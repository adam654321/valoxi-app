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

async function run() {
  const dryRun = !process.argv.includes('--commit');
  console.log(dryRun ? '=== DRY RUN (parity proof only, no writes). Pass --commit to migrate. ===' : '=== COMMIT MODE ===');

  // Find every model holding a seller_financing or earnout funding line.
  const rows: any[] = (await db.execute(
    `SELECT DISTINCT deal_model_id FROM deal_model_funding_lines WHERE funding_type IN ('seller_financing','earnout') ORDER BY deal_model_id` as any
  )).rows ?? [];
  const modelIds: number[] = rows.map((r: any) => Number(r.deal_model_id));
  console.log('Affected models:', modelIds.join(', '));

  let mismatches = 0;
  for (const id of modelIds) {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) { console.log(`model ${id}: NOT FOUND, skipping`); continue; }

    // BEFORE: today's path - all funding lines feed as funding lines; new tables (empty) feed nothing.
    const beforeFunding: FundingLineInput[] = model.fundingLines.map(toFundingInput);
    const beforeSeller: SellerPaymentInput[] = [];
    const beforeContingent: ContingentConsiderationInput[] = [];

    // AFTER: deferred types excluded from funding; seller/earnout fed as table rows mapped from those same lines.
    const afterFunding: FundingLineInput[] = model.fundingLines
      .filter((f) => !DEFERRED_TYPES.includes(f.fundingType))
      .map(toFundingInput);
    const afterSeller: SellerPaymentInput[] = model.fundingLines
      .filter((f) => f.fundingType === 'seller_financing')
      .map((f) => { const s = fundingLineToSellerPayment(f); return { amount: s.amount, termMonths: s.termMonths, interestRate: s.interestRate, includeInDscr: s.includeInDscr ?? true, isActive: s.isActive ?? false }; });
    const afterContingent: ContingentConsiderationInput[] = model.fundingLines
      .filter((f) => f.fundingType === 'earnout')
      .map((f) => { const c = fundingLineToContingent(f); return { maximumAmount: c.maximumAmount, termMonths: c.termMonths, includeInDscr: c.includeInDscr ?? true, isActive: c.isActive ?? false }; });

    const ebitda: Record<string, number> = {};
    for (const [k, v] of Object.entries(model as any)) { /* ebitda comes via service normally; reuse persisted calc inputs below */ }

    const before = calculateFullDealModel({ '1': 0 }, [], beforeFunding, buildModelInput(model), beforeSeller, beforeContingent);
    const after  = calculateFullDealModel({ '1': 0 }, [], afterFunding,  buildModelInput(model), afterSeller,  afterContingent);

    // Fee fields deliberately excluded: the fee-base fix changes feeLoanArrangement/totalFees
    // by design when seller/earnout leave the loan base. Parity proves the MOVE is
    // funded/gap/DSCR neutral, not fee-neutral.
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

  if (mismatches > 0) { console.error(`ABORT: ${mismatches} model(s) failed parity. No writes performed.`); process.exit(1); }
  console.log('All models parity OK.');

  if (dryRun) { console.log('Dry run complete. No writes. Re-run with --commit to migrate.'); return; }

  // COMMIT: per affected model, ensure new-table rows exist (insert ONLY if missing),
  // then deactivate the old seller/earnout funding lines so old and new never coexist active.
  // Insert runs BEFORE deactivation so a freshly inserted row inherits the active flag.
  for (const id of modelIds) {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) continue;
    const oldSeller = model.fundingLines.filter((f) => f.fundingType === 'seller_financing');
    const oldEarnout = model.fundingLines.filter((f) => f.fundingType === 'earnout');

    let sellerRowsPresent = (await dealModelRepository.getSellerPaymentsByModelId(id)).length;
    if (sellerRowsPresent === 0 && oldSeller.length > 0) {
      await dealModelRepository.createSellerPayments(oldSeller.map(fundingLineToSellerPayment));
      sellerRowsPresent = oldSeller.length;
      console.log(`model ${id}: inserted ${oldSeller.length} seller`);
    } else if (oldSeller.length > 0) {
      console.log(`model ${id}: seller rows present (${sellerRowsPresent}), insert skipped`);
    }

    let ccRowsPresent = (await dealModelRepository.getContingentConsiderationByModelId(id)).length;
    if (ccRowsPresent === 0 && oldEarnout.length > 0) {
      await dealModelRepository.createContingentConsiderations(oldEarnout.map(fundingLineToContingent));
      ccRowsPresent = oldEarnout.length;
      console.log(`model ${id}: inserted ${oldEarnout.length} earnout`);
    } else if (oldEarnout.length > 0) {
      console.log(`model ${id}: earnout rows present (${ccRowsPresent}), insert skipped`);
    }

    let deactivated = 0;
    for (const line of oldSeller) {
      if (sellerRowsPresent > 0 && line.isActive) { await dealModelRepository.updateFundingLine(line.id, { isActive: false }); deactivated++; }
    }
    for (const line of oldEarnout) {
      if (ccRowsPresent > 0 && line.isActive) { await dealModelRepository.updateFundingLine(line.id, { isActive: false }); deactivated++; }
    }
    console.log(`model ${id}: deactivated ${deactivated} old funding line(s)`);
  }
  console.log('Migration complete. New-table rows ensured; old seller/earnout funding lines deactivated.');
}

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

async function verify() {
  const rows: any[] = (await db.execute(
    `SELECT DISTINCT deal_model_id FROM deal_model_funding_lines WHERE funding_type IN ('seller_financing','earnout') ORDER BY deal_model_id` as any
  )).rows ?? [];
  const modelIds: number[] = rows.map((r: any) => Number(r.deal_model_id));
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  let bad = 0;
  for (const id of modelIds) {
    const m = await dealModelRepository.getByIdWithDetails(id);
    if (!m) { console.log(`model ${id}: FAIL - NOT FOUND`); bad++; continue; }
    const oldSeller = m.fundingLines.filter((f) => f.fundingType === 'seller_financing');
    const oldEarnout = m.fundingLines.filter((f) => f.fundingType === 'earnout');
    const activeOldSeller = oldSeller.filter((f) => f.isActive).length;
    const activeOldEarnout = oldEarnout.filter((f) => f.isActive).length;
    const sellerRows = m.sellerPayments ?? [];
    const ccRows = m.contingentConsideration ?? [];
    const oldSellerSum = oldSeller.reduce((s, f) => s + Number(f.amountUsed ?? 0), 0);
    const newSellerSum = sellerRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const oldEarnoutSum = oldEarnout.reduce((s, f) => s + Number(f.amountUsed ?? 0), 0);
    const newCcSum = ccRows.reduce((s, r) => s + Number(r.maximumAmount ?? 0), 0);

    const problems: string[] = [];
    if (activeOldSeller > 0) problems.push(`${activeOldSeller} active old seller line(s)`);
    if (activeOldEarnout > 0) problems.push(`${activeOldEarnout} active old earnout line(s)`);
    if (oldSeller.length > 0 && sellerRows.length === 0) problems.push('seller lines exist but no seller-payment rows');
    if (oldEarnout.length > 0 && ccRows.length === 0) problems.push('earnout lines exist but no contingent rows');
    if (oldSeller.length > 0 && !near(oldSellerSum, newSellerSum)) problems.push(`seller sum mismatch old=${oldSellerSum} new=${newSellerSum}`);
    if (oldEarnout.length > 0 && !near(oldEarnoutSum, newCcSum)) problems.push(`earnout sum mismatch old=${oldEarnoutSum} new=${newCcSum}`);

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

const entry = process.argv.includes('--verify') ? verify : run;
entry().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
