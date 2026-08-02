import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  documentEvidence,
  documentEvidencePeriod,
  documentEvidenceFigure,
} from '@shared/schema';
import { mapPayloadToEvidence } from '@shared/utils/evidence-mapper';
import { systemConfigService } from '../services/system-config.service';

const FLAG_KEY = 'evidence_shadow_write_enabled';

interface WriteFromPayloadInput {
  targetCompanyId: number;
  documentId: number;
  documentAnalysisResultId: number | null;
  documentType: string;
  payload: Record<string, unknown>;
}

type WriteFromPayloadResult =
  | { written: false; reason: 'flag_off' }
  | { written: true; evidenceId: number; periodCount: number; figureCount: number };

export class EvidenceRepository {
  async writeFromPayload(input: WriteFromPayloadInput): Promise<WriteFromPayloadResult> {
    // Step 1: check kill switch — no DB reads or writes if flag is off
    const flagValue = await systemConfigService.getConfig(FLAG_KEY);
    if (flagValue !== 'true') {
      return { written: false, reason: 'flag_off' };
    }

    // Step 2: compute next extraction_version for this (document_id, document_type)
    // The analysis queue serialises per company, so no transaction/retry needed.
    const [versionRow] = await db
      .select({
        nextVersion: sql<number>`coalesce(max(${documentEvidence.extractionVersion}), 0) + 1`,
      })
      .from(documentEvidence)
      .where(
        and(
          eq(documentEvidence.documentId, input.documentId),
          eq(documentEvidence.documentType, input.documentType),
        ),
      );
    const extractionVersion = versionRow?.nextVersion ?? 1;

    // Step 3: map payload to row shapes
    const { evidence, periods } = mapPayloadToEvidence({
      targetCompanyId: input.targetCompanyId,
      documentId: input.documentId,
      documentAnalysisResultId: input.documentAnalysisResultId,
      documentType: input.documentType,
      extractionVersion,
      payload: input.payload,
    });

    // Step 4: insert evidence row
    const [insertedEvidence] = await db
      .insert(documentEvidence)
      .values({
        targetCompanyId: evidence.targetCompanyId,
        documentId: evidence.documentId,
        documentAnalysisResultId: evidence.documentAnalysisResultId,
        documentType: evidence.documentType,
        extractionVersion: evidence.extractionVersion,
        contentHash: evidence.contentHash,
        extractor: evidence.extractor,
        companyNamesFound: evidence.companyNamesFound,
        registeredNumbersFound: evidence.registeredNumbersFound,
        yearEndStated: evidence.yearEndStated,
        directorsNamed: evidence.directorsNamed,
        accountantName: evidence.accountantName,
        isDraft: evidence.isDraft,
        isAbridged: evidence.isAbridged,
        isSigned: evidence.isSigned,
        reportDate: evidence.reportDate,
        identityVerdict: evidence.identityVerdict,
      })
      .returning({ id: documentEvidence.id });

    const evidenceId = insertedEvidence.id;

    // Step 5: insert period rows and their figures
    let totalFigureCount = 0;

    for (const period of periods) {
      const [insertedPeriod] = await db
        .insert(documentEvidencePeriod)
        .values({
          documentEvidenceId: evidenceId,
          fiscalYearStated: period.fiscalYearStated,
          periodEnd: period.periodEnd,
          monthsCoveredStated: period.monthsCoveredStated,
          anomalies: period.anomalies,
        })
        .returning({ id: documentEvidencePeriod.id });

      const periodId = insertedPeriod.id;

      if (period.figures.length > 0) {
        await db.insert(documentEvidenceFigure).values(
          period.figures.map(fig => ({
            documentEvidencePeriodId: periodId,
            statementType: fig.statementType,
            fieldKey: fig.fieldKey,
            value: String(fig.value),
            labelTextAsPrinted: fig.labelTextAsPrinted,
            pageNumber: fig.pageNumber,
            payloadPath: fig.payloadPath,
            isModelDerived: fig.isModelDerived,
          })),
        );
        totalFigureCount += period.figures.length;
      }
    }

    return {
      written: true,
      evidenceId,
      periodCount: periods.length,
      figureCount: totalFigureCount,
    };
  }
}

export const evidenceRepository = new EvidenceRepository();
