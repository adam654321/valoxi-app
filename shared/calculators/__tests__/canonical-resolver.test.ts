import { describe, it, expect } from 'vitest';
import {
  resolveCanonical,
  isMaterialConflict,
  isValuationEligible,
  toRelativePath,
  CANONICAL_RESOLVER_VERSION,
  CONFLICT_MATERIALITY_RATE,
  CONFLICT_MATERIALITY_FLOOR,
  type ResolverInput,
  type ResolverEvidence,
  type ResolverFigure,
  type ResolverPeriod,
  type ResolverAnomaly,
} from '../canonical-resolver';

const AS_OF = '2026-08-03';

let nextFigureId = 1;

function fig(
  fieldKey: string,
  value: string | null,
  opts: Partial<ResolverFigure> = {},
): ResolverFigure {
  return {
    evidenceFigureId: opts.evidenceFigureId ?? nextFigureId++,
    statementType: opts.statementType ?? 'income',
    fieldKey,
    payloadPath: opts.payloadPath ?? 'years.2025.profit_and_loss.' + fieldKey,
    value,
    isModelDerived: opts.isModelDerived ?? false,
    pageNumber: opts.pageNumber ?? null,
    labelTextAsPrinted: opts.labelTextAsPrinted ?? null,
  };
}

function period(
  id: number,
  fiscalYear: number,
  figures: ResolverFigure[],
  opts: Partial<ResolverPeriod> = {},
): ResolverPeriod {
  return {
    evidencePeriodId: id,
    fiscalYearStated: fiscalYear,
    periodStart: opts.periodStart ?? null,
    periodEnd: opts.periodEnd ?? fiscalYear + '-12-31',
    monthsCoveredStated:
      opts.monthsCoveredStated === undefined ? 12 : opts.monthsCoveredStated,
    anomalies: opts.anomalies ?? null,
    figures,
  };
}

function evidence(
  id: number,
  periods: ResolverPeriod[],
  opts: Partial<ResolverEvidence> = {},
): ResolverEvidence {
  return {
    evidenceId: id,
    documentId: opts.documentId === undefined ? id * 100 : opts.documentId,
    documentAnalysisResultId:
      opts.documentAnalysisResultId === undefined ? id * 1000 : opts.documentAnalysisResultId,
    periods,
  };
}

function input(ev: ResolverEvidence[], asOfDate = AS_OF): ResolverInput {
  return { targetCompanyId: 1877, asOfDate, evidence: ev };
}

const BLOCKING: ResolverAnomaly = {
  type: 'months_covered_conflict',
  severity: 'trust_blocking',
  detail: {},
};

const INFORMATIONAL: ResolverAnomaly = {
  type: 'cast_failure',
  severity: 'informational',
  detail: { check: 'BS6' },
};

// A. Purity and determinism. Spec 3.1's acceptance test. 4 tests.

