import { toNum } from './deal-model.calc';

export interface BaseYearData {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  administrativeExpenses: number;
  staffCosts: number;
  depreciationAmortisation: number;
  operatingProfit: number;
  interestPayable: number;
  corporationTax: number;
  netProfit: number;
  adjustedEbitda: number;
}

export interface YearAssumptions {
  year: number;
  revenueGrowthPercent: number;
  costOfSalesGrowthPercent: number;
  adminCostGrowthPercent: number;
  staffCostGrowthPercent: number;
  depreciationGrowthPercent: number;
  capexPerYear: number;
  workingCapitalPercent: number;
  taxRatePercent: number;
}

export interface SynergyInput {
  synergyType: 'revenue' | 'cost';
  name: string;
  targetValue: number;
  realisationByYear: number[];
  implementationCost: number;
}

export interface FundingLineForProjection {
  amountUsed: number;
  interestRate: number;
  termMonths: number;
  isDebt: boolean;
  isActive: boolean;
}

export interface ExitAssumptions {
  exitMultiple: number;
  holdPeriodYears: number;
  exitCostPercent: number;
}

export interface ScenarioMultipliers {
  revenueGrowthMultiplier: number;
  costPressureAdjustment: number;
}

export interface ProjectedYear {
  year: number;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  staffCosts: number;
  adminExpenses: number;
  totalOverheads: number;
  ebitdaBeforeSynergies: number;
  synergiesRevenue: number;
  synergiesCost: number;
  synergiesImplementationCost: number;
  synergiesNet: number;
  ebitda: number;
  depreciationAmortisation: number;
  operatingProfit: number;
  interestPayable: number;
  profitBeforeTax: number;
  corporationTax: number;
  netProfit: number;
  totalDebtService: number;
  cashAfterDebtService: number;
  dscr: number;
  capex: number;
  workingCapitalChange: number;
  freeCashFlow: number;
}

export interface DebtFacilitySchedule {
  facilityIndex: number;
  years: Array<{
    year: number;
    openingBalance: number;
    interestPayment: number;
    principalRepayment: number;
    closingBalance: number;
  }>;
}

export interface WaterfallYear {
  year: number;
  ebitda: number;
  tax: number;
  interest: number;
  principalRepayments: number;
  capex: number;
  workingCapitalChange: number;
  freeCashFlow: number;
}

export interface ReturnMetrics {
  irr: number;
  moic: number;
  paybackPeriodYears: number;
  totalReturn: number;
  totalCashDistributions: number;
  
  entryEquity: number;
  ebitdaGrowthValue: number;
  multipleExpansionValue: number;
  debtPaydownValue: number;
  cashDistributionsValue: number;
  feesDeducted: number;
  exitEquity: number;
}

export interface SensitivityResult {
  tornadoData: Array<{
    variable: string;
    baseValue: number;
    lowValue: number;
    highValue: number;
    lowOutput: number;
    highOutput: number;
  }>;
  heatmapData: {
    rowVariable: string;
    colVariable: string;
    rowValues: number[];
    colValues: number[];
    cells: number[][];
    baseRowIndex: number;
    baseColIndex: number;
  };
  breakEvenRevDeclineDSCR: number;
  breakEvenRevDeclineFCF: number;
  breakEvenInterestRateIncrease: number;
}

