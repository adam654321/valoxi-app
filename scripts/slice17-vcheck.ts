/**
 * scripts/slice17-vcheck.ts
 *
 * Slice 17 — completed-year gate V-check.
 *
 * Clones prod tc=218 (Canoports cancelled) and tc=137 (Manor Building Solutions)
 * into dev, backfills financial_contributions, runs reselect (now with the
 * period_end <= today gate), then calls fetchReportedEbitdaByYear and asserts:
 *
 *   A. No fiscal_year > 2026 appears in the reported EBITDA map for either company.
 *   B. tc=218 averaging window no longer contains 2028–2030; EV is not ~£19M.
 *   C. tc=137 averaging window does not include 2027.
 *
 * READS:  PROD_DATABASE_URL  (never written to, host-fingerprint checked)
 * WRITES: DATABASE_URL       (dev heliumdb only, host-fingerprint checked)
 *
 * Run: npx tsx scripts/slice17-vcheck.ts
 */

import pg from 'pg';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
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
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
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

const TAG            = '[SLICE17-VCHECK]';
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
  for (const id of ids) {
    await deleteDevClone(id);
  }
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

// ─── Backfill financial_contributions from cloned periods ─────────────────────
async function backfillContributions(devTcId: number): Promise<void> {
  const periods = await db
    .select()
    .from(financialPeriods)
    .where(eq(financialPeriods.targetCompanyId, devTcId));

  const isRows = await db
    .select()
    .from(incomeStatements)
    .where(eq(incomeStatements.targetCompanyId, devTcId));

  const bsRows = await db
    .select()
    .from(balanceSheets)
    .where(eq(balanceSheets.targetCompanyId, devTcId));

  const periodById = new Map(periods.map(p => [p.id, p]));

  // income contributions
  for (const is_ of isRows) {
    const p = periodById.get(is_.financialPeriodId);
    if (!p) continue;
    const tier = p.sourceTier ?? (p.periodType === 'statutory' ? 'statutory' : 'management');
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId,
      fiscalYear: p.fiscalYear,
      statementType: 'income',
      sourceTier: tier,
      isFullYear: p.isFullYear ?? true,
      isPrimaryYear: true,
      monthsCovered: p.monthsCovered,
      periodEnd: p.periodEnd,
      sourceDocumentId: is_.sourceDocumentId ?? p.sourceDocumentId,
      figures: {
        revenue: is_.revenue, costOfSales: is_.costOfSales, grossProfit: is_.grossProfit,
        administrativeExpenses: is_.administrativeExpenses,
        depreciationAmortisation: is_.depreciationAmortisation,
        otherOperatingIncome: is_.otherOperatingIncome,
        operatingProfit: is_.operatingProfit,
        interestReceivable: is_.interestReceivable, interestPayable: is_.interestPayable,
        profitBeforeTax: is_.profitBeforeTax, corporationTax: is_.corporationTax,
        netProfit: is_.netProfit, staffCosts: is_.staffCosts,
        directorsRemuneration: is_.directorsRemuneration, dividendsPaid: is_.dividendsPaid,
      },
    }).onConflictDoNothing();
  }

  // balance contributions
  for (const bs of bsRows) {
    const p = periodById.get(bs.financialPeriodId);
    if (!p) continue;
    const tier = p.sourceTier ?? (p.periodType === 'statutory' ? 'statutory' : 'management');
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId,
      fiscalYear: p.fiscalYear,
      statementType: 'balance',
      sourceTier: tier,
      isFullYear: p.isFullYear ?? true,
      isPrimaryYear: true,
      monthsCovered: p.monthsCovered,
      periodEnd: p.periodEnd,
      sourceDocumentId: bs.sourceDocumentId ?? p.sourceDocumentId,
      figures: {
        totalEquity: bs.totalEquity, cashAtBank: bs.cashAtBank,
        tradeDebtors: bs.tradeDebtors, tradeCreditors: bs.tradeCreditors,
        bankLoansOverdraftCurrent: bs.bankLoansOverdraftCurrent,
        bankLoansLongTerm: bs.bankLoansLongTerm,
        retainedEarnings: bs.retainedEarnings,
      },
    }).onConflictDoNothing();
  }
}

// ─── Compute deal model EV from dev data ──────────────────────────────────────
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
    name: dm.name ?? '(unnamed)',
    averagingYears: dm.averagingYears ?? 3,
    multiple: toNum(dm.ebitdaMultiple),
    yearsInWindow,
    avgAdjEbitda: averageAdjustedEbitda,
    enterpriseValue: calc.enterpriseValue,
  };
}

