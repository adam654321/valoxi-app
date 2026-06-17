import { describe, it, expect } from 'vitest';
import {
  toNum,
  calculateAdjustedEbitda,
  calculateOfferPrice,
  calculateFees,
  calculateFundingStack,
  calculatePaymentCover,
  calculateFullDealModel,
  type AdjustmentInput,
  type DealModelInput,
  type FundingLineInput,
  type SellerPaymentInput,
  type ContingentConsiderationInput,
} from '../deal-model.calc';

describe('toNum', () => {
  it('converts a numeric string to a number', () => {
    expect(toNum('100')).toBe(100);
  });

  it('returns 0 for null, undefined, and empty string', () => {
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum('')).toBe(0);
  });

  it('returns 0 for NaN strings', () => {
    expect(toNum('abc')).toBe(0);
  });

  it('passes through numbers unchanged', () => {
    expect(toNum(42)).toBe(42);
    expect(toNum(-10.5)).toBe(-10.5);
  });
});

describe('calculateAdjustedEbitda', () => {
  const reportedEbitda: Record<string, number> = {
    '2022': 500_000,
    '2023': 600_000,
    '2024': 700_000,
  };

  it('returns unadjusted values when there are no adjustments', () => {
    const result = calculateAdjustedEbitda(reportedEbitda, [], 3);
    expect(result.adjustedEbitdaByYear).toEqual(reportedEbitda);
    expect(result.averageAdjustedEbitda).toBe(600_000);
  });

  it('applies add-back adjustments to every year', () => {
    const adjustments: AdjustmentInput[] = [
      { adjustmentType: 'add_back', amount: 50_000, status: 'accepted' },
    ];
    const result = calculateAdjustedEbitda(reportedEbitda, adjustments, 3);
    expect(result.adjustedEbitdaByYear['2024']).toBe(750_000);
    expect(result.averageAdjustedEbitda).toBe(650_000);
  });

  it('applies deduction adjustments', () => {
    const adjustments: AdjustmentInput[] = [
      { adjustmentType: 'deduction', amount: 100_000, status: 'accepted' },
    ];
    const result = calculateAdjustedEbitda(reportedEbitda, adjustments, 3);
    expect(result.adjustedEbitdaByYear['2024']).toBe(600_000);
  });

  it('ignores rejected adjustments', () => {
    const adjustments: AdjustmentInput[] = [
      { adjustmentType: 'add_back', amount: 999_999, status: 'rejected' },
    ];
    const result = calculateAdjustedEbitda(reportedEbitda, adjustments, 3);
    expect(result.adjustedEbitdaByYear['2024']).toBe(700_000);
  });

  it('uses userOverrideAmount for modified adjustments', () => {
    const adjustments: AdjustmentInput[] = [
      { adjustmentType: 'add_back', amount: 50_000, status: 'modified', userOverrideAmount: 25_000 },
    ];
    const result = calculateAdjustedEbitda(reportedEbitda, adjustments, 1);
    expect(result.adjustedEbitdaByYear['2024']).toBe(725_000);
    expect(result.averageAdjustedEbitda).toBe(725_000);
  });

  it('uses year-specific amounts when amountsByYear is provided', () => {
    const adjustments: AdjustmentInput[] = [
      {
        adjustmentType: 'add_back',
        amount: 50_000,
        amountsByYear: { '2022': 10_000, '2023': 20_000, '2024': 30_000 },
        status: 'accepted',
      },
    ];
    const result = calculateAdjustedEbitda(reportedEbitda, adjustments, 3);
    expect(result.adjustedEbitdaByYear['2022']).toBe(510_000);
    expect(result.adjustedEbitdaByYear['2023']).toBe(620_000);
    expect(result.adjustedEbitdaByYear['2024']).toBe(730_000);
  });

  it('averages only the most recent N years', () => {
    const result = calculateAdjustedEbitda(reportedEbitda, [], 2);
    expect(result.averageAdjustedEbitda).toBe(650_000);
  });

  it('clamps averaging years to available data', () => {
    const result = calculateAdjustedEbitda(reportedEbitda, [], 10);
    expect(result.averageAdjustedEbitda).toBe(600_000);
  });
});