export function calculateProjections(
  baseYear: BaseYearData,
  assumptions: YearAssumptions[],
  synergies: SynergyInput[],
  fundingLines: FundingLineForProjection[],
  scenario: ScenarioMultipliers = { revenueGrowthMultiplier: 1, costPressureAdjustment: 0 }
): ProjectedYear[] {
  const years: ProjectedYear[] = [];
  const sortedAssumptions = [...assumptions].sort((a, b) => a.year - b.year);
  const debtSchedules = calculateDebtSchedules(fundingLines);

  let prevRevenue = baseYear.revenue;
  let prevCostOfSales = baseYear.costOfSales;
  let prevStaffCosts = baseYear.staffCosts;
  let prevAdminExpenses = baseYear.administrativeExpenses;
  let prevDepreciation = baseYear.depreciationAmortisation;

  for (let i = 0; i < 5; i++) {
    const yearNum = i + 1;
    const a = sortedAssumptions[i] || sortedAssumptions[sortedAssumptions.length - 1];
    
    const effectiveRevenueGrowth = a.revenueGrowthPercent * scenario.revenueGrowthMultiplier;
    const effectiveCostGrowth = a.costOfSalesGrowthPercent + scenario.costPressureAdjustment;
    const effectiveStaffGrowth = a.staffCostGrowthPercent + scenario.costPressureAdjustment;
    const effectiveAdminGrowth = a.adminCostGrowthPercent + scenario.costPressureAdjustment;

    const revenue = prevRevenue * (1 + effectiveRevenueGrowth / 100);
    const costOfSales = prevCostOfSales * (1 + effectiveCostGrowth / 100);
    const grossProfit = revenue - costOfSales;
    
    const staffCosts = prevStaffCosts * (1 + effectiveStaffGrowth / 100);
    const adminExpenses = prevAdminExpenses * (1 + effectiveAdminGrowth / 100);
    const totalOverheads = staffCosts + adminExpenses;
    
    const ebitdaBeforeSynergies = grossProfit - totalOverheads;

    let synergiesRevenue = 0;
    let synergiesCost = 0;
    let synergiesImplementationCost = 0;
    
    for (const syn of synergies) {
      const realisationPct = (syn.realisationByYear[i] || 0);
      const yearValue = syn.targetValue * realisationPct;
      
      if (syn.synergyType === 'revenue') {
        synergiesRevenue += yearValue;
      } else {
        synergiesCost += yearValue;
      }
      
      if (yearNum === 1) {
        synergiesImplementationCost += syn.implementationCost;
      }
    }
    
    const synergiesNet = synergiesRevenue + synergiesCost - synergiesImplementationCost;
    const ebitda = ebitdaBeforeSynergies + synergiesNet;
    
    const depreciationAmortisation = prevDepreciation * (1 + a.depreciationGrowthPercent / 100);
    const operatingProfit = ebitda - depreciationAmortisation;

    let totalInterest = 0;
    let totalPrincipal = 0;
    for (const schedule of debtSchedules) {
      const yearData = schedule.years.find(y => y.year === yearNum);
      if (yearData) {
        totalInterest += yearData.interestPayment;
        totalPrincipal += yearData.principalRepayment;
      }
    }
    
    const interestPayable = totalInterest;
    const profitBeforeTax = operatingProfit - interestPayable;
    const corporationTax = Math.max(0, profitBeforeTax * a.taxRatePercent / 100);
    const netProfit = profitBeforeTax - corporationTax;
    
    const totalDebtService = totalInterest + totalPrincipal;
    const cashAfterDebtService = ebitda - corporationTax - totalDebtService;
    const dscr = totalDebtService > 0 ? ebitda / totalDebtService : 999;

    const capex = a.capexPerYear;
    const revenueChange = revenue - prevRevenue;
    const workingCapitalChange = revenueChange * a.workingCapitalPercent / 100;
    const freeCashFlow = cashAfterDebtService - capex - workingCapitalChange;

    years.push({
      year: yearNum,
      revenue,
      costOfSales,
      grossProfit,
      staffCosts,
      adminExpenses,
      totalOverheads,
      ebitdaBeforeSynergies,
      synergiesRevenue,
      synergiesCost,
      synergiesImplementationCost,
      synergiesNet,
      ebitda,
      depreciationAmortisation,
      operatingProfit,
      interestPayable,
      profitBeforeTax,
      corporationTax,
      netProfit,
      totalDebtService,
      cashAfterDebtService,
      dscr,
      capex,
      workingCapitalChange,
      freeCashFlow,
    });

    prevRevenue = revenue;
    prevCostOfSales = costOfSales;
    prevStaffCosts = staffCosts;
    prevAdminExpenses = adminExpenses;
    prevDepreciation = depreciationAmortisation;
  }

  return years;
}

export function calculateDebtSchedules(fundingLines: FundingLineForProjection[]): DebtFacilitySchedule[] {
  const schedules: DebtFacilitySchedule[] = [];

  fundingLines.forEach((line, index) => {
    if (!line.isActive || !line.isDebt || line.amountUsed <= 0) {
      return;
    }

    const yearData: DebtFacilitySchedule['years'] = [];
    let balance = line.amountUsed;
    const monthlyRate = line.interestRate / 100 / 12;
    const totalMonths = line.termMonths || 60;

    let monthlyPayment: number;
    if (monthlyRate === 0) {
      monthlyPayment = balance / totalMonths;
    } else {
      const factor = Math.pow(1 + monthlyRate, totalMonths);
      monthlyPayment = (balance * monthlyRate * factor) / (factor - 1);
    }

    for (let year = 1; year <= 5; year++) {
      const openingBalance = balance;
      let yearInterest = 0;
      let yearPrincipal = 0;

      for (let month = 0; month < 12; month++) {
        if (balance <= 0) break;
        
        const monthsElapsed = (year - 1) * 12 + month;
        if (monthsElapsed >= totalMonths) break;

        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
        
        yearInterest += interestPayment;
        yearPrincipal += principalPayment;
        balance -= principalPayment;
      }

      yearData.push({
        year,
        openingBalance,
        interestPayment: yearInterest,
        principalRepayment: yearPrincipal,
        closingBalance: Math.max(0, balance),
      });
    }

    schedules.push({ facilityIndex: index, years: yearData });
  });

  return schedules;
}

