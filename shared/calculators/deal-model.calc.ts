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
  repaymentStructure?: string | null;
  isActive: boolean;
}
export interface SellerPaymentInput {
  amount?: string | number | null;
  termMonths?: number | null;
  interestRate?: string | number | null;
  repaymentStructure?: string | null;
  includeInDscr?: boolean;
  isActive: boolean;
}
export interface ContingentConsiderationInput {
  maximumAmount?: string | number | null;
  termMonths?: number | null;
  interestRate?: string | number | null;
  includeInDscr?: boolean;
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
  workingCapitalMonths?: number;
  workingCapitalMonthlyAmount?: number;
  workingCapitalOverride?: boolean;
  otherAdjustments?: Array<{ label: string; amount: number }> | null;

  feeLegalDdAmount?: string | number;
  feeAccountingDdAmount?: string | number;
  feeLoanArrangementAmount?: string | number;
  feeDealMakerAmount?: string | number;
  customFees?: Array<{ label: string; amount: string | number }>;
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
  feeLoanArrangement: number;
  feeDealMaker: number;
  customFeeAmounts: Array<{ label: string; amount: number }>;
  totalFees: number;
  totalFundingRequired: number;

  fundingLines: FundingLineResult[];
  totalFunded: number;
  fundingGap: number;

