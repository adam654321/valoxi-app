/**
 * Canonical resolver, slice 3b.
 *
 * PURE. Reads no database, writes no database, imported by nobody. Slice 3c
 * wires it behind a kill switch. Slice 5 is the only cutover.
 *
 * THE CLOCK IS A PARAMETER. `new Date()` must never appear in this file. The
 * live path (`reselect`) reads the wall clock twice inside its completed-year
 * gate, which is why spec 3.1's byte-identical acceptance test cannot pass
 * against it. `asOfDate` is that fix.
 *
 * Every choice below is backed by a count taken on dev, 3 August 2026.
 * Full rationale and the counts: claude/ASSESS-slice-3b-blockers.md
 */

/** Bump whenever resolver logic changes. Recorded on canonical_run. */
export const CANONICAL_RESOLVER_VERSION = 1;

/**
 * CONFLICTED materiality: 1% of the LARGER magnitude. Measured on 109
 * multi-document company-years. Any threshold from 0.2% to 3.8% classifies
 * identically. The cast tolerance is deliberately NOT reused here.
 */
export const CONFLICT_MATERIALITY_RATE = 0.01;

/**
 * Absolute floor, deliberately ZERO. All nine observed noise rows are
 * PROPORTIONAL (0.0001% to 0.1108%), so a percentage works at any scale.
 * Named and exported so adding a floor later is a one-line change against the
 * test that pins this to zero.
 */
export const CONFLICT_MATERIALITY_FLOOR = 0;

export type StatementType = 'income' | 'balance';

/**
 * 'unknown' is a THIRD span. `is_full_year_computed` is NULL on all 651 dev
 * periods because the mapper never writes it. months_covered_stated is null on
 * 250 of 651, and a sibling rescues only 4 of those. Defaulting the other 246
 * to full_year would launder an assumption into an authoritative field.
 * span_kind is varchar(12) with no CHECK, so this needs no DDL.
 */
export type SpanKind = 'full_year' | 'part_year' | 'unknown';

/**
 * Spec P4 defines six. Only QUARANTINED and CONFLICTED are computable today.
 * TRUST_UNRESOLVED is the transitional seventh and WILL dominate the first diff
 * report. That is the correct result, not a failure.
 */
export type TrustState =
  | 'VERIFIED'
  | 'CORROBORATED'
  | 'UNCORROBORATED'
  | 'SELLER_ASSERTED'
  | 'CONFLICTED'
  | 'QUARANTINED'
  | 'TRUST_UNRESOLVED';

export type AnomalySeverity = 'trust_blocking' | 'informational';

export interface ResolverAnomaly {
  type: string;
  severity: AnomalySeverity;
  detail: Record<string, unknown>;
}

export interface ResolverFigure {
  evidenceFigureId: number;
  statementType: StatementType;
  fieldKey: string;
  /** Full path including the years.N. prefix. 100% populated on dev. */
  payloadPath: string;
  value: string | null;
  isModelDerived: boolean;
  /** NULL on all 14,398 dev figures. Part of the spec P3 anchor. */
  pageNumber: number | null;
  /** NULL on all 14,398 dev figures. Part of the spec P3 anchor. */
  labelTextAsPrinted: string | null;
}

export interface ResolverPeriod {
  evidencePeriodId: number;
  fiscalYearStated: number;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCoveredStated: number | null;
  anomalies: ResolverAnomaly[] | null;
  figures: ResolverFigure[];
}

export interface ResolverEvidence {
  evidenceId: number;
  /** Nulled when the source document is deleted. #345. */
  documentId: number | null;
  documentAnalysisResultId: number | null;
  periods: ResolverPeriod[];
}

export interface ResolverInput {
  targetCompanyId: number;
  /** YYYY-MM-DD. THE CLOCK. Never read from the environment. */
  asOfDate: string;
  evidence: ResolverEvidence[];
}

