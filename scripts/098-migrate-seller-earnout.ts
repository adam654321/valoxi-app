import { db } from '../server/db';
import { dealModelRepository } from '../server/repositories/deal-model.repository';
import { fundingLineToSellerPayment, fundingLineToContingent } from './098-funding-mappers';
import {
  calculateFullDealModel,
  type FundingLineInput, type SellerPaymentInput, type ContingentConsiderationInput,
} from '../shared/calculators/deal-model.calc';

const DEFERRED_TYPES = ['seller_financing', 'earnout'];

// Map a funding line to FundingLineInput (mirror of buildCalcInputs, for the proof only).
function toFundingInput(f: any): FundingLineInput {
  return {
    fundingType: f.fundingType, assetBaseValue: f.assetBaseValue, ltvPercent: f.ltvPercent,
    amountUsed: f.amountUsed, interestRate: f.interestRate, termMonths: f.termMonths,
    arrangementFeePercent: f.arrangementFeePercent ?? null, isDebt: f.isDebt ?? false,
    repaymentStructure: f.repaymentStructure ?? 'amortizing',
    interestAsEbitdaAdjustment: f.interestAsEbitdaAdjustment ?? false, isActive: f.isActive ?? false,
  };
}

async function parityProof(modelIds: number[]): Promise<boolean> {
  let mismatches = 0;
  for (const id of modelIds) {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) { console.log(`model ${id}: NOT FOUND, skipping`); continue; }

    const beforeFunding: FundingLineInput[] = model.fundingLines.map(toFundingInput);
    const beforeSeller: SellerPaymentInput[] = [];
    const beforeContingent: ContingentConsiderationInput[] = [];

    const afterFunding: FundingLineInput[] = model.fundingLines
      .filter((f) => !DEFERRED_TYPES.includes(f.fundingType))
      .map(toFundingInput);
    const afterSeller: SellerPaymentInput[] = model.fundingLines
      .filter((f) => f.fundingType === 'seller_financing')
      .map((f) => { const s = fundingLineToSellerPayment(f); return { amount: s.amount, termMonths: s.termMonths, interestRate: s.interestRate, includeInDscr: s.includeInDscr ?? true, isActive: s.isActive ?? false }; });
    const afterContingent: ContingentConsiderationInput[] = model.fundingLines
      .filter((f) => f.fundingType === 'earnout')
      .map((f) => { const c = fundingLineToContingent(f); return { maximumAmount: c.maximumAmount, termMonths: c.termMonths, includeInDscr: c.includeInDscr ?? true, isActive: c.isActive ?? false }; });

    const before = calculateFullDealModel({ '1': 0 }, [], beforeFunding, buildModelInput(model), beforeSeller, beforeContingent);
    const after  = calculateFullDealModel({ '1': 0 }, [], afterFunding,  buildModelInput(model), afterSeller,  afterContingent);

    const fields: (keyof typeof before)[] = ['totalFunded','fundingGap','totalAnnualDebtService','paymentCoverRatio'];
    const diffs = fields.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (diffs.length) {
      mismatches++;
      console.log(`model ${id}: MISMATCH on ${diffs.join(', ')}`);
      for (const k of diffs) console.log(`    ${k}: before=${JSON.stringify(before[k])} after=${JSON.stringify(after[k])}`);
    } else {
      console.log(`model ${id}: parity OK (funded=${after.totalFunded}, gap=${after.fundingGap}, dscr=${after.paymentCoverRatio}, loanFee=${after.feeLoanArrangement})`);
    }
  }
  if (mismatches > 0) {
    console.error(`ABORT: ${mismatches} model(s) failed parity. No writes performed.`);
    return false;
  }
  console.log('All models parity OK.');
  return true;
}