  totalAnnualDebtService: number;
  sellerAnnualDebtService: number;
  earnoutAnnualDebtService: number;
  revolvingInterestAnnual: number;
  receivablesInterestAnnual: number;
  valuationEbitda: number;
  paymentCoverRatio: number | null;
  paymentCoverRating: 'strong' | 'fundable' | 'challenging' | 'critical' | 'unfundable' | 'no_debt';
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
  model: DealModelInput,
  totalLoanAmount: number = 0
): {
  feeLegalDd: number;
  feeAccountingDd: number;
  feeLoanArrangement: number;
  feeDealMaker: number;
  customFeeAmounts: Array<{ label: string; amount: number }>;
  totalFees: number;
  totalFundingRequired: number;
} {
  const feeLegalDd = toNum(model.feeLegalDdAmount);
  const feeAccountingDd = toNum(model.feeAccountingDdAmount);
  const feeLoanArrangement = toNum(model.feeLoanArrangementAmount);
  const feeDealMaker = toNum(model.feeDealMakerAmount);

  const customFeeAmounts: Array<{ label: string; amount: number }> = [];
  if (model.customFees && Array.isArray(model.customFees)) {
    for (const fee of model.customFees) {
      customFeeAmounts.push({ label: fee.label, amount: toNum(fee.amount) });
    }
  }

  const totalCustomFees = customFeeAmounts.reduce((acc, f) => acc + f.amount, 0);
  const totalFees = feeLegalDd + feeAccountingDd + feeLoanArrangement + feeDealMaker + totalCustomFees;
  const totalFundingRequired = offerPrice + totalFees;

  return {
    feeLegalDd,
    feeAccountingDd,
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
function computeMonthlyService(used: number, rate: number, term: number, structure: string): number {
  if (structure === 'interest_only') {
    return rate > 0 ? used * rate / 100 / 12 : 0;
  } else if (structure === 'principal_only') {
    return term > 0 ? used / term : 0;
  } else {
    // amortizing (default) - preserves prior behaviour exactly
    if (term <= 1) {
      return rate > 0 ? used * rate / 100 / 12 : 0;
    } else {
      return pmt(used, rate / 100 / 12, term);
    }
  }
}

export function annualiseService(monthly: number, termMonths: number | null | undefined): number {
  // Revolving / no fixed term / interest-only sentinel (term <= 1, matching
  // computeMonthlyService): facility runs all year.
  if (!termMonths || termMonths <= 1) return monthly * 12;
  // Fixed term: year-1 burden is monthly x months serviced this year, capped at 12.
  return monthly * Math.min(termMonths, 12);
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
  totalRevolvingInterest: number;
} {
  const results: FundingLineResult[] = [];
  let totalFunded = 0;
  let totalAnnualDebtService = 0;
  let totalArrangementFees = 0;
  let totalRevolvingInterest = 0;

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
    const isRevolvingIf = line.fundingType === 'receivables_finance';
    const structure = line.repaymentStructure ?? 'amortizing';
    const monthlyRepayment = computeMonthlyService(used, rate, term, structure);

    const annualRepayment = annualiseService(monthlyRepayment, term);
    const arrangementFee = used * toNum(line.arrangementFeePercent) / 100;

    results.push({ availableAmount, monthlyRepayment, annualRepayment, arrangementFee });

    totalFunded += used;
    totalArrangementFees += arrangementFee;
    if (isRevolvingIf) {
      // invoice/revolving finance: interest reduces the DSCR numerator, not a debt-service line
      totalRevolvingInterest += annualRepayment;
    } else if (line.isDebt) {
      totalAnnualDebtService += annualRepayment;
    }
  }

  const fundingGap = Math.round((totalFundingRequired - totalFunded) * 100) / 100;

  return { fundingLines: results, totalFunded, fundingGap, totalAnnualDebtService, totalArrangementFees, totalRevolvingInterest };
}

export function calculatePaymentCover(
  averageAdjustedEbitda: number,
  totalAnnualDebtService: number
): {
  paymentCoverRatio: number | null;
  paymentCoverRating: 'strong' | 'fundable' | 'challenging' | 'critical' | 'unfundable' | 'no_debt';
} {
  if (totalAnnualDebtService <= 0) {
    return { paymentCoverRatio: null, paymentCoverRating: 'no_debt' };
  }

  const paymentCoverRatio = averageAdjustedEbitda / totalAnnualDebtService;

  let paymentCoverRating: 'strong' | 'fundable' | 'challenging' | 'critical' | 'unfundable';
  if (paymentCoverRatio >= 2.0) {
    paymentCoverRating = 'strong';
  } else if (paymentCoverRatio >= 1.5) {
    paymentCoverRating = 'fundable';
  } else if (paymentCoverRatio >= 1.25) {
    paymentCoverRating = 'challenging';
  } else if (paymentCoverRatio >= 1.0) {
    paymentCoverRating = 'critical';
  } else {
    paymentCoverRating = 'unfundable';
  }

  return { paymentCoverRatio, paymentCoverRating };
}

export function calculateFullDealModel(
  reportedEbitdaByYear: Record<string, number>,
  adjustments: AdjustmentInput[],
  fundingLines: FundingLineInput[],
  model: DealModelInput,
  sellerPayments: SellerPaymentInput[] = [],
  contingentConsideration: ContingentConsiderationInput[] = []
): CalculationResult {
  const { adjustedEbitdaByYear, averageAdjustedEbitda } = calculateAdjustedEbitda(
    reportedEbitdaByYear,
    adjustments,
    model.averagingYears
  );

  // Invoice finance (receivables) is a revolving working-capital cost. Per the Jag/Dee decision
  // (Jun 2026), its interest element reduces the EBITDA used for valuation only, so EV falls at the
  // same multiple. The interest stays serviced in debt service for DSCR and the DSCR numerator keeps
  // the full EBITDA (below), so it is never double-counted. Receivables only; asset and property
  // finance are amortising acquisition debt and are untouched. Interest is drawn x rate (interest-only).
  const receivablesInterestAnnual = fundingLines
    .filter((l) => l.isActive && l.fundingType === 'receivables_finance')
    .reduce((sum, l) => sum + toNum(l.amountUsed) * toNum(l.interestRate) / 100, 0);
  const valuationEbitda = averageAdjustedEbitda - receivablesInterestAnnual;

  const { enterpriseValue, offerPrice } = calculateOfferPrice(valuationEbitda, model);

  const sellerActiveTotal = sellerPayments
    .filter(s => s.isActive)
    .reduce((sum, s) => sum + toNum(s.amount), 0);
  const earnoutActiveTotal = contingentConsideration
    .filter(c => c.isActive)
    .reduce((sum, c) => sum + toNum(c.maximumAmount), 0);
  const totalLoanAmount = fundingLines
    .filter(l => l.isActive)
    .reduce((sum, l) => sum + toNum(l.amountUsed), 0);

  const fees = calculateFees(offerPrice, model, totalLoanAmount);

  const funding = calculateFundingStack(fundingLines, offerPrice);

  const adjustedTotalFees = fees.totalFees + funding.totalArrangementFees;
  const adjustedTotalFundingRequired = offerPrice + adjustedTotalFees;
  const adjustedFundingGap = Math.round((offerPrice - funding.totalFunded) * 100) / 100;
  const sellerAnnualDebtService = sellerPayments.reduce((sum, s) => {
    if (!s.isActive || s.includeInDscr === false) return sum;
    const monthly = computeMonthlyService(toNum(s.amount), toNum(s.interestRate), s.termMonths ?? 0, s.repaymentStructure ?? 'amortizing');
    return sum + annualiseService(monthly, s.termMonths ?? 0);
  }, 0);
  const earnoutAnnualDebtService = contingentConsideration.reduce((sum, c) => {
    if (!c.isActive || c.includeInDscr === false) return sum;
    const monthly = computeMonthlyService(toNum(c.maximumAmount), toNum(c.interestRate), c.termMonths ?? 0, 'amortizing');
    return sum + annualiseService(monthly, c.termMonths ?? 0);
  }, 0);
  const combinedAnnualDebtService = funding.totalAnnualDebtService + sellerAnnualDebtService + earnoutAnnualDebtService;
  const combinedTotalFunded = funding.totalFunded + sellerActiveTotal + earnoutActiveTotal;
  const combinedFundingGap = Math.round((offerPrice - combinedTotalFunded) * 100) / 100;
  // Invoice-finance interest reduces the DSCR numerator only. offerPrice/valuation keep the full EBITDA.
  const dscrNumerator = averageAdjustedEbitda - funding.totalRevolvingInterest;
  const { paymentCoverRatio, paymentCoverRating } = calculatePaymentCover(
    dscrNumerator, combinedAnnualDebtService
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
    totalFunded: combinedTotalFunded,
    fundingGap: combinedFundingGap,
    totalAnnualDebtService: combinedAnnualDebtService,
    sellerAnnualDebtService,
    earnoutAnnualDebtService,
    revolvingInterestAnnual: funding.totalRevolvingInterest,
    receivablesInterestAnnual,
    valuationEbitda,
    paymentCoverRatio,
    paymentCoverRating,
  };
}