export interface ResolvedFigure {
  /** Relative path, after the first years.N. segment. THE UNIQUENESS KEY. */
  figurePath: string;
  /** Leaf name. NOT unique within a period: 295 duplicate groups on dev. */
  fieldKey: string;
  value: string | null;
  sourceEvidenceFigureId: number;
}

export interface ConflictEntry {
  figurePath: string;
  winningValue: string | null;
  winningEvidenceId: number;
  competingValue: string | null;
  competingEvidenceId: number;
  absoluteDifference: number;
  largerMagnitude: number;
  thresholdApplied: number;
}

export interface ResolvedPeriod {
  targetCompanyId: number;
  fiscalYear: number;
  statementType: StatementType;
  spanKind: SpanKind;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCovered: number | null;
  isFullYearProvisional: boolean;
  trustState: TrustState;
  valuationEligible: boolean;
  anchorComplete: boolean;
  winningEvidenceId: number;
  winningPeriodId: number;
  supersededEvidenceIds: number[];
  conflictDetail: { conflicts: ConflictEntry[] } | null;
  figures: ResolvedFigure[];
}

export interface ResolvedRun {
  targetCompanyId: number;
  resolverVersion: number;
  asOfDate: string;
  inputFingerprint: string;
  outputFingerprint: string;
}

export interface ResolverOutput {
  run: ResolvedRun;
  periods: ResolvedPeriod[];
}

/**
 * Deterministic non-cryptographic digest. Deliberately NOT node:crypto, because
 * this file is in shared/ and must bundle for the client. 16 hex characters.
 */