describe('calculateOfferPrice', () => {
  const baseModel: DealModelInput = {
    averagingYears: 3,
    ebitdaMultiple: 5,
    plusExcessCash: 100_000,
    minusPrimaryDebt: 200_000,
    minusOtherDebt: 0,
    minusCorpTaxDue: 50_000,
    minusWorkingCapitalAdj: 30_000,
    plusPropertyValue: 500_000,
    feeLegalDdAmount: 0,
    feeAccountingDdAmount: 0,
    feeLoanArrangementAmount: 0,
    feeDealMakerAmount: 0,
  };

  it('calculates enterprise value as EBITDA × multiple', () => {
    const result = calculateOfferPrice(600_000, baseModel);
    expect(result.enterpriseValue).toBe(3_000_000);
  });

  it('applies the EV-to-equity bridge correctly', () => {
    const result = calculateOfferPrice(600_000, baseModel);
    expect(result.offerPrice).toBe(3_000_000 + 100_000 - 200_000 - 50_000 - 30_000 + 500_000);
  });

  it('includes otherAdjustments in offer price', () => {
    const model = { ...baseModel, otherAdjustments: [{ label: 'Bonus', amount: 75_000 }] };
    const result = calculateOfferPrice(600_000, model);
    const expected = 3_000_000 + 100_000 - 200_000 - 50_000 - 30_000 + 500_000 + 75_000;
    expect(result.offerPrice).toBe(expected);
  });
});

describe('calculateFees', () => {
  const baseModel: DealModelInput = {
    averagingYears: 3,
    ebitdaMultiple: 5,
    plusExcessCash: 0,
    minusPrimaryDebt: 0,
    minusOtherDebt: 0,
    minusCorpTaxDue: 0,
    minusWorkingCapitalAdj: 0,
    plusPropertyValue: 0,
    feeLegalDdAmount: 20_000,
    feeAccountingDdAmount: 15_000,
    feeLoanArrangementAmount: 8_000,
    feeDealMakerAmount: 5_000,
  };

  it('calculates percentage fees off offer price, loan fee off loan amount', () => {
    const offerPrice = 1_000_000;
    const result = calculateFees(offerPrice, baseModel, 800_000);
    expect(result.feeLegalDd).toBe(20_000);
    expect(result.feeAccountingDd).toBe(15_000);
    expect(result.feeLoanArrangement).toBe(8_000); // 1% of loan amount, not offer price (949397d)
    expect(result.feeDealMaker).toBe(5_000);
    expect(result.totalFees).toBe(48_000);
    expect(result.totalFundingRequired).toBe(1_048_000);
  });

  it('handles fixed fee type', () => {
    const model = { ...baseModel, feeLegalDdAmount: 25_000 };
    const result = calculateFees(1_000_000, model);
    expect(result.feeLegalDd).toBe(25_000);
  });

  it('includes custom fees based on percent', () => {
    const model = { ...baseModel, customFees: [{ label: 'Advisory', amount: 5_000 }] };
    const result = calculateFees(1_000_000, model, 1_000_000);
    expect(result.customFeeAmounts).toEqual([{ label: 'Advisory', amount: 5_000 }]);
    expect(result.totalFees).toBe(53_000);
  });
});

describe('calculateFundingStack', () => {
  it('calculates LTV-based availability', () => {
    const lines: FundingLineInput[] = [
      {
        fundingType: 'senior_debt',
        assetBaseValue: 1_000_000,
        ltvPercent: 70,
        amountUsed: 500_000,
        interestRate: 5,
        termMonths: 60,
        arrangementFeePercent: 1,
        isDebt: true,
        isActive: true,
      },
    ];
    const result = calculateFundingStack(lines, 1_000_000);
    expect(result.fundingLines[0].availableAmount).toBe(700_000);
    expect(result.fundingLines[0].arrangementFee).toBe(5_000);
    expect(result.totalFunded).toBe(500_000);
    expect(result.fundingGap).toBe(500_000);
  });

  it('skips inactive lines', () => {
    const lines: FundingLineInput[] = [
      {
        fundingType: 'equity',
        assetBaseValue: 500_000,
        ltvPercent: 100,
        amountUsed: 500_000,
        interestRate: 0,
        termMonths: 0,
        arrangementFeePercent: 0,
        isDebt: false,
        isActive: false,
      },
    ];
    const result = calculateFundingStack(lines, 1_000_000);
    expect(result.totalFunded).toBe(0);
  });

  it('calculates interest-only for term <= 1', () => {
    const lines: FundingLineInput[] = [
      {
        fundingType: 'revolving',
        assetBaseValue: 0,
        ltvPercent: 0,
        amountUsed: 120_000,
        interestRate: 6,
        termMonths: 1,
        arrangementFeePercent: 0,
        isDebt: true,
        isActive: true,
      },
    ];
    const result = calculateFundingStack(lines, 200_000);
    expect(result.fundingLines[0].monthlyRepayment).toBe(600);
    expect(result.fundingLines[0].annualRepayment).toBe(7200);
  });
});