async function run() {
  const args = process.argv;
  const insertOnly    = args.includes('--insert-only');
  const deactivateOnly = args.includes('--deactivate-only');

  if (insertOnly) {
    console.log('=== MODE: INSERT-ONLY (pre-deploy) — old lines remain active ===');
  } else {
    console.log('=== MODE: DRY RUN — no writes ===');
  }

  const rows: any[] = (await db.execute(
    `SELECT DISTINCT deal_model_id FROM deal_model_funding_lines WHERE funding_type IN ('seller_financing','earnout') ORDER BY deal_model_id` as any
  )).rows ?? [];
  const modelIds: number[] = rows.map((r: any) => Number(r.deal_model_id));
  console.log('Affected models:', modelIds.join(', '));

  const ok = await parityProof(modelIds);
  if (!ok) { process.exit(1); }

  if (!insertOnly) {
    console.log('Dry run complete. No writes. Re-run with --insert-only to insert into new tables.');
    return;
  }

  // INSERT-ONLY: insert new-table rows; old funding lines left active throughout.
  for (const id of modelIds) {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) continue;
    const oldSeller  = model.fundingLines.filter((f) => f.fundingType === 'seller_financing');
    const oldEarnout = model.fundingLines.filter((f) => f.fundingType === 'earnout');

    const sellerRowsPresent = (await dealModelRepository.getSellerPaymentsByModelId(id)).length;
    if (sellerRowsPresent === 0 && oldSeller.length > 0) {
      await dealModelRepository.createSellerPayments(oldSeller.map(fundingLineToSellerPayment));
      console.log(`model ${id}: inserted ${oldSeller.length} seller row(s) — old lines remain active`);
    } else if (oldSeller.length > 0) {
      console.log(`model ${id}: seller rows already present (${sellerRowsPresent}), insert skipped`);
    }

    const ccRowsPresent = (await dealModelRepository.getContingentConsiderationByModelId(id)).length;
    if (ccRowsPresent === 0 && oldEarnout.length > 0) {
      await dealModelRepository.createContingentConsiderations(oldEarnout.map(fundingLineToContingent));
      console.log(`model ${id}: inserted ${oldEarnout.length} earnout row(s) — old lines remain active`);
    } else if (oldEarnout.length > 0) {
      console.log(`model ${id}: earnout rows already present (${ccRowsPresent}), insert skipped`);
    }
  }
  console.log('INSERT-ONLY complete. New-table rows ensured; old seller/earnout funding lines still active.');
}

async function deactivateOnly() {
  console.log('=== MODE: DEACTIVATE-ONLY (post-deploy) — removes old funding lines ===');

  const rows: any[] = (await db.execute(
    `SELECT DISTINCT deal_model_id FROM deal_model_funding_lines WHERE funding_type IN ('seller_financing','earnout') ORDER BY deal_model_id` as any
  )).rows ?? [];
  const modelIds: number[] = rows.map((r: any) => Number(r.deal_model_id));
  console.log('Affected models:', modelIds.join(', '));

  for (const id of modelIds) {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) { console.log(`model ${id}: NOT FOUND, skipping`); continue; }
    const oldSeller  = model.fundingLines.filter((f) => f.fundingType === 'seller_financing');
    const oldEarnout = model.fundingLines.filter((f) => f.fundingType === 'earnout');

    const sellerRowsPresent = (await dealModelRepository.getSellerPaymentsByModelId(id)).length;
    const ccRowsPresent     = (await dealModelRepository.getContingentConsiderationByModelId(id)).length;

    let deactivated = 0;

    for (const line of oldSeller) {
      if (sellerRowsPresent === 0) {
        console.warn(`model ${id}: WARNING — no seller-payment rows found; skipping deactivation of funding line ${line.id}`);
        continue;
      }
      if (line.isActive) { await dealModelRepository.updateFundingLine(line.id, { isActive: false }); deactivated++; }
    }

    for (const line of oldEarnout) {
      if (ccRowsPresent === 0) {
        console.warn(`model ${id}: WARNING — no contingent-consideration rows found; skipping deactivation of funding line ${line.id}`);
        continue;
      }
      if (line.isActive) { await dealModelRepository.updateFundingLine(line.id, { isActive: false }); deactivated++; }
    }

    console.log(`model ${id}: deactivated ${deactivated} old funding line(s)`);
  }
  console.log('DEACTIVATE-ONLY complete. Old seller/earnout funding lines deactivated.');
}

