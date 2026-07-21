/**
 * scripts/deep-trace.ts
 *
 * Deep-trace for 4 companies: 137 (Manor), 163 (Lovell), 218 (Canoports canceled), 220 (Canoports active).
 *
 * For each company: clone PROD → DEV, backfill financial_contributions, reselect.
 * Then print a 5-section report, clean up dev clone.
 *
 * READS:  PROD_DATABASE_URL  (never written to, host-fingerprint checked)
 * WRITES: DATABASE_URL       (dev heliumdb only, host-fingerprint checked)
 *
 * Run: npx tsx scripts/deep-trace.ts
 */

import pg from 'pg';
import crypto from 'crypto';
import { eq, and, asc, desc, inArray, isNull, ne } from 'drizzle-orm';
import { db, pool as devDrizzlePool } from '../server/db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  dealModelSellerPayments,
  dealModelContingentConsideration,
  documents,
  staffData,
  ebitdaAdjustments,
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import {
  calculateFullDealModel,
  calculateAdjustedEbitda,
  toNum,
  type AdjustmentInput,
  type FundingLineInput,
  type SellerPaymentInput,
  type ContingentConsiderationInput,
  type DealModelInput,
} from '../shared/calculators/deal-model.calc';
import { resolveSourceTier } from '../server/scripts/backfill-financial-contributions';

// ─── pg type parsers — keep JSON as raw strings for cross-DB clone ────────────
pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

const TARGET_TC_IDS = [137, 163, 218, 220];
const DEV_USER_ID         = 1;
const DEV_USER_COMPANY_ID = 5;

// ─── Formatting helpers ────────────────────────────────────────────────────────
const fmtGBP = (n: number | null | undefined) =>
  n == null ? 'n/a' : `£${Math.round(n).toLocaleString('en-GB')}`;
const parseCurrency = (v: unknown): number | null => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[£,\s]/g, ''));
  return isNaN(n) ? null : n;
};
const bar = (ch: string, n = 80) => ch.repeat(n);
const indent = (s: string, n = 4) => s.split('\n').map(l => ' '.repeat(n) + l).join('\n');

// ─── Safety guard ──────────────────────────────────────────────────────────────
async function assertHosts(): Promise<void> {
  const prodUrl = process.env.PROD_DATABASE_URL ?? '';
  const devUrl  = process.env.DATABASE_URL ?? '';
  console.log(bar('═'));
  console.log('SAFETY CHECK');
  console.log(`  PROD host: ${prodUrl.split('@')[1]?.split('/')[0] ?? '(parse error)'}`);
  if (!prodUrl.includes('ep-old-recipe'))
    throw new Error(`ABORT: PROD_DATABASE_URL does not contain expected fingerprint (ep-old-recipe).`);
  console.log('  PROD ✓ read-only');

  console.log(`  DEV  host: ${devUrl.split('@')[1]?.split('/')[0] ?? '(parse error)'}`);
  if (devUrl.includes('ep-old-recipe'))
    throw new Error(`ABORT: DATABASE_URL matches prod fingerprint. Writes refused.`);
  console.log('  DEV  ✓ writes permitted');

  const prodDb = (await prodPool.query('SELECT current_database() AS d')).rows[0].d;
  const devDb  = (await devPool.query('SELECT current_database() AS d')).rows[0].d;
  console.log(`  prod_db=${prodDb}  dev_db=${devDb}\n`);
}

// ─── Shared insert helper ──────────────────────────────────────────────────────
async function insertOne(client: pg.PoolClient, table: string, row: Record<string, unknown>): Promise<number> {
  const cols = Object.keys(row);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const res  = await client.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')}) RETURNING id`,
    cols.map(c => row[c]),
  );
  return (res.rows[0] as { id: number }).id;
}
function remapSoft(val: number | null | undefined, map: Map<number, number>): number | null {
  if (val == null) return null;
  return map.get(val) ?? null;
}
function remap(val: number | null | undefined, map: Map<number, number>): number {
  if (val == null) throw new Error('remap: null');
  const r = map.get(val);
  if (r === undefined) throw new Error(`remap: ID ${val} not found`);
  return r;
}
function safeJson(v: string | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') return JSON.stringify(v);
  try { JSON.parse(v); return v; } catch { return null; }
}

// ─── PROD DATA COLLECTORS ─────────────────────────────────────────────────────

interface PeriodRow {
  id: number;
  fiscalYear: number | null;
  periodEnd: string | null;
  periodType: string;       // 'statutory' | 'management' | ...
  isFullYear: boolean;
  sourceDocId: number | null;
  sourceFilename: string | null;
  docCategory: string | null;
  // income statement
  isRevenue: number | null;
  isOpProfit: number | null;
  isDA: number | null;
  isSourceDocId: number | null;
  isSourceFilename: string | null;
  // balance
  bsEquity: number | null;
  bsSourceDocId: number | null;
  bsSourceFilename: string | null;
}

/** All full-year periods on prod with their IS/BS data, keyed by fiscal_year */
async function getProdAllFullYearPeriods(tcId: number): Promise<Map<number, PeriodRow[]>> {
  // Periods + IS + BS in one go
  const { rows } = await prodPool.query(`
    SELECT
      fp.id, fp.fiscal_year, fp.period_end::text, fp.period_type,
      fp.is_full_year, fp.source_document_id AS period_doc_id,
      dp.original_filename AS period_filename, dp.document_category AS period_doc_cat,
      is_val.revenue::float AS is_revenue,
      is_val.operating_profit::float AS is_op_profit,
      is_val.depreciation_amortisation::float AS is_da,
      is_val.source_document_id AS is_source_doc_id,
      dis.original_filename AS is_source_filename,
      bs.total_equity::float AS bs_equity,
      bs.source_document_id AS bs_source_doc_id,
      dbs.original_filename AS bs_source_filename
    FROM financial_periods fp
    LEFT JOIN documents dp ON dp.id = fp.source_document_id
    LEFT JOIN income_statements is_val ON is_val.financial_period_id = fp.id
    LEFT JOIN documents dis ON dis.id = is_val.source_document_id
    LEFT JOIN balance_sheets bs ON bs.financial_period_id = fp.id
    LEFT JOIN documents dbs ON dbs.id = bs.source_document_id
    WHERE fp.target_company_id = $1 AND fp.is_full_year = true
    ORDER BY fp.fiscal_year ASC, fp.id ASC
  `, [tcId]);

  const result = new Map<number, PeriodRow[]>();
  for (const r of rows) {
    const fy = r.fiscal_year as number ?? 0;
    if (!result.has(fy)) result.set(fy, []);
    result.get(fy)!.push({
      id:                r.id,
      fiscalYear:        r.fiscal_year,
      periodEnd:         r.period_end,
      periodType:        r.period_type,
      isFullYear:        r.is_full_year,
      sourceDocId:       r.period_doc_id,
      sourceFilename:    r.period_filename,
      docCategory:       r.period_doc_cat,
      isRevenue:         r.is_revenue,
      isOpProfit:        r.is_op_profit,
      isDA:              r.is_da,
      isSourceDocId:     r.is_source_doc_id,
      isSourceFilename:  r.is_source_filename,
      bsEquity:          r.bs_equity,
      bsSourceDocId:     r.bs_source_doc_id,
      bsSourceFilename:  r.bs_source_filename,
    });
  }
  return result;
}