describe('calculatePaymentCover', () => {
  it('returns "strong" for DSCR >= 2.0', () => {
    const result = calculatePaymentCover(200_000, 100_000);
    expect(result.paymentCoverRatio).toBe(2.0);
    expect(result.paymentCoverRating).toBe('strong');
  });

  it('returns "fundable" for DSCR >= 1.5', () => {
    const result = calculatePaymentCover(150_000, 100_000);
    expect(result.paymentCoverRating).toBe('fundable');
  });

  it('returns "challenging" for DSCR >= 1.25', () => {
    const result = calculatePaymentCover(130_000, 100_000);
    expect(result.paymentCoverRating).toBe('challenging');
  });

  it('returns "critical" for DSCR >= 1.0', () => {
    const result = calculatePaymentCover(100_000, 100_000);
    expect(result.paymentCoverRating).toBe('critical');
  });

  it('returns "unfundable" for DSCR < 1.0', () => {
    const result = calculatePaymentCover(80_000, 100_000);
    expect(result.paymentCoverRating).toBe('unfundable');
  });

  it('returns "no_debt" when debt service is zero', () => {
    const result = calculatePaymentCover(500_000, 0);
    expect(result.paymentCoverRatio).toBeNull();
    expect(result.paymentCoverRating).toBe('no_debt');
  });
});

describe('calculateFullDealModel', () => {
  it('orchestrates the full pipeline end-to-end', () => {
    const reported: Record<string, number> = { '2023': 400_000, '2024': 500_000 };
    const adjustments: AdjustmentInput[] = [
      { adjustmentType: 'add_back', amount: 100_000, status: 'accepted' },
    ];
    const model: DealModelInput = {
      averagingYears: 2,
      ebitdaMultiple: 5,
      plusExcessCash: 0,
      minusPrimaryDebt: 0,
      minusOtherDebt: 0,
      minusCorpTaxDue: 0,
      minusWorkingCapitalAdj: 0,
      plusPropertyValue: 0,
      feeLegalDdAmount: 0,
      feeAccountingDdAmount: 0,
      feeLoanArrangementAmount: 0,
      feeDealMakerAmount: 0,
    };
    const funding: FundingLineInput[] = [];

    const result = calculateFullDealModel(reported, adjustments, funding, model);

    expect(result.adjustedEbitdaByYear['2023']).toBe(500_000);
    expect(result.adjustedEbitdaByYear['2024']).toBe(600_000);
    expect(result.averageAdjustedEbitda).toBe(550_000);
    expect(result.enterpriseValue).toBe(2_750_000);
    expect(result.offerPrice).toBe(2_750_000);
    expect(result.paymentCoverRating).toBe('no_debt');
  });
});