// ─── ASSERT helpers ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? '  — ' + detail : ''}`);
    failed++;
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await assertHosts();

  // Clean prior clones from any previous run
  await cleanupPriorClones();

  const cases: Array<{ prodId: number; name: string; maxExpectedYear: number; forbiddenWindowYears: number[] }> = [
    { prodId: 218, name: 'Canoports UK Ltd (cancelled)', maxExpectedYear: 2026, forbiddenWindowYears: [2027, 2028, 2029, 2030] },
    { prodId: 137, name: 'Manor Building Solutions',    maxExpectedYear: 2026, forbiddenWindowYears: [2027] },
  ];

  for (const { prodId, name, maxExpectedYear, forbiddenWindowYears } of cases) {
    console.log('\n' + bar('═'));
    console.log(`tc=${prodId}  ${name}`);
    console.log(bar('─'));

    // 1. Clone
    process.stdout.write('  Cloning prod → dev ... ');
    const { devTcId } = await cloneCompany(prodId, name);
    console.log(`devTcId=${devTcId}`);

    // 2. Backfill contributions
    process.stdout.write('  Backfilling financial_contributions ... ');
    await backfillContributions(devTcId);
    const contribCount = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, devTcId));
    console.log(`${contribCount.length} contributions`);

    // 3. Reselect (now with period_end <= today gate)
    process.stdout.write('  Running reselect ... ');
    await reselect(devTcId);
    console.log('done');

    // 4. Fetch reported EBITDA (the gated function)
    const ebitdaByYear = await fetchReportedEbitdaByYear(devTcId);
    const yearsReturned = Object.keys(ebitdaByYear).map(Number).sort();
    console.log(`\n  fetchReportedEbitdaByYear → ${yearsReturned.length} years: [${yearsReturned.join(', ')}]`);
    for (const [yr, val] of Object.entries(ebitdaByYear).sort()) {
      console.log(`    FY${yr}: ${fmtGBP(val)}`);
    }

    // 5. Deal model
    const dm = await computeDevDealModel(devTcId, ebitdaByYear);
    if (dm) {
      console.log(`\n  Deal model: "${dm.name}"  ${dm.averagingYears}yr avg × ${dm.multiple}×`);
      console.log(`    window=[${dm.yearsInWindow.join(', ')}]  avgAdjEBITDA=${fmtGBP(dm.avgAdjEbitda)}  EV=${fmtGBP(dm.enterpriseValue)}`);
    }

    // ─── ASSERTIONS ───────────────────────────────────────────────────────────
    console.log('\n  ASSERTIONS:');

    // A: no fiscal year > maxExpectedYear
    const futureYears = yearsReturned.filter(y => y > maxExpectedYear);
    assert(
      `A: no fiscal_year > ${maxExpectedYear} in reportedEbitdaByYear`,
      futureYears.length === 0,
      futureYears.length > 0 ? `found: [${futureYears.join(', ')}]` : undefined,
    );

    // B: forbidden years not in averaging window
    if (dm) {
      const windowYears = dm.yearsInWindow.map(Number);
      const windowHasForbidden = forbiddenWindowYears.filter(y => windowYears.includes(y));
      assert(
        `B: averaging window excludes future years [${forbiddenWindowYears.join(', ')}]`,
        windowHasForbidden.length === 0,
        windowHasForbidden.length > 0 ? `window contains: [${windowHasForbidden.join(', ')}]` : undefined,
      );
    }

    // C (tc=218 specific): EV is not ~£19M (forecast-inflated)
    if (prodId === 218 && dm) {
      assert(
        `C: tc=218 EV is not ~£19M (was £19,074,045 with forecast window)`,
        dm.enterpriseValue < 10_000_000,
        `EV=${fmtGBP(dm.enterpriseValue)}`,
      );
    }

    // D: exactly one IS row per completed fiscal year
    const isRows = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, devTcId));
    const yearCounts = new Map<number | null, number>();
    const periodMap2 = new Map<number, { fiscalYear: number | null; periodEnd: string | null }>();
    const allPeriods = await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, devTcId));
    for (const p of allPeriods) periodMap2.set(p.id, { fiscalYear: p.fiscalYear, periodEnd: p.periodEnd });

    for (const is_ of isRows) {
      const pInfo = periodMap2.get(is_.financialPeriodId);
      if (!pInfo?.periodEnd) continue;
      if (pInfo.periodEnd > TODAY) continue; // future — should have been gated out
      const fy = pInfo.fiscalYear;
      yearCounts.set(fy, (yearCounts.get(fy) ?? 0) + 1);
    }
    const duplicateYears = [...yearCounts.entries()].filter(([, c]) => c > 1).map(([y]) => y);
    assert(
      `D: no duplicate IS rows for completed fiscal years`,
      duplicateYears.length === 0,
      duplicateYears.length > 0 ? `duplicates: [${duplicateYears.join(', ')}]` : undefined,
    );

    // Cleanup this clone immediately
    await deleteDevClone(devTcId);
    console.log(`  Cleaned up devTcId=${devTcId}`);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n' + bar('═'));
  console.log(`SLICE 17 V-CHECK COMPLETE  —  ${passed} passed / ${failed} failed`);
  console.log(bar('═'));

  await prodPool.end();
  await devPool.end();
  await devDrizzlePool.end();

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('V-CHECK FATAL:', err);
  process.exit(1);
});
