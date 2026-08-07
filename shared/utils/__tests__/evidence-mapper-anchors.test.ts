import { describe, it, expect } from 'vitest';
import { mapPayloadToEvidence } from '../evidence-mapper';

const BASE = {
  targetCompanyId: 1,
  documentId: 1,
  documentAnalysisResultId: null,
  documentType: 'profit_and_loss',
  extractionVersion: 1,
};

// ─── 1. root shape with period_starts ───────────────────────────────────────

describe('mapPayloadToEvidence — period_starts', () => {
  it('root shape: periodStart set per year from period_starts', () => {
    const payload: Record<string, unknown> = {
      period_starts:  { '2022': '2022-04-01', '2023': '2023-04-01' },
      period_ends:    { '2022': '2023-03-31', '2023': '2024-03-31' },
      months_covered: { '2022': 12, '2023': 12 },
      years: {
        '2022': { year: 2022, profit_and_loss: { revenue: 100000 } },
        '2023': { year: 2023, profit_and_loss: { revenue: 120000 } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    expect(periods.find(p => p.fiscalYearStated === 2022)?.periodStart).toBe('2022-04-01');
    expect(periods.find(p => p.fiscalYearStated === 2023)?.periodStart).toBe('2023-04-01');
  });

  it('period_starts absent: periodStart null on every period', () => {
    const payload: Record<string, unknown> = {
      period_ends:    { '2022': '2023-03-31' },
      months_covered: { '2022': 12 },
      years: {
        '2022': { year: 2022, profit_and_loss: { revenue: 100000 } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    expect(periods).toHaveLength(1);
    expect(periods[0].periodStart).toBeNull();
  });

  it('wrapped shape conflict: balance_sheet wins, one period_start_conflict anomaly (trust_blocking)', () => {
    const payload: Record<string, unknown> = {
      balance_sheet: {
        period_starts:  { '2022': '2022-04-01' },
        period_ends:    { '2022': '2023-03-31' },
        months_covered: { '2022': 12 },
        years: { '2022': { year: 2022, balance_sheet: { equity: { total: 50000 } } } },
      },
      profit_and_loss: {
        period_starts:  { '2022': '2022-05-01' },
        period_ends:    { '2022': '2023-03-31' },
        months_covered: { '2022': 12 },
        years: { '2022': { year: 2022, profit_and_loss: { revenue: 100000 } } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    expect(periods[0].periodStart).toBe('2022-04-01');
    const conflicts = periods[0].anomalies.filter(a => a.type === 'period_start_conflict');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('trust_blocking');
    expect(conflicts[0].detail).toMatchObject({
      fiscalYear: '2022',
      used: '2022-04-01',
      usedSource: 'balance_sheet',
      discarded: '2022-05-01',
      discardedSource: 'profit_and_loss',
    });
  });
});
