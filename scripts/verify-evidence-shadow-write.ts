/**
 * Slice 1b proof script.
 * Usage: npx tsx scripts/verify-evidence-shadow-write.ts <dar_id>
 *
 * Loads a document_analysis_results row from dev (JOINing documents to obtain
 * target_company_id, which is not stored on the DAR row itself), calls
 * evidenceRepository.writeFromPayload with real ids, and prints the result.
 * Insert only — no deletes, no updates.
 *
 * TARGET: DEV. Uses DATABASE_URL implicitly via server/db.ts.
 */

import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { documentAnalysisResults, documents } from '@shared/schema';
import { evidenceRepository } from '../server/repositories/evidence.repository';

const darId = parseInt(process.argv[2] ?? '', 10);
if (!Number.isFinite(darId) || darId <= 0) {
  console.error('Usage: npx tsx scripts/verify-evidence-shadow-write.ts <dar_id>');
  process.exit(1);
}

(async () => {
  const [row] = await db
    .select({
      id: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
      targetCompanyId: documents.targetCompanyId,
    })
    .from(documentAnalysisResults)
    .innerJoin(documents, eq(documents.id, documentAnalysisResults.documentId))
    .where(eq(documentAnalysisResults.id, darId));

  if (!row) {
    console.error(`DAR id=${darId} not found in dev`);
    process.exit(1);
  }

  console.log(
    `Loaded DAR id=${row.id} documentType=${row.documentType} documentId=${row.documentId} targetCompanyId=${row.targetCompanyId}`,
  );

  const result = await evidenceRepository.writeFromPayload({
    targetCompanyId: row.targetCompanyId,
    documentId: row.documentId,
    documentAnalysisResultId: row.id,
    documentType: row.documentType,
    payload: (row.analysisData ?? {}) as Record<string, unknown>,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();
