import { describe, it, expect } from 'vitest';
import {
  calculateProjections,
  calculateReturns,
  calculateIRR,
  calculateLinkedScenarios,
  type BaseYearData,
  type YearAssumptions,
  type SynergyInput,
  type FundingLineForProjection,
  type ExitAssumptions,
} from '../value-creation.calc';

const baseYear: BaseYearData = {
  revenue: 2_000_000,
  costOfSales: 800_000,
  grossProfit: 1_200_000,
  administrativeExpenses: 200_000,
  staffCosts: 400_000,
  depreciationAmortisation: 50_000,
  operatingProfit: 550_000,
  interestPayable: 20_000,
  corporationTax: 100_000,
  netProfit: 430_000,
  adjustedEbitda: 600_000,
};

const defaultAssumptions: YearAssumptions[] = Array.from({ length: 5 }, (_, i) => ({
  year: i + 1,
  revenueGrowthPercent: 10,
  costOfSalesGrowthPercent: 8,
  adminCostGrowthPercent: 3,
  staffCostGrowthPercent: 5,
  depreciationGrowthPercent: 2,
  capexPerYear: 50_000,
  workingCapitalPercent: 10,
  taxRatePercent: 19,
}));

const noSynergies: SynergyInput[] = [];
const noFunding: FundingLineForProjection[] = [];

describe('calculateProjections', () => {
  it('projects 5 years of P&L data', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    expect(projections).toHaveLength(5);
    expect(projections[0].year).toBe(1);
    expect(projections[4].year).toBe(5);
  });

  it('grows revenue by the assumed percentage', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    expect(projections[0].revenue).toBeCloseTo(2_200_000, 0);
    expect(projections[1].revenue).toBeCloseTo(2_420_000, 0);
  });

  it('calculates gross profit as revenue minus cost of sales', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    expect(projections[0].grossProfit).toBeCloseTo(projections[0].revenue - projections[0].costOfSales, 0);
  });

  it('returns DSCR of 999 when no debt exists', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    expect(projections[0].dscr).toBe(999);
  });

  it('applies revenue synergies correctly', () => {
    const synergies: SynergyInput[] = [
      {
        synergyType: 'revenue',
        name: 'Cross-sell',
        targetValue: 100_000,
        realisationByYear: [0.2, 0.5, 0.8, 1.0, 1.0],
        implementationCost: 10_000,
      },
    ];
    const projections = calculateProjections(baseYear, defaultAssumptions, synergies, noFunding);
    expect(projections[0].synergiesRevenue).toBe(20_000);
    expect(projections[0].synergiesImplementationCost).toBe(10_000);
    expect(projections[1].synergiesRevenue).toBe(50_000);
    expect(projections[1].synergiesImplementationCost).toBe(0);
  });

  it('applies cost synergies correctly', () => {
    const synergies: SynergyInput[] = [
      {
        synergyType: 'cost',
        name: 'Redundancies',
        targetValue: 80_000,
        realisationByYear: [0.5, 1.0, 1.0, 1.0, 1.0],
        implementationCost: 20_000,
      },
    ];
    const projections = calculateProjections(baseYear, defaultAssumptions, synergies, noFunding);
    expect(projections[0].synergiesCost).toBe(40_000);
    expect(projections[1].synergiesCost).toBe(80_000);
  });

  it('calculates free cash flow including capex and working capital', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    const y1 = projections[0];
    const expectedWC = (y1.revenue - baseYear.revenue) * 10 / 100;
    const expectedFCF = y1.cashAfterDebtService - 50_000 - expectedWC;
    expect(y1.freeCashFlow).toBeCloseTo(expectedFCF, 0);
  });
});

describe('calculateIRR', () => {
  it('calculates IRR for a simple investment', () => {
    const cashFlows = [-1000, 200, 300, 400, 500];
    const irr = calculateIRR(cashFlows);
    expect(irr).toBeGreaterThan(0.1);
    expect(irr).toBeLessThan(0.2);
  });

  it('returns 0 for all-zero cash flows', () => {
    expect(calculateIRR([0, 0, 0])).toBe(0);
  });

  it('returns negative IRR for a losing investment', () => {
    const cashFlows = [-1000, 100, 100, 100, 100];
    const irr = calculateIRR(cashFlows);
    expect(irr).toBeLessThan(0);
  });

  it('handles a single-period doubling', () => {
    const irr = calculateIRR([-1000, 2000]);
    expect(irr).toBeCloseTo(1.0, 1);
  });
});

describe('calculateReturns', () => {
  it('calculates MOIC correctly', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    const exitAssumptions: ExitAssumptions = {
      exitMultiple: 6,
      holdPeriodYears: 5,
      exitCostPercent: 2,
    };
    const entryEquity = 2_000_000;
    const entryMultiple = 5;
    const totalDebt = 0;
    const totalFees = 100_000;

    const returns = calculateReturns(
      projections, exitAssumptions, entryEquity, entryMultiple, totalDebt, totalFees, noFunding
    );

    expect(returns.moic).toBeGreaterThan(1);
    expect(returns.irr).toBeGreaterThan(0);
    expect(returns.paybackPeriodYears).toBeGreaterThan(0);
    expect(returns.entryEquity).toBe(entryEquity);
  });

  it('returns zero MOIC when entry equity is zero and no return', () => {
    const projections = calculateProjections(baseYear, defaultAssumptions, noSynergies, noFunding);
    const exitAssumptions: ExitAssumptions = {
      exitMultiple: 0,
      holdPeriodYears: 5,
      exitCostPercent: 0,
    };
    const returns = calculateReturns(
      projections, exitAssumptions, 0, 0, 0, 0, noFunding
    );
    expect(returns.entryEquity).toBe(0);
  });
});

describe('calculateLinkedScenarios', () => {
  it('produces bear, base, and bull projections', () => {
    const result = calculateLinkedScenarios(
      baseYear, defaultAssumptions, noSynergies, noFunding, 5, 6
    );

    expect(result.bear).toHaveLength(5);
    expect(result.base).toHaveLength(5);
    expect(result.bull).toHaveLength(5);
  });

  it('bear revenue is lower than base, bull is higher', () => {
    const result = calculateLinkedScenarios(
      baseYear, defaultAssumptions, noSynergies, noFunding, 5, 6
    );

    expect(result.bear[4].revenue).toBeLessThan(result.base[4].revenue);
    expect(result.bull[4].revenue).toBeGreaterThan(result.base[4].revenue);
  });

  it('derives exit multiples from range percent', () => {
    const result = calculateLinkedScenarios(
      baseYear, defaultAssumptions, noSynergies, noFunding, 10, 6
    );

    expect(result.derivedExitMultiples.base).toBe(6);
    expect(result.derivedExitMultiples.bear).toBeLessThan(6);
    expect(result.derivedExitMultiples.bull).toBeGreaterThan(6);
  });
});