async function verify() {
  console.log('=== MODE: VERIFY ===');
  const rows: any[] = (await db.execute(
    `SELECT DISTINCT deal_model_id FROM deal_model_funding_lines WHERE funding_type IN ('seller_financing','earnout') ORDER BY deal_model_id` as any
  )).rows ?? [];
  const modelIds: number[] = rows.map((r: any) => Number(r.deal_model_id));
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  let bad = 0;
  for (const id of modelIds) {
    const m = await dealModelRepository.getByIdWithDetails(id);
    if (!m) { console.log(`model ${id}: FAIL - NOT FOUND`); bad++; continue; }
    const oldSeller  = m.fundingLines.filter((f) => f.fundingType === 'seller_financing');
    const oldEarnout = m.fundingLines.filter((f) => f.fundingType === 'earnout');
    const activeOldSeller  = oldSeller.filter((f) => f.isActive).length;
    const activeOldEarnout = oldEarnout.filter((f) => f.isActive).length;
    const sellerRows = m.sellerPayments ?? [];
    const ccRows     = m.contingentConsideration ?? [];
    const oldSellerSum  = oldSeller.reduce((s, f) => s + Number(f.amountUsed ?? 0), 0);
    const newSellerSum  = sellerRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const oldEarnoutSum = oldEarnout.reduce((s, f) => s + Number(f.amountUsed ?? 0), 0);
    const newCcSum      = ccRows.reduce((s, r) => s + Number(r.maximumAmount ?? 0), 0);

    const problems: string[] = [];
    if (activeOldSeller > 0)  problems.push(`${activeOldSeller} active old seller line(s)`);
    if (activeOldEarnout > 0) problems.push(`${activeOldEarnout} active old earnout line(s)`);
    if (oldSeller.length > 0 && sellerRows.length === 0)  problems.push('seller lines exist but no seller-payment rows');
    if (oldEarnout.length > 0 && ccRows.length === 0)     problems.push('earnout lines exist but no contingent rows');
    if (oldSeller.length > 0 && !near(oldSellerSum, newSellerSum))    problems.push(`seller sum mismatch old=${oldSellerSum} new=${newSellerSum}`);
    if (oldEarnout.length > 0 && !near(oldEarnoutSum, newCcSum))      problems.push(`earnout sum mismatch old=${oldEarnoutSum} new=${newCcSum}`);

    if (problems.length) {
      bad++;
      console.log(`model ${id}: FAIL - ${problems.join('; ')}`);
    } else {
      console.log(`model ${id}: VERIFIED (seller rows=${sellerRows.length} sum=${newSellerSum}, earnout rows=${ccRows.length} sum=${newCcSum}, active old lines=0)`);
    }
  }
  if (bad > 0) { console.error(`VERIFY FAILED: ${bad} model(s).`); process.exit(1); }
  console.log('All affected models verified: new-table rows present, sums reconcile, zero active old seller/earnout lines.');
}

// CLI dispatch
const args = process.argv;
if (args.includes('--commit')) {
  console.error('ERROR: --commit is no longer valid. Use --insert-only or --deactivate-only.');
  process.exit(1);
}

let entry: () => Promise<void>;
if (args.includes('--verify')) {
  entry = verify;
} else if (args.includes('--deactivate-only')) {
  entry = deactivateOnly;
} else {
  // Handles both --insert-only and dry run (no flags); run() reads args internally.
  entry = run;
}

entry().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

// Build the calculator's DealModelInput from a model row (mirror of buildCalcInputs modelInput).
function buildModelInput(model: any) {
  return {
    averagingYears: model.averagingYears ?? 3, ebitdaMultiple: model.ebitdaMultiple ?? '3.0',
    plusExcessCash: model.plusExcessCash ?? '0', minusPrimaryDebt: model.minusPrimaryDebt ?? '0',
    minusOtherDebt: model.minusOtherDebt ?? '0', minusCorpTaxDue: model.minusCorpTaxDue ?? '0',
    minusWorkingCapitalAdj: model.minusWorkingCapitalAdj ?? '0', plusPropertyValue: model.propertyValue ?? '0',
    otherAdjustments: null,
    feeLegalDdPercent: model.feeLegalDdPercent ?? '2.5', feeAccountingDdPercent: model.feeAccountingDdPercent ?? '1.5',
    feeBrokerPercent: model.feeBrokerPercent ?? '2.0', feeLoanArrangementPercent: model.feeLoanArrangementPercent ?? '1.0',
    feeDealMakerPercent: model.feeDealMakerPercent ?? '5.0',
    feeLegalDdType: (model.feeLegalDdType as any) ?? 'percent', feeAccountingDdType: (model.feeAccountingDdType as any) ?? 'percent',
    feeBrokerType: (model.feeBrokerType as any) ?? 'percent', feeLoanArrangementType: (model.feeLoanArrangementType as any) ?? 'percent',
    feeDealMakerType: (model.feeDealMakerType as any) ?? 'percent', customFees: null,
  };
}
