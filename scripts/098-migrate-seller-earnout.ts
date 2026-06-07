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

    const fields: (keyof typeof before)[] = ['totalFunded','fundingGap','totalAnnualDebtService','paymentCoverRatio','feeLoanArrangement','totalFees'];
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

  // COMMIT: per-model idempotent insert. Skip any model that already has target rows.
  for (const id of modelIds) {
    const existing = await dealModelRepository.getSellerPaymentsByModelId(id);
    const existingCc = await dealModelRepository.getContingentConsiderationByModelId(id);
    if (existing.length > 0 || existingCc.length > 0) { console.log(`model ${id}: target rows already exist, skipping`); continue; }
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) continue;
    const sellerRows = model.fundingLines.filter((f) => f.fundingType === 'seller_financing').map(fundingLineToSellerPayment);
    const ccRows = model.fundingLines.filter((f) => f.fundingType === 'earnout').map(fundingLineToContingent);
    await dealModelRepository.createSellerPayments(sellerRows);
    await dealModelRepository.createContingentConsiderations(ccRows);
    console.log(`model ${id}: inserted ${sellerRows.length} seller, ${ccRows.length} earnout`);
  }
  console.log('Migration complete. Old funding-line rows left dormant.');
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

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