describe('calculateFundingStack - repayment structures', () => {
  const line = (over: Partial<FundingLineInput>): FundingLineInput => ({
    fundingType: 'term_loan',
    amountUsed: 100_000,
    interestRate: 10,
    termMonths: 60,
    isDebt: true,
    isActive: true,
    ...over,
  });

  it('interest_only services interest only, ignores principal', () => {
    const r = calculateFundingStack([line({ repaymentStructure: 'interest_only' })], 0);
    expect(r.fundingLines[0].monthlyRepayment).toBeCloseTo(833.333, 2);
    expect(r.fundingLines[0].annualRepayment).toBeCloseTo(10_000, 2);
    expect(r.totalAnnualDebtService).toBeCloseTo(10_000, 2);
  });

  it('principal_only repays straight-line principal, ignores interest', () => {
    const r = calculateFundingStack([line({ amountUsed: 60_000, termMonths: 60, interestRate: 8, repaymentStructure: 'principal_only' })], 0);
    expect(r.fundingLines[0].monthlyRepayment).toBe(1_000);
    expect(r.fundingLines[0].annualRepayment).toBe(12_000);
  });

  it('amortizing default equals explicit amortizing', () => {
    const def = calculateFundingStack([line({})], 0);
    const exp = calculateFundingStack([line({ repaymentStructure: 'amortizing' })], 0);
    expect(def.fundingLines[0].monthlyRepayment).toBe(exp.fundingLines[0].monthlyRepayment);
  });

  it('amortizing amortises above straight-line principal when rate > 0', () => {
    const r = calculateFundingStack([line({ amountUsed: 120_000, termMonths: 60, interestRate: 6, repaymentStructure: 'amortizing' })], 0);
    expect(r.fundingLines[0].monthlyRepayment).toBeGreaterThan(2_000);
    expect(r.fundingLines[0].monthlyRepayment).toBeLessThan(2_400);
  });

  it('principal_only equals zero-rate amortizing for term > 1 (migration equivalence)', () => {
    const po = calculateFundingStack([line({ amountUsed: 60_000, termMonths: 60, interestRate: 0, repaymentStructure: 'principal_only' })], 0);
    const am = calculateFundingStack([line({ amountUsed: 60_000, termMonths: 60, interestRate: 0, repaymentStructure: 'amortizing' })], 0);
    expect(po.fundingLines[0].monthlyRepayment).toBe(am.fundingLines[0].monthlyRepayment);
  });
});

describe('calculateFullDealModel - seller and earnout in DSCR', () => {
  const model: DealModelInput = {
    averagingYears: 1, ebitdaMultiple: 5,
    plusExcessCash: 0, minusPrimaryDebt: 0, minusOtherDebt: 0,
    minusCorpTaxDue: 0, minusWorkingCapitalAdj: 0, plusPropertyValue: 0,
    feeLegalDdAmount: 0, feeAccountingDdAmount: 0,
    feeLoanArrangementAmount: 0, feeDealMakerAmount: 0,
  };
  const ebitda = { '2024': 1_000_000 };

  it('seller payment in DSCR adds straight-line service to the denominator', () => {
    const r = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 60_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }], []);
    expect(r.totalAnnualDebtService).toBe(12_000);
  });

  it('seller payment excluded when includeInDscr is false', () => {
    const r = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 60_000, termMonths: 60, interestRate: 0, includeInDscr: false, isActive: true }], []);
    expect(r.totalAnnualDebtService).toBe(0);
  });

  it('inactive seller payment contributes nothing', () => {
    const r = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 60_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: false }], []);
    expect(r.totalAnnualDebtService).toBe(0);
  });

  it('earnout serviced at its maximum amount', () => {
    const r = calculateFullDealModel(ebitda, [], [], model, [],
      [{ maximumAmount: 120_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }]);
    expect(r.totalAnnualDebtService).toBe(24_000);
  });

  it('earnout excluded when includeInDscr is false', () => {
    const r = calculateFullDealModel(ebitda, [], [], model, [],
      [{ maximumAmount: 120_000, termMonths: 60, interestRate: 0, includeInDscr: false, isActive: true }]);
    expect(r.totalAnnualDebtService).toBe(0);
  });

  it('combines funding, seller and earnout in the denominator', () => {
    const funding: FundingLineInput[] = [{ fundingType: 'term_loan', amountUsed: 100_000, interestRate: 0, termMonths: 50, isDebt: true, isActive: true, repaymentStructure: 'principal_only' }];
    const r = calculateFullDealModel(ebitda, [], funding, model,
      [{ amount: 60_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }],
      [{ maximumAmount: 120_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }]);
    expect(r.totalAnnualDebtService).toBe(60_000);
  });

  it('migration equivalence: a seller row equals the equivalent funding line in the denominator', () => {
    const asFundingLine = calculateFundingStack(
      [{ fundingType: 'seller_financing', amountUsed: 60_000, termMonths: 60, interestRate: 0, isDebt: true, isActive: true }], 0
    ).totalAnnualDebtService;
    const asSellerRow = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 60_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }], []
    ).totalAnnualDebtService;
    expect(asSellerRow).toBe(asFundingLine);
    expect(asSellerRow).toBe(12_000);
  });
});