export function calculateWaterfall(projections: ProjectedYear[]): WaterfallYear[] {
  return projections.map(p => ({
    year: p.year,
    ebitda: p.ebitda,
    tax: -p.corporationTax,
    interest: -p.interestPayable,
    principalRepayments: -(p.totalDebtService - p.interestPayable),
    capex: -p.capex,
    workingCapitalChange: -p.workingCapitalChange,
    freeCashFlow: p.freeCashFlow,
  }));
}

export function calculateReturns(
  projections: ProjectedYear[],
  exitAssumptions: ExitAssumptions,
  entryEquity: number,
  entryMultiple: number,
  totalDebtAtEntry: number,
  totalFees: number,
  fundingLines: FundingLineForProjection[]
): ReturnMetrics {
  const holdYears = Math.min(exitAssumptions.holdPeriodYears, 5);
  const exitYear = projections[holdYears - 1];
  if (!exitYear) {
    return emptyReturns(entryEquity);
  }

  const exitEV = exitYear.ebitda * exitAssumptions.exitMultiple;
  const exitCosts = exitEV * exitAssumptions.exitCostPercent / 100;
  
  const debtSchedules = calculateDebtSchedules(fundingLines);
  let remainingDebt = 0;
  for (const schedule of debtSchedules) {
    const yearData = schedule.years.find(y => y.year === holdYears);
    if (yearData) {
      remainingDebt += yearData.closingBalance;
    }
  }

  const exitEquity = exitEV - remainingDebt - exitCosts;
  
  const totalCashDistributions = projections
    .filter(p => p.year <= holdYears)
    .reduce((sum, p) => sum + Math.max(0, p.freeCashFlow), 0);

  const totalReturn = exitEquity + totalCashDistributions;
  const moic = entryEquity > 0 ? totalReturn / entryEquity : 0;

  let cumCash = 0;
  let paybackPeriodYears = holdYears;
  for (const p of projections) {
    if (p.year > holdYears) break;
    cumCash += Math.max(0, p.freeCashFlow);
    if (cumCash >= entryEquity && paybackPeriodYears === holdYears) {
      const prevCum = cumCash - Math.max(0, p.freeCashFlow);
      const remaining = entryEquity - prevCum;
      const fraction = Math.max(0, p.freeCashFlow) > 0 ? remaining / Math.max(0, p.freeCashFlow) : 1;
      paybackPeriodYears = p.year - 1 + fraction;
    }
  }

  const cashFlows: number[] = [-entryEquity];
  for (let y = 1; y <= holdYears; y++) {
    const yearProjection = projections[y - 1];
    let cf = Math.max(0, yearProjection?.freeCashFlow || 0);
    if (y === holdYears) {
      cf += exitEquity;
    }
    cashFlows.push(cf);
  }
  const irr = calculateIRR(cashFlows);

  const ebitdaGrowthValue = (exitYear.ebitda - projections[0].ebitdaBeforeSynergies) * entryMultiple;
  const multipleExpansionValue = exitYear.ebitda * (exitAssumptions.exitMultiple - entryMultiple);
  const debtPaydownValue = totalDebtAtEntry - remainingDebt;
  const feesDeducted = totalFees + exitCosts;

  return {
    irr,
    moic,
    paybackPeriodYears: Math.round(paybackPeriodYears * 10) / 10,
    totalReturn,
    totalCashDistributions,
    entryEquity,
    ebitdaGrowthValue,
    multipleExpansionValue,
    debtPaydownValue,
    cashDistributionsValue: totalCashDistributions,
    feesDeducted,
    exitEquity,
  };
}

