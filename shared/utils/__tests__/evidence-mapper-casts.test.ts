import { describe, it, expect } from 'vitest';
import { mapPayloadToEvidence } from '../evidence-mapper';
import dar1150 from './fixtures/dar-1150-profit-and-loss.json';
import dar1151 from './fixtures/dar-1151-balance-sheet.json';

function rootPayload(yearBody: Record<string, unknown>) {
  return {
    report_date: '2024-03-31',
    period_ends: { '2024': '2024-03-31' },
    months_covered: { '2024': 12 },
    years: { '2024': Object.assign({ year: 2024 }, yearBody) },
  } as Record<string, unknown>;
}

function mapRoot(yearBody: Record<string, unknown>) {
  return mapPayloadToEvidence({
    targetCompanyId: 1,
    documentId: 1,
    documentAnalysisResultId: 1,
    documentType: 'profit_and_loss',
    extractionVersion: 1,
    payload: rootPayload(yearBody),
  });
}

const casts = (p: { anomalies: { type: string }[] }) =>
  p.anomalies.filter(a => a.type === 'cast_failure' || a.type === 'duplicate_path_conflict');

describe('cast checks — PL1', () => {
  it('clean P&L produces no cast anomaly', () => {
    const { periods } = mapRoot({
      profit_and_loss: { revenue: 1000000, cost_of_sales: 600000, gross_profit: 400000 },
    });
    expect(casts(periods[0])).toHaveLength(0);
  });

  it('gross profit 200 out produces one trust_blocking cast_failure with full detail', () => {
    const { periods } = mapRoot({
      profit_and_loss: { revenue: 1000000, cost_of_sales: 600000, gross_profit: 399800 },
    });
    const a = casts(periods[0]);
    expect(a).toHaveLength(1);
    expect(a[0].type).toBe('cast_failure');
    expect((a[0] as any).severity).toBe('trust_blocking');
    expect((a[0] as any).detail.check).toBe('PL1');
    expect((a[0] as any).detail.lhs).toBe(399800);
    expect((a[0] as any).detail.rhs).toBe(400000);
    expect((a[0] as any).detail.diff).toBe(-200);
  });

  it('missing cost_of_sales makes PL1 not applicable, not a failure', () => {
    const { periods } = mapRoot({
      profit_and_loss: { revenue: 1000000, gross_profit: 400000 },
    });
    expect(casts(periods[0])).toHaveLength(0);
  });
});

describe('cast checks — tolerance is one basis point, floored at one pound', () => {
  it('300 out on a 4,000,300 left side passes (tolerance 400)', () => {
    const { periods } = mapRoot({
      profit_and_loss: { revenue: 10000000, cost_of_sales: 6000000, gross_profit: 4000300 },
    });
    expect(casts(periods[0])).toHaveLength(0);
  });

  it('500 out on a 4,000,500 left side fails (tolerance 400)', () => {
    const { periods } = mapRoot({
      profit_and_loss: { revenue: 10000000, cost_of_sales: 6000000, gross_profit: 4000500 },
    });
    expect(casts(periods[0])).toHaveLength(1);
  });

  it('small figures use the one pound floor, not a fraction of a penny', () => {
    const { periods } = mapRoot({
      profit_and_loss: { revenue: 100, cost_of_sales: 40, gross_profit: 58 },
    });
    expect(casts(periods[0])).toHaveLength(1);
  });
});

describe('cast checks — duplicate paths and component completeness', () => {
  it('DUP1 fires when the two depreciation paths disagree', () => {
    const { periods } = mapRoot({
      profit_and_loss: { depreciation_amortisation: 12000 },
      overheads_breakdown: { depreciation: 9000 },
    });
    const a = casts(periods[0]);
    expect(a).toHaveLength(1);
    expect(a[0].type).toBe('duplicate_path_conflict');
    expect((a[0] as any).severity).toBe('trust_blocking');
    expect((a[0] as any).detail.check).toBe('DUP1');
  });

  it('DUP1 silent when they agree', () => {
    const { periods } = mapRoot({
      profit_and_loss: { depreciation_amortisation: 12000 },
      overheads_breakdown: { depreciation: 12000 },
    });
    expect(casts(periods[0])).toHaveLength(0);
  });

  it('BS6 fires when tangible_assets does not equal its six components, and is informational', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        fixed_assets: {
          tangible_assets: 100000,
          plant_machinery: 60000,
          motor_vehicles: 25000,
        },
      },
    });
    const a = casts(periods[0]);
    expect(a).toHaveLength(1);
    expect((a[0] as any).detail.check).toBe('BS6');
    expect((a[0] as any).type).toBe('cast_failure');
    expect((a[0] as any).severity).toBe('informational');
    expect((a[0] as any).detail.rhs).toBe(85000);
  });
});

