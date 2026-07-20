/**
 * Part B — Fresh clone prod 119 → new dev company, TRUE PRE / POST diff.
 *
 * READS:  PROD_DATABASE_URL (prod, read-only)
 * WRITES: DATABASE_URL (dev heliumdb only — asserted before any write)
 *
 * Steps:
 *   1. Assert dev safety (host check)
 *   2. Clone prod 119 → fresh dev company (never touched by reselect)
 *   3. Check prod 119 for issued offer / HoT documents
 *   4. Capture TRUE PRE:
 *        a) fetchReportedEbitdaByYear  (live read from income_statements/periods)
 *        b) calculateFullDealModel     (live recompute — what getModel() would return)
 *        c) stored deal_models columns (adj_ebitda, ev — what the DB holds right now)
 *   5. Backfill financial_contributions + run reselect
 *   6. Capture POST: same three measurements
 *   7. Report PRE→POST diff
 *
 * Run:  npx tsx scripts/part-b-clone-and-diff.ts
 */

import pg from 'pg';
import crypto from 'crypto';
import { eq, and, sql, desc, ne, or, isNull } from 'drizzle-orm';
import { db } from '../server/db';
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
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import {
  calculateFullDealModel,
  toNum,
  type AdjustmentInput,
  type FundingLineInput,
  type SellerPaymentInput,
  type ContingentConsiderationInput,
  type DealModelInput,
} from '../shared/calculators/deal-model.calc';
import { resolveSourceTier } from '../server/scripts/backfill-financial-contributions';

// ─── pg setup (JSON auto-parse OFF — raw strings for cross-DB clone) ──────────
pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const PROD_ID = 119;
const DEV_USER_ID = 1;
const DEV_USER_COMPANY_ID = 5;

const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function remap(val: number | null | undefined, map: Map<number, number>): number {
  if (val == null) throw new Error(`remap: null value`);
  const r = map.get(val);
  if (r === undefined) throw new Error(`ID ${val} not found in remap map`);
  return r;
}

function remapSoft(val: number | null | undefined, map: Map<number, number>): number | null {
  if (val == null) return null;
  return map.get(val) ?? null;
}

function safeJson(value: string | null | undefined, _ctx: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return JSON.stringify(value);
  try { JSON.parse(value); return value; }
  catch { return null; }
}

async function insertOne(client: pg.PoolClient, table: string, row: Record<string, unknown>): Promise<number> {
  const cols = Object.keys(row);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const res = await client.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')}) RETURNING id`,
    cols.map(c => row[c]),
  );
  return (res.rows[0] as { id: number }).id;
}

const fmtN = (n: number | null | undefined, dp = 2) =>
  n == null ? 'NULL' : n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: dp });

// ─── 1. Safety guard ──────────────────────────────────────────────────────────

async function assertDev(): Promise<void> {
  const res = await db.execute(sql`SELECT current_database() AS db, inet_server_addr() AS host`);
  const row = res.rows?.[0] as { db: string; host: string } | undefined;
  const host = String(row?.host ?? '');
  console.log(`[SAFETY] dev db=${row?.db} host=${host}`);
  if (host.includes('ep-old-recipe')) {
    throw new Error(`ABORT: host "${host}" matches prod fingerprint. Writes refused.`);
  }
  console.log('[SAFETY] ✓ NOT prod — dev writes allowed\n');
}

// ─── 2. Clone prod 119 → fresh dev company ───────────────────────────────────

