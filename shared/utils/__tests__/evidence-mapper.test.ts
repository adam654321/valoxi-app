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

// ─── wrapped company_accounts shape (#339) ──────────────────────────────────

const WRAPPED_PAYLOAD = {
  document: 'company_accounts',
  source: 'statutory',
  balance_sheet: {
    document: 'balance_sheet',
    source: 'statutory',
    years_covered: [2022, 2023],
    period_ends: { '2022': '2022-03-31', '2023': '2023-03-31' },
    months_covered: { '2022': 12, '2023': 12 },
    years: {
      '2022': {
        year: 2022,
        balance_sheet: {
          equity: { share_capital: 100, retained_earnings: 5000.5 },
          financial_ratios: { current_ratio: 1.5 },
        },
      },
      '2023': {
        year: 2023,
        balance_sheet: { equity: { share_capital: 100, retained_earnings: 7500 } },
      },
    },
  },
  profit_and_loss: {
    document: 'profit_and_loss',
    source: 'statutory',
    years_covered: [2022, 2023],
    period_ends: { '2022': '2022-03-31', '2023': '2023-03-31' },
    months_covered: { '2022': 12, '2023': 12 },
    years: {
      '2022': { year: 2022, profit_and_loss: { revenue: 250000.5, net_profit: 40000.25 } },
      '2023': { year: 2023, profit_and_loss: { revenue: 300000, net_profit: -1500.75 } },
    },
  },
};

const BASE_INPUT_WRAPPED = {
  targetCompanyId: 8,
  documentId: 100,
  documentAnalysisResultId: 41,
  documentType: 'company_accounts',
  extractionVersion: 1,
  payload: WRAPPED_PAYLOAD as Record<string, unknown>,
};

describe('mapPayloadToEvidence — wrapped company_accounts shape (#339)', () => {
  const { evidence, periods } = mapPayloadToEvidence(BASE_INPUT_WRAPPED);

  it('two periods, merged per fiscal year, not four', () => {
    expect(periods).toHaveLength(2);
    expect(periods.map(p => p.fiscalYearStated).sort()).toEqual([2022, 2023]);
  });

  it('period 2022 carries periodEnd and stated months from the sub-object', () => {
    const p = periods.find(x => x.fiscalYearStated === 2022)!;
    expect(p.periodEnd).toBe('2022-03-31');
    expect(p.monthsCoveredStated).toBe(12);
  });

  it('period 2022 holds figures from BOTH statements', () => {
    const p = periods.find(x => x.fiscalYearStated === 2022)!;
    const bs = p.figures.find(f => f.fieldKey === 'share_capital');
    const pl = p.figures.find(f => f.fieldKey === 'revenue');
    expect(bs).toBeDefined();
    expect(bs!.value).toBe(100);
    expect(bs!.statementType).toBe('balance');
    expect(bs!.payloadPath).toBe('balance_sheet.years.2022.balance_sheet.equity.share_capital');
    expect(pl).toBeDefined();
    expect(pl!.value).toBe(250000.5);
    expect(pl!.statementType).toBe('income');
    expect(pl!.payloadPath).toBe('profit_and_loss.years.2022.profit_and_loss.revenue');
  });

  it('negative values preserved exactly, no abs()', () => {
    const p = periods.find(x => x.fiscalYearStated === 2023)!;
    const fig = p.figures.find(f => f.fieldKey === 'net_profit');
    expect(fig).toBeDefined();
    expect(fig!.value).toBe(-1500.75);
  });

  it('financial_ratios figures flagged isModelDerived', () => {
    const p = periods.find(x => x.fiscalYearStated === 2022)!;
    const ratio = p.figures.find(f => f.fieldKey === 'current_ratio');
    expect(ratio).toBeDefined();
    expect(ratio!.isModelDerived).toBe(true);
  });

  it('evidence.reportDate is null (wrapped payloads carry no top-level report_date)', () => {
    expect(evidence.reportDate).toBeNull();
  });
});

