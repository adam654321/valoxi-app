/**
 * scripts/slice18-vcheck.ts
 *
 * Slice 18 — YTD/part-year detection V-check.
 *
 * Clones prod tc=220 (Canoports active) and tc=137 (Manor Building Solutions)
 * into dev, backfills financial_contributions (which carry is_full_year=true
 * for YTD documents as stored on prod, pre-fix), then applies the Slice 18
 * patch: re-runs computeSpan with the source document filename as ytdHintText
 * and updates any contribution whose is_full_year flag changes.
 *
 * After the patch, runs reselect and calls fetchReportedEbitdaByYear.
 *
 * Per year, reports:
 *   • Whether each FY2026 contribution is now flagged part-year
 *   • What the FY2026 full-year winner becomes (or if 2026 drops out)
 *   • Resulting reported EBITDA and deal-model EV
 *
 * READS:  PROD_DATABASE_URL  (never written to, host-fingerprint checked)
 * WRITES: DATABASE_URL       (dev heliumdb only, host-fingerprint checked)
 *
 * Run: npx tsx scripts/slice18-vcheck.ts
 */

import pg from 'pg';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db, pool as devDrizzlePool } from '../server/db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  documents as documentsTable,
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  dealModelSellerPayments,
  dealModelContingentConsideration,
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
import { computeSpan } from '../shared/utils/derive-span';
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

pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

const TAG            = '[SLICE18-VCHECK]';
const DEV_USER_ID         = 1;
const DEV_USER_COMPANY_ID = 5;
const TODAY = new Date().toISOString().split('T')[0];

const fmtGBP = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const bar = (ch: string, n = 72) => ch.repeat(n);

// ─── Safety guard ──────────────────────────────────────────────────────────────
async function assertHosts(): Promise<void> {
  const prodUrl = process.env.PROD_DATABASE_URL ?? '';
  const devUrl  = process.env.DATABASE_URL ?? '';
  if (!prodUrl.includes('ep-old-recipe'))
    throw new Error(`ABORT: PROD_DATABASE_URL missing expected fingerprint (ep-old-recipe).`);
  if (devUrl.includes('ep-old-recipe'))
    throw new Error(`ABORT: DATABASE_URL matches prod fingerprint. Writes refused.`);
  console.log(`SAFETY OK  prod=ep-old-recipe (read-only)  dev=helium (writes permitted)`);
  console.log(`Today: ${TODAY}\n`);
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
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
function safeJson(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') return JSON.stringify(v);
  try { JSON.parse(v); return v; } catch { return null; }
}

// ─── Cleanup dev clones tagged with TAG ───────────────────────────────────────
async function deleteDevClone(devTcId: number): Promise<void> {
  const c = await devPool.connect();
  try {
    await c.query(`DELETE FROM financial_contributions WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM ebitda_adjustments WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM staff_data WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM income_statements WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM balance_sheets WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM financial_periods WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM deal_model_contingent_consideration WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [devTcId]);
    await c.query(`DELETE FROM deal_model_seller_payments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [devTcId]);
    await c.query(`DELETE FROM deal_model_funding_lines WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [devTcId]);
    await c.query(`DELETE FROM deal_model_adjustments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [devTcId]);
    await c.query(`DELETE FROM deal_models WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM documents WHERE target_company_id = $1`, [devTcId]);
    await c.query(`DELETE FROM target_companies WHERE id = $1`, [devTcId]);
  } finally {
    c.release();
  }
}

async function cleanupPriorClones(): Promise<void> {
  const { rows } = await devPool.query(
    `SELECT id FROM target_companies WHERE user_company_id = $1 AND company_name LIKE $2`,
    [DEV_USER_COMPANY_ID, `${TAG}%`],
  );
  if (rows.length === 0) return;
  const ids = rows.map((r: any) => r.id as number);
  console.log(`Cleaning up ${ids.length} prior clone(s): [${ids.join(', ')}]`);
  for (const id of ids) await deleteDevClone(id);
}

// ─── Clone prod → dev ──────────────────────────────────────────────────────────
async function cloneCompany(prodTcId: number, companyName: string): Promise<{
  devTcId: number; docMap: Map<number, number>; periodMap: Map<number, number>;
}> {
  const devClient = await devPool.connect();
  try {
    await devClient.query('BEGIN');

    const { rows: [src] } = await prodPool.query('SELECT * FROM target_companies WHERE id = $1', [prodTcId]);
    const devTcId = await insertOne(devClient, 'target_companies', {
      user_company_id: DEV_USER_COMPANY_ID, company_name: `${TAG} ${companyName}`,
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

    // financial_periods
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

// ─── Backfill contributions from cloned periods ───────────────────────────────
async function backfillContributions(devTcId: number): Promise<void> {
  const periods = await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, devTcId));
  const isRows  = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
  const bsRows  = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));
  const periodById = new Map(periods.map(p => [p.id, p]));

  for (const is_ of isRows) {
    const p = periodById.get(is_.financialPeriodId);
    if (!p) continue;
    const tier = p.sourceTier ?? (p.periodType === 'statutory' ? 'statutory' : 'management');
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId, fiscalYear: p.fiscalYear, statementType: 'income',
      sourceTier: tier, isFullYear: p.isFullYear ?? true, isPrimaryYear: true,
      monthsCovered: p.monthsCovered, periodEnd: p.periodEnd,
      sourceDocumentId: is_.sourceDocumentId ?? p.sourceDocumentId,
      figures: {
        revenue: is_.revenue, costOfSales: is_.costOfSales, grossProfit: is_.grossProfit,
        administrativeExpenses: is_.administrativeExpenses,
        depreciationAmortisation: is_.depreciationAmortisation,
        otherOperatingIncome: is_.otherOperatingIncome, operatingProfit: is_.operatingProfit,
        interestReceivable: is_.interestReceivable, interestPayable: is_.interestPayable,
        profitBeforeTax: is_.profitBeforeTax, corporationTax: is_.corporationTax,
        netProfit: is_.netProfit, staffCosts: is_.staffCosts,
        directorsRemuneration: is_.directorsRemuneration, dividendsPaid: is_.dividendsPaid,
      },
    }).onConflictDoNothing();
  }

  for (const bs of bsRows) {
    const p = periodById.get(bs.financialPeriodId);
    if (!p) continue;
    const tier = p.sourceTier ?? (p.periodType === 'statutory' ? 'statutory' : 'management');
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId, fiscalYear: p.fiscalYear, statementType: 'balance',
      sourceTier: tier, isFullYear: p.isFullYear ?? true, isPrimaryYear: true,
      monthsCovered: p.monthsCovered, periodEnd: p.periodEnd,
      sourceDocumentId: bs.sourceDocumentId ?? p.sourceDocumentId,
      figures: {
        totalEquity: bs.totalEquity, cashAtBank: bs.cashAtBank,
        tradeDebtors: bs.tradeDebtors, tradeCreditors: bs.tradeCreditors,
        bankLoansOverdraftCurrent: bs.bankLoansOverdraftCurrent,
        bankLoansLongTerm: bs.bankLoansLongTerm, retainedEarnings: bs.retainedEarnings,
      },
    }).onConflictDoNothing();
  }
}

