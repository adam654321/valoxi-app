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

// Mirror of fetchReportedEbitdaByYear — SELECT only
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

// Mirror of buildCalcInputs — uses already-fetched raw pg rows
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

function fmt(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  const client = await pool.connect();
  try {
    // Identity guard
    const guard = await client.query(
      `SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 3`
    );
    const names = guard.rows.map((r: any) => r.last_name);
    const env = names.includes('Coxon') ? 'PROD' : names.includes('David') ? 'DEV' : 'UNKNOWN';
    console.log(`\n=== IDENTITY GUARD: last_name hits = [${names.join(', ')}] — branch = ${env} ===`);

    // Load all deal models with company name
    const modelsRes = await client.query(`
      SELECT dm.*, tc.company_name
      FROM deal_models dm
      JOIN target_companies tc ON tc.id = dm.target_company_id
      ORDER BY dm.id
    `);
    const models = modelsRes.rows;
    console.log(`\n=== STEP 1: Total deal_models count ===`);
    console.log(`  Total: ${models.length}`);

    const results: Array<{
      id: number;
      company: string;
      stored: number | null;
      fresh: number;
      absDiff: number;
      pctDiff: number;
      isLocked: boolean;
      updatedAt: string;
    }> = [];

    for (const model of models) {
      const [adjRes, flRes, spRes, ccRes] = await Promise.all([
        client.query(`SELECT * FROM deal_model_adjustments WHERE deal_model_id = $1`, [model.id]),
        client.query(`SELECT * FROM deal_model_funding_lines WHERE deal_model_id = $1`, [model.id]),
        client.query(`SELECT * FROM deal_model_seller_payments WHERE deal_model_id = $1`, [model.id]),
        client.query(`SELECT * FROM deal_model_contingent_consideration WHERE deal_model_id = $1`, [model.id]),
      ]);

      const reportedEbitdaByYear = await fetchReportedEbitdaByYear(client, model.target_company_id);
      const { adjustments, fundingLines, sellerPayments, contingentConsideration, modelInput } =
        buildCalcInputs(model, adjRes.rows, flRes.rows, spRes.rows, ccRes.rows);

      const result = calculateFullDealModel(
        reportedEbitdaByYear,
        adjustments,
        fundingLines,
        modelInput,
        sellerPayments,
        contingentConsideration
      );

      const stored = model.total_purchase_price != null ? Number(model.total_purchase_price) : null;
      const fresh = result.offerPrice;
      const absDiff = stored != null ? Math.abs(stored - fresh) : fresh;
      const pctDiff = stored != null && fresh !== 0 ? (Math.abs(stored - fresh) / Math.abs(fresh)) * 100 : 0;

      results.push({
        id: model.id,
        company: model.company_name,
        stored,
        fresh,
        absDiff,
        pctDiff,
        isLocked: model.is_locked ?? false,
        updatedAt: model.updated_at ? new Date(model.updated_at).toISOString().split('T')[0] : 'NULL',
      });
    }

    // Partition
    const THRESHOLD = 1; // £1
    const unlockedDivergent = results.filter(r => !r.isLocked && r.absDiff > THRESHOLD);
    const lockedDivergent   = results.filter(r =>  r.isLocked && r.absDiff > THRESHOLD);
    const clean             = results.filter(r => r.absDiff <= THRESHOLD);

    console.log(`\n=== STEP 2: Summary ===`);
    console.log(`  Total models:                          ${results.length}`);
    console.log(`  Clean (diff <= £1, any lock state):   ${clean.length}`);
    console.log(`  Unlocked with staleness (diff > £1):  ${unlockedDivergent.length}  ← genuine staleness candidates`);
    console.log(`  Locked with frozen divergence (> £1): ${lockedDivergent.length}   (frozen-by-design, not a bug)`);

    if (unlockedDivergent.length > 0) {
      const maxAbs = Math.max(...unlockedDivergent.map(r => r.absDiff));
      const maxPct = Math.max(...unlockedDivergent.map(r => r.pctDiff));
      console.log(`\n=== STEP 3: Unlocked-divergent detail ===`);
      for (const r of unlockedDivergent) {
        console.log(`\n  Model ID: ${r.id}  |  Company: ${r.company}  |  isLocked: ${r.isLocked}  |  updatedAt: ${r.updatedAt}`);
        console.log(`  stored total_purchase_price: ${r.stored != null ? fmt(r.stored) : 'NULL'}`);
        console.log(`  fresh  offerPrice (runtime): ${fmt(r.fresh)}`);
        console.log(`  Absolute diff: ${fmt(r.absDiff)}  |  % diff: ${r.pctDiff.toFixed(3)}%`);
      }
      console.log(`\n  Max absolute divergence (unlocked): ${fmt(maxAbs)}`);
      console.log(`  Max % divergence (unlocked):        ${maxPct.toFixed(3)}%`);
    } else {
      console.log(`\n  No unlocked models with staleness > £1 detected.`);
    }

    if (lockedDivergent.length > 0) {
      console.log(`\n=== STEP 4: Locked-divergent detail (frozen-by-design) ===`);
      for (const r of lockedDivergent) {
        console.log(`\n  Model ID: ${r.id}  |  Company: ${r.company}  |  isLocked: ${r.isLocked}  |  updatedAt: ${r.updatedAt}`);
        console.log(`  stored total_purchase_price: ${r.stored != null ? fmt(r.stored) : 'NULL'}`);
        console.log(`  fresh  offerPrice (runtime): ${fmt(r.fresh)}`);
        console.log(`  Absolute diff: ${fmt(r.absDiff)}  |  % diff: ${r.pctDiff.toFixed(3)}%`);
      }
    }

    console.log(`\n=== WRITE-SAFETY CONFIRMATION ===`);
    console.log(`  SELECT + in-memory only. No INSERT/UPDATE/DELETE/ALTER/DDL.`);
    console.log(`  recalculate() and .update() were NOT called.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