interface DevPeriodRow {
  id: number;
  fiscalYear: number | null;
  periodEnd: string | null;
  sourceTier: string | null;
  isFullYear: boolean;
  sourceDocId: number | null;
  sourceFilename: string | null;
  // income statement
  isRevenue: number | null;
  isOpProfit: number | null;
  isDA: number | null;
  isSourceDocId: number | null;
  isSourceFilename: string | null;
  // balance
  bsEquity: number | null;
  bsSourceDocId: number | null;
  bsSourceFilename: string | null;
}

/** All full-year periods on dev (post-reselect) with IS/BS data */
async function getDevAllFullYearPeriods(devTcId: number): Promise<Map<number, DevPeriodRow[]>> {
  const { rows } = await devPool.query(`
    SELECT
      fp.id, fp.fiscal_year, fp.period_end::text, fp.source_tier,
      fp.is_full_year, fp.source_document_id AS period_doc_id,
      dp.original_filename AS period_filename,
      is_val.revenue::float AS is_revenue,
      is_val.operating_profit::float AS is_op_profit,
      is_val.depreciation_amortisation::float AS is_da,
      is_val.source_document_id AS is_source_doc_id,
      dis.original_filename AS is_source_filename,
      bs.total_equity::float AS bs_equity,
      bs.source_document_id AS bs_source_doc_id,
      dbs.original_filename AS bs_source_filename
    FROM financial_periods fp
    LEFT JOIN documents dp ON dp.id = fp.source_document_id
    LEFT JOIN income_statements is_val ON is_val.financial_period_id = fp.id
    LEFT JOIN documents dis ON dis.id = is_val.source_document_id
    LEFT JOIN balance_sheets bs ON bs.financial_period_id = fp.id
    LEFT JOIN documents dbs ON dbs.id = bs.source_document_id
    WHERE fp.target_company_id = $1 AND fp.is_full_year = true
    ORDER BY fp.fiscal_year ASC, fp.id ASC
  `, [devTcId]);

  const result = new Map<number, DevPeriodRow[]>();
  for (const r of rows) {
    const fy = r.fiscal_year as number ?? 0;
    if (!result.has(fy)) result.set(fy, []);
    result.get(fy)!.push({
      id:               r.id,
      fiscalYear:       r.fiscal_year,
      periodEnd:        r.period_end,
      sourceTier:       r.source_tier,
      isFullYear:       r.is_full_year,
      sourceDocId:      r.period_doc_id,
      sourceFilename:   r.period_filename,
      isRevenue:        r.is_revenue,
      isOpProfit:       r.is_op_profit,
      isDA:             r.is_da,
      isSourceDocId:    r.is_source_doc_id,
      isSourceFilename: r.is_source_filename,
      bsEquity:         r.bs_equity,
      bsSourceDocId:    r.bs_source_doc_id,
      bsSourceFilename: r.bs_source_filename,
    });
  }
  return result;
}

/** Prod "current winner" per year: first by period_end DESC (excluding IM docs) */
function getProdCurrentWinner(periods: Map<number, PeriodRow[]>): Map<number, PeriodRow> {
  const result = new Map<number, PeriodRow>();
  for (const [fy, rows] of periods) {
    // Filter out IM (Deal Documents category)
    const eligible = rows.filter(r => r.docCategory !== 'Deal Documents');
    if (eligible.length === 0) continue;
    // Sort by period_end DESC (null last), take first
    const sorted = [...eligible].sort((a, b) => {
      if (!a.periodEnd && !b.periodEnd) return 0;
      if (!a.periodEnd) return 1;
      if (!b.periodEnd) return -1;
      return b.periodEnd.localeCompare(a.periodEnd);
    });
    result.set(fy, sorted[0]);
  }
  return result;
}

/** Dev "corrected winner" per year: non-IM period with IS data (post-reselect there's exactly one per year) */
function getDevCorrectedWinner(periods: Map<number, DevPeriodRow[]>): Map<number, DevPeriodRow> {
  const result = new Map<number, DevPeriodRow>();
  for (const [fy, rows] of periods) {
    // Filter out IM
    const eligible = rows.filter(r => r.sourceTier !== 'information_memorandum');
    if (eligible.length === 0) continue;
    // Post-reselect: only one non-IM period per year should survive with IS data
    // Take the one with IS data first, then fallback to any
    const withIS = eligible.filter(r => r.isOpProfit != null);
    result.set(fy, withIS.length > 0 ? withIS[0] : eligible[0]);
  }
  return result;
}

/** Build EbitdaByYear from a winner map (for use with deal model calc) */
function ebitdaFromWinners(winners: Map<number, PeriodRow> | Map<number, DevPeriodRow>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [fy, w] of winners) {
    const op = w.isOpProfit ?? 0;
    const da = w.isDA ?? 0;
    result[String(fy)] = op + da;
  }
  return result;
}

// ─── DEAL MODEL ────────────────────────────────────────────────────────────────

interface DealModelResult {
  modelId: number;
  name: string;
  averagingYears: number;
  multiple: number;
  yearsInWindow: string[];
  adjustedEbitdaByYear: Record<string, number>;
  avgAdjEbitda: number;
  enterpriseValue: number;
}