// ─── Slice 18 patch: re-apply computeSpan with filename ytdHintText ───────────
interface PatchResult {
  contribId: number;
  fiscalYear: number;
  filename: string;
  wasFullYear: boolean;
  nowFullYear: boolean;
}

async function applySlice18Patch(devTcId: number): Promise<PatchResult[]> {
  const contribs = await db
    .select({
      id: financialContributions.id,
      fiscalYear: financialContributions.fiscalYear,
      periodEnd: financialContributions.periodEnd,
      monthsCovered: financialContributions.monthsCovered,
      isFullYear: financialContributions.isFullYear,
      sourceDocumentId: financialContributions.sourceDocumentId,
      statementType: financialContributions.statementType,
    })
    .from(financialContributions)
    .where(eq(financialContributions.targetCompanyId, devTcId));

  const docs = await db
    .select({ id: documentsTable.id, originalFilename: documentsTable.originalFilename, documentName: documentsTable.documentName })
    .from(documentsTable)
    .where(eq(documentsTable.targetCompanyId, devTcId));
  const docById = new Map(docs.map(d => [d.id, d]));

  const changes: PatchResult[] = [];

  for (const c of contribs) {
    if (!c.sourceDocumentId) continue;
    const doc = docById.get(c.sourceDocumentId);
    if (!doc) continue;

    const filename = doc.originalFilename ?? doc.documentName ?? '';
    if (!filename) continue;

    // Use balance_sheet documentType for balance contributions so path c (BS
    // snapshot rule) takes precedence correctly, matching what the live pipeline does.
    const docType = c.statementType === 'balance' ? 'balance_sheet' : 'profit_and_loss';

    const span = computeSpan({
      monthsCovered: c.monthsCovered != null ? Number(c.monthsCovered) : null,
      periodEnd: c.periodEnd,
      reportDate: null,
      documentType: docType,
      ytdHintText: filename,
    });

    if (span.isFullYear !== c.isFullYear) {
      changes.push({
        contribId: c.id,
        fiscalYear: c.fiscalYear,
        filename,
        wasFullYear: c.isFullYear,
        nowFullYear: span.isFullYear,
      });
      await db
        .update(financialContributions)
        .set({ isFullYear: span.isFullYear })
        .where(eq(financialContributions.id, c.id));
    }
  }

  return changes;
}

