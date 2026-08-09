/**
 * scripts/_proof-1c-restore-c.ts
 * V-CHECK 6 proof run for 1c-RESTORE-C.
 * Calls analyzeDocumentWithGemini 5 times for doc 5830 profit_and_loss.
 * Reports FY2023 and FY2024 depreciation_amortisation per run.
 * Reports anchor count and depreciation key presence per run.
 * WRITES NOTHING to any database table.
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { analyzeDocumentWithGemini } from '../server/services/gemini-step2-analysis-service';
import { buildProfitAndLossAnalysisPrompt } from '../server/prompts/step2-profit-and-loss-prompt';

const DOC_ID  = 5830;
const N_RUNS  = 5;

async function main() {
  // ── Verify current prompt is VARIANT C (contains anchors, not FIGURE ANCHORS) ─
  const livePrompt = buildProfitAndLossAnalysisPrompt();
  console.log(`[PROOF] Live P&L prompt length: ${livePrompt.length}`);
  console.log(`[PROOF] Contains FIGURE ANCHORS: ${livePrompt.includes('FIGURE ANCHORS')}`);
  console.log(`[PROOF] Contains anchors template: ${livePrompt.includes('"anchors"')}`);
  if (livePrompt.includes('FIGURE ANCHORS')) {
    console.error('ABORT: prompt still contains FIGURE ANCHORS instruction block');
    process.exit(1);
  }
  if (!livePrompt.includes('"anchors"')) {
    console.error('ABORT: prompt does not contain anchors template — not VARIANT C');
    process.exit(1);
  }
  console.log('[PROOF] Prompt pre-check: PASS — anchors template present, FIGURE ANCHORS absent\n');

  // ── Lookup document ────────────────────────────────────────────────────────
  const docRows = await db.execute<{ id: number; file_path: string; original_filename: string; file_type: string }>(sql`
    SELECT id, file_path, original_filename, file_type
    FROM documents WHERE id = ${DOC_ID} LIMIT 1
  `);
  if (docRows.rows.length === 0) {
    console.error(`Document ${DOC_ID} not found`);
    process.exit(1);
  }
  const doc = docRows.rows[0];
  console.log(`[PROOF] Doc: id=${doc.id}  file=${doc.original_filename}  type=${doc.file_type}`);

  // ── Pre-run row counts ─────────────────────────────────────────────────────
  const counts0 = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL SELECT 'document_evidence',        COUNT(*)::text FROM document_evidence
    UNION ALL SELECT 'document_evidence_period', COUNT(*)::text FROM document_evidence_period
    UNION ALL SELECT 'document_evidence_figure', COUNT(*)::text FROM document_evidence_figure
  `);
  const preCounts = new Map(counts0.rows.map((r) => [r.tbl, r.cnt]));

  // ── 5 sequential runs ──────────────────────────────────────────────────────
  console.log('\n='.repeat(72));
  console.log(`PROOF RUN — doc 5830 profit_and_loss — ${N_RUNS} runs`);
  console.log('='.repeat(72));

  const DA_KEY_23 = 'years.2023.profit_and_loss.depreciation_amortisation';
  const DA_KEY_24 = 'years.2024.profit_and_loss.depreciation_amortisation';

  for (let run = 1; run <= N_RUNS; run++) {
    console.log(`\n─── RUN ${run}/${N_RUNS}  started: ${new Date().toISOString()}`);
    const t0 = Date.now();

    const result = await analyzeDocumentWithGemini({
      documentId: DOC_ID,
      filePath: doc.file_path,
      fileName: doc.original_filename,
      mimeType: doc.file_type ?? 'application/pdf',
      documentType: 'profit_and_loss',
    });

    const elapsed = Date.now() - t0;

    if (!result.success || !result.analysisData) {
      console.log(`RUN ${run}: ERROR  elapsed=${elapsed}ms  err=${result.error ?? 'no analysisData'}`);
      continue;
    }

    const payload = result.analysisData as Record<string, unknown>;
    console.log(`RUN ${run}: OK  elapsed=${elapsed}ms  model=${result.model ?? 'unknown'}`);

    // D&A values
    const years = (payload['years'] ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
    const da23  = years['2023']?.['profit_and_loss']?.['depreciation_amortisation'] ?? null;
    const da24  = years['2024']?.['profit_and_loss']?.['depreciation_amortisation'] ?? null;
    console.log(`  FY2023 depreciation_amortisation: ${da23}`);
    console.log(`  FY2024 depreciation_amortisation: ${da24}`);

    // Anchors
    const anchors = (payload['anchors'] ?? null) as Record<string, unknown> | null;
    const anchorCount = anchors ? Object.keys(anchors).length : 0;
    const anchor23 = anchors ? (anchors[DA_KEY_23] ?? null) : null;
    const anchor24 = anchors ? (anchors[DA_KEY_24] ?? null) : null;
    console.log(`  anchors object entries: ${anchorCount}`);
    console.log(`  anchor for DA_KEY_23: ${anchor23 !== null ? JSON.stringify(anchor23) : 'NONE'}`);
    console.log(`  anchor for DA_KEY_24: ${anchor24 !== null ? JSON.stringify(anchor24) : 'NONE'}`);
  }

  // ── Post-run row counts ────────────────────────────────────────────────────
  const counts1 = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL SELECT 'document_evidence',        COUNT(*)::text FROM document_evidence
    UNION ALL SELECT 'document_evidence_period', COUNT(*)::text FROM document_evidence_period
    UNION ALL SELECT 'document_evidence_figure', COUNT(*)::text FROM document_evidence_figure
  `);
  const postCounts = new Map(counts1.rows.map((r) => [r.tbl, r.cnt]));

  console.log('\n' + '─'.repeat(72));
  console.log('ROW COUNT PROOF (writes-nothing check)');
  console.log('─'.repeat(72));
  for (const tbl of ['document_analysis_results','document_evidence','document_evidence_period','document_evidence_figure']) {
    const pre  = preCounts.get(tbl)  ?? '?';
    const post = postCounts.get(tbl) ?? '?';
    console.log(`  ${tbl}: before=${pre}  after=${post}  → ${pre === post ? 'UNCHANGED' : 'CHANGED — ABORT'}`);
  }

  console.log('\n' + '='.repeat(72));
  console.log(`completed: ${new Date().toISOString()}`);
}

main().catch((e) => {
  console.error('[proof] fatal:', e);
  process.exit(1);
});
