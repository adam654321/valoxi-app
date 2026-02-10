export interface AdjustmentInput {
  adjustmentType: 'add_back' | 'deduction';
  amount: string | number;
  amountsByYear?: Record<string, number> | null;
  status: string;
  userOverrideAmount?: string | number | null;
}

export interface FundingLineInput {
  fundingType: string;
  assetBaseValue?: string | number | null;
  ltvPercent?: string | number | null;
  amountUsed?: string | number | null;
  interestRate?: string | number | null;
  termMonths?: number | null;
  arrangementFeePercent?: string | number | null;
  isDebt?: boolean;
  isActive: boolean;
}

export interface DealModelInput {
  averagingYears: number;
  ebitdaMultiple: string | number;

  plusExcessCash: string | number;
  minusPrimaryDebt: string | number;
  minusOtherDebt: string | number;
  minusCorpTaxDue: string | number;
  minusWorkingCapitalAdj: string | number;
  plusPropertyValue: string | number;
  otherAdjustments?: Array<{ label: string; amount: number }> | null;

  feeLegalDdPercent: string | number;
  feeAccountingDdPercent: string | number;
  feeBrokerPercent: string | number;
  feeLoanArrangementPercent: string | number;
  feeDealMakerPercent: string | number;
  feeLegalDdType?: 'percent' | 'fixed';
  feeAccountingDdType?: 'percent' | 'fixed';
  feeBrokerType?: 'percent' | 'fixed';
  feeLoanArrangementType?: 'percent' | 'fixed';
  feeDealMakerType?: 'percent' | 'fixed';
  customFees?: Array<{ label: string; percent?: number; amount?: number }> | null;
}

export interface FundingLineResult {
  availableAmount: number;
  monthlyRepayment: number;
  annualRepayment: number;
  arrangementFee: number;
}

export interface CalculationResult {
  adjustedEbitdaByYear: Record<string, number>;
  averageAdjustedEbitda: number;

  enterpriseValue: number;
  offerPrice: number;

  feeLegalDd: number;
  feeAccountingDd: number;
  feeBroker: number;
  feeLoanArrangement: number;
  feeDealMaker: number;
  customFeeAmounts: Array<{ label: string; amount: number }>;
  totalFees: number;
  totalFundingRequired: number;

  fundingLines: FundingLineResult[];
  totalFunded: number;
  fundingGap: number;

  totalAnnualDebtService: number;
  paymentCoverRatio: number | null;
  paymentCoverRating: 'strong' | 'adequate' | 'tight' | 'unfundable' | 'no_debt';
}

export function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

export function calculateAdjustedEbitda(
  reportedEbitdaByYear: Record<string, number>,
  adjustments: AdjustmentInput[],
  averagingYears: number
): { adjustedEbitdaByYear: Record<string, number>; averageAdjustedEbitda: number } {
  const years = Object.keys(reportedEbitdaByYear).sort();
  const adjustedEbitdaByYear: Record<string, number> = {};

  const activeAdjustments = adjustments.filter(
    (a) => a.status === 'accepted' || a.status === 'modified'
  );

  for (const year of years) {
    let ebitda = reportedEbitdaByYear[year] ?? 0;

    for (const adj of activeAdjustments) {
      const effectiveAmount =
        adj.status === 'modified' && adj.userOverrideAmount != null
          ? toNum(adj.userOverrideAmount)
          : adj.amountsByYear && adj.amountsByYear[year] != null
            ? adj.amountsByYear[year]
            : toNum(adj.amount);

      if (adj.adjustmentType === 'add_back') {
        ebitda += effectiveAmount;
      } else {
        ebitda -= effectiveAmount;
      }
    }

    adjustedEbitdaByYear[year] = ebitda;
  }

  const sortedYearsDesc = Object.keys(adjustedEbitdaByYear).sort().reverse();
  const clampedN = Math.max(1, Math.min(averagingYears, sortedYearsDesc.length));
  const recentYears = sortedYearsDesc.slice(0, clampedN);

  const sum = recentYears.reduce((acc, y) => acc + adjustedEbitdaByYear[y], 0);
  const averageAdjustedEbitda = recentYears.length > 0 ? sum / recentYears.length : 0;

  return { adjustedEbitdaByYear, averageAdjustedEbitda };
}