// ─── Compute deal-model EV ─────────────────────────────────────────────────────
async function computeDevDealModel(devTcId: number, ebitdaByYear: Record<string, number>): Promise<{
  name: string; averagingYears: number; multiple: number;
  yearsInWindow: string[]; avgAdjEbitda: number; enterpriseValue: number;
} | null> {
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

  const { adjustedEbitdaByYear, averageAdjustedEbitda } = calculateAdjustedEbitda(
    ebitdaByYear, adjustments, dm.averagingYears ?? 3,
  );
  const calc = calculateFullDealModel(ebitdaByYear, adjustments, fundingLines, modelInput, sellerPayments, contingent);

  const sortedYearsDesc = Object.keys(adjustedEbitdaByYear).sort().reverse();
  const clampedN = Math.max(1, Math.min(dm.averagingYears ?? 3, sortedYearsDesc.length));
  const yearsInWindow = sortedYearsDesc.slice(0, clampedN);

  return {
    name: dm.name ?? '(unnamed)',
    averagingYears: dm.averagingYears ?? 3,
    multiple: toNum(dm.ebitdaMultiple),
    yearsInWindow,
    avgAdjEbitda: averageAdjustedEbitda,
    enterpriseValue: calc.enterpriseValue,
  };
}

// ─── Run one company ───────────────────────────────────────────────────────────
async function runCompany(prodTcId: number, companyName: string): Promise<{ pass: boolean }> {
  console.log(bar('═'));
  console.log(`tc=${prodTcId}  ${companyName}`);
  console.log(bar('─'));

  process.stdout.write('  Cloning prod → dev ... ');
  const { devTcId, docMap } = await cloneCompany(prodTcId, companyName);
  console.log(`devTcId=${devTcId}`);

  process.stdout.write('  Backfilling financial_contributions ... ');
  await backfillContributions(devTcId);
  const totalContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, devTcId));
  console.log(`${totalContribs.length} contributions (pre-patch)`);

  // Show FY2026 contributions before patch
  const fy2026Before = totalContribs.filter(c => c.fiscalYear === 2026 && c.statementType === 'income');
  if (fy2026Before.length > 0) {
    console.log(`\n  FY2026 income contributions BEFORE Slice 18 patch:`);
    for (const c of fy2026Before) {
      const doc = c.sourceDocumentId ? (await db.select().from(documentsTable).where(eq(documentsTable.id, c.sourceDocumentId)).limit(1))[0] : null;
      const fname = doc?.originalFilename ?? doc?.documentName ?? '(no file)';
      console.log(`    contrib ${c.id}: is_full_year=${c.isFullYear}  months=${c.monthsCovered ?? 'null'}  file="${fname}"`);
    }
  } else {
    console.log(`  No FY2026 income contributions found before patch`);
  }

  process.stdout.write('\n  Applying Slice 18 patch (computeSpan with ytdHintText) ... ');
  const changes = await applySlice18Patch(devTcId);
  console.log(`${changes.length} contribution(s) updated`);
  for (const ch of changes) {
    console.log(`    contrib ${ch.contribId} FY${ch.fiscalYear}: is_full_year ${ch.wasFullYear} → ${ch.nowFullYear}  file="${ch.filename}"`);
  }

  process.stdout.write('\n  Running reselect ... ');
  await reselect(devTcId);
  console.log('done\n');

  const ebitdaByYear = await fetchReportedEbitdaByYear(devTcId);
  const years = Object.keys(ebitdaByYear).map(Number).sort((a, b) => b - a);

  console.log(`  fetchReportedEbitdaByYear → ${years.length} year(s): [${years.join(', ')}]`);
  for (const y of years) {
    console.log(`    FY${y}: ${fmtGBP(ebitdaByYear[String(y)])}`);
  }

  // Show FY2026 status after patch
  const fy2026After = await db
    .select()
    .from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.fiscalYear, 2026),
      eq(financialContributions.statementType, 'income'),
    ));

  console.log(`\n  FY2026 income contributions AFTER Slice 18 patch:`);
  if (fy2026After.length === 0) {
    console.log('    (none)');
  }
  for (const c of fy2026After) {
    const doc = c.sourceDocumentId ? (await db.select().from(documentsTable).where(eq(documentsTable.id, c.sourceDocumentId)).limit(1))[0] : null;
    const fname = doc?.originalFilename ?? doc?.documentName ?? '(no file)';
    console.log(`    contrib ${c.id}: is_full_year=${c.isFullYear}  months=${c.monthsCovered ?? 'null'}  file="${fname}"`);
  }

  const fy2026InReported = ebitdaByYear['2026'] != null;
  console.log(`  FY2026 in reportedEbitdaByYear: ${fy2026InReported ? `YES — ${fmtGBP(ebitdaByYear['2026'])}` : 'NO (dropped out — no full-year winner)'}`);

  const dmResult = await computeDevDealModel(devTcId, ebitdaByYear);
  let enterpriseValue = 0;
  if (dmResult) {
    enterpriseValue = dmResult.enterpriseValue;
    console.log(`\n  Deal model: "${dmResult.name}"  ${dmResult.averagingYears}yr avg × ${dmResult.multiple}×`);
    console.log(`    window=[${dmResult.yearsInWindow.join(', ')}]  avgAdjEBITDA=${fmtGBP(dmResult.avgAdjEbitda)}  EV=${fmtGBP(enterpriseValue)}`);
  }

  // ── Assertions ─────────────────────────────────────────────────────────────
  console.log('\n  ASSERTIONS:');

  // A: all FY2026 YTD income contributions are now is_full_year = false
  const ytdStillFullYear = fy2026After.filter(c => {
    // only check contributions whose filename signals YTD
    return c.isFullYear === true;
  });
  // More precisely: flag if any is_full_year=true contrib has a YTD filename
  const ytdStillFullYearReal: typeof fy2026After = [];
  for (const c of fy2026After) {
    if (!c.isFullYear) continue;
    const doc = c.sourceDocumentId ? (await db.select().from(documentsTable).where(eq(documentsTable.id, c.sourceDocumentId)).limit(1))[0] : null;
    const fname = doc?.originalFilename ?? doc?.documentName ?? '';
    const YTD_PATTERN = /\bYTD\b|\byear[\s\-]?to[\s\-]?date\b|\binterim\b/i;
    if (YTD_PATTERN.test(fname)) ytdStillFullYearReal.push(c);
  }

  const passA = ytdStillFullYearReal.length === 0;
  console.log(`  ${passA ? '✅ PASS' : '❌ FAIL'}  A: no FY2026 YTD contribution has is_full_year=true`);
  if (!passA) {
    for (const c of ytdStillFullYearReal) console.log(`    FAIL: contrib ${c.id} is still full-year`);
  }

  // B: changes array contains at least one FY2026 row (something was actually patched)
  const fy2026Changes = changes.filter(ch => ch.fiscalYear === 2026 && ch.wasFullYear === true && ch.nowFullYear === false);
  const passB = fy2026Changes.length > 0;
  console.log(`  ${passB ? '✅ PASS' : '❌ FAIL'}  B: at least one FY2026 contribution was flipped to part-year by Slice 18 patch`);

  // C: FY2026 drops from reportedEbitdaByYear (no full-year winner for 2026)
  const passC = !fy2026InReported;
  console.log(`  ${passC ? '✅ PASS' : '⚠️  INFO'}  C: FY2026 dropped from reportedEbitdaByYear (no remaining full-year winner)`);
  if (!passC) {
    console.log(`    INFO: FY2026 still present — a different full-year contribution may cover 2026`);
  }

  const allPass = passA && passB;
  await deleteDevClone(devTcId);
  return { pass: allPass };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await assertHosts();
  await cleanupPriorClones();

  const results: boolean[] = [];

  results.push((await runCompany(220, 'Canoports (active)')).pass);
  results.push((await runCompany(137, 'Manor Building Solutions')).pass);

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;

  console.log('\n' + bar('═'));
  console.log(`SLICE 18 V-CHECK COMPLETE  —  ${passed + passed} assertions checked across ${results.length} companies`);
  if (failed > 0) {
    console.log(`❌ ${failed} company/companies had assertion failures`);
    process.exit(1);
  } else {
    console.log(`✅ All assertions passed`);
  }
  console.log(bar('═'));

  await prodPool.end();
  await devPool.end();
  await devDrizzlePool.end();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