describe('mapPayloadToEvidence — wrapped shape edge cases (#339)', () => {
  it('balance-sheet-only wrapped payload maps, income figures absent', () => {
    const bsOnly = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    delete bsOnly.profit_and_loss;
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: bsOnly });
    expect(periods).toHaveLength(2);
    expect(periods.flatMap(p => p.figures).length).toBeGreaterThan(0);
    expect(periods.every(p => p.figures.every(f => f.statementType === 'balance'))).toBe(true);
  });

  it('balance_sheet period_end wins when sub-objects disagree', () => {
    const conflicting = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    conflicting.profit_and_loss.period_ends['2022'] = '2022-04-30';
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: conflicting });
    expect(periods.find(x => x.fiscalYearStated === 2022)!.periodEnd).toBe('2022-03-31');
  });

  it('top-level years takes precedence, wrapped sub-objects ignored', () => {
    const mixed = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    mixed.years = { '2024': { year: 2024, profit_and_loss: { revenue: 111 } } };
    mixed.period_ends = { '2024': '2024-03-31' };
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: mixed });
    expect(periods).toHaveLength(1);
    expect(periods[0].fiscalYearStated).toBe(2024);
    expect(periods[0].figures.every(f => f.payloadPath.startsWith('years.'))).toBe(true);
  });

  it('payload with neither years nor wrapped sub-objects yields zero periods', () => {
    const { periods } = mapPayloadToEvidence({
      ...BASE_INPUT_WRAPPED,
      documentType: 'sales_ledger',
      payload: { document: 'sales_ledger', rows_summary: { count: 12 } } as Record<string, unknown>,
    });
    expect(periods).toHaveLength(0);
  });
});

describe('mapPayloadToEvidence — report_date resolution (#339 follow-on)', () => {
  it('hoists report_date from the balance_sheet sub-object', () => {
    const p = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    p.balance_sheet.report_date = '2024-12-19';
    const { evidence } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: p });
    expect(evidence.reportDate).toBe('2024-12-19');
  });

  it('falls back to profit_and_loss when balance_sheet has none (dar 1322 shape)', () => {
    const p = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    p.profit_and_loss.report_date = '2025-05-31';
    const { evidence } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: p });
    expect(evidence.reportDate).toBe('2025-05-31');
  });

  it('balance_sheet wins when both sub-objects carry one', () => {
    const p = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    p.balance_sheet.report_date = '2024-12-19';
    p.profit_and_loss.report_date = '2024-12-19';
    const { evidence } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: p });
    expect(evidence.reportDate).toBe('2024-12-19');
  });

  it('root report_date still wins over sub-objects (PL/BS document regression guard)', () => {
    const p = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    p.report_date = '2020-01-01';
    p.balance_sheet.report_date = '2024-12-19';
    const { evidence } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload: p });
    expect(evidence.reportDate).toBe('2020-01-01');
  });

  it('null when no report_date exists anywhere', () => {
    const { evidence } = mapPayloadToEvidence(BASE_INPUT_WRAPPED);
    expect(evidence.reportDate).toBeNull();
  });
});

describe('mapPayloadToEvidence — merge anomalies (spec 2.7)', () => {
  it('wrapped payload, conflicting period_end: one anomaly, type period_end_conflict, used=BS value, usedSource=balance_sheet', () => {
    const payload = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    payload.profit_and_loss.period_ends['2022'] = '2022-04-30';
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload });
    const p = periods.find(x => x.fiscalYearStated === 2022)!;
    expect(p.anomalies).toHaveLength(1);
    expect(p.anomalies[0].type).toBe('period_end_conflict');
    expect(p.anomalies[0].detail.used).toBe('2022-03-31');
    expect(p.anomalies[0].detail.usedSource).toBe('balance_sheet');
    expect(p.anomalies[0].detail.discarded).toBe('2022-04-30');
  });

  it('wrapped payload, both sub-objects agree on period_end: anomalies is an empty array', () => {
    const { periods } = mapPayloadToEvidence(BASE_INPUT_WRAPPED);
    expect(periods.every(p => p.anomalies.length === 0)).toBe(true);
  });

  it('wrapped payload, balance_sheet only: anomalies is an empty array', () => {
    const payload = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    delete payload.profit_and_loss;
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload });
    expect(periods.every(p => p.anomalies.length === 0)).toBe(true);
  });

  it('root years-keyed payload (pre-#339 shape): no MERGE anomalies (casts are out of scope for this block)', () => {
    const { periods } = mapPayloadToEvidence(BASE_INPUT_1150);
    expect(periods.length).toBeGreaterThan(0);
    const mergeTypes = ['period_end_conflict', 'months_covered_conflict'];
    expect(
      periods.every(p => p.anomalies.every(a => mergeTypes.indexOf(a.type) === -1)),
    ).toBe(true);
  });

  it('wrapped payload, conflicting months_covered: one anomaly, type months_covered_conflict', () => {
    const payload = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    payload.profit_and_loss.months_covered['2022'] = 11;
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload });
    const p = periods.find(x => x.fiscalYearStated === 2022)!;
    expect(p.anomalies).toHaveLength(1);
    expect(p.anomalies[0].type).toBe('months_covered_conflict');
    expect(p.anomalies[0].detail.used).toBe(12);
    expect(p.anomalies[0].detail.usedSource).toBe('balance_sheet');
    expect(p.anomalies[0].detail.discarded).toBe(11);
  });

  it('wrapped payload with both conflicts on the same fiscal year: exactly two anomalies, one of each type', () => {
    const payload = JSON.parse(JSON.stringify(WRAPPED_PAYLOAD));
    payload.profit_and_loss.period_ends['2022'] = '2022-04-30';
    payload.profit_and_loss.months_covered['2022'] = 11;
    const { periods } = mapPayloadToEvidence({ ...BASE_INPUT_WRAPPED, payload });
    const p = periods.find(x => x.fiscalYearStated === 2022)!;
    expect(p.anomalies).toHaveLength(2);
    const types = p.anomalies.map(a => a.type).sort();
    expect(types).toEqual(['months_covered_conflict', 'period_end_conflict']);
  });
});

