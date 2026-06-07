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
    feeLegalDdPercent: 0,
    feeAccountingDdPercent: 0,
    feeBrokerPercent: 0,
    feeLoanArrangementPercent: 0,
    feeDealMakerPercent: 0,
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
    feeLegalDdPercent: 2,
    feeAccountingDdPercent: 1.5,
    feeBrokerPercent: 3,
    feeLoanArrangementPercent: 1,
    feeDealMakerPercent: 0.5,
  };

  it('calculates percentage-based fees off the offer price', () => {
    const offerPrice = 1_000_000;
    const result = calculateFees(offerPrice, baseModel);
    expect(result.feeLegalDd).toBe(20_000);
    expect(result.feeAccountingDd).toBe(15_000);
    expect(result.feeLoanArrangement).toBe(10_000);
    expect(result.feeDealMaker).toBe(5_000);
    expect(result.totalFees).toBe(50_000);
    expect(result.totalFundingRequired).toBe(1_050_000);
  });

  it('handles fixed fee type', () => {
    const model = { ...baseModel, feeLegalDdPercent: 25_000, feeLegalDdType: 'fixed' as const };
    const result = calculateFees(1_000_000, model);
    expect(result.feeLegalDd).toBe(25_000);
  });

  it('includes custom fees based on percent', () => {
    const model = { ...baseModel, customFees: [{ label: 'Advisory', percent: 0.5 }] };
    const result = calculateFees(1_000_000, model);
    expect(result.customFeeAmounts).toEqual([{ label: 'Advisory', amount: 5_000 }]);
    expect(result.totalFees).toBe(85_000);
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
      feeLegalDdPercent: 1,
      feeAccountingDdPercent: 0,
      feeBrokerPercent: 0,
      feeLoanArrangementPercent: 0,
      feeDealMakerPercent: 0,
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