describe('cast checks — balance sheet', () => {
  it('BS4 fires on a long term liabilities sum mismatch and is trust_blocking', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        long_term_liabilities: { total: 200000, bank_loans: 120000, deferred_taxation: 50000 },
      },
    });
    const a = casts(periods[0]).filter(x => (x as any).detail.check === 'BS4');
    expect(a).toHaveLength(1);
    expect((a[0] as any).severity).toBe('trust_blocking');
  });

  it('BS2 excludes directors_current_account from the sum and is informational', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        current_assets: {
          total: 90000,
          cash_at_bank: 50000,
          trade_debtors: 40000,
          directors_current_account: 7000,
        },
      },
    });
    expect(casts(periods[0])).toHaveLength(0);
  });

  it('BS1 mismatch is informational, not trust_blocking', () => {
    const { periods } = mapRoot({
      balance_sheet: { equity: { total: 60000, share_capital: 100, retained_earnings: 50000 } },
    });
    const a = casts(periods[0]).filter(x => (x as any).detail.check === 'BS1');
    expect(a).toHaveLength(1);
    expect((a[0] as any).severity).toBe('informational');
  });
});

describe('cast checks — BS4b long-term liabilities contract observer', () => {
  it('fires informationally on the Midland FY2024 deferred-tax fold while BS4 passes', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        long_term_liabilities: {
          total: 319401,
          bank_loans: 23333,
          hire_purchase_long_term: 249133,
          deferred_taxation: 46935,
        },
      },
    });
    const a = casts(periods[0]);
    const bs4b = a.filter(x => (x as any).detail.check === 'BS4b');
    expect(bs4b).toHaveLength(1);
    expect((bs4b[0] as any).severity).toBe('informational');
    expect((bs4b[0] as any).detail.lhs).toBe(319401);
    expect((bs4b[0] as any).detail.rhs).toBe(272466);
    expect(a.some(x => (x as any).detail.check === 'BS4')).toBe(false);
  });

  it('fires when deferred taxation is the whole total', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        long_term_liabilities: { total: 4006, deferred_taxation: 4006 },
      },
    });
    const bs4b = casts(periods[0]).filter(x => (x as any).detail.check === 'BS4b');
    expect(bs4b).toHaveLength(1);
    expect((bs4b[0] as any).detail.lhs).toBe(4006);
    expect((bs4b[0] as any).detail.rhs).toBe(0);
  });

  it('skips when deferred taxation is absent', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        long_term_liabilities: { total: 45044, bank_loans: 43333, hire_purchase_long_term: 1711 },
      },
    });
    expect(casts(periods[0]).some(x => (x as any).detail.check === 'BS4b')).toBe(false);
  });

  it('does not fire when the total already excludes deferred taxation, while BS4 fires by design', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        long_term_liabilities: {
          total: 272466,
          bank_loans: 23333,
          hire_purchase_long_term: 249133,
          deferred_taxation: 46935,
        },
      },
    });
    const a = casts(periods[0]);
    expect(a.some(x => (x as any).detail.check === 'BS4b')).toBe(false);
    expect(a.some(x => (x as any).detail.check === 'BS4')).toBe(true);
  });

  it('does not fire within the one-basis-point tolerance', () => {
    const { periods } = mapRoot({
      balance_sheet: {
        long_term_liabilities: {
          total: 1000000,
          bank_loans: 999999.5,
          deferred_taxation: 500,
        },
      },
    });
    expect(casts(periods[0]).some(x => (x as any).detail.check === 'BS4b')).toBe(false);
  });
});

describe('cast checks — path normalisation and merge coexistence', () => {
  it('wrapped payload paths normalise, so casts still bind', () => {
    const wrapped = {
      profit_and_loss: {
        period_ends: { '2024': '2024-03-31' },
        years: {
          '2024': {
            year: 2024,
            profit_and_loss: { revenue: 1000000, cost_of_sales: 600000, gross_profit: 399800 },
          },
        },
      },
    } as Record<string, unknown>;
    const { periods } = mapPayloadToEvidence({
      targetCompanyId: 1,
      documentId: 1,
      documentAnalysisResultId: 1,
      documentType: 'company_accounts',
      extractionVersion: 1,
      payload: wrapped,
    });
    const a = casts(periods[0]);
    expect(a).toHaveLength(1);
    expect((a[0] as any).detail.check).toBe('PL1');
  });

  it('a period with zero figures keeps an empty anomalies array', () => {
    const { periods } = mapRoot({});
    expect(periods).toHaveLength(1);
    expect(periods[0].anomalies).toEqual([]);
  });
});

describe('cast checks — real fixtures (informational, always passes)', () => {
  it('reports cast anomalies on dar 1150 and dar 1151', () => {
    const p1150 = mapPayloadToEvidence({
      targetCompanyId: 1877,
      documentId: 5836,
      documentAnalysisResultId: 1150,
      documentType: 'profit_and_loss',
      extractionVersion: 1,
      payload: dar1150 as Record<string, unknown>,
    }).periods;
    const p1151 = mapPayloadToEvidence({
      targetCompanyId: 1877,
      documentId: 5836,
      documentAnalysisResultId: 1151,
      documentType: 'balance_sheet',
      extractionVersion: 1,
      payload: dar1151 as Record<string, unknown>,
    }).periods;
    console.log('[2b.2] dar 1150 casts: ' + JSON.stringify(p1150.map(p => casts(p))));
    console.log('[2b.2] dar 1151 casts: ' + JSON.stringify(p1151.map(p => casts(p))));
    expect(true).toBe(true);
  });
});