async function cloneCompany(): Promise<{ devTcId: number; devDmIds: number[]; companyName: string }> {
  console.log('═'.repeat(70));
  console.log(`CLONING prod target_company ${PROD_ID} → fresh dev company`);
  console.log('═'.repeat(70));

  const devClient = await devPool.connect();
  try {
    await devClient.query('BEGIN');

    // 1. target_company
    const { rows: [src] } = await prodPool.query('SELECT * FROM target_companies WHERE id = $1', [PROD_ID]);
    if (!src) throw new Error(`Prod company ${PROD_ID} not found`);

    const tcRow = {
      user_company_id:  DEV_USER_COMPANY_ID,
      company_name:     `[Part-B] ${src.company_name}`,
      industry:         src.industry,
      sub_sector:       src.sub_sector,
      website:          src.website,
      phone:            src.phone,
      email:            src.email,
      address:          src.address,
      annual_revenue:   src.annual_revenue,
      employee_count:   src.employee_count,
      year_established: src.year_established,
      description:      src.description,
      stage:            src.stage,
      is_archived:      false,
      created_by:       DEV_USER_ID,
    };
    const devTcId = await insertOne(devClient, 'target_companies', tcRow);
    console.log(`  ✓ target_company  prod=${PROD_ID}  dev=${devTcId}  (${src.company_name})`);

    // 2. documents
    const { rows: prodDocs } = await prodPool.query('SELECT * FROM documents WHERE target_company_id = $1 ORDER BY id', [PROD_ID]);
    const docMap = new Map<number, number>();
    for (const d of prodDocs) {
      const id = await insertOne(devClient, 'documents', {
        target_company_id:  devTcId, uploaded_by: DEV_USER_ID,
        document_name: d.document_name, original_filename: d.original_filename,
        file_path: d.file_path, file_size: d.file_size, file_type: d.file_type,
        document_category: d.document_category, secondary_category: d.secondary_category,
        description: d.description, is_confidential: d.is_confidential,
        public_token: crypto.randomBytes(32).toString('hex'),
      });
      docMap.set(d.id as number, id);
    }
    console.log(`  ✓ documents       ${prodDocs.length} rows`);

    // 3. financial_periods
    const { rows: prodPeriods } = await prodPool.query('SELECT * FROM financial_periods WHERE target_company_id = $1 ORDER BY id', [PROD_ID]);
    const periodMap = new Map<number, number>();
    for (const p of prodPeriods) {
      const id = await insertOne(devClient, 'financial_periods', {
        target_company_id: devTcId, period_type: p.period_type,
        period_start: p.period_start, period_end: p.period_end,
        fiscal_year: p.fiscal_year, period_label: p.period_label,
        months_covered: p.months_covered, is_full_year: p.is_full_year,
        source_tier: p.source_tier,
        source_document_id: remapSoft(p.source_document_id as number, docMap),
      });
      periodMap.set(p.id as number, id);
    }
    console.log(`  ✓ financial_periods ${prodPeriods.length} rows`);

    // 4. income_statements
    const { rows: prodIS } = await prodPool.query('SELECT * FROM income_statements WHERE target_company_id = $1 ORDER BY id', [PROD_ID]);
    for (const r of prodIS) {
      await insertOne(devClient, 'income_statements', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        revenue: r.revenue, cost_of_sales: r.cost_of_sales, gross_profit: r.gross_profit,
        administrative_expenses: r.administrative_expenses,
        depreciation_amortisation: r.depreciation_amortisation,
        other_operating_income: r.other_operating_income,
        operating_profit: r.operating_profit,
        interest_receivable: r.interest_receivable, interest_payable: r.interest_payable,
        profit_before_tax: r.profit_before_tax, corporation_tax: r.corporation_tax,
        net_profit: r.net_profit, staff_costs: r.staff_costs,
        directors_remuneration: r.directors_remuneration, dividends_paid: r.dividends_paid,
        revenue_breakdown:       safeJson(r.revenue_breakdown,       `IS ${r.id} rev`),
        cost_of_sales_breakdown: safeJson(r.cost_of_sales_breakdown, `IS ${r.id} cos`),
        overheads_breakdown:     safeJson(r.overheads_breakdown,     `IS ${r.id} ovh`),
        exceptional_items:       safeJson(r.exceptional_items,       `IS ${r.id} exc`),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }
    console.log(`  ✓ income_statements ${prodIS.length} rows`);

    // 5. balance_sheets
    const { rows: prodBS } = await prodPool.query('SELECT * FROM balance_sheets WHERE target_company_id = $1 ORDER BY id', [PROD_ID]);
    for (const r of prodBS) {
      await insertOne(devClient, 'balance_sheets', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        intangible_assets: r.intangible_assets, tangible_fixed_assets: r.tangible_fixed_assets,
        freehold_property: r.freehold_property, leasehold_property: r.leasehold_property,
        plant_machinery: r.plant_machinery, fixtures_fittings: r.fixtures_fittings,
        motor_vehicles: r.motor_vehicles, computer_equipment: r.computer_equipment,
        stock_inventory: r.stock_inventory, trade_debtors: r.trade_debtors,
        prepayments: r.prepayments,
        amounts_owed_by_directors: r.amounts_owed_by_directors,
        amounts_owed_by_connected_companies: r.amounts_owed_by_connected_companies,
        directors_current_account: r.directors_current_account,
        other_debtors: r.other_debtors, cash_at_bank: r.cash_at_bank,
        total_current_assets: r.total_current_assets,
        trade_creditors: r.trade_creditors,
        taxation_social_security: r.taxation_social_security,
        vat_payable: r.vat_payable, corporation_tax_due: r.corporation_tax_due,
        bank_loans_overdraft_current: r.bank_loans_overdraft_current,
        hire_purchase_current: r.hire_purchase_current, accruals: r.accruals,
        amounts_owed_to_directors: r.amounts_owed_to_directors,
        other_creditors: r.other_creditors,
        total_current_liabilities: r.total_current_liabilities,
        bank_loans_long_term: r.bank_loans_long_term,
        hire_purchase_long_term: r.hire_purchase_long_term,
        deferred_taxation: r.deferred_taxation, other_long_term_debt: r.other_long_term_debt,
        total_long_term_liabilities: r.total_long_term_liabilities,
        share_capital: r.share_capital, retained_earnings: r.retained_earnings,
        total_equity: r.total_equity,
        debtors_list:        safeJson(r.debtors_list,        `BS ${r.id} deb`),
        creditors_list:      safeJson(r.creditors_list,      `BS ${r.id} cre`),
        fixed_assets_detail: safeJson(r.fixed_assets_detail, `BS ${r.id} fa`),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }
    console.log(`  ✓ balance_sheets   ${prodBS.length} rows`);

    // 6. staff_data
    const { rows: prodSD } = await prodPool.query('SELECT * FROM staff_data WHERE target_company_id = $1 ORDER BY id', [PROD_ID]).catch(() => ({ rows: [] }));
    for (const r of prodSD) {
      await insertOne(devClient, 'staff_data', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        total_headcount: r.total_headcount, total_staff_costs: r.total_staff_costs,
        total_gross_salaries: r.total_gross_salaries, total_employer_ni: r.total_employer_ni,
        total_employer_pension: r.total_employer_pension,
        director_count: r.director_count, director_remuneration: r.director_remuneration,
        working_director_count: r.working_director_count,
        non_working_director_count: r.non_working_director_count,
        employee_count: r.employee_count, employee_costs: r.employee_costs,
        staff_records: safeJson(r.staff_records, `SD ${r.id}`),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }
    console.log(`  ✓ staff_data       ${prodSD.length} rows`);

    // 7. ebitda_adjustments
    const { rows: prodEA } = await prodPool.query('SELECT * FROM ebitda_adjustments WHERE target_company_id = $1 ORDER BY id', [PROD_ID]).catch(() => ({ rows: [] }));
    for (const r of prodEA) {
      await insertOne(devClient, 'ebitda_adjustments', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        description: r.description, amount: r.amount,
        category: r.category, notes: r.notes, created_by: DEV_USER_ID,
      });
    }
    console.log(`  ✓ ebitda_adjustments ${prodEA.length} rows`);

    // 8. valuations
    const { rows: prodVals } = await prodPool.query('SELECT * FROM valuations WHERE target_company_id = $1 ORDER BY id', [PROD_ID]).catch(() => ({ rows: [] }));
    for (const r of prodVals) {
      await insertOne(devClient, 'valuations', {
        target_company_id: devTcId, calculation_method: r.calculation_method,
        valuation_multiple: r.valuation_multiple, adjusted_ebitda: r.adjusted_ebitda,
        enterprise_value: r.enterprise_value, net_debt: r.net_debt,
        equity_value: r.equity_value, funding_structure: r.funding_structure,
        deal_notes: r.deal_notes, created_by: DEV_USER_ID,
      });
    }
    console.log(`  ✓ valuations       ${prodVals.length} rows`);

    // 9. deal_models
    const { rows: prodDMs } = await prodPool.query('SELECT * FROM deal_models WHERE target_company_id = $1 ORDER BY id', [PROD_ID]);
    const dmMap = new Map<number, number>();
    for (const r of prodDMs) {
      const id = await insertOne(devClient, 'deal_models', {
        target_company_id: devTcId, created_by: DEV_USER_ID,
        name: r.name, status: r.status, version: r.version,
        transaction_type: r.transaction_type, parent_model_id: null,
        is_locked: r.is_locked,
        averaging_years: r.averaging_years, ebitda_multiple: r.ebitda_multiple,
        multiple_low: r.multiple_low, multiple_high: r.multiple_high,
        property_value: r.property_value, cash_value: r.cash_value,
        other_assets: r.other_assets,
        calculated_ebitda: r.calculated_ebitda,
        adjusted_ebitda:   r.adjusted_ebitda,
        enterprise_value:  r.enterprise_value,
        plus_excess_cash:  r.plus_excess_cash,
        minus_primary_debt: r.minus_primary_debt, minus_other_debt: r.minus_other_debt,
        minus_corp_tax_due: r.minus_corp_tax_due,
        minus_working_capital_adj: r.minus_working_capital_adj,
        working_capital_months: r.working_capital_months,
        working_capital_monthly_amount: r.working_capital_monthly_amount,
        total_purchase_price: r.total_purchase_price,
        total_funding_available: r.total_funding_available,
        equity_required: r.equity_required,
        upfront_cash: r.upfront_cash, deferred_amount: r.deferred_amount,
        deferred_terms: r.deferred_terms,
        earnout_maximum: r.earnout_maximum, earnout_metric: r.earnout_metric,
        earnout_period_months: r.earnout_period_months,
        retention_escrow: r.retention_escrow,
        fee_legal_dd_amount: r.fee_legal_dd_amount,
        fee_accounting_dd_amount: r.fee_accounting_dd_amount,
        fee_loan_arrangement_amount: r.fee_loan_arrangement_amount,
        fee_deal_maker_amount: r.fee_deal_maker_amount,
        custom_fees:              safeJson(r.custom_fees,              `DM ${r.id} cf`),
        expert_data_snapshot:     safeJson(r.expert_data_snapshot,     `DM ${r.id} eds`),
        financial_data_snapshot:  safeJson(r.financial_data_snapshot,  `DM ${r.id} fds`),
        notes: r.notes,
      });
      dmMap.set(r.id as number, id);
    }
    const devDmIds = [...dmMap.values()];
    console.log(`  ✓ deal_models      ${prodDMs.length} rows  →  dev ids: ${devDmIds.join(',')}`);

    // 10. deal_model_adjustments
    const { rows: prodDMA } = await prodPool.query(
      `SELECT dma.* FROM deal_model_adjustments dma
       JOIN deal_models dm ON dm.id = dma.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY dma.id`, [PROD_ID]);
    for (const r of prodDMA) {
      await insertOne(devClient, 'deal_model_adjustments', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        source_expert_result_id: null,
        adjustment_type: r.adjustment_type, category: r.category,
        description: r.description, amount: r.amount,
        amounts_by_year: safeJson(r.amounts_by_year, `DMA ${r.id}`),
        source_expert: r.source_expert, reasoning: r.reasoning,
        confidence: r.confidence, defensibility_score: r.defensibility_score,
        case_for_inclusion: r.case_for_inclusion, case_for_exclusion: r.case_for_exclusion,
        status: r.status, is_accepted: r.is_accepted,
        is_manual: r.is_manual, sort_order: r.sort_order,
      });
    }
    console.log(`  ✓ deal_model_adjustments ${prodDMA.length} rows`);

    // 11. deal_model_funding_lines
    const { rows: prodFLs } = await prodPool.query(
      `SELECT fl.* FROM deal_model_funding_lines fl
       JOIN deal_models dm ON dm.id = fl.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY fl.id`, [PROD_ID]).catch(() => ({ rows: [] }));
    for (const r of prodFLs) {
      await insertOne(devClient, 'deal_model_funding_lines', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        funding_type: r.funding_type, label: r.label,
        asset_base_value: r.asset_base_value, ltv_percent: r.ltv_percent,
        available_amount: r.available_amount, amount_used: r.amount_used,
        interest_rate: r.interest_rate,
        arrangement_fee_percent: r.arrangement_fee_percent,
        term_months: r.term_months, monthly_repayment: r.monthly_repayment,
        is_debt: r.is_debt, repayment_structure: r.repayment_structure,
        is_active: r.is_active, notes: r.notes, sort_order: r.sort_order,
      });
    }
    console.log(`  ✓ deal_model_funding_lines ${prodFLs.length} rows`);

    // 12. deal_model_seller_payments
    const { rows: prodSPs } = await prodPool.query(
      `SELECT sp.* FROM deal_model_seller_payments sp
       JOIN deal_models dm ON dm.id = sp.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY sp.id`, [PROD_ID]).catch(() => ({ rows: [] }));
    for (const r of prodSPs) {
      await insertOne(devClient, 'deal_model_seller_payments', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        payment_type: r.payment_type, amount: r.amount, term_months: r.term_months,
        interest_rate: r.interest_rate, label: r.label,
        include_in_dscr: r.include_in_dscr, is_active: r.is_active, sort_order: r.sort_order,
      });
    }
    console.log(`  ✓ deal_model_seller_payments ${prodSPs.length} rows`);

    // 13. deal_model_contingent_consideration
    const { rows: prodCCs } = await prodPool.query(
      `SELECT cc.* FROM deal_model_contingent_consideration cc
       JOIN deal_models dm ON dm.id = cc.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY cc.id`, [PROD_ID]).catch(() => ({ rows: [] }));
    for (const r of prodCCs) {
      await insertOne(devClient, 'deal_model_contingent_consideration', {
        deal_model_id: remap(r.deal_model_id as number, dmMap),
        consideration_type: r.consideration_type, maximum_amount: r.maximum_amount,
        term_months: r.term_months, trigger_description: r.trigger_description,
        include_in_dscr: r.include_in_dscr, is_active: r.is_active, sort_order: r.sort_order,
      });
    }
    console.log(`  ✓ deal_model_contingent_consideration ${prodCCs.length} rows`);

    // 14. financial_contributions — skip (not in prod, will backfill in step 5)
    console.log(`  ⊘ financial_contributions — table absent in prod; will backfill after PRE capture`);

    await devClient.query('COMMIT');
    console.log(`\n  ✅ COMMITTED — new dev target_company id = ${devTcId}`);
    return { devTcId, devDmIds, companyName: src.company_name as string };

  } catch (err) {
    await devClient.query('ROLLBACK');
    console.error(`  ❌ ROLLED BACK: ${(err as Error).message}`);
    throw err;
  } finally {
    devClient.release();
  }
}