describe('calculateFullDealModel - invoice finance interest as EBITDA deduction', () => {
  const model: DealModelInput = {
    averagingYears: 1, ebitdaMultiple: 5,
    plusExcessCash: 0, minusPrimaryDebt: 0, minusOtherDebt: 0,
    minusCorpTaxDue: 0, minusWorkingCapitalAdj: 0, plusPropertyValue: 0,
    feeLegalDdAmount: 0, feeAccountingDdAmount: 0,
    feeLoanArrangementAmount: 0, feeDealMakerAmount: 0,
  };
  const ebitda = { '2024': 1_000_000 };
  const ifLine = (over = {}): FundingLineInput => ({ fundingType: 'receivables_finance', amountUsed: 200_000, interestRate: 10, termMonths: 0, isDebt: true, isActive: true, interestAsEbitdaAdjustment: true, ...over });
  const termLoan: FundingLineInput = { fundingType: 'new_senior_debt', amountUsed: 500_000, interestRate: 0, termMonths: 50, isDebt: true, isActive: true, repaymentStructure: 'principal_only' };

  it('IF interest is kept out of debt service and surfaced as revolving interest', () => {
    const r = calculateFullDealModel(ebitda, [], [ifLine()], model, [], []);
    expect(r.totalAnnualDebtService).toBe(0);
    expect(r.revolvingInterestAnnual).toBe(20_000);
    expect(r.paymentCoverRatio).toBeNull();
    expect(r.paymentCoverRating).toBe('no_debt');
  });

  it('IF interest reduces the DSCR numerator when other debt exists', () => {
    const r = calculateFullDealModel(ebitda, [], [ifLine(), termLoan], model, [], []);
    expect(r.totalAnnualDebtService).toBe(120_000);
    expect(r.revolvingInterestAnnual).toBe(20_000);
    expect(r.paymentCoverRatio).toBeCloseTo(980_000 / 120_000, 4);
  });

  it('the same line UNflagged sits in debt service and leaves the numerator full', () => {
    const r = calculateFullDealModel(ebitda, [], [ifLine({ interestAsEbitdaAdjustment: false }), termLoan], model, [], []);
    expect(r.totalAnnualDebtService).toBe(140_000);
    expect(r.revolvingInterestAnnual).toBe(0);
    expect(r.paymentCoverRatio).toBeCloseTo(1_000_000 / 140_000, 4);
  });

  it('a normal debt line is unchanged and contributes no revolving interest', () => {
    const r = calculateFullDealModel(ebitda, [], [termLoan], model, [], []);
    expect(r.totalAnnualDebtService).toBe(120_000);
    expect(r.revolvingInterestAnnual).toBe(0);
  });

  it('flag false equals flag omitted (migration safety)', () => {
    const a = calculateFullDealModel(ebitda, [], [ifLine({ interestAsEbitdaAdjustment: false })], model, [], []);
    const b = calculateFullDealModel(ebitda, [], [ifLine({ interestAsEbitdaAdjustment: undefined })], model, [], []);
    expect(a.totalAnnualDebtService).toBe(b.totalAnnualDebtService);
    expect(a.revolvingInterestAnnual).toBe(b.revolvingInterestAnnual);
  });

  it('IF interest reduces valuation EBITDA, EV and offer price (Jag/Dee model)', () => {
    const withIf = calculateFullDealModel(ebitda, [], [ifLine({ interestAsEbitdaAdjustment: false }), termLoan], model, [], []);
    const without = calculateFullDealModel(ebitda, [], [termLoan], model, [], []);
    expect(withIf.receivablesInterestAnnual).toBe(20_000);
    expect(withIf.valuationEbitda).toBe(980_000);
    expect(withIf.enterpriseValue).toBe(4_900_000);
    expect(withIf.offerPrice).toBe(4_900_000);
    expect(without.offerPrice).toBe(5_000_000);
  });

  it('IF interest leaves full EBITDA in the DSCR numerator and stays serviced in debt service', () => {
    const r = calculateFullDealModel(ebitda, [], [ifLine({ interestAsEbitdaAdjustment: false }), termLoan], model, [], []);
    expect(r.averageAdjustedEbitda).toBe(1_000_000);
    expect(r.totalAnnualDebtService).toBe(140_000);
    expect(r.paymentCoverRatio).toBeCloseTo(1_000_000 / 140_000, 4);
  });

  it('asset and property finance do not reduce valuation EBITDA', () => {
    const assetLine: FundingLineInput = { fundingType: 'asset_finance', amountUsed: 200_000, interestRate: 10, termMonths: 60, isDebt: true, isActive: true };
    const propLine: FundingLineInput = { fundingType: 'property_finance', amountUsed: 300_000, interestRate: 6, termMonths: 240, isDebt: true, isActive: true };
    const r = calculateFullDealModel(ebitda, [], [assetLine, propLine], model, [], []);
    expect(r.receivablesInterestAnnual).toBe(0);
    expect(r.valuationEbitda).toBe(1_000_000);
    expect(r.enterpriseValue).toBe(5_000_000);
  });

  it('an undrawn receivables line costs nothing in valuation', () => {
    const r = calculateFullDealModel(ebitda, [], [ifLine({ interestAsEbitdaAdjustment: false, amountUsed: 0 })], model, [], []);
    expect(r.receivablesInterestAnnual).toBe(0);
    expect(r.valuationEbitda).toBe(1_000_000);
    expect(r.offerPrice).toBe(5_000_000);
  });
});

