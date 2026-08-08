/**
 * scripts/tier2-rerun-1c4.ts
 *
 * Slice 1c.4 — tier 2 re-run and evidence diff.
 *
 * Destroys and rebuilds DARs + evidence for 24 specified documents.
 * DESTRUCTIVE on dev DARs and live financial tables for these documents only.
 * Authorised by Adam.
 *
 * Uses retriggerAnalysisForDocument (same function as the HTTP retry route)
 * then polls file_upload_events.webhook_status until terminal state.
 *
 * STRICTLY SEQUENTIAL — one document at a time.
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { retriggerAnalysisForDocument } from '../server/services/file-analysis.service';
import fs from 'fs/promises';
import path from 'path';

// ─── Corpus ───────────────────────────────────────────────────────────────────
// 1877: 6 documents
// 1880: 10 documents
// 1881: 8 documents
// Total: 24
const RERUN_DOCS: number[] = [
  // 1877
  5830, 5831, 5832, 5833, 5835, 5836,
  // 1880
  5857, 5860, 5861, 5862, 5863, 5865, 5866, 5867, 5868, 5869,
  // 1881
  5873, 5874, 5875, 5876, 5877, 5879, 5880, 5881,
];

// ─── Polling ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 6000;
const POLL_TIMEOUT_MS  = 10 * 60 * 1000; // 10 minutes per document

const TERMINAL_STATUSES = new Set([
  'analysis_complete',
  'failed',
  'classification_failed',
]);

async function pollUntilComplete(docId: number): Promise<{ status: string; webhookResponse: string | null }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const rows = await db.execute<{ webhook_status: string; webhook_response: string | null }>(
      sql.raw(`SELECT webhook_status, webhook_response FROM file_upload_events WHERE document_id = ${docId} ORDER BY id DESC LIMIT 1`)
    );
    const row = rows.rows[0];
    if (!row) continue;

    if (TERMINAL_STATUSES.has(row.webhook_status)) {
      return { status: row.webhook_status, webhookResponse: row.webhook_response };
    }
  }

  return { status: 'TIMEOUT', webhookResponse: null };
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
  const lines: string[] = [];
  const log = (s: string = '') => {
    process.stdout.write(s + '\n');
    lines.push(s);
  };

  log(`TIER 2 RE-RUN — slice 1c.4`);
  log(`Documents: ${RERUN_DOCS.length}  (6 + 10 + 8 = 24)`);
  log(`Started: ${new Date().toISOString()}`);
  log('');

  const perDocResults: Array<{
    docId: number;
    verdict: 'COMPLETE' | 'ERROR' | 'TIMEOUT';
    darTypes: string[];
    v2EvidenceRows: number;
    message?: string;
  }> = [];

  for (const docId of RERUN_DOCS) {
    log(`────────────────────────────────────────────────────────────────`);
    log(`doc_id: ${docId}`);
    log(`retrigger fired: ${new Date().toISOString()}`);

    let retriggered = false;
    try {
      await retriggerAnalysisForDocument(docId);
      retriggered = true;
      log(`retrigger: OK (retriggerAnalysisForDocument)`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`retrigger: FAILED — ${msg}`);
      perDocResults.push({ docId, verdict: 'ERROR', darTypes: [], v2EvidenceRows: 0, message: `retrigger failed: ${msg}` });
      log('');
      continue;
    }

    // Poll for completion
    log(`polling for completion (max 10 min)…`);
    let pollResult: { status: string; webhookResponse: string | null };
    try {
      pollResult = await pollUntilComplete(docId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`poll error: ${msg}`);
      perDocResults.push({ docId, verdict: 'ERROR', darTypes: [], v2EvidenceRows: 0, message: `poll error: ${msg}` });
      log('');
      continue;
    }

    log(`completion confirmed: ${new Date().toISOString()}`);
    log(`webhook_status: ${pollResult.status}`);

    if (pollResult.status === 'TIMEOUT') {
      log(`verdict: TIMEOUT`);
      perDocResults.push({ docId, verdict: 'TIMEOUT', darTypes: [], v2EvidenceRows: 0, message: 'polling timed out after 10 minutes' });
      log('');
      continue;
    }

    if (pollResult.status !== 'analysis_complete') {
      const errMsg = pollResult.status;
      log(`verdict: ERROR (terminal status: ${errMsg})`);
      perDocResults.push({ docId, verdict: 'ERROR', darTypes: [], v2EvidenceRows: 0, message: `terminal status: ${errMsg}` });
      log('');
      continue;
    }

    const darTypes = await getDarTypes(docId);
    const v2Count  = await getV2EvidenceCount(docId);

    log(`new DAR type set: [${darTypes.join(', ')}]`);
    log(`v2 evidence rows written: ${v2Count}`);
    log(`verdict: COMPLETE`);
    log('');

    perDocResults.push({ docId, verdict: 'COMPLETE', darTypes, v2EvidenceRows: v2Count });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const completeCount = perDocResults.filter((r) => r.verdict === 'COMPLETE').length;
  const errorCount    = perDocResults.filter((r) => r.verdict === 'ERROR').length;
  const timeoutCount  = perDocResults.filter((r) => r.verdict === 'TIMEOUT').length;

  log(`════════════════════════════════════════════════════════════════`);
  log(`SUMMARY`);
  log(`Total documents: ${RERUN_DOCS.length}`);
  log(`COMPLETE: ${completeCount}`);
  log(`ERROR:    ${errorCount}`);
  log(`TIMEOUT:  ${timeoutCount}`);
  log(`COMPLETE + ERROR + TIMEOUT = ${completeCount + errorCount + timeoutCount}  (must equal ${RERUN_DOCS.length})`);
  log('');
  log(`PER-DOCUMENT TABLE`);
  for (const r of perDocResults) {
    const darStr = r.darTypes.length > 0 ? `[${r.darTypes.join(', ')}]` : '[]';
    log(`${String(r.docId).padEnd(6)} | ${r.verdict.padEnd(8)} | DARs=${darStr} | v2_evidence=${r.v2EvidenceRows}${r.message ? ' | ' + r.message : ''}`);
  }
  log('');
  log(`Finished: ${new Date().toISOString()}`);

  // Write log to file for reference (not the capture file — that comes from the diff script)
  const logPath = path.join(process.cwd(), 'docs', 'pipeline-fidelity-fix', 'tier2-rerun-1c4-log.txt');
  await fs.writeFile(logPath, lines.join('\n'), 'utf-8');
  log(`\nRun log written to ${logPath}`);
}

main().catch((e) => {
  console.error('[tier2-rerun-1c4] fatal:', e);
  process.exit(1);
});