// ─── 3. Check prod 119 offer/HoT ─────────────────────────────────────────────

async function checkProdDocuments(): Promise<void> {
  const { rows } = await prodPool.query(
    `SELECT id, document_type, status, sent_at, responded_at
     FROM deal_documents
     WHERE target_company_id = $1
       AND document_type IN ('offer_letter','heads_of_terms')
     ORDER BY id`,
    [PROD_ID],
  );
  console.log(`\nProd ${PROD_ID} offer / HoT documents: ${rows.length === 0 ? 'NONE' : ''}`);
  if (rows.length > 0) {
    for (const r of rows) {
      console.log(`  id=${r.id} type=${r.document_type} status=${r.status} sent=${r.sent_at ?? 'null'} responded=${r.responded_at ?? 'null'}`);
    }
  }
}

// ─── 4. fetchReportedEbitdaByYear (Drizzle, reads dev) ───────────────────────

async function liveEbitdaByYear(tcId: number): Promise<Record<string, number>> {
  const rows = await db
    .select({
      periodEnd: financialPeriods.periodEnd,
      fiscalYear: financialPeriods.fiscalYear,
      sourceTier: financialPeriods.sourceTier,
      operatingProfit: incomeStatements.operatingProfit,
      depreciationAmortisation: incomeStatements.depreciationAmortisation,
    })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(
      and(
        eq(incomeStatements.targetCompanyId, tcId),
        eq(financialPeriods.isFullYear, true),
        or(
          isNull(financialPeriods.sourceTier),
          ne(financialPeriods.sourceTier, 'information_memorandum'),
        ),
      ),
    )
    .orderBy(desc(financialPeriods.periodEnd));

  const result: Record<string, number> = {};
  for (const row of rows) {
    const year = row.fiscalYear?.toString()
      || (row.periodEnd ? new Date(row.periodEnd).getFullYear().toString() : null);
    if (!year) continue;
    if (year in result) continue;
    result[year] = toNum(row.operatingProfit) + toNum(row.depreciationAmortisation);
  }
  return result;
}