export function calculateOfferPrice(
  averageAdjustedEbitda: number,
  model: DealModelInput
): { enterpriseValue: number; offerPrice: number } {
  const enterpriseValue = averageAdjustedEbitda * toNum(model.ebitdaMultiple);

  let offerPrice = enterpriseValue
    + toNum(model.plusExcessCash)
    - toNum(model.minusPrimaryDebt)
    - toNum(model.minusOtherDebt)
    - toNum(model.minusCorpTaxDue)
    - toNum(model.minusWorkingCapitalAdj)
    + toNum(model.plusPropertyValue);

  if (model.otherAdjustments && Array.isArray(model.otherAdjustments)) {
    for (const adj of model.otherAdjustments) {
      offerPrice += toNum(adj.amount);
    }
  }

  return { enterpriseValue, offerPrice };
}

export function calculateFees(
  offerPrice: number,
  model: DealModelInput
): {
  feeLegalDd: number;
  feeAccountingDd: number;
  feeBroker: number;
  feeLoanArrangement: number;
  feeDealMaker: number;
  customFeeAmounts: Array<{ label: string; amount: number }>;
  totalFees: number;
  totalFundingRequired: number;
} {
  function calcFee(value: string | number, type: 'percent' | 'fixed' | undefined, base: number): number {
    const numValue = toNum(value);
    return type === 'fixed' ? numValue : base * numValue / 100;
  }

  const feeLegalDd = calcFee(model.feeLegalDdPercent, model.feeLegalDdType, offerPrice);
  const feeAccountingDd = calcFee(model.feeAccountingDdPercent, model.feeAccountingDdType, offerPrice);
  const feeBroker = calcFee(model.feeBrokerPercent, model.feeBrokerType, offerPrice);
  const feeLoanArrangement = calcFee(model.feeLoanArrangementPercent, model.feeLoanArrangementType, offerPrice);
  const feeDealMaker = calcFee(model.feeDealMakerPercent, model.feeDealMakerType, offerPrice);

  const customFeeAmounts: Array<{ label: string; amount: number }> = [];
  if (model.customFees && Array.isArray(model.customFees)) {
    for (const fee of model.customFees) {
      const amount = fee.percent != null
        ? offerPrice * toNum(fee.percent) / 100
        : toNum(fee.amount);
      customFeeAmounts.push({ label: fee.label, amount });
    }
  }

  const totalCustomFees = customFeeAmounts.reduce((acc, f) => acc + f.amount, 0);
  const totalFees = feeLegalDd + feeAccountingDd + feeBroker + feeLoanArrangement + feeDealMaker + totalCustomFees;
  const totalFundingRequired = offerPrice + totalFees;

  return {
    feeLegalDd,
    feeAccountingDd,
    feeBroker,
    feeLoanArrangement,
    feeDealMaker,
    customFeeAmounts,
    totalFees,
    totalFundingRequired,
  };
}

