import { db } from '../db';
import { documentAnalysisResults, documents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export async function backfillCompanyAccountsRows(): Promise<{ inserted: number; skipped: number }> {
  console.log('[BACKFILL] Starting company_accounts backfill...');

  const candidates = await db
    .select({
      documentId: documentAnalysisResults.documentId,
      fileUploadEventId: documentAnalysisResults.fileUploadEventId,
      analysisData: documentAnalysisResults.analysisData,
    })
    .from(documentAnalysisResults)
    .innerJoin(documents, eq(documents.id, documentAnalysisResults.documentId))
    .where(
      and(
        eq(documentAnalysisResults.documentType, 'profit_and_loss'),
        eq(documents.documentCategory, 'Company Accounts'),
      )
    );

  let inserted = 0;
  let skipped = 0;

  for (const plRow of candidates) {
    const existing = await db
      .select({ id: documentAnalysisResults.id })
      .from(documentAnalysisResults)
      .where(
        and(
          eq(documentAnalysisResults.documentId, plRow.documentId),
          eq(documentAnalysisResults.documentType, 'company_accounts')
        )
      );

    if (existing.length > 0) {
      console.log(`[BACKFILL] Skipping doc ${plRow.documentId} — company_accounts row already exists`);
      skipped++;
      continue;
    }

    const [bsRow] = await db
      .select({ analysisData: documentAnalysisResults.analysisData })
      .from(documentAnalysisResults)
      .where(
        and(
          eq(documentAnalysisResults.documentId, plRow.documentId),
          eq(documentAnalysisResults.documentType, 'balance_sheet')
        )
      );

    const caData: Record<string, unknown> = {
      document: 'company_accounts',
      source: 'statutory_accounts',
      profit_and_loss: plRow.analysisData,
      balance_sheet: bsRow?.analysisData ?? null,
    };

    await db.insert(documentAnalysisResults).values({
      documentId: plRow.documentId,
      fileUploadEventId: plRow.fileUploadEventId,
      documentType: 'company_accounts',
      analysisData: caData,
      processingTime: 0,
      usageMetadata: null,
    });

    console.log(`[BACKFILL] Inserted company_accounts row for document ${plRow.documentId}`);
    inserted++;
  }

  console.log(`[BACKFILL] Done — inserted: ${inserted}, skipped: ${skipped}`);
  return { inserted, skipped };
}

if (process.argv[1]?.includes('backfill-company-accounts')) {
  backfillCompanyAccountsRows()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(1);
    });
}