// ─── 5. Live deal model calculation ──────────────────────────────────────────

interface LiveCalc {
  modelId: number;
  name: string;
  averagingYears: number;
  multiple: string;
  averageAdjustedEbitda: number;
  enterpriseValue: number;
  offerPrice: number;
  ebitdaByYear: Record<string, number>;
}

async function liveCalcForCompany(tcId: number): Promise<LiveCalc[]> {
  const reportedEbitda = await liveEbitdaByYear(tcId);
  const dms = await db.select().from(dealModels).where(eq(dealModels.targetCompanyId, tcId));

  const results: LiveCalc[] = [];
  for (const dm of dms) {
    const adjs = await db.select().from(dealModelAdjustments).where(eq(dealModelAdjustments.dealModelId, dm.id));
    const fls  = await db.select().from(dealModelFundingLines).where(eq(dealModelFundingLines.dealModelId, dm.id));
    const sps  = await db.select().from(dealModelSellerPayments).where(eq(dealModelSellerPayments.dealModelId, dm.id)).catch(() => []);
    const ccs  = await db.select().from(dealModelContingentConsideration).where(eq(dealModelContingentConsideration.dealModelId, dm.id)).catch(() => []);

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
        isDebt: f.isDebt ?? false,
        repaymentStructure: f.repaymentStructure ?? 'amortizing',
        isActive: f.isActive ?? false,
      }));
    const sellerPayments: SellerPaymentInput[] = sps.map(s => ({
      amount: s.amount, termMonths: s.termMonths,
      interestRate: s.interestRate, includeInDscr: s.includeInDscr ?? true,
      isActive: s.isActive ?? false,
    }));
    const contingentConsideration: ContingentConsiderationInput[] = ccs.map(c => ({
      maximumAmount: c.maximumAmount, termMonths: c.termMonths,
      includeInDscr: c.includeInDscr ?? true, isActive: c.isActive ?? false,
    }));
    const modelInput: DealModelInput = {
      averagingYears: dm.averagingYears ?? 3,
      ebitdaMultiple: dm.ebitdaMultiple ?? '3.0',
      plusExcessCash: dm.plusExcessCash ?? '0',
      minusPrimaryDebt: dm.minusPrimaryDebt ?? '0',
      minusOtherDebt: dm.minusOtherDebt ?? '0',
      minusCorpTaxDue: dm.minusCorpTaxDue ?? '0',
      minusWorkingCapitalAdj: dm.minusWorkingCapitalAdj ?? '0',
      plusPropertyValue: dm.propertyValue ?? '0',
      otherAdjustments: null,
      feeLegalDdAmount: dm.feeLegalDdAmount ?? '0',
      feeAccountingDdAmount: dm.feeAccountingDdAmount ?? '0',
      feeLoanArrangementAmount: dm.feeLoanArrangementAmount ?? '0',
      feeDealMakerAmount: dm.feeDealMakerAmount ?? '0',
      customFees: (dm.customFees as Array<{ label: string; amount: string | number }>) ?? [],
    };

    const calc = calculateFullDealModel(reportedEbitda, adjustments, fundingLines, modelInput, sellerPayments, contingentConsideration);

    results.push({
      modelId: dm.id,
      name: dm.name ?? '(unnamed)',
      averagingYears: dm.averagingYears ?? 3,
      multiple: dm.ebitdaMultiple ?? '3.0',
      averageAdjustedEbitda: calc.averageAdjustedEbitda,
      enterpriseValue: calc.enterpriseValue,
      offerPrice: calc.offerPrice,
      ebitdaByYear: reportedEbitda,
    });
  }
  return results;
}

