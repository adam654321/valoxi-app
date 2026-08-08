/**
 * scripts/tier2-rerun-inline.ts
 *
 * Slice 1c.4 — tier 2 re-run, inline variant (no queue, no polling).
 *
 * For each document in --docs=ID,ID,... :
 *   1. Delete DARs + financial data (destructive, authorised by Adam)
 *   2. Reset file_upload_event webhook_status to 'pending'
 *   3. Call analyzeUploadedFileWithGemini(eventId) directly (inline, awaitable)
 *   4. Record new DARs and v2 evidence row count
 *
 * Run in batches to stay within time limits. Append results to
 * docs/pipeline-fidelity-fix/tier2-rerun-1c4-log.txt across batch calls.
 *
 * Usage:
 *   npx tsx scripts/tier2-rerun-inline.ts --docs=5830,5831,...  [--batch=N]
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { analyzeUploadedFileWithGemini } from '../server/services/file-analysis.service';
import { documentAnalysisRepository } from '../server/repositories/document-analysis.repository';
import fs from 'fs/promises';
import path from 'path';

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const docsArg = process.argv.find((a) => a.startsWith('--docs='))?.slice('--docs='.length);
const batchArg = process.argv.find((a) => a.startsWith('--batch='))?.slice('--batch='.length) ?? '?';

if (!docsArg) {
  console.error('Usage: npx tsx scripts/tier2-rerun-inline.ts --docs=5830,5831,...');
  process.exit(1);
}

const DOC_IDS: number[] = docsArg.split(',').map((s) => parseInt(s.trim(), 10));

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getEventId(docId: number): Promise<number | null> {
  const rows = await db.execute<{ id: number }>(
    sql.raw(`SELECT id FROM file_upload_events WHERE document_id = ${docId} ORDER BY id DESC LIMIT 1`)
  );
  return rows.rows[0]?.id ?? null;
}

async function deleteAndReset(docId: number, eventId: number): Promise<void> {
  // Delete DARs
  await documentAnalysisRepository.deleteByDocumentId(docId);
  // Delete financial data
  try {
    const { financialDataRepository } = await import('../server/repositories/financial-data.repository');
    await financialDataRepository.deleteByDocumentId(docId);
  } catch (e) {
    console.warn(`[tier2] Warning: financial data delete for ${docId}:`, e);
  }
  // Delete evidence (shadow) — v1 rows for this doc will be replaced by v2
  // Note: the shadow write creates new rows at extraction_version=2;
  // old v1 rows remain. We do NOT delete evidence — the diff script compares versions.
  // Reset event to 'pending' so analyzeUploadedFileWithGemini does not skip it
  await db.execute(
    sql.raw(`UPDATE file_upload_events SET webhook_status = 'pending', webhook_response = NULL WHERE id = ${eventId}`)
  );
}

async function getDarTypes(docId: number): Promise<string[]> {
  const rows = await db.execute<{ document_type: string }>(
    sql.raw(`SELECT DISTINCT document_type FROM document_analysis_results WHERE document_id = ${docId} ORDER BY document_type`)
  );
  return rows.rows.map((r) => r.document_type);
}

async function getV2EvidenceCount(docId: number): Promise<number> {
  const rows = await db.execute<{ cnt: string }>(
    sql.raw(`SELECT count(*)::text AS cnt FROM document_evidence WHERE document_id = ${docId} AND extraction_version = 2`)
  );
  return parseInt(rows.rows[0]?.cnt ?? '0', 10);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const logPath = path.join(
    process.cwd(),
    'docs',
    'pipeline-fidelity-fix',
    'tier2-rerun-1c4-log.txt',
  );

  const batchLines: string[] = [];
  const log = (s: string = '') => {
    process.stdout.write(s + '\n');
    batchLines.push(s);
  };

  log(`════════════════════════════════════════════════════════════════`);
  log(`BATCH ${batchArg}  docs: [${DOC_IDS.join(', ')}]  started: ${new Date().toISOString()}`);
  log('');

  for (const docId of DOC_IDS) {
    log(`────────────────────────────────────────────────────────────────`);
    log(`doc_id: ${docId}`);

    // Get event ID
    const eventId = await getEventId(docId);
    if (eventId === null) {
      log(`verdict: ERROR`);
      log(`error: no file_upload_event found for document ${docId}`);
      log('');
      continue;
    }
    log(`event_id: ${eventId}`);

    // Destructive cleanup
    try {
      await deleteAndReset(docId, eventId);
      log(`cleanup: DARs deleted, financial data deleted, event reset to 'pending'`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`verdict: ERROR`);
      log(`error: cleanup failed: ${msg}`);
      log('');
      continue;
    }

    log(`retrigger fired: ${new Date().toISOString()}  (analyzeUploadedFileWithGemini inline)`);

    // Run analysis inline
    const t0 = Date.now();
    try {
      await analyzeUploadedFileWithGemini(eventId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`verdict: ERROR`);
      log(`error: analyzeUploadedFileWithGemini threw: ${msg}`);
      log(`elapsed: ${Date.now() - t0}ms`);
      log('');
      continue;
    }
    const elapsed = Date.now() - t0;

    log(`completion confirmed: ${new Date().toISOString()}  elapsed: ${elapsed}ms`);

    const darTypes = await getDarTypes(docId);
    const v2Count  = await getV2EvidenceCount(docId);

    log(`new DAR type set: [${darTypes.join(', ')}]`);
    log(`v2 evidence rows written: ${v2Count}`);
    log(`verdict: COMPLETE`);
    log('');
  }

  log(`Batch ${batchArg} finished: ${new Date().toISOString()}`);
  log('');

  // Append to log file
  try {
    let existing = '';
    try { existing = await fs.readFile(logPath, 'utf-8'); } catch {}
    await fs.writeFile(logPath, existing + batchLines.join('\n') + '\n', 'utf-8');
    console.log(`Appended to ${logPath}`);
  } catch (e) {
    console.error('Could not write log file:', e);
  }
}

main().catch((e) => {
  console.error('[tier2-rerun-inline] fatal:', e);
  process.exit(1);
});
