import { describe, it, expect } from 'vitest';
import {
  buildResolverInput,
  isIsoDate,
  type EvidenceRowInput,
  type PeriodRowInput,
  type FigureRowInput,
} from '../canonical-input';

const AS_OF = '2026-08-03';

function ev(evidenceId: number, over: Partial<EvidenceRowInput> = {}): EvidenceRowInput {
  return {
    evidenceId,
    documentId: 100 + evidenceId,
    documentAnalysisResultId: 200 + evidenceId,
    ...over,
  };
}

function per(
  evidencePeriodId: number,
  evidenceId: number,
  over: Partial<PeriodRowInput> = {},
): PeriodRowInput {
  return {
    evidencePeriodId,
    evidenceId,
    fiscalYearStated: 2025,
    periodStart: null,
    periodEnd: '2025-12-31',
    monthsCoveredStated: 12,
    anomalies: null,
    ...over,
  };
}

function fig(
  evidenceFigureId: number,
  evidencePeriodId: number,
  over: Partial<FigureRowInput> = {},
): FigureRowInput {
  return {
    evidenceFigureId,
    evidencePeriodId,
    statementType: 'income',
    fieldKey: 'revenue',
    payloadPath: 'years.2025.profit_and_loss.revenue',
    value: '1000.00',
    isModelDerived: false,
    pageNumber: null,
    labelTextAsPrinted: null,
    ...over,
  };
}

