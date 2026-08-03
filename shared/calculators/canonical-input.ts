/**
 * shared/calculators/canonical-input.ts
 *
 * Pure adapter: flat evidence rows to ResolverInput. Slice 3c.
 *
 * No ORM types, no database handle, no clock. The caller supplies asOfDate.
 *
 * Why this is a separate pure file: the row-to-input mapping is the part of 3c
 * that can be tested without a database, and the slice 3 design names mapping
 * code as the most defect-prone part of the slice.
 *
 * SKIP, NEVER THROW. Every row this file cannot honestly convert is skipped and
 * counted, and the counts are returned to the caller. Throwing inside the
 * pipeline's non-fatal catch would lose an entire run while logging one line.
 * Measured on dev 3 August 2026: 0 of 651 periods lack fiscal_year_stated, and
 * 0 of 14,398 figures lack payload_path or value. Every counter below is
 * therefore expected to be zero. They exist because those columns are nullable
 * in the schema declaration, not because the data is dirty.
 */

import type {
  ResolverInput,
  ResolverEvidence,
  ResolverPeriod,
  ResolverFigure,
  ResolverAnomaly,
  StatementType,
  AnomalySeverity,
} from './canonical-resolver';

export interface EvidenceRowInput {
  evidenceId: number;
  documentId: number | null;
  documentAnalysisResultId: number | null;
}

export interface PeriodRowInput {
  evidencePeriodId: number;
  evidenceId: number;
  fiscalYearStated: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCoveredStated: number | null;
  anomalies: unknown;
}

export interface FigureRowInput {
  evidenceFigureId: number;
  evidencePeriodId: number;
  statementType: string;
  fieldKey: string;
  payloadPath: string | null;
  value: string | null;
  isModelDerived: boolean;
  pageNumber: number | null;
  labelTextAsPrinted: string | null;
}

export interface BuildSkipCounts {
  periodsWithoutFiscalYear: number;
  periodsWithoutParentEvidence: number;
  figuresWithoutPayloadPath: number;
  figuresWithoutParentPeriod: number;
  figuresWithUnknownStatementType: number;
  anomalyEntriesDropped: number;
}

export interface BuildResolverInputResult {
  input: ResolverInput;
  skipped: BuildSkipCounts;
  counts: { evidence: number; periods: number; figures: number };
}

export interface EvidenceRowSet {
  evidence: EvidenceRowInput[];
  periods: PeriodRowInput[];
  figures: FigureRowInput[];
}

const STATEMENT_TYPES: StatementType[] = ['income', 'balance'];
const ANOMALY_SEVERITIES: AnomalySeverity[] = ['trust_blocking', 'informational'];

/** YYYY-MM-DD only. The date column will not accept anything else. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isStatementType(value: string): value is StatementType {
  return STATEMENT_TYPES.indexOf(value as StatementType) !== -1;
}

function isAnomalySeverity(value: unknown): value is AnomalySeverity {
  return (
    typeof value === 'string' &&
    ANOMALY_SEVERITIES.indexOf(value as AnomalySeverity) !== -1
  );
}

function normaliseAnomalies(
  raw: unknown,
  skipped: BuildSkipCounts,
): ResolverAnomaly[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: ResolverAnomaly[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') {
      skipped.anomalyEntriesDropped += 1;
      continue;
    }
    const record = entry as Record<string, unknown>;
    const type = record.type;
    const severity = record.severity;
    if (typeof type !== 'string' || !isAnomalySeverity(severity)) {
      skipped.anomalyEntriesDropped += 1;
      continue;
    }
    const rawDetail = record.detail;
    const detail =
      rawDetail !== null && typeof rawDetail === 'object'
        ? (rawDetail as Record<string, unknown>)
        : {};
    out.push({ type, severity, detail });
  }
  return out;
}

export function buildResolverInput(
  targetCompanyId: number,
  asOfDate: string,
  rows: EvidenceRowSet,
): BuildResolverInputResult {
  const skipped: BuildSkipCounts = {
    periodsWithoutFiscalYear: 0,
    periodsWithoutParentEvidence: 0,
    figuresWithoutPayloadPath: 0,
    figuresWithoutParentPeriod: 0,
    figuresWithUnknownStatementType: 0,
    anomalyEntriesDropped: 0,
  };

  const periodIds = new Set(rows.periods.map((p) => p.evidencePeriodId));
  const evidenceIds = new Set(rows.evidence.map((e) => e.evidenceId));

  const figuresByPeriod = new Map<number, ResolverFigure[]>();
  const sortedFigures = rows.figures
    .slice()
    .sort((a, b) => a.evidenceFigureId - b.evidenceFigureId);
  for (const f of sortedFigures) {
    if (!periodIds.has(f.evidencePeriodId)) {
      skipped.figuresWithoutParentPeriod += 1;
      continue;
    }
    const payloadPath = f.payloadPath;
    if (payloadPath === null) {
      skipped.figuresWithoutPayloadPath += 1;
      continue;
    }
    const statementType = f.statementType;
    if (!isStatementType(statementType)) {
      skipped.figuresWithUnknownStatementType += 1;
      continue;
    }
    const mapped: ResolverFigure = {
      evidenceFigureId: f.evidenceFigureId,
      statementType,
      fieldKey: f.fieldKey,
      payloadPath,
      value: f.value,
      isModelDerived: f.isModelDerived,
      pageNumber: f.pageNumber,
      labelTextAsPrinted: f.labelTextAsPrinted,
    };
    const bucket = figuresByPeriod.get(f.evidencePeriodId);
    if (bucket) {
      bucket.push(mapped);
    } else {
      figuresByPeriod.set(f.evidencePeriodId, [mapped]);
    }
  }

  const periodsByEvidence = new Map<number, ResolverPeriod[]>();
  const sortedPeriods = rows.periods
    .slice()
    .sort((a, b) => a.evidencePeriodId - b.evidencePeriodId);
  for (const p of sortedPeriods) {
    if (!evidenceIds.has(p.evidenceId)) {
      skipped.periodsWithoutParentEvidence += 1;
      continue;
    }
    const fiscalYearStated = p.fiscalYearStated;
    if (fiscalYearStated === null) {
      skipped.periodsWithoutFiscalYear += 1;
      continue;
    }
    const mapped: ResolverPeriod = {
      evidencePeriodId: p.evidencePeriodId,
      fiscalYearStated,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      monthsCoveredStated: p.monthsCoveredStated,
      anomalies: normaliseAnomalies(p.anomalies, skipped),
      figures: figuresByPeriod.get(p.evidencePeriodId) ?? [],
    };
    const bucket = periodsByEvidence.get(p.evidenceId);
    if (bucket) {
      bucket.push(mapped);
    } else {
      periodsByEvidence.set(p.evidenceId, [mapped]);
    }
  }

  const evidence: ResolverEvidence[] = rows.evidence
    .slice()
    .sort((a, b) => a.evidenceId - b.evidenceId)
    .map((e) => ({
      evidenceId: e.evidenceId,
      documentId: e.documentId,
      documentAnalysisResultId: e.documentAnalysisResultId,
      periods: periodsByEvidence.get(e.evidenceId) ?? [],
    }));

  let periodCount = 0;
  let figureCount = 0;
  for (const e of evidence) {
    periodCount += e.periods.length;
    for (const p of e.periods) {
      figureCount += p.figures.length;
    }
  }

  return {
    input: { targetCompanyId, asOfDate, evidence },
    skipped,
    counts: { evidence: evidence.length, periods: periodCount, figures: figureCount },
  };
}
