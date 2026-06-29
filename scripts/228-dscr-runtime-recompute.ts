import pg from 'pg';
const { Pool } = pg;

// READ-ONLY script — SELECT statements and in-memory calculation only.
// No INSERT/UPDATE/DELETE/ALTER/DDL. No call to recalculate or .update().

import { calculateFullDealModel, toNum } from '../shared/calculators/deal-model.calc';
import type {
  AdjustmentInput,
  FundingLineInput,
  SellerPaymentInput,
  ContingentConsiderationInput,
  DealModelInput,
} from '../shared/calculators/deal-model.calc';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Mirror of fetchReportedEbitdaByYear from deal-model.service.ts — SELECT only
async function fetchReportedEbitdaByYear(
  client: pg.PoolClient,
  targetCompanyId: number
): Promise<Record<string, number>> {
  const res = await client.query(`
    SELECT
      fp.fiscal_year,
      fp.period_end,
      ist.operating_profit,
      ist.depreciation_amortisation
    FROM income_statements ist
    JOIN financial_periods fp ON ist.financial_period_id = fp.id
    WHERE ist.target_company_id = $1
    ORDER BY fp.period_end DESC
  `, [targetCompanyId]);

  const result: Record<string, number> = {};
  for (const row of res.rows) {
    const year = row.fiscal_year?.toString()
      || (row.period_end ? new Date(row.period_end).getFullYear().toString() : null);
    if (!year) continue;
    const op = toNum(row.operating_profit);
    const da = toNum(row.depreciation_amortisation);
    result[year] = op + da;
  }
  return result;
}

// Mirror of buildCalcInputs from deal-model.service.ts — uses already-fetched rows
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
} {
  const adjInputs: AdjustmentInput[] = adjustments.map(a => ({
    adjustmentType: a.adjustment_type as 'add_back' | 'deduction',
    amount: a.amount,
    amountsByYear: a.amounts_by_year as Record<string, number> | null,
    status: a.status || 'suggested',
    userOverrideAmount: null,
  }));

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

  return { adjustments: adjInputs, fundingLines: flInputs, sellerPayments: spInputs, contingentConsideration: ccInputs, modelInput };
}

function fmt(n: number | null | undefined): string {
  if (n == null) return 'null';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function processModelIds(client: pg.PoolClient, modelIds: number[]) {
  for (const modelId of modelIds) {
    // Load model row
    const modelRes = await client.query(`
      SELECT dm.*, tc.company_name
      FROM deal_models dm
      JOIN target_companies tc ON tc.id = dm.target_company_id
      WHERE dm.id = $1
    `, [modelId]);

    if (modelRes.rows.length === 0) {
      console.log(`\n  Model ID ${modelId}: NOT FOUND`);
      continue;
    }
    const model = modelRes.rows[0];

    // Load related rows
    const [adjRes, flRes, spRes, ccRes] = await Promise.all([
      client.query(`SELECT * FROM deal_model_adjustments WHERE deal_model_id = $1`, [modelId]),
      client.query(`SELECT * FROM deal_model_funding_lines WHERE deal_model_id = $1`, [modelId]),
      client.query(`SELECT * FROM deal_model_seller_payments WHERE deal_model_id = $1`, [modelId]),
      client.query(`SELECT * FROM deal_model_contingent_consideration WHERE deal_model_id = $1`, [modelId]),
    ]);

    // Fetch reported EBITDA by year
    const reportedEbitdaByYear = await fetchReportedEbitdaByYear(client, model.target_company_id);

    // Build inputs (mirrors buildCalcInputs)
    const { adjustments, fundingLines, sellerPayments, contingentConsideration, modelInput } =
      buildCalcInputs(model, adjRes.rows, flRes.rows, spRes.rows, ccRes.rows);

    // Run canonical calc — same as computeFor(), no writes
    const result = calculateFullDealModel(
      reportedEbitdaByYear,
      adjustments,
      fundingLines,
      modelInput,
      sellerPayments,
      contingentConsideration
    );

    const dscrNumerator = result.averageAdjustedEbitda - result.revolvingInterestAnnual;
    const storedAdjEbitda = model.adjusted_ebitda != null ? Number(model.adjusted_ebitda) : null;
    const storedMatchesRuntime = storedAdjEbitda != null
      ? Math.abs(storedAdjEbitda - result.averageAdjustedEbitda) < 0.01
      : null;
    const displayDivergesFromDscr = Math.abs(result.averageAdjustedEbitda - dscrNumerator) > 0.001;

    console.log(`\n  ── Model ID: ${modelId}  |  Company: ${model.company_name} ──`);
    console.log(`  averageAdjustedEbitda (runtime):       ${fmt(result.averageAdjustedEbitda)}`);
    console.log(`  revolvingInterestAnnual:               ${fmt(result.revolvingInterestAnnual)}`);
    console.log(`  receivablesInterestAnnual:             ${fmt(result.receivablesInterestAnnual)}`);
    console.log(`  valuationEbitda:                       ${fmt(result.valuationEbitda)}`);
    console.log(`  derived dscrNumerator (avg - revolving): ${fmt(dscrNumerator)}`);
    console.log(`  totalAnnualDebtService:                ${fmt(result.totalAnnualDebtService)}`);
    console.log(`  paymentCoverRatio:                     ${result.paymentCoverRatio != null ? result.paymentCoverRatio.toFixed(4) + 'x' : 'null (no_debt)'}`);
    console.log(`  stored adjusted_ebitda (DB column):    ${storedAdjEbitda != null ? fmt(storedAdjEbitda) : 'NULL'}`);
    console.log(`  stored == runtime averageAdjustedEbitda? ${storedMatchesRuntime == null ? 'n/a' : storedMatchesRuntime ? 'YES — store holds raw average' : 'NO — store differs from runtime'}`);
    console.log(`  averageAdjustedEbitda != dscrNumerator? ${displayDivergesFromDscr ? 'YES — display base inflated; revolving deduction is hidden in dscrNumerator only' : 'NO — no revolving deduction active'}`);
    if (displayDivergesFromDscr) {
      const pct = (result.revolvingInterestAnnual / result.averageAdjustedEbitda) * 100;
      console.log(`  Display DSCR numerator overstatement:  ${fmt(result.revolvingInterestAnnual)} (${pct.toFixed(3)}% of averageAdjustedEbitda)`);
    }
  }
}

async function main() {
  const client = await pool.connect();
  try {
    // Identity guard
    const guard = await client.query(`SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 3`);
    const names = guard.rows.map((r: any) => r.last_name);
    const env = names.includes('Coxon') ? 'PROD' : names.includes('David') ? 'DEV' : 'UNKNOWN';
    console.log(`\n=== IDENTITY GUARD: last_name hits = [${names.join(', ')}] — branch = ${env} ===`);

    const devIds  = [13, 32, 51, 54];
    const prodIds = [64, 76, 84, 96, 106];
    const modelIds = env === 'PROD' ? prodIds : devIds;

    console.log(`\n=== RUNTIME RECOMPUTE for model IDs: ${modelIds.join(', ')} ===`);
    await processModelIds(client, modelIds);

    console.log('\n=== WRITE-SAFETY CONFIRMATION ===');
    console.log('  This script contains only SELECT statements and in-memory calculation.');
    console.log('  No INSERT, UPDATE, DELETE, ALTER, DDL executed.');
    console.log('  recalculate() and dealModelRepository.update() were NOT called.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