// ─── 6. Stored deal_models columns ───────────────────────────────────────────

interface StoredSnap {
  modelId: number;
  name: string;
  isLocked: boolean;
  storedAdjEbitda: number;
  storedEv: number;
  storedTpp: number;
}

async function storedSnap(tcId: number): Promise<StoredSnap[]> {
  const dms = await db.select().from(dealModels).where(eq(dealModels.targetCompanyId, tcId));
  return dms.map(d => ({
    modelId: d.id,
    name: d.name ?? '(unnamed)',
    isLocked: d.isLocked,
    storedAdjEbitda: toNum(d.adjustedEbitda),
    storedEv: toNum(d.enterpriseValue),
    storedTpp: toNum(d.totalPurchasePrice),
  }));
}

// ─── 7. Backfill ──────────────────────────────────────────────────────────────

async function backfill(tcId: number): Promise<void> {
  await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, tcId));

  const incRows = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, tcId));
  for (const row of incRows) {
    const [period] = await db.select({
      fiscalYear: financialPeriods.fiscalYear, periodType: financialPeriods.periodType,
      isFullYear: financialPeriods.isFullYear, monthsCovered: financialPeriods.monthsCovered,
      periodEnd: financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));
    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }
    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    await db.insert(financialContributions).values({
      targetCompanyId: row.targetCompanyId,
      fiscalYear: period?.fiscalYear ?? null,
      statementType: 'income',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier,
      isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null,
      periodEnd: period?.periodEnd ?? null,
      asAtDate: null,
      figures: {
        revenue: row.revenue, costOfSales: row.costOfSales, grossProfit: row.grossProfit,
        administrativeExpenses: row.administrativeExpenses,
        depreciationAmortisation: row.depreciationAmortisation,
        otherOperatingIncome: row.otherOperatingIncome,
        operatingProfit: row.operatingProfit,
        interestReceivable: row.interestReceivable, interestPayable: row.interestPayable,
        profitBeforeTax: row.profitBeforeTax, corporationTax: row.corporationTax,
        netProfit: row.netProfit, staffCosts: row.staffCosts,
        directorsRemuneration: row.directorsRemuneration, dividendsPaid: row.dividendsPaid,
        revenueBreakdown: row.revenueBreakdown, costOfSalesBreakdown: row.costOfSalesBreakdown,
        overheadsBreakdown: row.overheadsBreakdown, exceptionalItems: row.exceptionalItems,
      },
    });
  }

  const balRows = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, tcId));
  for (const row of balRows) {
    const [period] = await db.select({
      fiscalYear: financialPeriods.fiscalYear, periodType: financialPeriods.periodType,
      isFullYear: financialPeriods.isFullYear, monthsCovered: financialPeriods.monthsCovered,
      periodEnd: financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));
    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }
    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    await db.insert(financialContributions).values({
      targetCompanyId: row.targetCompanyId,
      fiscalYear: period?.fiscalYear ?? null,
      statementType: 'balance',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier,
      isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null,
      periodEnd: period?.periodEnd ?? null,
      asAtDate: period?.periodEnd ?? null,
      figures: {
        intangibleAssets: row.intangibleAssets, tangibleFixedAssets: row.tangibleFixedAssets,
        freeholdProperty: row.freeholdProperty, leaseholdProperty: row.leaseholdProperty,
        plantMachinery: row.plantMachinery, fixturesFittings: row.fixturesFittings,
        motorVehicles: row.motorVehicles, computerEquipment: row.computerEquipment,
        stockInventory: row.stockInventory, tradeDebtors: row.tradeDebtors,
        prepayments: row.prepayments,
        amountsOwedByDirectors: row.amountsOwedByDirectors,
        amountsOwedByConnectedCompanies: row.amountsOwedByConnectedCompanies,
        directorsCurrentAccount: row.directorsCurrentAccount,
        otherDebtors: row.otherDebtors, cashAtBank: row.cashAtBank,
        totalCurrentAssets: row.totalCurrentAssets,
        tradeCreditors: row.tradeCreditors,
        taxationSocialSecurity: row.taxationSocialSecurity,
        vatPayable: row.vatPayable, corporationTaxDue: row.corporationTaxDue,
        bankLoansOverdraftCurrent: row.bankLoansOverdraftCurrent,
        hirePurchaseCurrent: row.hirePurchaseCurrent, accruals: row.accruals,
        amountsOwedToDirectors: row.amountsOwedToDirectors,
        otherCreditors: row.otherCreditors,
        totalCurrentLiabilities: row.totalCurrentLiabilities,
        bankLoansLongTerm: row.bankLoansLongTerm,
        hirePurchaseLongTerm: row.hirePurchaseLongTerm,
        deferredTaxation: row.deferredTaxation, otherLongTermDebt: row.otherLongTermDebt,
        totalLongTermLiabilities: row.totalLongTermLiabilities,
        shareCapital: row.shareCapital, retainedEarnings: row.retainedEarnings,
        totalEquity: row.totalEquity,
        debtorsList: row.debtorsList, creditorsList: row.creditorsList,
        fixedAssetsDetail: row.fixedAssetsDetail,
      },
    });
  }
  console.log(`  backfill: income=${incRows.length} balance=${balRows.length}`);
}