async function computeDevDealModel(devTcId: number, ebitdaByYear: Record<string, number>): Promise<DealModelResult | null> {
  const dms = await db.select().from(dealModels).where(eq(dealModels.targetCompanyId, devTcId)).orderBy(dealModels.id);
  if (dms.length === 0) return null;
  const dm = dms[0];

  const adjs = await db.select().from(dealModelAdjustments).where(eq(dealModelAdjustments.dealModelId, dm.id));
  const fls  = await db.select().from(dealModelFundingLines).where(eq(dealModelFundingLines.dealModelId, dm.id));
  const sps  = await db.select().from(dealModelSellerPayments).where(eq(dealModelSellerPayments.dealModelId, dm.id));
  const ccs  = await db.select().from(dealModelContingentConsideration).where(eq(dealModelContingentConsideration.dealModelId, dm.id));

  const adjustments: AdjustmentInput[] = adjs.map(a => ({
    adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
    amount: a.amount, amountsByYear: a.amountsByYear as Record<string, number> | null,
    status: a.status || 'suggested', userOverrideAmount: null,
  }));
  const fundingLines: FundingLineInput[] = fls
    .filter(f => f.fundingType !== 'seller_financing' && f.fundingType !== 'earnout')
    .map(f => ({
      fundingType: f.fundingType, assetBaseValue: f.assetBaseValue,
      ltvPercent: f.ltvPercent, amountUsed: f.amountUsed,
      interestRate: f.interestRate, termMonths: f.termMonths,
      arrangementFeePercent: f.arrangementFeePercent ?? null,
      isDebt: f.isDebt ?? false, repaymentStructure: f.repaymentStructure ?? 'amortizing',
      isActive: f.isActive ?? false,
    }));
  const sellerPayments: SellerPaymentInput[] = sps.map(s => ({
    amount: s.amount, termMonths: s.termMonths, interestRate: s.interestRate,
    includeInDscr: s.includeInDscr ?? true, isActive: s.isActive ?? false,
  }));
  const contingent: ContingentConsiderationInput[] = ccs.map(c => ({
    maximumAmount: c.maximumAmount, termMonths: c.termMonths,
    triggerDescription: c.triggerDescription, includeInDscr: c.includeInDscr ?? false,
    isActive: c.isActive ?? false,
  }));

  const modelInput: DealModelInput = {
    averagingYears: dm.averagingYears ?? 3, ebitdaMultiple: dm.ebitdaMultiple ?? '3.0',
    plusExcessCash: dm.plusExcessCash ?? '0', minusPrimaryDebt: dm.minusPrimaryDebt ?? '0',
    minusOtherDebt: dm.minusOtherDebt ?? '0', minusCorpTaxDue: dm.minusCorpTaxDue ?? '0',
    minusWorkingCapitalAdj: dm.minusWorkingCapitalAdj ?? '0',
    plusPropertyValue: dm.propertyValue ?? '0', otherAdjustments: null,
    feeLegalDdAmount: dm.feeLegalDdAmount ?? '0', feeAccountingDdAmount: dm.feeAccountingDdAmount ?? '0',
    feeLoanArrangementAmount: dm.feeLoanArrangementAmount ?? '0', feeDealMakerAmount: dm.feeDealMakerAmount ?? '0',
    customFees: (dm.customFees as Array<{ label: string; amount: string | number }>) ?? [],
  };

  const { adjustedEbitdaByYear, averageAdjustedEbitda } = calculateAdjustedEbitda(ebitdaByYear, adjustments, dm.averagingYears ?? 3);
  const calc = calculateFullDealModel(ebitdaByYear, adjustments, fundingLines, modelInput, sellerPayments, contingent);

  const sortedYearsDesc = Object.keys(adjustedEbitdaByYear).sort().reverse();
  const clampedN = Math.max(1, Math.min(dm.averagingYears ?? 3, sortedYearsDesc.length));
  const yearsInWindow = sortedYearsDesc.slice(0, clampedN);

  return {
    modelId: dm.id, name: dm.name ?? '(unnamed)',
    averagingYears: dm.averagingYears ?? 3,
    multiple: toNum(dm.ebitdaMultiple),
    yearsInWindow,
    adjustedEbitdaByYear,
    avgAdjEbitda: averageAdjustedEbitda,
    enterpriseValue: calc.enterpriseValue,
  };
}

// ─── CLONE (reuse from comms-analysis pattern) ────────────────────────────────

