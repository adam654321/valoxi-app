import pg from 'pg';
const { Pool } = pg;

// READ-ONLY script — SELECT + in-memory calculation only.
// No INSERT/UPDATE/DELETE/ALTER/DDL. No recalculate(). No .update().

import { calculateFullDealModel, toNum } from '../shared/calculators/deal-model.calc';
import type {
  AdjustmentInput,
  FundingLineInput,
  SellerPaymentInput,
  ContingentConsiderationInput,
  DealModelInput,
} from '../shared/calculators/deal-model.calc';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fetchReportedEbitdaByYear(
  client: pg.PoolClient,
  targetCompanyId: number
): Promise<{ map: Record<string, number>; rowCount: number }> {
  const res = await client.query(`
    SELECT fp.fiscal_year, fp.period_end,
           ist.operating_profit, ist.depreciation_amortisation
    FROM income_statements ist
    JOIN financial_periods fp ON ist.financial_period_id = fp.id
    WHERE ist.target_company_id = $1
    ORDER BY fp.period_end DESC
  `, [targetCompanyId]);

  const map: Record<string, number> = {};
  for (const row of res.rows) {
    const year = row.fiscal_year?.toString()
      || (row.period_end ? new Date(row.period_end).getFullYear().toString() : null);
    if (!year) continue;
    const op = toNum(row.operating_profit);
    const da = toNum(row.depreciation_amortisation);
    map[year] = op + da;
  }
  return { map, rowCount: res.rows.length };
}

function buildCalcInputs(
  model: any,
  adjustments: any[],
  fundingLines: any[],
  sellerPayments: any[],
  contingentConsideration: any[]
): {
  adjustments: AdjustmentInput[];
  fundingLines: FundingLineInput[];
  sellerPayments: SellerPaymentInput[];
  contingentConsideration: ContingentConsiderationInput[];
  modelInput: DealModelInput;
  filteredOutFundingLines: any[];
} {
  const adjInputs: AdjustmentInput[] = adjustments.map(a => ({
    adjustmentType: a.adjustment_type as 'add_back' | 'deduction',
    amount: a.amount,
    amountsByYear: a.amounts_by_year as Record<string, number> | null,
    status: a.status || 'suggested',
    userOverrideAmount: null,
  }));

  const filteredOutFundingLines = fundingLines.filter(
    f => f.funding_type === 'seller_financing' || f.funding_type === 'earnout'
  );

  const flInputs: FundingLineInput[] = fundingLines
    .filter(f => f.funding_type !== 'seller_financing' && f.funding_type !== 'earnout')
    .map(f => ({
      fundingType: f.funding_type,
      assetBaseValue: f.asset_base_value,
      ltvPercent: f.ltv_percent,
      amountUsed: f.amount_used,
      interestRate: f.interest_rate,
      termMonths: f.term_months,
      arrangementFeePercent: f.arrangement_fee_percent ?? null,
      isDebt: f.is_debt ?? false,
      repaymentStructure: f.repayment_structure ?? 'amortizing',
      isActive: f.is_active ?? false,
    }));

  const spInputs: SellerPaymentInput[] = sellerPayments.map(s => ({
    amount: s.amount,
    termMonths: s.term_months,
    interestRate: s.interest_rate,
    includeInDscr: s.include_in_dscr ?? true,
    isActive: s.is_active ?? false,
  }));

  const ccInputs: ContingentConsiderationInput[] = contingentConsideration.map(c => ({
    maximumAmount: c.maximum_amount,
    termMonths: c.term_months,
    interestRate: c.interest_rate,
    includeInDscr: c.include_in_dscr ?? true,
    isActive: c.is_active ?? false,
  }));

  const modelInput: DealModelInput = {
    averagingYears: model.averaging_years ?? 3,
    ebitdaMultiple: model.ebitda_multiple ?? '3.0',
    plusExcessCash: model.cash_value ?? '0',
    minusPrimaryDebt: model.minus_primary_debt ?? '0',
    minusOtherDebt: model.minus_other_debt ?? '0',
    minusCorpTaxDue: model.minus_corp_tax_due ?? '0',
    minusWorkingCapitalAdj: model.minus_working_capital_adj ?? '0',
    plusPropertyValue: model.property_value ?? '0',
    otherAdjustments: null,
    feeLegalDdAmount: model.fee_legal_dd_amount ?? '0',
    feeAccountingDdAmount: model.fee_accounting_dd_amount ?? '0',
    feeLoanArrangementAmount: model.fee_loan_arrangement_amount ?? '0',
    feeDealMakerAmount: model.fee_deal_maker_amount ?? '0',
    customFees: (model.custom_fees as Array<{ label: string; amount: string | number }>) ?? [],
  };

  return { adjustments: adjInputs, fundingLines: flInputs, sellerPayments: spInputs, contingentConsideration: ccInputs, modelInput, filteredOutFundingLines };
}