// ─── 8. Recalc + persist stored columns ──────────────────────────────────────

async function recalcAndPersist(tcId: number): Promise<void> {
  const reportedEbitda = await liveEbitdaByYear(tcId);
  const dms = await db.select().from(dealModels).where(eq(dealModels.targetCompanyId, tcId));
  for (const dm of dms) {
    const adjs = await db.select().from(dealModelAdjustments).where(eq(dealModelAdjustments.dealModelId, dm.id));
    const fls  = await db.select().from(dealModelFundingLines).where(eq(dealModelFundingLines.dealModelId, dm.id));
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
        isDebt: f.isDebt ?? false,
        repaymentStructure: f.repaymentStructure ?? 'amortizing',
        isActive: f.isActive ?? false,
      }));
    const modelInput: DealModelInput = {
      averagingYears: dm.averagingYears ?? 3,
      ebitdaMultiple: dm.ebitdaMultiple ?? '3.0',
      plusExcessCash: dm.plusExcessCash ?? '0',
      minusPrimaryDebt: dm.minusPrimaryDebt ?? '0',
      minusOtherDebt: dm.minusOtherDebt ?? '0',
      minusCorpTaxDue: dm.minusCorpTaxDue ?? '0',
      minusWorkingCapitalAdj: dm.minusWorkingCapitalAdj ?? '0',
      plusPropertyValue: dm.propertyValue ?? '0',
      otherAdjustments: null,
      feeLegalDdAmount: dm.feeLegalDdAmount ?? '0',
      feeAccountingDdAmount: dm.feeAccountingDdAmount ?? '0',
      feeLoanArrangementAmount: dm.feeLoanArrangementAmount ?? '0',
      feeDealMakerAmount: dm.feeDealMakerAmount ?? '0',
      customFees: (dm.customFees as Array<{ label: string; amount: string | number }>) ?? [],
    };
    const result = calculateFullDealModel(reportedEbitda, adjustments, fundingLines, modelInput, [], []);
    await db.update(dealModels).set({
      calculatedEbitda: String(result.averageAdjustedEbitda),
      adjustedEbitda:   String(result.averageAdjustedEbitda),
      enterpriseValue:  String(result.enterpriseValue),
      totalPurchasePrice: String(result.offerPrice),
      updatedAt: new Date(),
    }).where(eq(dealModels.id, dm.id));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await assertDev();

  // ── Step 2: Clone ─────────────────────────────────────────────────────────
  const { devTcId, devDmIds, companyName } = await cloneCompany();

  // ── Step 3: Prod docs check ───────────────────────────────────────────────
  await checkProdDocuments();

  // ── Step 4: TRUE PRE ──────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log(`PRE STATE  (fresh clone, no backfill / reselect yet)  dev=${devTcId}`);
  console.log('─'.repeat(70));

  const preEbitda  = await liveEbitdaByYear(devTcId);
  const preLive    = await liveCalcForCompany(devTcId);
  const preStored  = await storedSnap(devTcId);

  console.log('\n  [PRE] fetchReportedEbitdaByYear:');
  for (const [yr, v] of Object.entries(preEbitda).sort()) {
    console.log(`    FY${yr} = £${fmtN(v)}`);
  }
  if (Object.keys(preEbitda).length === 0) console.log('    (empty — no qualifying full-year periods)');

  console.log('\n  [PRE] Live calculateFullDealModel:');
  for (const c of preLive) {
    console.log(`    "${c.name}"  avg=${c.averagingYears}y ×${c.multiple}  avgAdjEBITDA=£${fmtN(c.averageAdjustedEbitda)}  EV=£${fmtN(c.enterpriseValue)}  offerPrice=£${fmtN(c.offerPrice)}`);
  }

  console.log('\n  [PRE] Stored deal_models columns:');
  for (const s of preStored) {
    console.log(`    "${s.name}"  isLocked=${s.isLocked}  adj_ebitda=£${fmtN(s.storedAdjEbitda)}  ev=£${fmtN(s.storedEv)}  tpp=£${fmtN(s.storedTpp)}`);
  }

  // ── Step 5: Backfill + reselect ───────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log('BACKFILL + RESELECT');
  console.log('─'.repeat(70));
  await backfill(devTcId);
  await reselect(devTcId);
  await recalcAndPersist(devTcId);
  console.log('  ✓ backfill + reselect + recalc complete');

  // ── Step 6: POST ──────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  console.log('POST STATE  (after backfill + reselect)');
  console.log('─'.repeat(70));

  const postEbitda  = await liveEbitdaByYear(devTcId);
  const postLive    = await liveCalcForCompany(devTcId);
  const postStored  = await storedSnap(devTcId);

  console.log('\n  [POST] fetchReportedEbitdaByYear:');
  for (const [yr, v] of Object.entries(postEbitda).sort()) {
    console.log(`    FY${yr} = £${fmtN(v)}`);
  }

  console.log('\n  [POST] Live calculateFullDealModel:');
  for (const c of postLive) {
    console.log(`    "${c.name}"  avg=${c.averagingYears}y ×${c.multiple}  avgAdjEBITDA=£${fmtN(c.averageAdjustedEbitda)}  EV=£${fmtN(c.enterpriseValue)}  offerPrice=£${fmtN(c.offerPrice)}`);
  }

  console.log('\n  [POST] Stored deal_models columns:');
  for (const s of postStored) {
    console.log(`    "${s.name}"  isLocked=${s.isLocked}  adj_ebitda=£${fmtN(s.storedAdjEbitda)}  ev=£${fmtN(s.storedEv)}  tpp=£${fmtN(s.storedTpp)}`);
  }

  // ── Step 7: DIFF table ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(`DIFF  PRE → POST  (dev=${devTcId}  prod_source=${PROD_ID}  "${companyName}")`);
  console.log('═'.repeat(70));

  // EBITDA by year diff
  const allYears = [...new Set([...Object.keys(preEbitda), ...Object.keys(postEbitda)])].sort();
  console.log('\n  fetchReportedEbitdaByYear diff:');
  console.log(`  ${'FY'.padEnd(6)} ${'PRE'.padStart(14)} ${'POST'.padStart(14)} ${'Δ'.padStart(14)} ${'Changed?'.padEnd(8)}`);
  console.log(`  ${'─'.repeat(56)}`);
  for (const yr of allYears) {
    const pre  = preEbitda[yr]  ?? null;
    const post = postEbitda[yr] ?? null;
    const delta = (pre != null && post != null) ? post - pre : null;
    const changed = pre !== post;
    console.log(
      `  ${String('FY' + yr).padEnd(6)} ${fmtN(pre).padStart(14)} ${fmtN(post).padStart(14)} ${(delta != null ? (delta >= 0 ? '+' : '') + fmtN(delta) : 'N/A').padStart(14)}  ${changed ? '⬆ CHANGED' : '─ same'}`,
    );
  }

  // Live calc diff
  const preL  = preLive[0];
  const postL = postLive[0];
  if (preL && postL) {
    console.log('\n  Live calculateFullDealModel diff:');
    const pairs: Array<[string, number, number]> = [
      ['avgAdjEBITDA', preL.averageAdjustedEbitda, postL.averageAdjustedEbitda],
      ['enterpriseValue', preL.enterpriseValue, postL.enterpriseValue],
      ['offerPrice', preL.offerPrice, postL.offerPrice],
    ];
    for (const [label, pre, post] of pairs) {
      const delta = post - pre;
      const changed = Math.abs(delta) > 0.01;
      console.log(
        `  ${label.padEnd(18)}  PRE=£${fmtN(pre).padStart(12)}  POST=£${fmtN(post).padStart(12)}  Δ=${(delta >= 0 ? '+' : '') + fmtN(delta).padStart(12)}  ${changed ? '⬆ CHANGED' : '─ same'}`,
      );
    }
  }

  // Stored columns diff
  const preS  = preStored[0];
  const postS = postStored[0];
  if (preS && postS) {
    console.log('\n  Stored deal_models columns diff:');
    const pairs: Array<[string, number, number]> = [
      ['adj_ebitda', preS.storedAdjEbitda, postS.storedAdjEbitda],
      ['enterprise_value', preS.storedEv, postS.storedEv],
      ['total_purchase_price', preS.storedTpp, postS.storedTpp],
    ];
    for (const [label, pre, post] of pairs) {
      const delta = post - pre;
      const changed = Math.abs(delta) > 0.01;
      console.log(
        `  ${label.padEnd(20)}  PRE=£${fmtN(pre).padStart(12)}  POST=£${fmtN(post).padStart(12)}  Δ=${(delta >= 0 ? '+' : '') + fmtN(delta).padStart(12)}  ${changed ? '⬆ CHANGED' : '─ same'}`,
      );
    }
  }

  // Prod reference
  console.log('\n  PROD reference  (company 119, deal model 114, prod live stored):');
  console.log('    adj_ebitda=£163,788.72  enterprise_value=£409,471.79  total_purchase_price=£409,471.79  is_locked=false');

  console.log('\n  Offer / HoT issued on prod 119: NONE — no snapshot to worry about');

  console.log('\n✅ Part B complete\n');

  await prodPool.end();
  await devPool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