async function cloneCompany(prodTcId: number, companyName: string): Promise<{
  devTcId: number; docMap: Map<number, number>; periodMap: Map<number, number>;
}> {
  const devClient = await devPool.connect();
  try {
    await devClient.query('BEGIN');

    const { rows: [src] } = await prodPool.query('SELECT * FROM target_companies WHERE id = $1', [prodTcId]);
    const devTcId = await insertOne(devClient, 'target_companies', {
      user_company_id: DEV_USER_COMPANY_ID, company_name: `[DEEP-TRACE] ${companyName}`,
      industry: src.industry, sub_sector: src.sub_sector, website: src.website,
      phone: src.phone, email: src.email, address: src.address,
      annual_revenue: src.annual_revenue, employee_count: src.employee_count,
      year_established: src.year_established, description: src.description,
      stage: src.stage, is_archived: false, created_by: DEV_USER_ID,
    });

    // documents
    const { rows: prodDocs } = await prodPool.query('SELECT * FROM documents WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const docMap = new Map<number, number>();
    for (const d of prodDocs) {
      const id = await insertOne(devClient, 'documents', {
        target_company_id: devTcId, uploaded_by: DEV_USER_ID,
        document_name: d.document_name, original_filename: d.original_filename,
        file_path: d.file_path, file_size: d.file_size, file_type: d.file_type,
        document_category: d.document_category, secondary_category: d.secondary_category,
        description: d.description, is_confidential: d.is_confidential,
        public_token: crypto.randomBytes(32).toString('hex'),
      });
      docMap.set(d.id as number, id);
    }

    // financial_periods (source_tier derived from period_type — prod doesn't have source_tier)
    const { rows: prodPeriods } = await prodPool.query('SELECT * FROM financial_periods WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const periodMap = new Map<number, number>();
    for (const p of prodPeriods) {
      const derivedTier = p.period_type === 'statutory' ? 'statutory' : 'management';
      const id = await insertOne(devClient, 'financial_periods', {
        target_company_id: devTcId, period_type: p.period_type,
        period_start: p.period_start, period_end: p.period_end,
        fiscal_year: p.fiscal_year, period_label: p.period_label,
        months_covered: p.months_covered, is_full_year: p.is_full_year,
        source_tier: derivedTier,
        source_document_id: remapSoft(p.source_document_id as number, docMap),
      });
      periodMap.set(p.id as number, id);
    }

    // income_statements
    const { rows: prodIS } = await prodPool.query('SELECT * FROM income_statements WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodIS) {
      await insertOne(devClient, 'income_statements', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        revenue: r.revenue, cost_of_sales: r.cost_of_sales, gross_profit: r.gross_profit,
        administrative_expenses: r.administrative_expenses,
        depreciation_amortisation: r.depreciation_amortisation,
        other_operating_income: r.other_operating_income, operating_profit: r.operating_profit,
        interest_receivable: r.interest_receivable, interest_payable: r.interest_payable,
        profit_before_tax: r.profit_before_tax, corporation_tax: r.corporation_tax,
        net_profit: r.net_profit, staff_costs: r.staff_costs,
        directors_remuneration: r.directors_remuneration, dividends_paid: r.dividends_paid,
        revenue_breakdown: safeJson(r.revenue_breakdown), cost_of_sales_breakdown: safeJson(r.cost_of_sales_breakdown),
        overheads_breakdown: safeJson(r.overheads_breakdown), exceptional_items: safeJson(r.exceptional_items),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }

    // balance_sheets
    const { rows: prodBS } = await prodPool.query('SELECT * FROM balance_sheets WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodBS) {
      await insertOne(devClient, 'balance_sheets', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        intangible_assets: r.intangible_assets, tangible_fixed_assets: r.tangible_fixed_assets,
        freehold_property: r.freehold_property, leasehold_property: r.leasehold_property,
        plant_machinery: r.plant_machinery, fixtures_fittings: r.fixtures_fittings,
        motor_vehicles: r.motor_vehicles, computer_equipment: r.computer_equipment,
        stock_inventory: r.stock_inventory, trade_debtors: r.trade_debtors,
        prepayments: r.prepayments, amounts_owed_by_directors: r.amounts_owed_by_directors,
        amounts_owed_by_connected_companies: r.amounts_owed_by_connected_companies,
        directors_current_account: r.directors_current_account, other_debtors: r.other_debtors,
        cash_at_bank: r.cash_at_bank, total_current_assets: r.total_current_assets,
        trade_creditors: r.trade_creditors, taxation_social_security: r.taxation_social_security,
        vat_payable: r.vat_payable, corporation_tax_due: r.corporation_tax_due,
        bank_loans_overdraft_current: r.bank_loans_overdraft_current,
        hire_purchase_current: r.hire_purchase_current, accruals: r.accruals,
        amounts_owed_to_directors: r.amounts_owed_to_directors, other_creditors: r.other_creditors,
        total_current_liabilities: r.total_current_liabilities, bank_loans_long_term: r.bank_loans_long_term,
        hire_purchase_long_term: r.hire_purchase_long_term, deferred_taxation: r.deferred_taxation,
        other_long_term_debt: r.other_long_term_debt, total_long_term_liabilities: r.total_long_term_liabilities,
        share_capital: r.share_capital, retained_earnings: r.retained_earnings, total_equity: r.total_equity,
        debtors_list: safeJson(r.debtors_list), creditors_list: safeJson(r.creditors_list),
        fixed_assets_detail: safeJson(r.fixed_assets_detail),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }

    // staff_data
    const { rows: prodSD } = await prodPool.query('SELECT * FROM staff_data WHERE target_company_id = $1 ORDER BY id', [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodSD) {
      await insertOne(devClient, 'staff_data', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        total_headcount: r.total_headcount, total_staff_costs: r.total_staff_costs,
        total_gross_salaries: r.total_gross_salaries, total_employer_ni: r.total_employer_ni,
        total_employer_pension: r.total_employer_pension, director_count: r.director_count,
        director_remuneration: r.director_remuneration, working_director_count: r.working_director_count,
        non_working_director_count: r.non_working_director_count, employee_count: r.employee_count,
        employee_costs: r.employee_costs, staff_records: safeJson(r.staff_records),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }

    // ebitda_adjustments
    const { rows: prodEA } = await prodPool.query('SELECT * FROM ebitda_adjustments WHERE target_company_id = $1 ORDER BY id', [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodEA) {
      await insertOne(devClient, 'ebitda_adjustments', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId, description: r.description,
        amount: r.amount, category: r.category, notes: r.notes, created_by: DEV_USER_ID,
      });
    }

    // deal_models
    const { rows: prodDMs } = await prodPool.query('SELECT * FROM deal_models WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const dmMap = new Map<number, number>();
    for (const r of prodDMs) {
      const id = await insertOne(devClient, 'deal_models', {
        target_company_id: devTcId, created_by: DEV_USER_ID,
        name: r.name, status: r.status, version: r.version,
        transaction_type: r.transaction_type, parent_model_id: null, is_locked: r.is_locked,
        averaging_years: r.averaging_years, ebitda_multiple: r.ebitda_multiple,
        multiple_low: r.multiple_low, multiple_high: r.multiple_high,
        property_value: r.property_value, cash_value: r.cash_value, other_assets: r.other_assets,
        calculated_ebitda: r.calculated_ebitda, adjusted_ebitda: r.adjusted_ebitda,
        enterprise_value: r.enterprise_value,
        plus_excess_cash: r.plus_excess_cash, minus_primary_debt: r.minus_primary_debt,
        minus_other_debt: r.minus_other_debt, minus_corp_tax_due: r.minus_corp_tax_due,
        minus_working_capital_adj: r.minus_working_capital_adj,
        working_capital_months: r.working_capital_months,
        working_capital_monthly_amount: r.working_capital_monthly_amount,
        total_purchase_price: r.total_purchase_price, total_funding_available: r.total_funding_available,
        equity_required: r.equity_required, upfront_cash: r.upfront_cash,
        deferred_amount: r.deferred_amount, deferred_terms: r.deferred_terms,
        earnout_maximum: r.earnout_maximum, earnout_metric: r.earnout_metric,
        earnout_period_months: r.earnout_period_months, retention_escrow: r.retention_escrow,
        fee_legal_dd_amount: r.fee_legal_dd_amount, fee_accounting_dd_amount: r.fee_accounting_dd_amount,
        fee_loan_arrangement_amount: r.fee_loan_arrangement_amount, fee_deal_maker_amount: r.fee_deal_maker_amount,
        custom_fees: safeJson(r.custom_fees), expert_data_snapshot: safeJson(r.expert_data_snapshot),
        financial_data_snapshot: safeJson(r.financial_data_snapshot), notes: r.notes,
      });
      dmMap.set(r.id as number, id);
    }

    // deal_model_adjustments
    const { rows: prodDMA } = await prodPool.query(`SELECT dma.* FROM deal_model_adjustments dma JOIN deal_models dm ON dm.id = dma.deal_model_id WHERE dm.target_company_id = $1 ORDER BY dma.id`, [prodTcId]);
    for (const r of prodDMA) {
      await insertOne(devClient, 'deal_model_adjustments', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        source_expert_result_id: null, adjustment_type: r.adjustment_type,
        category: r.category, description: r.description, amount: r.amount,
        amounts_by_year: safeJson(r.amounts_by_year), source_expert: r.source_expert,
        reasoning: r.reasoning, confidence: r.confidence,
        defensibility_score: r.defensibility_score, case_for_inclusion: r.case_for_inclusion,
        case_for_exclusion: r.case_for_exclusion, status: r.status,
        is_accepted: r.is_accepted, is_manual: r.is_manual, sort_order: r.sort_order,
      });
    }

    // deal_model_funding_lines
    const { rows: prodFLs } = await prodPool.query(`SELECT fl.* FROM deal_model_funding_lines fl JOIN deal_models dm ON dm.id = fl.deal_model_id WHERE dm.target_company_id = $1 ORDER BY fl.id`, [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodFLs) {
      await insertOne(devClient, 'deal_model_funding_lines', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        funding_type: r.funding_type, label: r.label,
        asset_base_value: r.asset_base_value, ltv_percent: r.ltv_percent,
        available_amount: r.available_amount, amount_used: r.amount_used,
        interest_rate: r.interest_rate, arrangement_fee_percent: r.arrangement_fee_percent,
        term_months: r.term_months, monthly_repayment: r.monthly_repayment,
        is_debt: r.is_debt, repayment_structure: r.repayment_structure,
        is_active: r.is_active, notes: r.notes, sort_order: r.sort_order,
      });
    }

    // deal_model_seller_payments
    const { rows: prodSPs } = await prodPool.query(`SELECT sp.* FROM deal_model_seller_payments sp JOIN deal_models dm ON dm.id = sp.deal_model_id WHERE dm.target_company_id = $1 ORDER BY sp.id`, [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodSPs) {
      await insertOne(devClient, 'deal_model_seller_payments', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        payment_type: r.payment_type, amount: r.amount,
        term_months: r.term_months, interest_rate: r.interest_rate,
        label: r.label, include_in_dscr: r.include_in_dscr,
        is_active: r.is_active, sort_order: r.sort_order,
      });
    }

    // deal_model_contingent_consideration
    const { rows: prodCCs } = await prodPool.query(`SELECT cc.* FROM deal_model_contingent_consideration cc JOIN deal_models dm ON dm.id = cc.deal_model_id WHERE dm.target_company_id = $1 ORDER BY cc.id`, [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodCCs) {
      await insertOne(devClient, 'deal_model_contingent_consideration', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        consideration_type: r.consideration_type, maximum_amount: r.maximum_amount,
        term_months: r.term_months, trigger_description: r.trigger_description,
        include_in_dscr: r.include_in_dscr, is_active: r.is_active, sort_order: r.sort_order,
      });
    }

    await devClient.query('COMMIT');
    return { devTcId, docMap, periodMap };
  } catch (e) {
    await devClient.query('ROLLBACK');
    throw e;
  } finally {
    devClient.release();
  }
}

// ─── BACKFILL ──────────────────────────────────────────────────────────────────
async function backfillContributions(devTcId: number): Promise<void> {
  await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, devTcId));
  const incRows = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
  for (const row of incRows) {
    const [period] = await db.select({ fiscalYear: financialPeriods.fiscalYear, periodType: financialPeriods.periodType, isFullYear: financialPeriods.isFullYear, monthsCovered: financialPeriods.monthsCovered, periodEnd: financialPeriods.periodEnd }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));
    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory }).from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }
    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId, fiscalYear: period?.fiscalYear ?? null,
      statementType: 'income', sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier, isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null, periodEnd: period?.periodEnd ?? null,
      asAtDate: null,
      figures: {
        revenue: row.revenue, costOfSales: row.costOfSales, grossProfit: row.grossProfit,
        administrativeExpenses: row.administrativeExpenses, depreciationAmortisation: row.depreciationAmortisation,
        otherOperatingIncome: row.otherOperatingIncome, operatingProfit: row.operatingProfit,
        interestReceivable: row.interestReceivable, interestPayable: row.interestPayable,
        profitBeforeTax: row.profitBeforeTax, corporationTax: row.corporationTax,
        netProfit: row.netProfit, staffCosts: row.staffCosts,
        directorsRemuneration: row.directorsRemuneration, dividendsPaid: row.dividendsPaid,
        revenueBreakdown: row.revenueBreakdown, costOfSalesBreakdown: row.costOfSalesBreakdown,
        overheadsBreakdown: row.overheadsBreakdown, exceptionalItems: row.exceptionalItems,
      },
    });
  }
  const balRows = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));
  for (const row of balRows) {
    const [period] = await db.select({ fiscalYear: financialPeriods.fiscalYear, periodType: financialPeriods.periodType, isFullYear: financialPeriods.isFullYear, monthsCovered: financialPeriods.monthsCovered, periodEnd: financialPeriods.periodEnd }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));
    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory }).from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }
    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId, fiscalYear: period?.fiscalYear ?? null,
      statementType: 'balance', sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier, isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null, periodEnd: period?.periodEnd ?? null,
      asAtDate: period?.periodEnd ?? null,
      figures: {
        intangibleAssets: row.intangibleAssets, tangibleFixedAssets: row.tangibleFixedAssets,
        freeholdProperty: row.freeholdProperty, leaseholdProperty: row.leaseholdProperty,
        plantMachinery: row.plantMachinery, fixturesFittings: row.fixturesFittings,
        motorVehicles: row.motorVehicles, computerEquipment: row.computerEquipment,
        stockInventory: row.stockInventory, tradeDebtors: row.tradeDebtors,
        prepayments: row.prepayments, amountsOwedByDirectors: row.amountsOwedByDirectors,
        amountsOwedByConnectedCompanies: row.amountsOwedByConnectedCompanies,
        directorsCurrentAccount: row.directorsCurrentAccount, otherDebtors: row.otherDebtors,
        cashAtBank: row.cashAtBank, totalCurrentAssets: row.totalCurrentAssets,
        tradeCreditors: row.tradeCreditors, taxationSocialSecurity: row.taxationSocialSecurity,
        vatPayable: row.vatPayable, corporationTaxDue: row.corporationTaxDue,
        bankLoansOverdraftCurrent: row.bankLoansOverdraftCurrent, hirePurchaseCurrent: row.hirePurchaseCurrent,
        accruals: row.accruals, amountsOwedToDirectors: row.amountsOwedToDirectors,
        otherCreditors: row.otherCreditors, totalCurrentLiabilities: row.totalCurrentLiabilities,
        bankLoansLongTerm: row.bankLoansLongTerm, hirePurchaseLongTerm: row.hirePurchaseLongTerm,
        deferredTaxation: row.deferredTaxation, otherLongTermDebt: row.otherLongTermDebt,
        totalLongTermLiabilities: row.totalLongTermLiabilities, shareCapital: row.shareCapital,
        retainedEarnings: row.retainedEarnings, totalEquity: row.totalEquity,
        debtorsList: row.debtorsList, creditorsList: row.creditorsList, fixedAssetsDetail: row.fixedAssetsDetail,
      },
    });
  }
}

