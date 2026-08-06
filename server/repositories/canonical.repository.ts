import { and, eq, inArray, or, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  documentEvidence,
  documentEvidencePeriod,
  documentEvidenceFigure,
  canonicalRun,
  canonicalPeriod,
  canonicalFigure,
} from '@shared/schema';
import {
  buildResolverInput,
  isIsoDate,
  type EvidenceRowInput,
  type PeriodRowInput,
  type FigureRowInput,
  type BuildSkipCounts,
} from '@shared/calculators/canonical-input';
import {
  resolveCanonical,
  type ResolverOutput,
} from '@shared/calculators/canonical-resolver';
import { systemConfigService } from '../services/system-config.service';

const FLAG_KEY = 'canonical_shadow_write_enabled';
const EVIDENCE_FLAG_KEY = 'evidence_shadow_write_enabled';

export interface WriteForCompanyInput {
  targetCompanyId: number;
  /** YYYY-MM-DD. Omit and the repository stamps today in UTC. */
  asOfDate?: string;
}

export interface ResolveCounts {
  evidence: number;
  periods: number;
  figures: number;
}

export type ResolveForCompanyResult =
  | { resolved: false; reason: 'bad_as_of_date' | 'no_evidence' }
  | {
      resolved: true;
      asOfDate: string;
      input: ResolveCounts;
      skipped: BuildSkipCounts;
      output: ResolverOutput;
    };

export type CanonicalWriteResult =
  | {
      written: false;
      reason: 'flag_off' | 'evidence_flag_off' | 'bad_as_of_date' | 'no_evidence';
    }
  | {
      written: true;
      runId: number;
      asOfDate: string;
      periodCount: number;
      figureCount: number;
      input: ResolveCounts;
      skipped: BuildSkipCounts;
      output: ResolverOutput;
    };

export class CanonicalRepository {
  /**
   * READ ONLY. Reads one company's evidence and resolves it. Writes nothing, and
   * is deliberately not gated on either kill switch, because it cannot write.
   * The write path calls this, so a dry run exercises identical code.
   */
  async resolveForCompany(input: WriteForCompanyInput): Promise<ResolveForCompanyResult> {
    // The only clock in slice 3. UTC, never server local: the same corpus must
    // not resolve differently either side of midnight BST.
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
    if (!isIsoDate(asOfDate)) {
      return { resolved: false, reason: 'bad_as_of_date' };
    }

    const evidenceRows: EvidenceRowInput[] = await db
      .select({
        evidenceId: documentEvidence.id,
        documentId: documentEvidence.documentId,
        documentAnalysisResultId: documentEvidence.documentAnalysisResultId,
      })
      .from(documentEvidence)
      .where(
        and(
          eq(documentEvidence.targetCompanyId, input.targetCompanyId),
          or(
            isNull(documentEvidence.documentId),
            eq(
              documentEvidence.extractionVersion,
              sql<number>`(SELECT MAX(de2.extraction_version) FROM document_evidence de2 WHERE de2.document_id = ${documentEvidence.documentId} AND de2.document_type = ${documentEvidence.documentType})`,
            ),
          ),
        ),
      );

    if (evidenceRows.length === 0) {
      return { resolved: false, reason: 'no_evidence' };
    }

    const evidenceIds = evidenceRows.map((r) => r.evidenceId);
    const periodRows: PeriodRowInput[] = await db
      .select({
        evidencePeriodId: documentEvidencePeriod.id,
        evidenceId: documentEvidencePeriod.documentEvidenceId,
        fiscalYearStated: documentEvidencePeriod.fiscalYearStated,
        periodStart: documentEvidencePeriod.periodStart,
        periodEnd: documentEvidencePeriod.periodEnd,
        monthsCoveredStated: documentEvidencePeriod.monthsCoveredStated,
        anomalies: documentEvidencePeriod.anomalies,
      })
      .from(documentEvidencePeriod)
      .where(inArray(documentEvidencePeriod.documentEvidenceId, evidenceIds));

    const periodIds = periodRows.map((r) => r.evidencePeriodId);
    const figureRows: FigureRowInput[] =
      periodIds.length === 0
        ? []
        : await db
            .select({
              evidenceFigureId: documentEvidenceFigure.id,
              evidencePeriodId: documentEvidenceFigure.documentEvidencePeriodId,
              statementType: documentEvidenceFigure.statementType,
              fieldKey: documentEvidenceFigure.fieldKey,
              payloadPath: documentEvidenceFigure.payloadPath,
              value: documentEvidenceFigure.value,
              isModelDerived: documentEvidenceFigure.isModelDerived,
              pageNumber: documentEvidenceFigure.pageNumber,
              labelTextAsPrinted: documentEvidenceFigure.labelTextAsPrinted,
            })
            .from(documentEvidenceFigure)
            .where(inArray(documentEvidenceFigure.documentEvidencePeriodId, periodIds));

    // Pure adapter, then pure resolver. Neither touches the database.
    const built = buildResolverInput(input.targetCompanyId, asOfDate, {
      evidence: evidenceRows,
      periods: periodRows,
      figures: figureRows,
    });
    const output = resolveCanonical(built.input);

    return {
      resolved: true,
      asOfDate,
      input: built.counts,
      skipped: built.skipped,
      output,
    };
  }

