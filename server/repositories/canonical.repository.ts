import { eq, inArray } from 'drizzle-orm';
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
import { resolveCanonical } from '@shared/calculators/canonical-resolver';
import { systemConfigService } from '../services/system-config.service';

const FLAG_KEY = 'canonical_shadow_write_enabled';
const EVIDENCE_FLAG_KEY = 'evidence_shadow_write_enabled';

export interface WriteForCompanyInput {
  targetCompanyId: number;
  /** YYYY-MM-DD. Omit and the repository stamps today in UTC. */
  asOfDate?: string;
}

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
      skipped: BuildSkipCounts;
      outputFingerprint: string;
    };

export class CanonicalRepository {
  /**
   * Resolves one company's evidence into a canonical run. Slice 3c, shadow mode.
   * Nothing reads what this writes.
   */
  async writeForCompany(input: WriteForCompanyInput): Promise<CanonicalWriteResult> {
    // Step 1: both kill switches, before any DB read or write. Canonical over a
    // corpus that has stopped being updated would be confidently stale, so the
    // evidence switch gates this one too.
    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
    if (flagValue !== 'true') {
      return { written: false, reason: 'flag_off' };
    }
    const evidenceFlagValue = await systemConfigService.getConfig(EVIDENCE_FLAG_KEY);
    if (evidenceFlagValue !== 'true') {
      return { written: false, reason: 'evidence_flag_off' };
    }

    // Step 2: the only clock in slice 3. UTC, never server local: the same
    // corpus must not resolve differently either side of midnight BST.
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
    if (!isIsoDate(asOfDate)) {
      return { written: false, reason: 'bad_as_of_date' };
    }

    // Step 3: read this company's evidence, three flat selects.
    const evidenceRows: EvidenceRowInput[] = await db
      .select({
        evidenceId: documentEvidence.id,
        documentId: documentEvidence.documentId,
        documentAnalysisResultId: documentEvidence.documentAnalysisResultId,
      })
      .from(documentEvidence)
      .where(eq(documentEvidence.targetCompanyId, input.targetCompanyId));

    if (evidenceRows.length === 0) {
      return { written: false, reason: 'no_evidence' };
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

    // Step 4: pure adapter, then pure resolver. Neither touches the database.
    const built = buildResolverInput(input.targetCompanyId, asOfDate, {
      evidence: evidenceRows,
      periods: periodRows,
      figures: figureRows,
    });
    const resolved = resolveCanonical(built.input);

    // Step 5: one transaction for the whole run. A partially written run would
    // carry a fingerprint computed over rows that do not all exist, and the diff
    // report would read it as a complete statement of the company's history.
    let runId = 0;
    let figureCount = 0;
    await db.transaction(async (tx) => {
      const [runRow] = await tx
        .insert(canonicalRun)
        .values({
          targetCompanyId: resolved.run.targetCompanyId,
          resolverVersion: resolved.run.resolverVersion,
          asOfDate: resolved.run.asOfDate,
          inputFingerprint: resolved.run.inputFingerprint,
          outputFingerprint: resolved.run.outputFingerprint,
        })
        .returning({ id: canonicalRun.id });
      runId = runRow.id;

      for (const period of resolved.periods) {
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
      periodCount: resolved.periods.length,
      figureCount,
      skipped: built.skipped,
      outputFingerprint: resolved.run.outputFingerprint,
    };
  }
}

export const canonicalRepository = new CanonicalRepository();