describe('calculateFullDealModel - seller/earnout funding footprint and fee-base exclusion', () => {
  const model: DealModelInput = {
    averagingYears: 1, ebitdaMultiple: 5,
    plusExcessCash: 0, minusPrimaryDebt: 0, minusOtherDebt: 0,
    minusCorpTaxDue: 0, minusWorkingCapitalAdj: 0, plusPropertyValue: 0,
    feeLegalDdAmount: 0, feeAccountingDdAmount: 0,
    feeLoanArrangementAmount: 0, feeDealMakerAmount: 0,
  };
  const ebitda = { '2024': 1_000_000 };

  it('a seller row reproduces the equivalent funding line across funded, gap and DSCR', () => {
    const asLine = calculateFullDealModel(ebitda, [],
      [{ fundingType: 'seller_financing', amountUsed: 300_000, termMonths: 60, interestRate: 0, isDebt: true, isActive: true }],
      model, [], []);
    const asRow = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 300_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }], []);
    expect(asRow.totalFunded).toBe(asLine.totalFunded);
    expect(asRow.fundingGap).toBe(asLine.fundingGap);
    expect(asRow.totalAnnualDebtService).toBe(asLine.totalAnnualDebtService);
    expect(asRow.paymentCoverRatio).toBe(asLine.paymentCoverRatio);
  });

  it('an earnout row reproduces the equivalent funding line across funded and gap', () => {
    const asLine = calculateFullDealModel(ebitda, [],
      [{ fundingType: 'earnout', amountUsed: 200_000, termMonths: 60, interestRate: 0, isDebt: true, isActive: true }],
      model, [], []);
    const asRow = calculateFullDealModel(ebitda, [], [], model, [],
      [{ maximumAmount: 200_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }]);
    expect(asRow.totalFunded).toBe(asLine.totalFunded);
    expect(asRow.fundingGap).toBe(asLine.fundingGap);
  });

  it('seller deferred is excluded from the loan-arrangement-fee base', () => {
    const r = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 300_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }], []);
    expect(r.feeLoanArrangement).toBe(0);
  });

  it('earnout is excluded from the loan-arrangement-fee base', () => {
    const r = calculateFullDealModel(ebitda, [], [], model, [],
      [{ maximumAmount: 200_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }]);
    expect(r.feeLoanArrangement).toBe(0);
  });

  it('an inactive seller row adds nothing to funded or fee base', () => {
    const r = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 300_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: false }], []);
    expect(r.totalFunded).toBe(0);
    expect(r.feeLoanArrangement).toBe(0);
  });

  it('includeInDscr=false seller counts toward funded but not the DSCR denominator, and not the fee base', () => {
    const r = calculateFullDealModel(ebitda, [], [], model,
      [{ amount: 300_000, termMonths: 60, interestRate: 0, includeInDscr: false, isActive: true }], []);
    expect(r.totalFunded).toBe(300_000);
    expect(r.totalAnnualDebtService).toBe(0);
    expect(r.feeLoanArrangement).toBe(0);
  });

  it('the loan-arrangement-fee base counts genuine lending only, not seller or earnout', () => {
    const r = calculateFullDealModel(ebitda, [],
      [{ fundingType: 'mezzanine', amountUsed: 500_000, termMonths: 60, interestRate: 8, isDebt: true, isActive: true }],
      model,
      [{ amount: 300_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }],
      [{ maximumAmount: 200_000, termMonths: 60, interestRate: 0, includeInDscr: true, isActive: true }]);
    expect(r.feeLoanArrangement).toBe(10_000); // 2% of the 500k loan only
  });
});