  /**
   * Resolves one company's evidence into a canonical run. Slice 3c, shadow mode.
   * Nothing reads what this writes.
   */
  async writeForCompany(input: WriteForCompanyInput): Promise<CanonicalWriteResult> {
    // Both kill switches, before any DB read or write. Canonical over a corpus
    // that has stopped being updated would be confidently stale, so the evidence
    // switch gates this one too.
    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
    if (flagValue !== 'true') {
      return { written: false, reason: 'flag_off' };
    }
    const evidenceFlagValue = await systemConfigService.getConfig(EVIDENCE_FLAG_KEY);
    if (evidenceFlagValue !== 'true') {
      return { written: false, reason: 'evidence_flag_off' };
    }

    const prepared = await this.resolveForCompany(input);
    if (!prepared.resolved) {
      return { written: false, reason: prepared.reason };
    }
    const { asOfDate, output } = prepared;

    // One transaction for the whole run. A partially written run would carry a
    // fingerprint computed over rows that do not all exist, and the diff report
    // would read it as a complete statement of the company's history.
    let runId = 0;
    let figureCount = 0;
    await db.transaction(async (tx) => {
      const [runRow] = await tx
        .insert(canonicalRun)
        .values({
          targetCompanyId: output.run.targetCompanyId,
          resolverVersion: output.run.resolverVersion,
          asOfDate: output.run.asOfDate,
          inputFingerprint: output.run.inputFingerprint,
          outputFingerprint: output.run.outputFingerprint,
        })
        .returning({ id: canonicalRun.id });
      runId = runRow.id;

      for (const period of output.periods) {
        const [periodRow] = await tx
          .insert(canonicalPeriod)
          .values({
            canonicalRunId: runId,
            targetCompanyId: period.targetCompanyId,
            fiscalYear: period.fiscalYear,
            statementType: period.statementType,
            spanKind: period.spanKind,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            monthsCovered: period.monthsCovered,
            isFullYearProvisional: period.isFullYearProvisional,
            trustState: period.trustState,
            valuationEligible: period.valuationEligible,
            anchorComplete: period.anchorComplete,
            winningEvidenceId: period.winningEvidenceId,
            winningPeriodId: period.winningPeriodId,
            supersededEvidenceIds: period.supersededEvidenceIds,
            conflictDetail: period.conflictDetail,
          })
          .returning({ id: canonicalPeriod.id });

        if (period.figures.length === 0) {
          continue;
        }
        await tx.insert(canonicalFigure).values(
          period.figures.map((f) => ({
            canonicalPeriodId: periodRow.id,
            fieldKey: f.fieldKey,
            value: f.value,
            sourceEvidenceFigureId: f.sourceEvidenceFigureId,
            figurePath: f.figurePath,
          })),
        );
        figureCount += period.figures.length;
      }
    });

    return {
      written: true,
      runId,
      asOfDate,
      periodCount: output.periods.length,
      figureCount,
      input: prepared.input,
      skipped: prepared.skipped,
      output,
    };
  }
}

export const canonicalRepository = new CanonicalRepository();