// ─── CLEANUP ───────────────────────────────────────────────────────────────────
async function cleanupDevClone(devTcId: number): Promise<void> {
  const c = await devPool.connect();
  try {
    await c.query('DELETE FROM financial_contributions WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM ebitda_adjustments WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM staff_data WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM income_statements WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM balance_sheets WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM financial_periods WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM deal_model_contingent_consideration WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_model_seller_payments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_model_funding_lines WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_model_adjustments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_models WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM documents WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM target_companies WHERE id = $1', [devTcId]);
  } finally { c.release(); }
}

// ─── ISSUED OFFERS ─────────────────────────────────────────────────────────────
async function getIssuedOffers(prodTcId: number): Promise<Array<{
  id: number; docType: string; status: string; sentAt: string | null;
  frozenEV: number | null; frozenOffer: number | null;
  rawData: Record<string, unknown> | null;
}>> {
  const { rows } = await prodPool.query(`
    SELECT id, document_type, status, sent_at, document_data
    FROM deal_documents
    WHERE target_company_id = $1
      AND document_type IN ('offer_letter','heads_of_terms')
    ORDER BY id
  `, [prodTcId]);

  const { rows: cos } = await prodPool.query(`
    SELECT id, enterprise_value, offer_price, sent_at
    FROM current_offers WHERE target_company_id = $1 ORDER BY id
  `, [prodTcId]).catch(() => ({ rows: [] }));

  const results = [];
  for (const r of rows) {
    let data: Record<string, unknown> | null = null;
    if (r.document_data) {
      try { data = typeof r.document_data === 'string' ? JSON.parse(r.document_data) : r.document_data; } catch { /**/ }
    }
    results.push({
      id: r.id as number, docType: r.document_type as string, status: r.status as string,
      sentAt: r.sent_at ? String(r.sent_at) : null,
      frozenEV:    parseCurrency(data?.enterpriseValue),
      frozenOffer: parseCurrency(data?.offerPrice),
      rawData:     data,
    });
  }
  for (const r of cos) {
    const ev    = parseCurrency(r.enterprise_value);
    const offer = parseCurrency(r.offer_price);
    if (ev != null || offer != null) {
      results.push({
        id: r.id as number, docType: 'current_offer', status: 'issued',
        sentAt: r.sent_at ? String(r.sent_at) : null,
        frozenEV: ev, frozenOffer: offer, rawData: null,
      });
    }
  }
  return results;
}

// ─── REPORT PRINTER ───────────────────────────────────────────────────────────