function digest(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Everything after the first years.N. segment. The fallback is defensive only. */
export function toRelativePath(payloadPath: string): string {
  const match = /^years\.[^.]+\./.exec(payloadPath);
  return match ? payloadPath.slice(match[0].length) : payloadPath;
}

function parseValue(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Longhand. #295 and #331 are both abs()-on-financials defects. */
function magnitude(n: number): number {
  return n < 0 ? 0 - n : n;
}

function yearOf(isoDate: string): number {
  return parseInt(isoDate.slice(0, 4), 10);
}

/** 12 is a full year, 1 to 11 a part year, anything else unreadable. */
function spanFromMonths(months: number | null): SpanKind | null {
  if (months === null) return null;
  if (months === 12) return 'full_year';
  if (months >= 1 && months <= 11) return 'part_year';
  return null;
}

/** Zero against a non-zero is 100% divergent, so it IS material. */
export function isMaterialConflict(a: number, b: number): boolean {
  const difference = magnitude(a - b);
  if (difference === 0) return false;
  const larger = magnitude(a) > magnitude(b) ? magnitude(a) : magnitude(b);
  const rateThreshold = larger * CONFLICT_MATERIALITY_RATE;
  const threshold =
    rateThreshold > CONFLICT_MATERIALITY_FLOOR ? rateThreshold : CONFLICT_MATERIALITY_FLOOR;
  return difference > threshold;
}

interface Candidate {
  evidenceId: number;
  evidencePeriodId: number;
  anchorComplete: boolean;
  quarantined: boolean;
  fiscalYear: number;
  statementType: StatementType;
  statedSpan: SpanKind | null;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCovered: number | null;
  figures: ResolverFigure[];
}

/**
 * Winner ordering. Tiers are gone, so no quality signal remains except these.
 * Every winner is TRUST_UNRESOLVED anyway, so this confers no authority. It
 * exists to be DETERMINISTIC, nothing more.
 *   1. not quarantined  2. complete anchor  3. higher evidenceId  4. higher periodId
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.quarantined !== b.quarantined) return a.quarantined ? 1 : -1;
  if (a.anchorComplete !== b.anchorComplete) return a.anchorComplete ? -1 : 1;
  if (a.evidenceId !== b.evidenceId) return b.evidenceId - a.evidenceId;
  return b.evidencePeriodId - a.evidencePeriodId;
}

export function resolveCanonical(input: ResolverInput): ResolverOutput {
  const asOfYear = yearOf(input.asOfDate);
  const statementTypes: StatementType[] = ['balance', 'income'];
  const candidates: Candidate[] = [];
  const inputLines: string[] = [];

  for (const evidence of input.evidence) {
    for (const period of evidence.periods) {
      // The as-of gate. Replaces reselect's two new Date() calls.
      if (period.periodEnd !== null && period.periodEnd > input.asOfDate) continue;
      if (period.fiscalYearStated > asOfYear) continue;

      const anomalies = period.anomalies === null ? [] : period.anomalies;
      const quarantined = anomalies.some((a) => a.severity === 'trust_blocking');
      const live = period.figures.filter((f) => f.isModelDerived === false);

      // Spec P3: an anchor is document, page AND printed label. The latter two
      // are NULL on all 14,398 dev figures, so this is false everywhere today.
      const anchorComplete =
        evidence.documentId !== null &&
        live.length > 0 &&
        live.every((f) => f.pageNumber !== null && f.labelTextAsPrinted !== null);

      for (const figure of live) {
        inputLines.push(
          [
            evidence.evidenceId,
            evidence.documentId === null ? 'null' : evidence.documentId,
            period.evidencePeriodId,
            period.fiscalYearStated,
            period.periodEnd === null ? 'null' : period.periodEnd,
            period.monthsCoveredStated === null ? 'null' : period.monthsCoveredStated,
            figure.statementType,
            toRelativePath(figure.payloadPath),
            figure.value === null ? 'null' : figure.value,
          ].join('|'),
        );
      }

      for (const statementType of statementTypes) {
        const figures = live.filter((f) => f.statementType === statementType);
        if (figures.length === 0) continue;
        candidates.push({
          evidenceId: evidence.evidenceId,
          evidencePeriodId: period.evidencePeriodId,
          anchorComplete,
          quarantined,
          fiscalYear: period.fiscalYearStated,
          statementType,
          statedSpan: spanFromMonths(period.monthsCoveredStated),
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          monthsCovered: period.monthsCoveredStated,
          figures,
        });
      }
    }
  }

  // Silent-sibling rule. A candidate with no stated months adopts its
  // company-year-statement siblings' span ONLY when they state exactly one
  // distinct span between them. Rescues 4 of 250 on dev.
  const statedSpans = new Map<string, Set<SpanKind>>();
  for (const c of candidates) {
    if (c.statedSpan === null) continue;
    const key = c.fiscalYear + '|' + c.statementType;
    const set = statedSpans.get(key);
    if (set) {
      set.add(c.statedSpan);
    } else {
      statedSpans.set(key, new Set([c.statedSpan]));
    }
  }

  function spanFor(c: Candidate): SpanKind {
    if (c.statedSpan !== null) return c.statedSpan;
    const set = statedSpans.get(c.fiscalYear + '|' + c.statementType);
    if (set && set.size === 1) return Array.from(set)[0];
    return 'unknown';
  }

  const slots = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = c.fiscalYear + '|' + c.statementType + '|' + spanFor(c);
    const bucket = slots.get(key);
    if (bucket) {
      bucket.push(c);
    } else {
      slots.set(key, [c]);
    }
  }

  const periods: ResolvedPeriod[] = [];

  for (const key of Array.from(slots.keys()).sort()) {
    const bucket = (slots.get(key) as Candidate[]).slice().sort(compareCandidates);
    const winner = bucket[0];
    const losers = bucket.slice(1);

    // Figures come from the WINNING period only. Deduped by figurePath, lowest
    // evidenceFigureId wins, sorted for a stable fingerprint.
    const byPath = new Map<string, ResolverFigure>();
    for (const f of winner.figures) {
      const path = toRelativePath(f.payloadPath);
      const existing = byPath.get(path);
      if (!existing || f.evidenceFigureId < existing.evidenceFigureId) {
        byPath.set(path, f);
      }
    }
    const figures: ResolvedFigure[] = Array.from(byPath.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([path, f]) => ({
        figurePath: path,
        fieldKey: f.fieldKey,
        value: f.value,
        sourceEvidenceFigureId: f.evidenceFigureId,
      }));

    const conflicts: ConflictEntry[] = [];
    const winnerByPath = new Map(figures.map((f) => [f.figurePath, f]));
    for (const loser of losers) {
      for (const lf of loser.figures) {
        const path = toRelativePath(lf.payloadPath);
        const wf = winnerByPath.get(path);
        if (!wf) continue;
        const a = parseValue(wf.value);
        const b = parseValue(lf.value);
        if (a === null || b === null) continue;
        if (!isMaterialConflict(a, b)) continue;
        const larger = magnitude(a) > magnitude(b) ? magnitude(a) : magnitude(b);
        const rateThreshold = larger * CONFLICT_MATERIALITY_RATE;
        conflicts.push({
          figurePath: path,
          winningValue: wf.value,
          winningEvidenceId: winner.evidenceId,
          competingValue: lf.value,
          competingEvidenceId: loser.evidenceId,
          absoluteDifference: magnitude(a - b),
          largerMagnitude: larger,
          thresholdApplied:
            rateThreshold > CONFLICT_MATERIALITY_FLOOR
              ? rateThreshold
              : CONFLICT_MATERIALITY_FLOOR,
        });
      }
    }
    conflicts.sort((x, y) =>
      x.figurePath < y.figurePath ? -1 : x.figurePath > y.figurePath ? 1 : 0,
    );

    const allQuarantined = bucket.every((c) => c.quarantined);
    let trustState: TrustState = 'TRUST_UNRESOLVED';
    if (allQuarantined) {
      trustState = 'QUARANTINED';
    } else if (conflicts.length > 0) {
      trustState = 'CONFLICTED';
    }

    const spanKind = spanFor(winner);

    // The eligibility RULE, expressed rather than hardcoded. False on every path
    // in 3b because neither VERIFIED nor CORROBORATED is reachable until 1c.
    const valuationEligible =
      (trustState === 'VERIFIED' || trustState === 'CORROBORATED') &&
      spanKind === 'full_year' &&
      winner.anchorComplete;

    periods.push({
      targetCompanyId: input.targetCompanyId,
      fiscalYear: winner.fiscalYear,
      statementType: winner.statementType,
      spanKind,
      periodStart: winner.periodStart,
      periodEnd: winner.periodEnd,
      monthsCovered: winner.monthsCovered,
      // Spec 2.2 amendment: no company year end is stored anywhere, so
      // is_full_year can apply only its months test until 1c. Every row says so.
      isFullYearProvisional: true,
      trustState,
      valuationEligible,
      anchorComplete: winner.anchorComplete,
      winningEvidenceId: winner.evidenceId,
      winningPeriodId: winner.evidencePeriodId,
      supersededEvidenceIds: Array.from(new Set(losers.map((l) => l.evidenceId))).sort(
        (a, b) => a - b,
      ),
      conflictDetail: conflicts.length > 0 ? { conflicts } : null,
      figures,
    });
  }

  const outputLines: string[] = [];
  for (const p of periods) {
    outputLines.push(
      [
        p.fiscalYear,
        p.statementType,
        p.spanKind,
        p.trustState,
        p.anchorComplete ? '1' : '0',
        p.winningEvidenceId,
        p.winningPeriodId,
      ].join('|'),
    );
    for (const f of p.figures) {
      outputLines.push(
        p.fiscalYear +
          '|' +
          p.statementType +
          '|' +
          p.spanKind +
          '|' +
          f.figurePath +
          '|' +
          (f.value === null ? 'null' : f.value),
      );
    }
  }

  return {
    run: {
      targetCompanyId: input.targetCompanyId,
      resolverVersion: CANONICAL_RESOLVER_VERSION,
      asOfDate: input.asOfDate,
      // Sorted, so upload order cannot change either fingerprint. This is what
      // makes spec 3.1's permutation test executable rather than aspirational.
      inputFingerprint: digest(inputLines.slice().sort().join('\n')),
      outputFingerprint: digest(outputLines.slice().sort().join('\n')),
    },
    periods,
  };
}