describe('determinism', () => {
  it('A1 produces an identical output fingerprint under every upload permutation', () => {
    nextFigureId = 1;
    const a = evidence(1, [period(11, 2024, [fig('revenue', '100000')])]);
    const b = evidence(2, [period(22, 2025, [fig('revenue', '200000')])]);
    const c = evidence(3, [period(33, 2026, [fig('revenue', '300000')])]);

    const one = resolveCanonical(input([a, b, c]));
    const two = resolveCanonical(input([c, a, b]));
    const three = resolveCanonical(input([b, c, a]));

    expect(two.run.outputFingerprint).toBe(one.run.outputFingerprint);
    expect(three.run.outputFingerprint).toBe(one.run.outputFingerprint);
    expect(two.run.inputFingerprint).toBe(one.run.inputFingerprint);
    expect(three.run.inputFingerprint).toBe(one.run.inputFingerprint);
  });

  it('A2 is a no-op on rerun against unchanged evidence', () => {
    nextFigureId = 1;
    const ev = [evidence(1, [period(11, 2025, [fig('revenue', '500000')])])];
    const first = resolveCanonical(input(ev));
    const second = resolveCanonical(input(ev));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('A3 changes its result when the as-of date moves, and only then', () => {
    nextFigureId = 1;
    const ev = [
      evidence(1, [
        period(11, 2025, [fig('revenue', '100000')]),
        period(12, 2027, [fig('revenue', '900000')], { periodEnd: '2027-12-31' }),
      ]),
    ];
    const now = resolveCanonical(input(ev, '2026-08-03'));
    const later = resolveCanonical(input(ev, '2028-01-01'));

    expect(now.periods).toHaveLength(1);
    expect(later.periods).toHaveLength(2);
    expect(later.run.outputFingerprint).not.toBe(now.run.outputFingerprint);
  });

  it('A4 records the as-of date and resolver version on the run', () => {
    nextFigureId = 1;
    const out = resolveCanonical(input([evidence(1, [period(11, 2025, [fig('revenue', '1')])])]));
    expect(out.run.asOfDate).toBe(AS_OF);
    expect(out.run.resolverVersion).toBe(CANONICAL_RESOLVER_VERSION);
    expect(out.run.targetCompanyId).toBe(1877);
  });
});

// B. Span. 250 of 651 dev periods state no months. 6 tests.

describe('span_kind', () => {
  it('B1 twelve months is a full year', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([evidence(1, [period(11, 2025, [fig('revenue', '1')], { monthsCoveredStated: 12 })])]),
    );
    expect(out.periods[0].spanKind).toBe('full_year');
  });

  it('B2 one to eleven months is a part year', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([evidence(1, [period(11, 2025, [fig('revenue', '1')], { monthsCoveredStated: 5 })])]),
    );
    expect(out.periods[0].spanKind).toBe('part_year');
  });

  it('B3 no stated months and no sibling is unknown, never full_year', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '1')], { monthsCoveredStated: null })]),
      ]),
    );
    expect(out.periods[0].spanKind).toBe('unknown');
    expect(out.periods[0].valuationEligible).toBe(false);
  });

  it('B4 no stated months adopts a single stating sibling', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '1')], { monthsCoveredStated: 12 })]),
        evidence(2, [period(22, 2025, [fig('revenue', '1')], { monthsCoveredStated: null })]),
      ]),
    );
    expect(out.periods).toHaveLength(1);
    expect(out.periods[0].spanKind).toBe('full_year');
  });

  it('B5 no stated months stays unknown when siblings disagree on span', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '1')], { monthsCoveredStated: 12 })]),
        evidence(2, [period(22, 2025, [fig('revenue', '2')], { monthsCoveredStated: 6 })]),
        evidence(3, [period(33, 2025, [fig('revenue', '3')], { monthsCoveredStated: null })]),
      ]),
    );
    const spans = out.periods.map((p) => p.spanKind).sort();
    expect(spans).toEqual(['full_year', 'part_year', 'unknown']);
  });

  it('B6 a months figure above twelve is unreadable, not a full year', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([evidence(1, [period(11, 2025, [fig('revenue', '1')], { monthsCoveredStated: 18 })])]),
    );
    expect(out.periods[0].spanKind).toBe('unknown');
  });
});

// C. Anchor. page_number and label_text_as_printed are NULL on all 14,398 dev
// figures, so anchorComplete is false everywhere today. #345. 3 tests.

describe('anchor_complete', () => {
  it('C1 anchor-less evidence is admitted and flagged, never eligible', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([evidence(1, [period(11, 2025, [fig('revenue', '1')])], { documentId: null })]),
    );
    expect(out.periods).toHaveLength(1);
    expect(out.periods[0].anchorComplete).toBe(false);
    expect(out.periods[0].valuationEligible).toBe(false);
  });

  it('C2 a document id alone is not an anchor when page and label are absent', () => {
    nextFigureId = 1;
    const out = resolveCanonical(input([evidence(1, [period(11, 2025, [fig('revenue', '1')])])]));
    expect(out.periods[0].anchorComplete).toBe(false);
  });

  it('C3 document, page and printed label together make a complete anchor', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [
          period(11, 2025, [
            fig('revenue', '1', { pageNumber: 4, labelTextAsPrinted: 'Turnover' }),
          ]),
        ]),
      ]),
    );
    expect(out.periods[0].anchorComplete).toBe(true);
  });
});

// D. Trust states. QUARANTINED has zero instances in any corpus, so these
// fixtures are synthetic by necessity. 5 tests.

