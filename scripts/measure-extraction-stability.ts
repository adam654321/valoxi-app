/**
 * scripts/measure-extraction-stability.ts
 * STABILITY-1 — measures extraction stability across N sequential runs of the
 * same document with the same current prompts.
 *
 * WRITES NOTHING to any database table. No INSERT, UPDATE, DELETE, or ALTER.
 * READ-ONLY on the database (document row lookup only).
 *
 * Usage:
 *   npx tsx scripts/measure-extraction-stability.ts \
 *     --doc=<id> --type=<profit_and_loss|balance_sheet> --runs=<N>
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { analyzeDocumentWithGemini } from '../server/services/gemini-step2-analysis-service';
import { mapPayloadToEvidence } from '../shared/utils/evidence-mapper';
import { PROMPT_VERSION } from '../shared/prompt-version';
import fs from 'fs/promises';
import path from 'path';

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const docArg   = process.argv.find((a) => a.startsWith('--doc='))?.slice('--doc='.length);
const typeArg  = process.argv.find((a) => a.startsWith('--type='))?.slice('--type='.length);
const runsArg  = process.argv.find((a) => a.startsWith('--runs='))?.slice('--runs='.length);

if (!docArg || !typeArg || !runsArg) {
  console.error('Usage: npx tsx scripts/measure-extraction-stability.ts --doc=<id> --type=<profit_and_loss|balance_sheet> --runs=<N>');
  process.exit(1);
}

const DOC_ID    = parseInt(docArg, 10);
const DOC_TYPE  = typeArg as 'profit_and_loss' | 'balance_sheet';
const N_RUNS    = parseInt(runsArg, 10);

if (!['profit_and_loss', 'balance_sheet'].includes(DOC_TYPE)) {
  console.error('--type must be profit_and_loss or balance_sheet');
  process.exit(1);
}
if (isNaN(N_RUNS) || N_RUNS < 1) {
  console.error('--runs must be a positive integer');
  process.exit(1);
}

// ─── mimeType resolver (copied verbatim from file-analysis.service.ts) ────────

function getMimeTypeForFile(fileType: string): string {
  const mimeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv': 'text/csv',
    'tsv': 'text/tab-separated-values',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'webp': 'image/webp',
    'numbers': 'application/vnd.apple.numbers',
    'pages': 'application/vnd.apple.pages',
    'key': 'application/vnd.apple.keynote',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'application/pdf': 'application/pdf',
    'application/msword': 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel': 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv': 'text/csv',
    'image/png': 'image/png',
    'image/jpeg': 'image/jpeg',
  };
  const normalized = fileType.toLowerCase();
  return mimeMap[normalized] || 'application/octet-stream';
}

// ─── Group A suffix list ──────────────────────────────────────────────────────
// Match by stripping 'years.YYYY.' prefix and comparing the remainder.

const GROUP_A_SHORT_PATHS = new Set<string>([
  // P&L
  'profit_and_loss.revenue',
  'profit_and_loss.cost_of_sales',
  'profit_and_loss.gross_profit',
  'profit_and_loss.administrative_expenses',
  'profit_and_loss.depreciation_amortisation',
  'profit_and_loss.other_operating_income',
  'profit_and_loss.operating_profit',
  'profit_and_loss.interest_receivable',
  'profit_and_loss.interest_payable',
  'profit_and_loss.profit_before_tax',
  'profit_and_loss.corporation_tax',
  'profit_and_loss.net_profit',
  // BS totals
  'balance_sheet.current_assets.total',
  'balance_sheet.current_liabilities.total',
  'balance_sheet.long_term_liabilities.total',
  'balance_sheet.equity.total',
  // BS current assets
  'balance_sheet.current_assets.cash_at_bank',
  'balance_sheet.current_assets.trade_debtors',
  'balance_sheet.current_assets.amounts_owed_by_directors',
  // BS current liabilities
  'balance_sheet.current_liabilities.trade_creditors',
  'balance_sheet.current_liabilities.corporation_tax',
  'balance_sheet.current_liabilities.bank_loans_current',
  'balance_sheet.current_liabilities.hire_purchase_current',
  'balance_sheet.current_liabilities.amounts_owed_to_directors',
  // BS long term
  'balance_sheet.long_term_liabilities.bank_loans',
  'balance_sheet.long_term_liabilities.hire_purchase_long_term',
  // BS fixed assets
  'balance_sheet.fixed_assets.tangible_assets',
  'balance_sheet.fixed_assets.intangible_assets',
  // BS equity
  'balance_sheet.equity.share_capital',
  'balance_sheet.equity.retained_earnings',
]);

// Group B period keys (per fiscal year, from mapPayloadToEvidence output)
const GROUP_B_PERIOD_FIELDS = ['period_start', 'period_end', 'months_covered'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortPath(payloadPath: string): string {
  // payloadPath format: years.YYYY.{rest}
  // returns {rest}, e.g. 'balance_sheet.current_assets.total'
  const parts = payloadPath.split('.');
  return parts.slice(2).join('.');
}

function classifyPath(payloadPath: string): 'A' | 'C' {
  return GROUP_A_SHORT_PATHS.has(shortPath(payloadPath)) ? 'A' : 'C';
}

function line(s: string = '') {
  process.stdout.write(s + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const reportPath = path.join(
    process.cwd(),
    'docs',
    'pipeline-fidelity-fix',
    'stability-2026-08-08.txt',
  );

  const reportLines: string[] = [];
  const log = (s: string = '') => {
    process.stdout.write(s + '\n');
    reportLines.push(s);
  };

  // ── Lookup document row ──────────────────────────────────────────────────
  const docRows = await db.execute<{
    id: number;
    file_path: string;
    original_filename: string;
    target_company_id: number;
  }>(sql`
    SELECT id, file_path, original_filename, target_company_id
    FROM documents
    WHERE id = ${DOC_ID}
    LIMIT 1
  `);

  if (docRows.rows.length === 0) {
    console.error(`Document ${DOC_ID} not found`);
    process.exit(1);
  }

  const doc = docRows.rows[0];
  const filePath = doc.file_path;
  const fileName = doc.original_filename;
  // Resolve mimeType the same way the pipeline does: from file extension of fileName
  const fileExtension = fileName.split('.').pop()?.toLowerCase() ?? 'pdf';
  const mimeType = getMimeTypeForFile(fileExtension);

  log('='.repeat(72));
  log(`STABILITY-1 REPORT`);
  log(`doc_id:    ${DOC_ID}`);
  log(`type:      ${DOC_TYPE}`);
  log(`runs:      ${N_RUNS}`);
  log(`filePath:  ${filePath}`);
  log(`fileName:  ${fileName}`);
  log(`mimeType:  ${mimeType}`);
  log(`promptVersion: ${PROMPT_VERSION}`);
  log(`started:   ${new Date().toISOString()}`);
  log('='.repeat(72));
  log();

  // ── Pre-run row counts (writes-nothing proof baseline) ────────────────────
  const counts0 = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL
    SELECT 'document_evidence',         COUNT(*)::text FROM document_evidence
    UNION ALL
    SELECT 'document_evidence_period',  COUNT(*)::text FROM document_evidence_period
    UNION ALL
    SELECT 'document_evidence_figure',  COUNT(*)::text FROM document_evidence_figure
  `);
  const preRunCounts = new Map(counts0.rows.map((r) => [r.tbl, r.cnt]));

  // ── N sequential extraction runs ─────────────────────────────────────────
  // Key: `${fiscalYearStated}|${payloadPath}`  → value[] across runs
  // Group B key: `${fiscalYearStated}|${field}`  or 'report_date' (doc-level)
  const figureSets = new Map<string, (string | null)[]>();  // Group A + C
  const periodSets = new Map<string, (string | null)[]>();  // Group B

  for (let run = 1; run <= N_RUNS; run++) {
    log(`────────────────────────────────────────────────────────────────`);
    log(`RUN ${run}/${N_RUNS}  started: ${new Date().toISOString()}`);

    const result = await analyzeDocumentWithGemini({
      filePath,
      mimeType,
      fileName,
      documentType: DOC_TYPE,
    });

    if (!result.success || !result.analysisData) {
      log(`RUN ${run}: ERROR — ${result.error ?? 'no analysisData'}`);
      // Record null for all keys to keep run counts aligned
      for (const [k, arr] of figureSets) arr.push(null);
      for (const [k, arr] of periodSets) arr.push(null);
      continue;
    }

    log(`RUN ${run}: OK  model=${result.model ?? 'unknown'}  elapsed=${result.processingTime}ms`);

    // Map payload → evidence (pure, no DB writes)
    const mapped = mapPayloadToEvidence({
      targetCompanyId: 0,           // dummy — never persisted
      documentId:      0,           // dummy — never persisted
      documentAnalysisResultId: null,
      documentType:    DOC_TYPE,
      extractionVersion: 0,         // dummy — never persisted
      payload:         result.analysisData,
      model:           result.model,
      promptVersion:   PROMPT_VERSION,
    });

    // Collect figure values
    const runFigures = new Map<string, string | null>();
    for (const period of mapped.periods) {
      const fy = period.fiscalYearStated;
      for (const fig of period.figures) {
        const key = `${fy}|${fig.payloadPath}`;
        runFigures.set(key, fig.value !== null ? String(fig.value) : null);
      }
    }

    // Collect period (Group B) values
    const runPeriods = new Map<string, string | null>();
    for (const period of mapped.periods) {
      const fy = period.fiscalYearStated;
      runPeriods.set(`${fy}|period_start`,   period.periodStart   ?? null);
      runPeriods.set(`${fy}|period_end`,     period.periodEnd     ?? null);
      runPeriods.set(`${fy}|months_covered`, period.monthsCoveredStated !== null ? String(period.monthsCoveredStated) : null);
    }
    // report_date is document-level (EvidenceRow)
    runPeriods.set('doc|report_date', mapped.evidence.reportDate ?? null);

    // Merge figures into accumulated set (add new keys if first seen, back-fill)
    for (const [key, val] of runFigures) {
      if (!figureSets.has(key)) {
        figureSets.set(key, Array(run - 1).fill(null));
      }
      figureSets.get(key)!.push(val);
    }
    // Back-fill figure keys that appeared in prior runs but not this run
    for (const [key, arr] of figureSets) {
      if (!runFigures.has(key)) arr.push(null);
    }

    // Merge period (Group B) values into accumulated set
    for (const [key, val] of runPeriods) {
      if (!periodSets.has(key)) {
        periodSets.set(key, Array(run - 1).fill(null));
      }
      periodSets.get(key)!.push(val);
    }
    // Back-fill period keys that appeared in prior runs but not this run
    for (const [key, arr] of periodSets) {
      if (!runPeriods.has(key)) arr.push(null);
    }
  }

  log();
  log('='.repeat(72));
  log('STABILITY ANALYSIS');
  log('='.repeat(72));
  log();

  // ── Classify figure keys ──────────────────────────────────────────────────
  const groupA = new Map<string, (string | null)[]>();
  const groupC = new Map<string, (string | null)[]>();

  for (const [key, vals] of figureSets) {
    const payloadPath = key.split('|').slice(1).join('|');
    if (classifyPath(payloadPath) === 'A') {
      groupA.set(key, vals);
    } else {
      groupC.set(key, vals);
    }
  }

  // ── Per-doc totals summary ────────────────────────────────────────────────
  const allFigureKeys = figureSets.size;
  const allPeriodKeys = periodSets.size;
  const totalKeys     = allFigureKeys + allPeriodKeys;

  let stableCount   = 0;
  let unstableCount = 0;
  for (const vals of figureSets.values()) {
    const distinct = new Set(vals.filter((v) => v !== null)).size;
    if (distinct <= 1) stableCount++; else unstableCount++;
  }
  for (const vals of periodSets.values()) {
    const distinct = new Set(vals.filter((v) => v !== null)).size;
    if (distinct <= 1) stableCount++; else unstableCount++;
  }

  log(`doc ${DOC_ID}  type=${DOC_TYPE}  runs=${N_RUNS}`);
  log(`total keys compared:        ${totalKeys}  (figures: ${allFigureKeys}  period: ${allPeriodKeys})`);
  log(`keys with 1 distinct value: ${stableCount}`);
  log(`keys with > 1 distinct:     ${unstableCount}`);
  log(`arithmetic check:           ${stableCount} + ${unstableCount} = ${stableCount + unstableCount}  (should equal ${totalKeys})`);
  log();

  // ── GROUP A ───────────────────────────────────────────────────────────────
  log('─'.repeat(72));
  log('GROUP A — VALUATION CRITICAL');
  log('─'.repeat(72));

  let groupAStable   = 0;
  let groupAUnstable = 0;
  const groupARows: string[] = [];

  for (const [key, vals] of [...groupA.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const nonNull = vals.filter((v) => v !== null);
    const distinct = new Set(nonNull);
    if (distinct.size <= 1) {
      groupAStable++;
      const repr = nonNull[0] ?? 'null';
      groupARows.push(`  STABLE   ${key}  = ${repr}`);
    } else {
      groupAUnstable++;
      groupARows.push(`  UNSTABLE ${key}  distinct_values=[${[...distinct].join(', ')}]`);
    }
  }

  for (const r of groupARows) log(r);
  log();
  if (groupAUnstable === 0) {
    log(`GROUP A entirely stable. ${groupAStable} keys, all with 1 distinct value.`);
  } else {
    log(`GROUP A: ${groupAStable} stable, ${groupAUnstable} unstable`);
  }
  log();

  // ── GROUP B ───────────────────────────────────────────────────────────────
  log('─'.repeat(72));
  log('GROUP B — SPAN CRITICAL');
  log('─'.repeat(72));

  let groupBStable   = 0;
  let groupBUnstable = 0;

  for (const [key, vals] of [...periodSets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const nonNull = vals.filter((v) => v !== null);
    const distinct = new Set(nonNull);
    if (distinct.size <= 1) {
      groupBStable++;
      const repr = nonNull[0] ?? 'null';
      log(`  STABLE   ${key}  = ${repr}`);
    } else {
      groupBUnstable++;
      log(`  UNSTABLE ${key}  distinct_values=[${[...distinct].join(', ')}]`);
    }
  }
  log();
  if (groupBUnstable === 0) {
    log(`GROUP B entirely stable. ${groupBStable} keys, all with 1 distinct value.`);
  } else {
    log(`GROUP B: ${groupBStable} stable, ${groupBUnstable} unstable`);
  }
  log();

  // ── GROUP C ───────────────────────────────────────────────────────────────
  log('─'.repeat(72));
  log('GROUP C — EVERYTHING ELSE');
  log('─'.repeat(72));

  let groupCStable   = 0;
  let groupCUnstable = 0;

  // Collect all C entries with distinct count for ranking
  const groupCRanked: Array<{ key: string; distinct: number; vals: (string | null)[] }> = [];

  for (const [key, vals] of groupC.entries()) {
    const nonNull = vals.filter((v) => v !== null);
    const distinct = new Set(nonNull).size;
    if (distinct <= 1) groupCStable++; else groupCUnstable++;
    groupCRanked.push({ key, distinct, vals });
  }

  log(`total GROUP C keys:   ${groupC.size}`);
  log(`stable (1 distinct):  ${groupCStable}`);
  log(`unstable (> 1):       ${groupCUnstable}`);
  log();

  // Top 10 by distinct value count (most unstable first)
  groupCRanked.sort((a, b) => b.distinct - a.distinct || a.key.localeCompare(b.key));
  log('Top 10 most variable GROUP C keys:');
  for (const { key, distinct, vals } of groupCRanked.slice(0, 10)) {
    const nonNull = vals.filter((v) => v !== null);
    const distinctVals = [...new Set(nonNull)];
    if (distinct > 1) {
      log(`  ${key}  distinct=${distinct}  values=[${distinctVals.join(', ')}]`);
    } else {
      log(`  ${key}  distinct=${distinct}  value=${distinctVals[0] ?? 'null'}`);
    }
  }
  log();

  // ── depreciation_amortisation special report ──────────────────────────────
  log('─'.repeat(72));
  log('depreciation_amortisation — special report');
  log('─'.repeat(72));

  const daKeys = [...groupA.keys()].filter((k) =>
    k.includes('depreciation_amortisation')
  );
  if (daKeys.length === 0) {
    log('  No depreciation_amortisation keys found in GROUP A for this doc/type.');
  } else {
    for (const key of daKeys.sort()) {
      const vals = groupA.get(key)!;
      const nonNull = vals.filter((v) => v !== null);
      const distinct = new Set(nonNull);
      if (distinct.size <= 1) {
        log(`  STABLE   ${key}  = ${nonNull[0] ?? 'null'}`);
        log(`           values across ${N_RUNS} runs: [${vals.join(', ')}]`);
      } else {
        log(`  UNSTABLE ${key}`);
        log(`           values across ${N_RUNS} runs: [${vals.join(', ')}]`);
        log(`           distinct: [${[...distinct].join(', ')}]`);
      }
    }
  }
  log();

  // ── Row counts after (writes-nothing proof) ───────────────────────────────
  log('─'.repeat(72));
  log('ROW COUNT PROOF (writes-nothing check)');
  log('─'.repeat(72));

  const counts1 = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL
    SELECT 'document_evidence',         COUNT(*)::text FROM document_evidence
    UNION ALL
    SELECT 'document_evidence_period',  COUNT(*)::text FROM document_evidence_period
    UNION ALL
    SELECT 'document_evidence_figure',  COUNT(*)::text FROM document_evidence_figure
  `);
  const postRunCounts = new Map(counts1.rows.map((r) => [r.tbl, r.cnt]));

  for (const tbl of ['document_analysis_results', 'document_evidence', 'document_evidence_period', 'document_evidence_figure']) {
    const pre  = preRunCounts.get(tbl)  ?? '?';
    const post = postRunCounts.get(tbl) ?? '?';
    const ok   = pre === post ? 'UNCHANGED' : 'CHANGED';
    log(`  ${tbl}: before=${pre}  after=${post}  → ${ok}`);
  }
  log();

  log(`completed: ${new Date().toISOString()}`);
  log('='.repeat(72));

  // ── Append to report file ─────────────────────────────────────────────────
  let existing = '';
  try { existing = await fs.readFile(reportPath, 'utf-8'); } catch {}
  await fs.writeFile(reportPath, existing + reportLines.join('\n') + '\n\n', 'utf-8');
  console.log(`Report appended to ${reportPath}`);
}

main().catch((e) => {
  console.error('[measure-extraction-stability] fatal:', e);
  process.exit(1);
});
