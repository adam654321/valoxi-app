import { describe, it, expect } from 'vitest';
import { mapPayloadToEvidence } from '../evidence-mapper';
import dar1150 from './fixtures/dar-1150-profit-and-loss.json';
import dar1151 from './fixtures/dar-1151-balance-sheet.json';

const BASE_INPUT_1150 = {
  targetCompanyId: 1877,
  documentId: 5836,
  documentAnalysisResultId: 1150,
  documentType: 'profit_and_loss',
  extractionVersion: 1,
  payload: dar1150 as Record<string, unknown>,
};

const BASE_INPUT_1151 = {
  targetCompanyId: 1877,
  documentId: 5836,
  documentAnalysisResultId: 1151,
  documentType: 'balance_sheet',
  extractionVersion: 1,
  payload: dar1151 as Record<string, unknown>,
};

// ─── dar 1151 (balance sheet) ───────────────────────────────────────────────

describe('mapPayloadToEvidence — dar 1151 (balance sheet)', () => {
  const result = mapPayloadToEvidence(BASE_INPUT_1151);
  const { evidence, periods } = result;

  it('evidence.reportDate === "2025-09-08"', () => {
    expect(evidence.reportDate).toBe('2025-09-08');
  });

  it('exactly one period', () => {
    expect(periods).toHaveLength(1);
  });

  it('period fiscalYearStated === 2025', () => {
    expect(periods[0].fiscalYearStated).toBe(2025);
  });

  it('period periodEnd === "2025-09-08"', () => {
    expect(periods[0].periodEnd).toBe('2025-09-08');
  });

  it('period monthsCoveredStated === null', () => {
    expect(periods[0].monthsCoveredStated).toBeNull();
  });

  it('amounts_owed_to_directors: value -16056.67, statementType "balance", isModelDerived false', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'amounts_owed_to_directors');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(-16056.67);
    expect(fig!.statementType).toBe('balance');
    expect(fig!.isModelDerived).toBe(false);
    expect(fig!.payloadPath).toBe(
      'years.2025.balance_sheet.current_liabilities.amounts_owed_to_directors',
    );
  });

  it('hire_purchase_long_term: value -167914.37', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'hire_purchase_long_term');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(-167914.37);
  });

  it('other_debt: value 319252.04', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'other_debt');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(319252.04);
  });

  it('every figure under financial_ratios has isModelDerived true', () => {
    const ratioFigs = periods[0].figures.filter(f =>
      f.payloadPath.includes('.financial_ratios.'),
    );
    expect(ratioFigs.length).toBeGreaterThan(0);
    expect(ratioFigs.every(f => f.isModelDerived)).toBe(true);
  });

  it('no figure has a null value', () => {
    expect(periods[0].figures.every(f => f.value !== null)).toBe(true);
  });

  it('no figure has fieldKey "year"', () => {
    expect(periods[0].figures.every(f => f.fieldKey !== 'year')).toBe(true);
  });

  it('reports total figure count (informational)', () => {
    console.log(`[evidence-mapper] dar 1151 figure count: ${periods[0].figures.length}`);
    expect(true).toBe(true);
  });
});

// ─── dar 1150 (profit and loss) ─────────────────────────────────────────────

describe('mapPayloadToEvidence — dar 1150 (profit and loss)', () => {
  const result = mapPayloadToEvidence(BASE_INPUT_1150);
  const { periods } = result;

  it('net_profit: value 183126.57, statementType "income"', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'net_profit');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(183126.57);
    expect(fig!.statementType).toBe('income');
  });

  it('dividends_paid: value 75140.85', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'dividends_paid');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(75140.85);
  });

  it('total_staff_costs: value 42069.03', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'total_staff_costs');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(42069.03);
  });

  it('staff_wages_salaries: value 33571.85 and payloadPath contains "overheads_breakdown"', () => {
    const fig = periods[0].figures.find(f => f.fieldKey === 'staff_wages_salaries');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(33571.85);
    expect(fig!.payloadPath).toContain('overheads_breakdown');
  });

  it('statementType is "income" for every figure', () => {
    expect(periods[0].figures.every(f => f.statementType === 'income')).toBe(true);
  });

  it('reports total figure count (informational)', () => {
    console.log(`[evidence-mapper] dar 1150 figure count: ${periods[0].figures.length}`);
    expect(true).toBe(true);
  });
});