describe('trust_state', () => {
  it('D1 a sole candidate carrying a trust_blocking anomaly is QUARANTINED', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([evidence(1, [period(11, 2025, [fig('revenue', '1')], { anomalies: [BLOCKING] })])]),
    );
    expect(out.periods[0].trustState).toBe('QUARANTINED');
  });

  it('D2 a clean sibling beats a quarantined one and the slot is not QUARANTINED', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '1000')], { anomalies: [BLOCKING] })]),
        evidence(2, [period(22, 2025, [fig('revenue', '1000')], { anomalies: [] })]),
      ]),
    );
    expect(out.periods[0].winningEvidenceId).toBe(2);
    expect(out.periods[0].trustState).toBe('TRUST_UNRESOLVED');
    expect(out.periods[0].supersededEvidenceIds).toEqual([1]);
  });

  it('D3 an informational anomaly does not quarantine', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '1')], { anomalies: [INFORMATIONAL] })]),
      ]),
    );
    expect(out.periods[0].trustState).toBe('TRUST_UNRESOLVED');
  });

  it('D4 nothing is valuation eligible in slice 3b, on any path', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [
          period(11, 2024, [fig('revenue', '1', { pageNumber: 1, labelTextAsPrinted: 'X' })]),
          period(12, 2025, [fig('revenue', '2')], { monthsCoveredStated: 6 }),
          period(13, 2026, [fig('revenue', '3')], { monthsCoveredStated: null }),
        ]),
      ]),
    );
    expect(out.periods.length).toBeGreaterThan(0);
    expect(out.periods.every((p) => p.valuationEligible === false)).toBe(true);
    expect(out.periods.every((p) => p.isFullYearProvisional === true)).toBe(true);
  });

  it('D5 the eligibility rule is correct for all seven states, including the four 1c unlocks', () => {
    expect(isValuationEligible('VERIFIED', 'full_year', true)).toBe(true);
    expect(isValuationEligible('CORROBORATED', 'full_year', true)).toBe(true);
    expect(isValuationEligible('VERIFIED', 'part_year', true)).toBe(false);
    expect(isValuationEligible('VERIFIED', 'unknown', true)).toBe(false);
    expect(isValuationEligible('VERIFIED', 'full_year', false)).toBe(false);
    expect(isValuationEligible('UNCORROBORATED', 'full_year', true)).toBe(false);
    expect(isValuationEligible('SELLER_ASSERTED', 'full_year', true)).toBe(false);
    expect(isValuationEligible('CONFLICTED', 'full_year', true)).toBe(false);
    expect(isValuationEligible('QUARANTINED', 'full_year', true)).toBe(false);
    expect(isValuationEligible('TRUST_UNRESOLVED', 'full_year', true)).toBe(false);
  });
});

// E. CONFLICTED. Every number here is a real measured case from the dev corpus.
// 9 tests.

describe('conflict materiality', () => {
  it('E1 the 91.98% divergence in #351 is material', () => {
    expect(isMaterialConflict(361855, 4508976)).toBe(true);
  });

  it('E2 the 3.80% straggler, company 81 FY2022, is material', () => {
    expect(isMaterialConflict(456428, 474474)).toBe(true);
  });

  it('E3 the 0.11% noise ceiling is absorbed', () => {
    expect(isMaterialConflict(778880, 778017)).toBe(false);
  });

  it('E4 a sub-pound spread is absorbed, which the cast tolerance would not do', () => {
    expect(isMaterialConflict(456428.25, 456428.5)).toBe(false);
  });

  it('E5 a stored zero against a real figure is material, company 67 FY2022', () => {
    expect(isMaterialConflict(0, 4803828)).toBe(true);
  });

  it('E6 two zeroes do not conflict and do not divide by zero', () => {
    expect(isMaterialConflict(0, 0)).toBe(false);
  });

  it('E7 the floor is zero and the rate is one percent, deliberately', () => {
    expect(CONFLICT_MATERIALITY_FLOOR).toBe(0);
    expect(CONFLICT_MATERIALITY_RATE).toBe(0.01);
  });

  it('E8 a material disagreement marks the slot CONFLICTED and records both sides', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '361855')])]),
        evidence(2, [period(22, 2025, [fig('revenue', '4508976')])]),
      ]),
    );
    expect(out.periods).toHaveLength(1);
    expect(out.periods[0].trustState).toBe('CONFLICTED');
    expect(out.periods[0].valuationEligible).toBe(false);
    const detail = out.periods[0].conflictDetail;
    expect(detail).not.toBeNull();
    expect(detail?.conflicts).toHaveLength(1);
    expect(detail?.conflicts[0].figurePath).toBe('profit_and_loss.revenue');
  });

  it('E9 an immaterial disagreement leaves the slot unresolved, not conflicted', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '778880')])]),
        evidence(2, [period(22, 2025, [fig('revenue', '778017')])]),
      ]),
    );
    expect(out.periods[0].trustState).toBe('TRUST_UNRESOLVED');
    expect(out.periods[0].conflictDetail).toBeNull();
  });
});