function pmt(principal: number, monthlyRate: number, numPayments: number): number {
  if (principal <= 0 || numPayments <= 0) return 0;
  if (monthlyRate === 0) return principal / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function calculateFundingStack(
  fundingLines: FundingLineInput[],
  totalFundingRequired: number
): {
  fundingLines: FundingLineResult[];
  totalFunded: number;
  fundingGap: number;
  totalAnnualDebtService: number;
  totalArrangementFees: number;
} {
  const results: FundingLineResult[] = [];
  let totalFunded = 0;
  let totalAnnualDebtService = 0;
  let totalArrangementFees = 0;

  for (const line of fundingLines) {
    if (!line.isActive) {
      results.push({ availableAmount: 0, monthlyRepayment: 0, annualRepayment: 0, arrangementFee: 0 });
      continue;
    }

    const baseValue = toNum(line.assetBaseValue);
    const ltv = toNum(line.ltvPercent);
    const availableAmount = baseValue > 0 && ltv > 0 ? baseValue * ltv / 100 : 0;

    const used = toNum(line.amountUsed);
    const rate = toNum(line.interestRate);
    const term = line.termMonths ?? 0;

    let monthlyRepayment: number;

    if (term <= 1) {
      monthlyRepayment = rate > 0 ? used * rate / 100 / 12 : 0;
    } else {
      monthlyRepayment = pmt(used, rate / 100 / 12, term);
    }

    const annualRepayment = monthlyRepayment * 12;
    const arrangementFee = used * toNum(line.arrangementFeePercent) / 100;

    results.push({ availableAmount, monthlyRepayment, annualRepayment, arrangementFee });

    totalFunded += used;
    totalArrangementFees += arrangementFee;
    if (line.isDebt) {
      totalAnnualDebtService += annualRepayment;
    }
  }

  const fundingGap = Math.round((totalFundingRequired - totalFunded) * 100) / 100;

  return { fundingLines: results, totalFunded, fundingGap, totalAnnualDebtService, totalArrangementFees };
}

export function calculatePaymentCover(
  averageAdjustedEbitda: number,
  totalAnnualDebtService: number
): {
  paymentCoverRatio: number | null;
  paymentCoverRating: 'strong' | 'adequate' | 'tight' | 'unfundable' | 'no_debt';
} {
  if (totalAnnualDebtService <= 0) {
    return { paymentCoverRatio: null, paymentCoverRating: 'no_debt' };
  }

  const paymentCoverRatio = averageAdjustedEbitda / totalAnnualDebtService;

  let paymentCoverRating: 'strong' | 'adequate' | 'tight' | 'unfundable';
  if (paymentCoverRatio > 2.0) {
    paymentCoverRating = 'strong';
  } else if (paymentCoverRatio >= 1.5) {
    paymentCoverRating = 'adequate';
  } else if (paymentCoverRatio >= 1.0) {
    paymentCoverRating = 'tight';
  } else {
    paymentCoverRating = 'unfundable';
  }

  return { paymentCoverRatio, paymentCoverRating };
}

export function calculateFullDealModel(
  reportedEbitdaByYear: Record<string, number>,
  adjustments: AdjustmentInput[],
  fundingLines: FundingLineInput[],
  model: DealModelInput
): CalculationResult {
  const { adjustedEbitdaByYear, averageAdjustedEbitda } = calculateAdjustedEbitda(
    reportedEbitdaByYear,
    adjustments,
    model.averagingYears
  );

  const { enterpriseValue, offerPrice } = calculateOfferPrice(averageAdjustedEbitda, model);

  const fees = calculateFees(offerPrice, model);

  const funding = calculateFundingStack(fundingLines, fees.totalFundingRequired);

  const adjustedTotalFees = fees.totalFees + funding.totalArrangementFees;
  const adjustedTotalFundingRequired = fees.totalFundingRequired + funding.totalArrangementFees;
  const adjustedFundingGap = Math.round((adjustedTotalFundingRequired - funding.totalFunded) * 100) / 100;

  const { paymentCoverRatio, paymentCoverRating } = calculatePaymentCover(
    averageAdjustedEbitda,
    funding.totalAnnualDebtService
  );

  return {
    adjustedEbitdaByYear,
    averageAdjustedEbitda,
    enterpriseValue,
    offerPrice,
    ...fees,
    totalFees: adjustedTotalFees,
    totalFundingRequired: adjustedTotalFundingRequired,
    fundingLines: funding.fundingLines,
    totalFunded: funding.totalFunded,
    fundingGap: adjustedFundingGap,
    totalAnnualDebtService: funding.totalAnnualDebtService,
    paymentCoverRatio,
    paymentCoverRating,
  };
}