// ─── extractor and contentHash (slice 1c.2a) ────────────────────────────────

describe('mapPayloadToEvidence — extractor', () => {
  const SIMPLE_PAYLOAD = { years: { '2023': { revenue: 100000 } }, period_ends: { '2023': '2023-12-31' } } as Record<string, unknown>;

  it('composed from both model and promptVersion joined by slash', () => {
    const { evidence } = mapPayloadToEvidence({
      ...BASE_INPUT_1150,
      payload: SIMPLE_PAYLOAD,
      model: 'gemini-2.5-flash',
      promptVersion: 'pre-1c',
    });
    expect(evidence.extractor).toBe('gemini-2.5-flash/pre-1c');
  });

  it('only model present: extractor equals model', () => {
    const { evidence } = mapPayloadToEvidence({
      ...BASE_INPUT_1150,
      payload: SIMPLE_PAYLOAD,
      model: 'gemini-2.5-flash',
    });
    expect(evidence.extractor).toBe('gemini-2.5-flash');
  });

  it('only promptVersion present: extractor equals promptVersion', () => {
    const { evidence } = mapPayloadToEvidence({
      ...BASE_INPUT_1150,
      payload: SIMPLE_PAYLOAD,
      promptVersion: 'pre-1c',
    });
    expect(evidence.extractor).toBe('pre-1c');
  });

  it('neither model nor promptVersion: extractor is null', () => {
    const { evidence } = mapPayloadToEvidence({
      ...BASE_INPUT_1150,
      payload: SIMPLE_PAYLOAD,
    });
    expect(evidence.extractor).toBeNull();
  });

  it('truncated at 100 characters when combined string is longer', () => {
    const longModel = 'a'.repeat(80);
    const longVersion = 'b'.repeat(80);
    const { evidence } = mapPayloadToEvidence({
      ...BASE_INPUT_1150,
      payload: SIMPLE_PAYLOAD,
      model: longModel,
      promptVersion: longVersion,
    });
    // combined is 161 chars (80 + '/' + 80), must be sliced to 100
    expect(evidence.extractor).not.toBeNull();
    expect(evidence.extractor!.length).toBe(100);
    expect(evidence.extractor!.startsWith(longModel.slice(0, 80))).toBe(true);
  });
});

describe('mapPayloadToEvidence — contentHash', () => {
  const PAYLOAD_A = { years: { '2023': { revenue: 100000 } }, period_ends: { '2023': '2023-12-31' } } as Record<string, unknown>;
  const PAYLOAD_B = { years: { '2023': { revenue: 999999 } }, period_ends: { '2023': '2023-12-31' } } as Record<string, unknown>;

  it('stable across two calls with the same payload', () => {
    const { evidence: r1 } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: PAYLOAD_A });
    const { evidence: r2 } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: PAYLOAD_A });
    expect(r1.contentHash).not.toBeNull();
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it('identical for two payloads that differ only in key order', () => {
    const payloadKeyOrder1 = { period_ends: { '2023': '2023-12-31' }, years: { '2023': { revenue: 100000 } } } as Record<string, unknown>;
    const payloadKeyOrder2 = { years: { '2023': { revenue: 100000 } }, period_ends: { '2023': '2023-12-31' } } as Record<string, unknown>;
    const { evidence: r1 } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: payloadKeyOrder1 });
    const { evidence: r2 } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: payloadKeyOrder2 });
    expect(r1.contentHash).not.toBeNull();
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it('different for payloads differing in a value', () => {
    const { evidence: r1 } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: PAYLOAD_A });
    const { evidence: r2 } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: PAYLOAD_B });
    expect(r1.contentHash).not.toBeNull();
    expect(r2.contentHash).not.toBeNull();
    expect(r1.contentHash).not.toBe(r2.contentHash);
  });

  it('null on an unserialisable payload, no throw', () => {
    // Construct a payload with a circular reference, which JSON.stringify cannot serialise.
    const circular: Record<string, unknown> = { a: 1 };
    circular['self'] = circular;
    expect(() => {
      const { evidence } = mapPayloadToEvidence({ ...BASE_INPUT_1150, payload: circular });
      expect(evidence.contentHash).toBeNull();
    }).not.toThrow();
  });
});