// F. Output shape. 7 tests.

describe('output shape', () => {
  it('F1 model-derived figures are excluded', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [
          period(11, 2025, [
            fig('revenue', '100'),
            fig('gross_profit', '50', { isModelDerived: true }),
          ]),
        ]),
      ]),
    );
    expect(out.periods[0].figures.map((f) => f.fieldKey)).toEqual(['revenue']);
  });

  it('F2 field_key repeats across sections but figure_path does not', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [
          period(11, 2025, [
            fig('total', '1156884', {
              statementType: 'balance',
              payloadPath: 'years.2025.balance_sheet.current_assets.total',
            }),
            fig('total', '365924', {
              statementType: 'balance',
              payloadPath: 'years.2025.balance_sheet.current_liabilities.total',
            }),
            fig('total', '789023.96', {
              statementType: 'balance',
              payloadPath: 'years.2025.balance_sheet.equity.total',
            }),
          ]),
        ]),
      ]),
    );
    const figures = out.periods[0].figures;
    expect(figures).toHaveLength(3);
    expect(new Set(figures.map((f) => f.fieldKey)).size).toBe(1);
    expect(new Set(figures.map((f) => f.figurePath)).size).toBe(3);
  });

  it('F3 the years prefix is stripped and the relative path is the key', () => {
    expect(toRelativePath('years.2027.balance_sheet.current_assets.total')).toBe(
      'balance_sheet.current_assets.total',
    );
    expect(toRelativePath('profit_and_loss.revenue')).toBe('profit_and_loss.revenue');
  });

  it('F4 income and balance are separate slots for the same year', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [
          period(11, 2025, [
            fig('revenue', '100', { statementType: 'income' }),
            fig('total_equity', '900', {
              statementType: 'balance',
              payloadPath: 'years.2025.balance_sheet.equity.total',
            }),
          ]),
        ]),
      ]),
    );
    expect(out.periods).toHaveLength(2);
    expect(out.periods.map((p) => p.statementType).sort()).toEqual(['balance', 'income']);
  });

  it('F5 exactly one row per company, year, statement and span', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '100')])]),
        evidence(2, [period(22, 2025, [fig('revenue', '100')])]),
        evidence(3, [period(33, 2025, [fig('revenue', '100')])]),
      ]),
    );
    const keys = out.periods.map((p) => p.fiscalYear + '|' + p.statementType + '|' + p.spanKind);
    expect(keys).toHaveLength(1);
    expect(new Set(keys).size).toBe(keys.length);
    expect(out.periods[0].supersededEvidenceIds).toEqual([1, 2]);
  });

  it('F6 figures come from the winning period only', () => {
    nextFigureId = 1;
    const out = resolveCanonical(
      input([
        evidence(1, [period(11, 2025, [fig('revenue', '100'), fig('cost_of_sales', '40')])]),
        evidence(2, [period(22, 2025, [fig('revenue', '100')])]),
      ]),
    );
    expect(out.periods[0].winningEvidenceId).toBe(2);
    expect(out.periods[0].figures.map((f) => f.fieldKey)).toEqual(['revenue']);
  });

  it('F7 an empty evidence set resolves to an empty run, not a throw', () => {
    const out = resolveCanonical(input([]));
    expect(out.periods).toEqual([]);
    expect(out.run.inputFingerprint).toHaveLength(16);
    expect(out.run.outputFingerprint).toHaveLength(16);
  });
});