function fmt(n: number | null | undefined): string {
  if (n == null) return 'NULL';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtRaw(v: any): string {
  if (v == null) return 'NULL';
  const n = Number(v);
  return isNaN(n) ? String(v) : fmt(n);
}

async function diagnoseModel(client: pg.PoolClient, modelId: number) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  MODEL ID: ${modelId}`);
  console.log(`${'═'.repeat(70)}`);

  // ── A. Stored row ────────────────────────────────────────────────────────
  const modelRes = await client.query(`
    SELECT dm.*, tc.company_name
    FROM deal_models dm
    JOIN target_companies tc ON tc.id = dm.target_company_id
    WHERE dm.id = $1
  `, [modelId]);

  if (modelRes.rows.length === 0) {
    console.log('  NOT FOUND — skipping.');
    return;
  }
  const m = modelRes.rows[0];

  console.log(`\n── A. STORED ROW  (company: ${m.company_name}) ──`);
  console.log(`  total_purchase_price:    ${fmtRaw(m.total_purchase_price)}`);
  console.log(`  enterprise_value:        ${fmtRaw(m.enterprise_value)}`);
  console.log(`  adjusted_ebitda:         ${fmtRaw(m.adjusted_ebitda)}`);
  console.log(`  calculated_ebitda:       ${fmtRaw(m.calculated_ebitda)}`);
  console.log(`  ebitda_multiple:         ${m.ebitda_multiple}`);
  console.log(`  averaging_years:         ${m.averaging_years}`);
  console.log(`  updated_at:              ${m.updated_at ? new Date(m.updated_at).toISOString() : 'NULL'}`);
  console.log(`  is_locked:               ${m.is_locked}`);
  console.log(`  EV bridge fields:`);
  console.log(`    plus_excess_cash:      ${fmtRaw(m.cash_value)}`);
  console.log(`    minus_primary_debt:    ${fmtRaw(m.minus_primary_debt)}`);
  console.log(`    minus_other_debt:      ${fmtRaw(m.minus_other_debt)}`);
  console.log(`    minus_corp_tax_due:    ${fmtRaw(m.minus_corp_tax_due)}`);
  console.log(`    minus_working_capital: ${fmtRaw(m.minus_working_capital_adj)}`);
  console.log(`    plus_property_value:   ${fmtRaw(m.property_value)}`);

  // ── B. Live reported EBITDA ──────────────────────────────────────────────
  const { map: reportedEbitdaByYear, rowCount } = await fetchReportedEbitdaByYear(client, m.target_company_id);
  const yearEntries = Object.entries(reportedEbitdaByYear).sort((a, b) => b[0].localeCompare(a[0]));
  const ebitdaEmpty = yearEntries.length === 0;

  console.log(`\n── B. LIVE REPORTED EBITDA (fetchReportedEbitdaByYear NOW) ──`);
  console.log(`  income_statement rows for target_company_id=${m.target_company_id}: ${rowCount}`);
  if (ebitdaEmpty) {
    console.log(`  *** ZERO ROWS — reportedEbitdaByYear is EMPTY ***`);
  } else {
    for (const [yr, val] of yearEntries) {
      console.log(`  ${yr}: ${fmt(val)}`);
    }
  }

  // ── C. Adjustments ───────────────────────────────────────────────────────
  const adjRes = await client.query(
    `SELECT adjustment_type, status, amount FROM deal_model_adjustments WHERE deal_model_id = $1`,
    [modelId]
  );
  const adjAll = adjRes.rows;
  const accepted = adjAll.filter(a => a.status === 'accepted' || a.status === 'modified');
  const addBacks = accepted.filter(a => a.adjustment_type === 'add_back');
  const deductions = accepted.filter(a => a.adjustment_type === 'deduction');
  const sumOf = (rows: any[]) => rows.reduce((s, r) => s + toNum(r.amount), 0);

  console.log(`\n── C. ADJUSTMENTS ──`);
  console.log(`  Total rows: ${adjAll.length}  |  accepted/modified: ${accepted.length}`);
  console.log(`  Add-backs (${addBacks.length}): sum = ${fmt(sumOf(addBacks))}`);
  console.log(`  Deductions (${deductions.length}): sum = ${fmt(sumOf(deductions))}`);

  // ── D. Funding lines ─────────────────────────────────────────────────────
  const flRes = await client.query(
    `SELECT id, funding_type, is_active, amount_used, is_debt, interest_rate, term_months, repayment_structure
     FROM deal_model_funding_lines WHERE deal_model_id = $1 ORDER BY id`,
    [modelId]
  );
  const flAll = flRes.rows;
  const sellerEarnoutRows = flAll.filter(f => f.funding_type === 'seller_financing' || f.funding_type === 'earnout');

  console.log(`\n── D. FUNDING LINES (ALL rows, including seller_financing/earnout) ──`);
  console.log(`  Total rows: ${flAll.length}`);
  if (flAll.length === 0) {
    console.log('  (none)');
  } else {
    for (const f of flAll) {
      const filtered = f.funding_type === 'seller_financing' || f.funding_type === 'earnout';
      console.log(`  ID ${f.id}: type=${f.funding_type}  isActive=${f.is_active}  amountUsed=${fmtRaw(f.amount_used)}  isDebt=${f.is_debt}  rate=${f.interest_rate}%  term=${f.term_months}m  repayment=${f.repayment_structure}${filtered ? '  *** FILTERED OUT by buildCalcInputs ***' : ''}`);
    }
  }
  if (sellerEarnoutRows.length > 0) {
    const activeSE = sellerEarnoutRows.filter(f => f.is_active);
    const sumSE = activeSE.reduce((s, f) => s + toNum(f.amount_used), 0);
    console.log(`  *** POSSIBLE CAUSE 2: ${sellerEarnoutRows.length} seller_financing/earnout funding_line row(s) exist (${activeSE.length} active, active total: ${fmt(sumSE)}) — filtered out of current buildCalcInputs ***`);
  } else {
    console.log(`  No seller_financing/earnout rows in funding_lines.`);
  }

  // ── E. Seller payments & contingent consideration ────────────────────────
  const spRes = await client.query(
    `SELECT id, amount, is_active, term_months, interest_rate FROM deal_model_seller_payments WHERE deal_model_id = $1`,
    [modelId]
  );
  const ccRes = await client.query(
    `SELECT id, maximum_amount, is_active, term_months FROM deal_model_contingent_consideration WHERE deal_model_id = $1`,
    [modelId]
  );
  const spActive = spRes.rows.filter(r => r.is_active);
  const ccActive = ccRes.rows.filter(r => r.is_active);
  const spSum = spActive.reduce((s, r) => s + toNum(r.amount), 0);
  const ccSum = ccActive.reduce((s, r) => s + toNum(r.maximum_amount), 0);

  console.log(`\n── E. SELLER PAYMENTS & CONTINGENT CONSIDERATION ──`);
  console.log(`  seller_payments: ${spRes.rows.length} rows  |  ${spActive.length} active  |  active total: ${fmt(spSum)}`);
  console.log(`  contingent_consideration: ${ccRes.rows.length} rows  |  ${ccActive.length} active  |  active total: ${fmt(ccSum)}`);

  // ── F. Fresh recompute ───────────────────────────────────────────────────
  const { adjustments, fundingLines, sellerPayments, contingentConsideration, modelInput, filteredOutFundingLines } =
    buildCalcInputs(m, adjAll, flAll, spRes.rows, ccRes.rows);

  const result = calculateFullDealModel(
    reportedEbitdaByYear, adjustments, fundingLines, modelInput, sellerPayments, contingentConsideration
  );

  const multiple = toNum(modelInput.ebitdaMultiple);
  const plusExcessCash      = toNum(modelInput.plusExcessCash);
  const minusPrimaryDebt    = toNum(modelInput.minusPrimaryDebt);
  const minusOtherDebt      = toNum(modelInput.minusOtherDebt);
  const minusCorpTaxDue     = toNum(modelInput.minusCorpTaxDue);
  const minusWorkingCapital = toNum(modelInput.minusWorkingCapitalAdj);
  const plusPropertyValue   = toNum(modelInput.plusPropertyValue);

  console.log(`\n── F. FRESH RECOMPUTE ──`);
  console.log(`  averageAdjustedEbitda:   ${fmt(result.averageAdjustedEbitda)}`);
  console.log(`  receivablesInterestAnnual: ${fmt(result.receivablesInterestAnnual)}`);
  console.log(`  valuationEbitda:         ${fmt(result.valuationEbitda)}  ← fed to EV calc`);
  console.log(`  ebitdaMultiple:          ${multiple}x`);
  console.log(`  enterpriseValue:         ${fmt(result.enterpriseValue)}  (= valuationEbitda × ${multiple}x)`);
  console.log(`  offerPrice term-by-term:`);
  console.log(`    enterpriseValue:       ${fmt(result.enterpriseValue)}`);
  console.log(`    + plusExcessCash:      ${fmt(plusExcessCash)}`);
  console.log(`    - minusPrimaryDebt:    ${fmt(minusPrimaryDebt)}`);
  console.log(`    - minusOtherDebt:      ${fmt(minusOtherDebt)}`);
  console.log(`    - minusCorpTaxDue:     ${fmt(minusCorpTaxDue)}`);
  console.log(`    - minusWorkingCapital: ${fmt(minusWorkingCapital)}`);
  console.log(`    + plusPropertyValue:   ${fmt(plusPropertyValue)}`);
  console.log(`    ──────────────────────────────`);
  console.log(`    = fresh offerPrice:    ${fmt(result.offerPrice)}`);

  // ── G. Reconciliation & classification ──────────────────────────────────
  const stored = m.total_purchase_price != null ? Number(m.total_purchase_price) : null;
  const fresh  = result.offerPrice;
  const absDiff = stored != null ? Math.abs(stored - fresh) : Math.abs(fresh);
  const pctDiff = stored != null && fresh !== 0
    ? (Math.abs(stored - fresh) / Math.abs(fresh)) * 100
    : 0;

  // Stored EV / multiple → implied stored EBITDA at time of last save
  const storedEV = m.enterprise_value != null ? Number(m.enterprise_value) : null;
  const impliedStoredEbitda = storedEV != null && multiple > 0 ? storedEV / multiple : null;
  const freshAvgEbitda = result.averageAdjustedEbitda;

  let causeHint: string;
  if (ebitdaEmpty) {
    causeHint = '*** LIKELY CAUSE 1: reportedEbitdaByYear is EMPTY — financials missing or drifted to zero ***';
  } else if (impliedStoredEbitda != null && Math.abs(impliedStoredEbitda - freshAvgEbitda) > 1000) {
    const ebitdaDrift = impliedStoredEbitda - freshAvgEbitda;
    const driftFromSF = sellerEarnoutRows.length > 0
      ? ' | also check CAUSE 2: seller_financing/earnout funding rows present'
      : '';
    causeHint = `*** LIKELY CAUSE 1: EBITDA drift — implied stored EBITDA ${fmt(impliedStoredEbitda)} vs fresh ${fmt(freshAvgEbitda)} (drift: ${fmt(Math.abs(ebitdaDrift))})${driftFromSF} ***`;
  } else if (sellerEarnoutRows.length > 0) {
    causeHint = '*** POSSIBLE CAUSE 2: seller_financing/earnout funding_line rows exist (filtered out by buildCalcInputs) ***';
  } else {
    causeHint = 'NEEDS MANUAL READ — stored EBITDA and bridge terms align with fresh; check fee or funding-stack deltas';
  }

  console.log(`\n── G. RECONCILIATION ──`);
  console.log(`  stored total_purchase_price: ${stored != null ? fmt(stored) : 'NULL'}`);
  console.log(`  fresh  offerPrice:           ${fmt(fresh)}`);
  console.log(`  Absolute diff: ${fmt(absDiff)}  |  % diff: ${pctDiff.toFixed(3)}%`);
  if (impliedStoredEbitda != null) {
    console.log(`  Implied stored EBITDA (stored EV / multiple): ${fmt(impliedStoredEbitda)}`);
    console.log(`  Fresh averageAdjustedEbitda:                  ${fmt(freshAvgEbitda)}`);
    console.log(`  EBITDA drift (stored implied − fresh):        ${fmt(impliedStoredEbitda - freshAvgEbitda)}`);
  }
  console.log(`  Classification: ${causeHint}`);
}

async function main() {
  const client = await pool.connect();
  try {
    const guard = await client.query(
      `SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 3`
    );
    const names = guard.rows.map((r: any) => r.last_name);
    const env = names.includes('Coxon') ? 'PROD' : names.includes('David') ? 'DEV' : 'UNKNOWN';
    console.log(`\n=== IDENTITY GUARD: [${names.join(', ')}] — branch = ${env} ===`);

    const devIds  = [34, 49, 13];
    const prodIds = [55, 57, 64, 84];
    const modelIds = env === 'PROD' ? prodIds : devIds;

    console.log(`Running deep diagnostic for model IDs: ${modelIds.join(', ')}`);

    for (const id of modelIds) {
      await diagnoseModel(client, id);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`=== WRITE-SAFETY CONFIRMATION ===`);
    console.log(`  SELECT + in-memory only. No INSERT/UPDATE/DELETE/ALTER/DDL.`);
    console.log(`  recalculate() and .update() were NOT called.`);
    console.log(`${'═'.repeat(70)}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