describe('buildResolverInput', () => {
  it('returns an empty input for no rows', () => {
    const r = buildResolverInput(7, AS_OF, { evidence: [], periods: [], figures: [] });
    expect(r.input.evidence).toEqual([]);
    expect(r.counts).toEqual({ evidence: 0, periods: 0, figures: 0 });
    expect(r.skipped.periodsWithoutFiscalYear).toBe(0);
    expect(r.skipped.figuresWithoutPayloadPath).toBe(0);
  });

  it('passes targetCompanyId and asOfDate through unchanged', () => {
    const r = buildResolverInput(1880, AS_OF, { evidence: [], periods: [], figures: [] });
    expect(r.input.targetCompanyId).toBe(1880);
    expect(r.input.asOfDate).toBe(AS_OF);
  });

  it('nests figures under their period and periods under their evidence row', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(100, 10), fig(101, 10)],
    });
    expect(r.input.evidence).toHaveLength(1);
    expect(r.input.evidence[0].periods).toHaveLength(1);
    expect(r.input.evidence[0].periods[0].figures.map((f) => f.evidenceFigureId)).toEqual([100, 101]);
    expect(r.counts).toEqual({ evidence: 1, periods: 1, figures: 2 });
  });

  it('sorts evidence rows ascending by evidenceId', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(3), ev(1), ev(2)],
      periods: [],
      figures: [],
    });
    expect(r.input.evidence.map((e) => e.evidenceId)).toEqual([1, 2, 3]);
  });

  it('sorts periods ascending by evidencePeriodId', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(12, 1), per(10, 1), per(11, 1)],
      figures: [],
    });
    expect(r.input.evidence[0].periods.map((p) => p.evidencePeriodId)).toEqual([10, 11, 12]);
  });

  it('sorts figures ascending by evidenceFigureId', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(103, 10), fig(101, 10), fig(102, 10)],
    });
    expect(r.input.evidence[0].periods[0].figures.map((f) => f.evidenceFigureId)).toEqual([101, 102, 103]);
  });

  it('skips a period with a null fiscalYearStated and counts it', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1, { fiscalYearStated: null }), per(11, 1)],
      figures: [],
    });
    expect(r.input.evidence[0].periods.map((p) => p.evidencePeriodId)).toEqual([11]);
    expect(r.skipped.periodsWithoutFiscalYear).toBe(1);
    expect(r.counts.periods).toBe(1);
  });

  it('drops the figures of a skipped period', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1, { fiscalYearStated: null })],
      figures: [fig(100, 10)],
    });
    expect(r.counts.figures).toBe(0);
    expect(r.skipped.figuresWithoutParentPeriod).toBe(0);
  });

  it('skips a figure with a null payloadPath and counts it', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(100, 10, { payloadPath: null }), fig(101, 10)],
    });
    expect(r.counts.figures).toBe(1);
    expect(r.skipped.figuresWithoutPayloadPath).toBe(1);
  });

  it('skips a figure with an unknown statementType and counts it', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(100, 10, { statementType: 'cashflow' }), fig(101, 10)],
    });
    expect(r.counts.figures).toBe(1);
    expect(r.skipped.figuresWithUnknownStatementType).toBe(1);
  });

  it('skips a figure whose parent period is not in the row set', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(100, 99)],
    });
    expect(r.counts.figures).toBe(0);
    expect(r.skipped.figuresWithoutParentPeriod).toBe(1);
  });

  it('skips a period whose parent evidence row is not in the row set', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 99)],
      figures: [],
    });
    expect(r.counts.periods).toBe(0);
    expect(r.skipped.periodsWithoutParentEvidence).toBe(1);
  });

  it('gives a period with no figures an empty array', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [],
    });
    expect(r.input.evidence[0].periods[0].figures).toEqual([]);
  });

  it('preserves a null value rather than coercing it', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(100, 10, { value: null })],
    });
    expect(r.input.evidence[0].periods[0].figures[0].value).toBeNull();
  });

  it('preserves null pageNumber and labelTextAsPrinted', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1)],
      figures: [fig(100, 10)],
    });
    const f = r.input.evidence[0].periods[0].figures[0];
    expect(f.pageNumber).toBeNull();
    expect(f.labelTextAsPrinted).toBeNull();
  });

  it('leaves anomalies null when the column is null', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1, { anomalies: null })],
      figures: [],
    });
    expect(r.input.evidence[0].periods[0].anomalies).toBeNull();
  });

  it('maps a valid anomaly array and defaults a missing detail to an empty object', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [
        per(10, 1, {
          anomalies: [{ type: 'bs_imbalance', severity: 'trust_blocking' }],
        }),
      ],
      figures: [],
    });
    expect(r.input.evidence[0].periods[0].anomalies).toEqual([
      { type: 'bs_imbalance', severity: 'trust_blocking', detail: {} },
    ]);
    expect(r.skipped.anomalyEntriesDropped).toBe(0);
  });

  it('keeps an empty anomalies array as an empty array, not null', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [per(10, 1, { anomalies: [] })],
      figures: [],
    });
    expect(r.input.evidence[0].periods[0].anomalies).toEqual([]);
  });

  it('drops malformed anomaly entries and counts them', () => {
    const r = buildResolverInput(7, AS_OF, {
      evidence: [ev(1)],
      periods: [
        per(10, 1, {
          anomalies: [
            null,
            'nonsense',
            { type: 'no_severity' },
            { type: 'bad_severity', severity: 'critical' },
            { type: 'ok', severity: 'informational', detail: { a: 1 } },
          ],
        }),
      ],
      figures: [],
    });
    expect(r.input.evidence[0].periods[0].anomalies).toEqual([
      { type: 'ok', severity: 'informational', detail: { a: 1 } },
    ]);
    expect(r.skipped.anomalyEntriesDropped).toBe(4);
  });

  it('is order independent: shuffled input produces identical output', () => {
    const evidence = [ev(1), ev(2)];
    const periods = [per(10, 1), per(11, 2), per(12, 1)];
    const figures = [fig(100, 10), fig(101, 11), fig(102, 12), fig(103, 10)];
    const a = buildResolverInput(7, AS_OF, { evidence, periods, figures });
    const b = buildResolverInput(7, AS_OF, {
      evidence: evidence.slice().reverse(),
      periods: periods.slice().reverse(),
      figures: figures.slice().reverse(),
    });
    expect(JSON.stringify(b.input)).toBe(JSON.stringify(a.input));
  });
});

describe('isIsoDate', () => {
  it('accepts a YYYY-MM-DD date and rejects anything else', () => {
    expect(isIsoDate('2026-08-03')).toBe(true);
    expect(isIsoDate('2026-8-3')).toBe(false);
    expect(isIsoDate('03/08/2026')).toBe(false);
    expect(isIsoDate('2026-08-03T00:00:00.000Z')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});