export function calculateScenarios(
  baseYear: BaseYearData,
  assumptions: YearAssumptions[],
  synergies: SynergyInput[],
  fundingLines: FundingLineForProjection[],
  bearMultipliers?: ScenarioMultipliers,
  bullMultipliers?: ScenarioMultipliers
): { bear: ProjectedYear[]; base: ProjectedYear[]; bull: ProjectedYear[] } {
  const defaultBear: ScenarioMultipliers = bearMultipliers || { revenueGrowthMultiplier: 0.6, costPressureAdjustment: 1.5 };
  const defaultBull: ScenarioMultipliers = bullMultipliers || { revenueGrowthMultiplier: 1.4, costPressureAdjustment: -0.5 };
  const baseScenario: ScenarioMultipliers = { revenueGrowthMultiplier: 1, costPressureAdjustment: 0 };

  return {
    bear: calculateProjections(baseYear, assumptions, synergies, fundingLines, defaultBear),
    base: calculateProjections(baseYear, assumptions, synergies, fundingLines, baseScenario),
    bull: calculateProjections(baseYear, assumptions, synergies, fundingLines, defaultBull),
  };
}

export function calculateSensitivity(
  baseYear: BaseYearData,
  assumptions: YearAssumptions[],
  synergies: SynergyInput[],
  fundingLines: FundingLineForProjection[],
  exitAssumptions: ExitAssumptions,
  entryEquity: number,
  entryMultiple: number,
  totalDebtAtEntry: number,
  totalFees: number
): SensitivityResult {
  const computeMetric = (modifiedAssumptions: YearAssumptions[], modifiedExit: ExitAssumptions): number => {
    const proj = calculateProjections(baseYear, modifiedAssumptions, synergies, fundingLines);
    const returns = calculateReturns(proj, modifiedExit, entryEquity, entryMultiple, totalDebtAtEntry, totalFees, fundingLines);
    return returns.exitEquity + returns.totalCashDistributions;
  };

  const baseMetric = computeMetric(assumptions, exitAssumptions);

  const tornadoVariables: Array<{
    variable: string;
    modifyLow: () => [YearAssumptions[], ExitAssumptions];
    modifyHigh: () => [YearAssumptions[], ExitAssumptions];
    lowLabel: number;
    highLabel: number;
  }> = [
    {
      variable: 'Revenue Growth',
      modifyLow: () => [assumptions.map(a => ({ ...a, revenueGrowthPercent: a.revenueGrowthPercent - 5 })), exitAssumptions],
      modifyHigh: () => [assumptions.map(a => ({ ...a, revenueGrowthPercent: a.revenueGrowthPercent + 5 })), exitAssumptions],
      lowLabel: assumptions[0]?.revenueGrowthPercent - 5,
      highLabel: assumptions[0]?.revenueGrowthPercent + 5,
    },
    {
      variable: 'Exit Multiple',
      modifyLow: () => [assumptions, { ...exitAssumptions, exitMultiple: exitAssumptions.exitMultiple - 1 }],
      modifyHigh: () => [assumptions, { ...exitAssumptions, exitMultiple: exitAssumptions.exitMultiple + 1 }],
      lowLabel: exitAssumptions.exitMultiple - 1,
      highLabel: exitAssumptions.exitMultiple + 1,
    },
    {
      variable: 'Cost Inflation',
      modifyLow: () => [assumptions.map(a => ({ ...a, costOfSalesGrowthPercent: a.costOfSalesGrowthPercent - 3 })), exitAssumptions],
      modifyHigh: () => [assumptions.map(a => ({ ...a, costOfSalesGrowthPercent: a.costOfSalesGrowthPercent + 3 })), exitAssumptions],
      lowLabel: assumptions[0]?.costOfSalesGrowthPercent - 3,
      highLabel: assumptions[0]?.costOfSalesGrowthPercent + 3,
    },
    {
      variable: 'Tax Rate',
      modifyLow: () => [assumptions.map(a => ({ ...a, taxRatePercent: a.taxRatePercent - 5 })), exitAssumptions],
      modifyHigh: () => [assumptions.map(a => ({ ...a, taxRatePercent: a.taxRatePercent + 5 })), exitAssumptions],
      lowLabel: assumptions[0]?.taxRatePercent - 5,
      highLabel: assumptions[0]?.taxRatePercent + 5,
    },
    {
      variable: 'Staff Cost Growth',
      modifyLow: () => [assumptions.map(a => ({ ...a, staffCostGrowthPercent: a.staffCostGrowthPercent - 3 })), exitAssumptions],
      modifyHigh: () => [assumptions.map(a => ({ ...a, staffCostGrowthPercent: a.staffCostGrowthPercent + 3 })), exitAssumptions],
      lowLabel: assumptions[0]?.staffCostGrowthPercent - 3,
      highLabel: assumptions[0]?.staffCostGrowthPercent + 3,
    },
  ];

  const tornadoData = tornadoVariables.map(v => {
    const [lowA, lowE] = v.modifyLow();
    const [highA, highE] = v.modifyHigh();
    return {
      variable: v.variable,
      baseValue: baseMetric,
      lowValue: v.lowLabel,
      highValue: v.highLabel,
      lowOutput: computeMetric(lowA, lowE),
      highOutput: computeMetric(highA, highE),
    };
  }).sort((a, b) => Math.abs(b.highOutput - b.lowOutput) - Math.abs(a.highOutput - a.lowOutput));

  const rowValues = [-5, -2.5, 0, 2.5, 5, 7.5, 10, 12.5, 15];
  const colValues = [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0];
  
  const baseRevGrowth = assumptions[0]?.revenueGrowthPercent || 5;
  const baseRowIndex = rowValues.findIndex(v => Math.abs(v - baseRevGrowth) < 0.1) || 4;
  const baseColIndex = colValues.findIndex(v => Math.abs(v - exitAssumptions.exitMultiple) < 0.1) || 2;

  const cells = rowValues.map(revGrowth => {
    return colValues.map(exitMult => {
      const modA = assumptions.map(a => ({ ...a, revenueGrowthPercent: revGrowth }));
      const modE = { ...exitAssumptions, exitMultiple: exitMult };
      return computeMetric(modA, modE);
    });
  });

  const breakEvenRevDeclineDSCR = findBreakEven(0, -50, 0.5, (decline) => {
    const modA = assumptions.map(a => ({ ...a, revenueGrowthPercent: decline }));
    const proj = calculateProjections(baseYear, modA, synergies, fundingLines);
    const worstDSCR = Math.min(...proj.map(p => p.dscr));
    return worstDSCR >= 1.0;
  });

  const breakEvenRevDeclineFCF = findBreakEven(0, -50, 0.5, (decline) => {
    const modA = assumptions.map(a => ({ ...a, revenueGrowthPercent: decline }));
    const proj = calculateProjections(baseYear, modA, synergies, fundingLines);
    return proj.every(p => p.freeCashFlow >= 0);
  });

  const breakEvenInterestRateIncrease = findBreakEven(0, 20, 0.25, (increase) => {
    const modFunding = fundingLines.map(f => ({ ...f, interestRate: f.interestRate + increase }));
    const proj = calculateProjections(baseYear, assumptions, synergies, modFunding);
    const worstDSCR = Math.min(...proj.map(p => p.dscr));
    return worstDSCR >= 1.0;
  });

  return {
    tornadoData,
    heatmapData: {
      rowVariable: 'Revenue Growth %',
      colVariable: 'Exit Multiple',
      rowValues,
      colValues,
      cells,
      baseRowIndex,
      baseColIndex,
    },
    breakEvenRevDeclineDSCR: Math.abs(breakEvenRevDeclineDSCR),
    breakEvenRevDeclineFCF: Math.abs(breakEvenRevDeclineFCF),
    breakEvenInterestRateIncrease,
  };
}

export function calculateIRR(cashFlows: number[], guess: number = 0.1, maxIterations: number = 100, tolerance: number = 0.00001): number {
  if (cashFlows.length < 2) return 0;
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      const denominator = Math.pow(1 + rate, t);
      npv += cashFlows[t] / denominator;
      dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    
    if (Math.abs(dnpv) < 1e-10) break;
    
    const newRate = rate - npv / dnpv;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    
    rate = newRate;
  }
  
  return rate;
}

function findBreakEven(start: number, end: number, step: number, condition: (value: number) => boolean): number {
  let value = start;
  while (condition(value) && (start < end ? value < end : value > end)) {
    value += start < end ? step : -step;
  }
  return value - (start < end ? step : -step);
}

function emptyReturns(entryEquity: number): ReturnMetrics {
  return {
    irr: 0, moic: 0, paybackPeriodYears: 0, totalReturn: 0, totalCashDistributions: 0,
    entryEquity, ebitdaGrowthValue: 0, multipleExpansionValue: 0, debtPaydownValue: 0,
    cashDistributionsValue: 0, feesDeducted: 0, exitEquity: 0,
  };
}