function printYearRow(
  label: string,
  fy: number,
  tier: string | null,
  filename: string | null,
  sourceDocId: number | null,
  revenue: number | null,
  opProfit: number | null,
  da: number | null,
  equity: number | null,
  note = '',
) {
  const ebitda = opProfit != null && da != null ? opProfit + da : opProfit != null ? opProfit : null;
  console.log(`  ${label.padEnd(12)} FY${fy}`);
  console.log(`      tier=${String(tier ?? 'n/a').padEnd(22)} doc_id=${String(sourceDocId ?? 'n/a').padEnd(6)} file="${filename ?? '(no doc)'}"`);
  console.log(`      revenue=${fmtGBP(revenue).padStart(14)}  op_profit=${fmtGBP(opProfit).padStart(14)}  D&A=${fmtGBP(da).padStart(12)}  EBITDA=${fmtGBP(ebitda).padStart(14)}  equity=${fmtGBP(equity).padStart(14)}${note ? '  ← '+note : ''}`);
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function processCompany(prodTcId: number): Promise<void> {
  // Get company name
  const { rows: [tc] } = await prodPool.query('SELECT company_name FROM target_companies WHERE id = $1', [prodTcId]);
  const companyName = tc?.company_name ?? `tc=${prodTcId}`;

  console.log('\n');
  console.log(bar('═'));
  console.log(`COMPANY: "${companyName}"  (prod tc=${prodTcId})`);
  console.log(bar('═'));

  // ── Collect PROD data ───────────────────────────────────────────────────────
  const prodPeriods    = await getProdAllFullYearPeriods(prodTcId);
  const prodWinners    = getProdCurrentWinner(prodPeriods);
  const prodEbitda     = ebitdaFromWinners(prodWinners);
  const issuedOffers   = await getIssuedOffers(prodTcId);

  // Get prod deal model config (for averaging_years + multiple — use first model)
  const { rows: prodDMs } = await prodPool.query('SELECT * FROM deal_models WHERE target_company_id = $1 ORDER BY id LIMIT 1', [prodTcId]);
  const prodDM = prodDMs[0] ?? null;

  // ── Clone → backfill → reselect ─────────────────────────────────────────────
  console.log(`\nCloning prod tc=${prodTcId} → dev...`);
  const { devTcId } = await cloneCompany(prodTcId, companyName);
  console.log(`  dev tc=${devTcId}`);

  process.stdout.write(`  Backfilling contributions...`);
  await backfillContributions(devTcId);
  process.stdout.write(` done\n`);

  process.stdout.write(`  Reselecting...`);
  await reselect(devTcId);
  process.stdout.write(` done\n`);

  // ── Collect DEV data ────────────────────────────────────────────────────────
  const devPeriods  = await getDevAllFullYearPeriods(devTcId);
  const devWinners  = getDevCorrectedWinner(devPeriods);
  const devEbitda   = ebitdaFromWinners(devWinners);

  // ── Compute deal models ─────────────────────────────────────────────────────
  // PRE: use prod ebitda with dev model config (same config, different input)
  const preModel  = await computeDevDealModel(devTcId, prodEbitda);
  // POST: use corrected ebitda with dev model config
  const postModel = await computeDevDealModel(devTcId, devEbitda);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 0 — ALL FULL-YEAR PERIODS ON PROD (BUG EXPOSURE)
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${bar('─')}`);
  console.log(`SECTION 0 — ALL FULL-YEAR PERIODS ON PROD (duplicate/conflict exposure)`);
  console.log(bar('─'));
  const allFYs = [...prodPeriods.keys()].sort((a, b) => a - b);
  for (const fy of allFYs) {
    const rows = prodPeriods.get(fy)!;
    const winner = prodWinners.get(fy);
    const hasBug = rows.length > 1;
    const hasMgmtStatConflict = rows.length > 1 &&
      rows.some(r => r.periodType === 'statutory') &&
      rows.some(r => r.periodType !== 'statutory');
    const isForecast = fy > 2026;

    let bugLabel = '';
    if (isForecast)           bugLabel += ' 🔴 FORECAST>2026';
    if (hasBug && hasMgmtStatConflict) bugLabel += ' 🟠 MGMT∧STAT';
    else if (hasBug)          bugLabel += ' 🟡 DUPLICATE';

    console.log(`\n  FY${fy}${bugLabel}  (${rows.length} period${rows.length > 1 ? 's' : ''})`);
    for (const r of rows) {
      const isWinner = r.id === winner?.id;
      const marker   = isWinner ? '  ★ CURRENT WINNER' : '    (loser)       ';
      const ebitda   = (r.isOpProfit ?? 0) + (r.isDA ?? 0);
      console.log(`    ${marker}  period_id=${r.id}  type=${r.periodType.padEnd(12)}  period_end=${r.periodEnd ?? 'null'}  doc_id=${r.sourceDocId ?? 'null'}  "${r.sourceFilename ?? 'no doc'}"`);
      console.log(`               EBITDA=${fmtGBP(ebitda)}  (op=${fmtGBP(r.isOpProfit)} + DA=${fmtGBP(r.isDA)})  equity=${fmtGBP(r.bsEquity)}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — PER-YEAR SIDE-BY-SIDE: CURRENT vs CORRECTED
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${bar('─')}`);
  console.log(`SECTION 1 — PER-YEAR WINNER: CURRENT (prod) vs CORRECTED (dev post-reselect)`);
  console.log(bar('─'));

  const allYears = new Set([...prodWinners.keys(), ...devWinners.keys()]);
  for (const fy of [...allYears].sort((a, b) => a - b)) {
    const cur  = prodWinners.get(fy);
    const corr = devWinners.get(fy);
    const curEbitda  = cur  ? (cur.isOpProfit ?? 0)  + (cur.isDA ?? 0)  : null;
    const corrEbitda = corr ? (corr.isOpProfit ?? 0) + (corr.isDA ?? 0) : null;

    const changed = cur == null || corr == null ||
      curEbitda !== corrEbitda || cur.isSourceFilename !== corr.isSourceFilename;
    const changeMarker = changed ? '  ⬅ CHANGED' : '';

    console.log(`\n  ── FY${fy}${changeMarker} ──`);

    if (cur) {
      printYearRow('CURRENT', fy, cur.periodType, cur.isSourceFilename ?? cur.sourceFilename, cur.isSourceDocId ?? cur.sourceDocId,
        cur.isRevenue, cur.isOpProfit, cur.isDA, cur.bsEquity);
    } else {
      console.log(`  CURRENT      FY${fy}  (no winner — not in prod EBITDA)`);
    }
    if (corr) {
      printYearRow('CORRECTED', fy, corr.sourceTier, corr.isSourceFilename ?? corr.sourceFilename, corr.isSourceDocId ?? corr.sourceDocId,
        corr.isRevenue, corr.isOpProfit, corr.isDA, corr.bsEquity);
    } else {
      console.log(`  CORRECTED    FY${fy}  (NO WINNER — year removed after reselect)`);
    }

    // Explain the change
    if (cur && corr && changed) {
      const ebitdaDelta = (corrEbitda ?? 0) - (curEbitda ?? 0);
      if (cur.isSourceFilename !== corr.isSourceFilename && cur.isSourceFilename != null && corr.isSourceFilename != null) {
        console.log(`    CHANGE: doc switched "${cur.isSourceFilename}" (${cur.periodType}) → "${corr.isSourceFilename}" (${corr.sourceTier})`);
      }
      if (ebitdaDelta !== 0) {
        console.log(`    CHANGE: EBITDA ${ebitdaDelta > 0 ? '↑' : '↓'} ${fmtGBP(Math.abs(ebitdaDelta))}  (${fmtGBP(curEbitda)} → ${fmtGBP(corrEbitda)})`);
      }
    } else if (!cur && corr) {
      console.log(`    CHANGE: year ADDED by reselect (was hidden/orphaned on prod)`);
    } else if (cur && !corr) {
      console.log(`    CHANGE: year REMOVED by reselect (was duplicate/forecast)`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — FORECAST / IM LEAK CHECK
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${bar('─')}`);
  console.log(`SECTION 2 — FORECAST / IM LEAK CHECK (corrected state)`);
  console.log(bar('─'));

  // Forecast years in corrected EBITDA
  const forecastInCorrected = [...devWinners.keys()].filter(fy => fy > 2026);
  if (forecastInCorrected.length === 0) {
    console.log('  ✓ Zero forecast years (>2026) in corrected reported EBITDA');
  } else {
    console.log(`  🔴 FORECAST YEARS STILL PRESENT IN CORRECTED EBITDA:`);
    for (const fy of forecastInCorrected) {
      const w = devWinners.get(fy)!;
      const ebitda = (w.isOpProfit ?? 0) + (w.isDA ?? 0);
      console.log(`     FY${fy}: EBITDA=${fmtGBP(ebitda)}  tier=${w.sourceTier}  doc="${w.isSourceFilename ?? w.sourceFilename ?? 'n/a'}"`);
    }
  }

  // IM-tier figures in corrected EBITDA
  const imInCorrected = [...devWinners.entries()].filter(([, w]) => w.sourceTier === 'information_memorandum');
  if (imInCorrected.length === 0) {
    console.log('  ✓ Zero IM-tier figures in corrected reported EBITDA');
  } else {
    console.log(`  🔴 IM-TIER FIGURES IN CORRECTED EBITDA:`);
    for (const [fy, w] of imInCorrected) {
      const ebitda = (w.isOpProfit ?? 0) + (w.isDA ?? 0);
      console.log(`     FY${fy}: EBITDA=${fmtGBP(ebitda)}  doc="${w.isSourceFilename ?? w.sourceFilename ?? 'n/a'}"`);
    }
  }

  // All dev periods with forecast year (even if not in winner set) — paranoia check
  const { rows: allForecastPeriods } = await devPool.query(`
    SELECT fp.id, fp.fiscal_year, fp.source_tier, fp.is_full_year,
           is_val.operating_profit::float AS op, is_val.depreciation_amortisation::float AS da
    FROM financial_periods fp
    LEFT JOIN income_statements is_val ON is_val.financial_period_id = fp.id
    WHERE fp.target_company_id = $1 AND fp.fiscal_year > 2026
    ORDER BY fp.fiscal_year, fp.id
  `, [devTcId]);
  if (allForecastPeriods.length > 0) {
    console.log(`\n  Forecast periods on dev (any is_full_year):`);
    for (const r of allForecastPeriods) {
      const ebitda = (r.op ?? 0) + (r.da ?? 0);
      console.log(`    fp_id=${r.id}  FY${r.fiscal_year}  is_full_year=${r.is_full_year}  tier=${r.source_tier}  EBITDA=${fmtGBP(ebitda)}`);
    }
  } else {
    console.log('  ✓ No forecast-year periods remain on dev at all');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — DEAL MODEL / VALUATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${bar('─')}`);
  console.log(`SECTION 3 — DEAL MODEL / VALUATION`);
  console.log(bar('─'));

  if (!preModel && !postModel) {
    console.log('  (no deal model configured)');
  } else {
    const avY = preModel?.averagingYears ?? postModel?.averagingYears ?? 3;
    const mult = preModel?.multiple ?? postModel?.multiple ?? 0;
    console.log(`  averagingYears=${avY}  multiple=${mult}×`);

    if (preModel) {
      console.log(`\n  PRE (using current/buggy EBITDA input):`);
      console.log(`    Years in window: [${preModel.yearsInWindow.join(', ')}]`);
      console.log(`    Adjusted EBITDA by year:`);
      for (const y of Object.keys(preModel.adjustedEbitdaByYear).sort()) {
        const inWindow = preModel.yearsInWindow.includes(y);
        console.log(`      FY${y}: ${fmtGBP(preModel.adjustedEbitdaByYear[y]).padStart(14)}  ${inWindow ? '← IN WINDOW' : '(outside window)'}`);
      }
      console.log(`    avgAdjEBITDA = ${fmtGBP(preModel.avgAdjEbitda)}  →  EV = ${fmtGBP(preModel.enterpriseValue)}`);
    } else {
      console.log(`  PRE: (no model)`);
    }

    if (postModel) {
      console.log(`\n  POST (using corrected EBITDA input):`);
      console.log(`    Years in window: [${postModel.yearsInWindow.join(', ')}]`);
      console.log(`    Adjusted EBITDA by year:`);
      for (const y of Object.keys(postModel.adjustedEbitdaByYear).sort()) {
        const inWindow = postModel.yearsInWindow.includes(y);
        console.log(`      FY${y}: ${fmtGBP(postModel.adjustedEbitdaByYear[y]).padStart(14)}  ${inWindow ? '← IN WINDOW' : '(outside window)'}`);
      }
      console.log(`    avgAdjEBITDA = ${fmtGBP(postModel.avgAdjEbitda)}  →  EV = ${fmtGBP(postModel.enterpriseValue)}`);
    } else {
      console.log(`  POST: (no model)`);
    }

    if (preModel && postModel) {
      const evDelta = postModel.enterpriseValue - preModel.enterpriseValue;
      const avgDelta = postModel.avgAdjEbitda - preModel.avgAdjEbitda;
      console.log(`\n  Δ  avgAdjEBITDA = ${evDelta >= 0 ? '+' : ''}${fmtGBP(avgDelta)}   EV = ${evDelta >= 0 ? '+' : ''}${fmtGBP(evDelta)}`);
      if (JSON.stringify(preModel.yearsInWindow) !== JSON.stringify(postModel.yearsInWindow)) {
        console.log(`  ⚠ Window changed: [${preModel.yearsInWindow.join(',')}] → [${postModel.yearsInWindow.join(',')}]`);
      } else {
        console.log(`  Window unchanged: [${preModel.yearsInWindow.join(',')}]`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — ISSUED OFFERS (163 and 220 only)
  // ════════════════════════════════════════════════════════════════════════════
  if ([163, 220].includes(prodTcId)) {
    console.log(`\n${bar('─')}`);
    console.log(`SECTION 4 — ISSUED OFFERS`);
    console.log(bar('─'));
    if (issuedOffers.length === 0) {
      console.log('  (none found)');
    }
    for (const offer of issuedOffers) {
      console.log(`\n  doc_id=${offer.id}  type=${offer.docType}  status=${offer.status}  sent=${offer.sentAt ?? 'n/a'}`);
      console.log(`    frozen EV    = ${fmtGBP(offer.frozenEV)}`);
      console.log(`    frozen offer = ${fmtGBP(offer.frozenOffer)}`);
      console.log(`    corrected EV = ${fmtGBP(postModel?.enterpriseValue)}`);
      const evDiff = offer.frozenEV != null && postModel ? offer.frozenEV - postModel.enterpriseValue : null;
      if (evDiff != null) {
        console.log(`    EV delta     = ${fmtGBP(evDiff)}  (frozen ${evDiff > 0 ? 'HIGHER' : 'LOWER'} than corrected)`);
      }

      if (offer.rawData) {
        // Show key fields from document_data
        const d = offer.rawData;
        const importantKeys = ['ebitdaMultiple', 'averagingYears', 'propertyValue', 'excessCash',
          'primaryDebt', 'otherDebt', 'corpTaxDue', 'workingCapitalAdj'];
        console.log(`    document_data fields:`);
        for (const k of importantKeys) {
          if (d[k] != null) console.log(`      ${k}: ${d[k]}`);
        }
        // Show _raw if it contains per-year EBITDA
        if (d._raw) {
          let raw: Record<string, unknown> = {};
          try { raw = typeof d._raw === 'string' ? JSON.parse(d._raw as string) : d._raw as Record<string, unknown>; } catch { /**/ }
          // Look for ebitda-by-year or reportedEbitdaByYear
          for (const k of Object.keys(raw)) {
            if (/ebitda|year|revenue|profit/i.test(k)) {
              const v = raw[k];
              console.log(`      _raw.${k}: ${JSON.stringify(v)?.substring(0, 200)}`);
            }
          }
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — PLAIN-ENGLISH EXPLANATION
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${bar('─')}`);
  console.log(`SECTION 5 — PLAIN-ENGLISH EXPLANATION`);
  console.log(bar('─'));

  // Derive the explanation from the data
  const addedYears   = [...devWinners.keys()].filter(fy => !prodWinners.has(fy));
  const removedYears = [...prodWinners.keys()].filter(fy => !devWinners.has(fy));
  const changedYears = [...allYears].filter(fy => {
    const cur  = prodWinners.get(fy);
    const corr = devWinners.get(fy);
    if (!cur || !corr) return false;
    const curE  = (cur.isOpProfit ?? 0) + (cur.isDA ?? 0);
    const corrE = (corr.isOpProfit ?? 0) + (corr.isDA ?? 0);
    return Math.abs(curE - corrE) >= 1;
  });

  const lines: string[] = [];

  // Forecast year contamination
  const forecastOnProd = [...prodWinners.keys()].filter(fy => fy > 2026);
  if (forecastOnProd.length > 0) {
    lines.push(`FORECAST CONTAMINATION: Prod has ${forecastOnProd.length} fiscal year(s) > 2026 — ` +
      forecastOnProd.map(fy => {
        const w = prodWinners.get(fy)!;
        return `FY${fy} (EBITDA ${fmtGBP((w.isOpProfit ?? 0) + (w.isDA ?? 0))}, doc "${w.isSourceFilename ?? 'n/a'}")`;
      }).join(', ') + `. These were fed into the averaging window, inflating/deflating the EV because ` +
      `year ordering sort().reverse() put them at the TOP of the window.`
    );
  }

  // Management-overrides-statutory
  const mgmtOverStatYears: number[] = [];
  for (const [fy, rows] of prodPeriods) {
    if (rows.some(r => r.periodType === 'statutory') && rows.some(r => r.periodType !== 'statutory')) {
      const winner = prodWinners.get(fy);
      if (winner && winner.periodType !== 'statutory') {
        mgmtOverStatYears.push(fy);
      }
    }
  }
  if (mgmtOverStatYears.length > 0) {
    lines.push(`MANAGEMENT OVERRIDING STATUTORY: For FY[${mgmtOverStatYears.join(', ')}], the prod current-winner was a ` +
      `management-type period even though a statutory period also existed for the same year. ` +
      `This happened because period_end ordering was used as the tie-break instead of tier rank. ` +
      `After reselect, statutory correctly beats management.`
    );
  }

  // Duplicate periods (same type)
  const dupYears: number[] = [];
  for (const [fy, rows] of prodPeriods) {
    const types = rows.map(r => r.periodType);
    const hasDup = new Set(types).size < types.length;
    if (hasDup) dupYears.push(fy);
  }
  if (dupYears.length > 0) {
    lines.push(`DUPLICATE PERIODS: FY[${dupYears.join(', ')}] had multiple periods of the same type. ` +
      `This occurs when a document upload creates a new period for a year that already had one. ` +
      `Reselect picks the single best contribution and re-points the income statement to a canonical period.`
    );
  }

  // Years added/removed
  if (addedYears.length > 0) {
    lines.push(`YEARS ADDED by reselect: FY[${addedYears.join(', ')}]. These years existed on prod ` +
      `but were invisible to the EBITDA query because they were only in documents ` +
      `that were classified as IM or in orphaned periods. After reselect, they are surfaced.`
    );
  }
  if (removedYears.length > 0) {
    lines.push(`YEARS REMOVED by reselect: FY[${removedYears.join(', ')}]. These years are removed ` +
      `from the EBITDA series because their periods are pruned (they were ghost duplicates ` +
      `with no surviving income statement, or forecast years).`
    );
  }

  // EV impact
  if (preModel && postModel) {
    const evDelta = postModel.enterpriseValue - preModel.enterpriseValue;
    const windowChanged = JSON.stringify(preModel.yearsInWindow) !== JSON.stringify(postModel.yearsInWindow);
    if (Math.abs(evDelta) < 1) {
      lines.push(`EV IMPACT: The enterprise value is unchanged at ${fmtGBP(postModel.enterpriseValue)}. ` +
        `The data changes cancel out OR the affected years fall outside the averaging window.`
      );
    } else {
      lines.push(`EV IMPACT: ${evDelta > 0 ? 'INCREASE' : 'DECREASE'} of ${fmtGBP(Math.abs(evDelta))} ` +
        `(${fmtGBP(preModel.enterpriseValue)} → ${fmtGBP(postModel.enterpriseValue)}). ` +
        (windowChanged
          ? `The averaging window changed from [${preModel.yearsInWindow.join(',')}] to [${postModel.yearsInWindow.join(',')}], ` +
            `which is the primary driver.`
          : `The averaging window stayed at [${preModel.yearsInWindow.join(',')}]; ` +
            `the delta comes purely from figures changing within those years.`
        )
      );
    }
  }

  if (lines.length === 0) lines.push('No specific bugs identified in this company\'s data.');
  for (const line of lines) {
    console.log(`\n  • ${line}`);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  console.log(`\n  Cleaning up dev tc=${devTcId}...`);
  await cleanupDevClone(devTcId);
  console.log(`  Done.`);
}

async function main(): Promise<void> {
  await assertHosts();

  for (const tcId of TARGET_TC_IDS) {
    await processCompany(tcId);
  }

  console.log('\n\n' + bar('═'));
  console.log('ALL COMPANIES PROCESSED.');
  console.log(bar('═'));
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1); })
  .finally(async () => {
    await prodPool.end();
    await devPool.end();
    await devDrizzlePool.end();
  });
