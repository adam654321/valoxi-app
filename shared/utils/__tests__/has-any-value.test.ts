import { describe, it, expect } from 'vitest';
import { hasAnyValue, hasCoreIncomeValue } from '../has-any-value';

describe('hasAnyValue — phantom P&L fix (Item A)', () => {
  it('returns FALSE when all numeric fields are null but breakdown fields are non-null empty objects', () => {
    expect(hasAnyValue({
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      netProfit: null,
      revenueBreakdown: {},
      costOfSalesBreakdown: {},
      overheadsBreakdown: {},
      exceptionalItems: {},
      sourceDocumentId: 42,
    })).toBe(false);
  });

  it('returns TRUE when any numeric field has a real value', () => {
    expect(hasAnyValue({
      revenue: '100000',
      grossProfit: null,
      revenueBreakdown: {},
      sourceDocumentId: 42,
    })).toBe(true);
  });

  it('returns FALSE for an entirely null/empty object', () => {
    expect(hasAnyValue({ revenue: null, netProfit: null })).toBe(false);
  });

  it('returns FALSE when only a non-null array breakdown is present', () => {
    expect(hasAnyValue({
      revenue: null,
      exceptionalItems: [{ label: 'restructuring', amount: 5000 }],
    })).toBe(false);
  });

  it('does not count sourceDocumentId as a real value', () => {
    expect(hasAnyValue({ revenue: null, sourceDocumentId: 99 })).toBe(false);
  });
});

describe('hasCoreIncomeValue — balance-sheet artefact gate (Item A ext.)', () => {
  it('returns TRUE when revenue is present', () => {
    expect(hasCoreIncomeValue({
      revenue: '500000',
      costOfSales: null,
      grossProfit: null,
      operatingProfit: null,
      profitBeforeTax: null,
      netProfit: null,
    })).toBe(true);
  });

  it('returns TRUE when only operatingProfit is present', () => {
    expect(hasCoreIncomeValue({
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      operatingProfit: '80000',
      profitBeforeTax: null,
    })).toBe(true);
  });

  it('returns FALSE when only balance-sheet-adjacent fields are present (netProfit, staffCosts, dividendsPaid)', () => {
    expect(hasCoreIncomeValue({
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      operatingProfit: null,
      profitBeforeTax: null,
      netProfit: '183126.57',
      staffCosts: '42069.03',
      dividendsPaid: '75140.85',
    })).toBe(false);
  });

  it('returns FALSE when all core fields are null', () => {
    expect(hasCoreIncomeValue({
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      operatingProfit: null,
      profitBeforeTax: null,
    })).toBe(false);
  });

  it('returns TRUE when grossProfit alone is non-null', () => {
    expect(hasCoreIncomeValue({
      revenue: null,
      costOfSales: null,
      grossProfit: '250000',
      operatingProfit: null,
      profitBeforeTax: null,
    })).toBe(true);
  });

  it('returns TRUE when profitBeforeTax alone is non-null', () => {
    expect(hasCoreIncomeValue({
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      operatingProfit: null,
      profitBeforeTax: '95000',
    })).toBe(true);
  });

  it('returns TRUE when costOfSales alone is non-null', () => {
    expect(hasCoreIncomeValue({
      revenue: null,
      costOfSales: '300000',
      grossProfit: null,
      operatingProfit: null,
      profitBeforeTax: null,
    })).toBe(true);
  });
});
