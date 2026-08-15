/**
 * scripts/audit1-extract-capture.ts
 * AUDIT-1.apply-1 — fresh single-pass extraction across all 24 evidence-bearing
 * documents for companies 1877, 1880, 1881.
 *
 * WRITES NOTHING to any database table. No INSERT, UPDATE, DELETE, or ALTER.
 * Database access: read-only document inventory lookup + before/after COUNT(*).
 * API calls: analyzeDocumentWithGemini — 1 call per (document, type).
 * Output: docs/pipeline-fidelity-fix/audit1-capture-2026-08-15.txt
 *
 * documentType resolution: reads each document's stored document_analysis_results
 * types (filtering to profit_and_loss / balance_sheet only), replicating the
 * production expansion logic from file-analysis.service.ts lines 255-260 where
 * company_accounts is expanded to include both profit_and_loss and balance_sheet.
 *
 * GROUP A paths (30) and GROUP B fields copied verbatim from
 * scripts/measure-extraction-stability.ts lines 94-135.
 *
 * Capture detail is written INLINE per document so partial progress is
 * preserved if the run is interrupted before completion.
 *
 * Usage:
 *   npx tsx scripts/audit1-extract-capture.ts           # full run (all 3 companies)
 *   npx tsx scripts/audit1-extract-capture.ts --co=1881 # continuation: company 1881 only, append mode
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { analyzeDocumentWithGemini } from '../server/services/gemini-step2-analysis-service';
import { mapPayloadToEvidence } from '../shared/utils/evidence-mapper';
import { PROMPT_VERSION } from '../shared/prompt-version';
import fsSync from 'fs';
import path from 'path';

// ─── Mode flag ────────────────────────────────────────────────────────────────
const coArg = process.argv.find(a => a.startsWith('--co='))?.slice('--co='.length);
const CONTINUATION_CO = coArg ? parseInt(coArg, 10) : null; // null = full run

// ─── Hardcoded 24-doc list (pre-step A confirmed) ────────────────────────────

const DOCS_BY_COMPANY: Array<{ companyId: number; docIds: number[] }> = [
  { companyId: 1877, docIds: [5830, 5831, 5832, 5833, 5835, 5836] },
  { companyId: 1880, docIds: [5857, 5860, 5861, 5862, 5863, 5865, 5866, 5867, 5868, 5869] },
  { companyId: 1881, docIds: [5873, 5874, 5875, 5876, 5877, 5879, 5880, 5881] },
];

const COMPANIES_TO_RUN = CONTINUATION_CO
  ? DOCS_BY_COMPANY.filter(c => c.companyId === CONTINUATION_CO)
  : DOCS_BY_COMPANY;

const ALL_DOC_IDS = COMPANIES_TO_RUN.flatMap(c => c.docIds);

// ─── GROUP A — verbatim from measure-extraction-stability.ts lines 94-132 ────

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

// GROUP B period keys — verbatim from measure-extraction-stability.ts line 135
const GROUP_B_PERIOD_FIELDS = ['period_start', 'period_end', 'months_covered'] as const;

// Ordered list for deterministic output
const GROUP_A_ORDERED = [...GROUP_A_SHORT_PATHS].sort();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortPath(payloadPath: string): string {
  const parts = payloadPath.split('.');
  return parts.slice(2).join('.');
}

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
    'csv': 'text/csv', 'tsv': 'text/tab-separated-values', 'txt': 'text/plain',
    'rtf': 'application/rtf', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'png': 'image/png', 'gif': 'image/gif', 'bmp': 'image/bmp',
    'tiff': 'image/tiff', 'tif': 'image/tiff', 'webp': 'image/webp',
    'numbers': 'application/vnd.apple.numbers', 'pages': 'application/vnd.apple.pages',
    'key': 'application/vnd.apple.keynote', 'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'application/pdf': 'application/pdf', 'application/msword': 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel': 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv': 'text/csv', 'image/png': 'image/png', 'image/jpeg': 'image/jpeg',
  };
  return mimeMap[fileType.toLowerCase()] || 'application/octet-stream';
}

// ─── Per-year capture structure ───────────────────────────────────────────────

interface YearCapture {
  groupA: Map<string, string | null>;
  groupB: { period_start: string|null; period_end: string|null; months_covered: string|null; report_date: string|null; };
  typesExtracted: string[];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outputPath = path.join(process.cwd(), 'docs', 'pipeline-fidelity-fix', 'audit1-capture-2026-08-15.txt');
  const isAppend = CONTINUATION_CO !== null;

  const outStream = fsSync.createWriteStream(outputPath, { flags: isAppend ? 'a' : 'w', encoding: 'utf-8' });
  const log = (s: string = '') => { process.stdout.write(s + '\n'); outStream.write(s + '\n'); };

  if (!isAppend) {
    log('='.repeat(80));
    log('AUDIT-1.apply-1 — EXTRACTION CAPTURE');
    log(`promptVersion: ${PROMPT_VERSION}`);
    log(`started:       ${new Date().toISOString()}`);
    log(`documents:     24`);
    log('='.repeat(80));
    log();

    // BEFORE row counts (full run only; continuation reuses the pre-recorded before counts)
    const before = await db.execute<{ tbl: string; cnt: string }>(sql`
      SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
      UNION ALL SELECT 'document_evidence',        COUNT(*)::text FROM document_evidence
      UNION ALL SELECT 'document_evidence_period',  COUNT(*)::text FROM document_evidence_period
      UNION ALL SELECT 'document_evidence_figure',  COUNT(*)::text FROM document_evidence_figure
    `);
    log('BEFORE row counts:');
    for (const r of before.rows) log(`  ${r.tbl}: ${r.cnt}`);
    log();

    log('='.repeat(80));
    log('CAPTURE DETAIL — grouped by company / document / fiscal year');
    log('='.repeat(80));
  } else {
    log();
    log(`[CONTINUATION] company ${CONTINUATION_CO} only — appended at ${new Date().toISOString()}`);
    log();
  }

  // ── Fetch document inventory ──────────────────────────────────────────────
  const docIdLiterals = sql.join(ALL_DOC_IDS.map(id => sql`${id}`), sql`, `);

  const docsRows = await db.execute<{
    id: number; target_company_id: number; file_path: string;
    original_filename: string; document_category: string;
  }>(sql`
    SELECT id, target_company_id, file_path, original_filename, document_category
    FROM documents
    WHERE id IN (${docIdLiterals})
  `);
  const docMap = new Map(docsRows.rows.map(r => [r.id, r]));

  // ── Fetch stored document types (production resolution) ───────────────────
  const darRows = await db.execute<{ document_id: number; document_type: string }>(sql`
    SELECT document_id, document_type
    FROM document_analysis_results
    WHERE document_id IN (${docIdLiterals})
      AND document_type IN ('profit_and_loss', 'balance_sheet')
    ORDER BY document_id, document_type
  `);
  const docTypesMap = new Map<number, string[]>();
  for (const row of darRows.rows) {
    if (!docTypesMap.has(row.document_id)) docTypesMap.set(row.document_id, []);
    docTypesMap.get(row.document_id)!.push(row.document_type);
  }

  // ── Processing loop ───────────────────────────────────────────────────────
  const failures: Array<{ docId: number; type: string; error: string }> = [];
  let totalApiCalls = 0;
  let firstCompany = true;

  for (const { companyId, docIds } of COMPANIES_TO_RUN) {
    log();
    log('━'.repeat(80));
    log(`COMPANY ${companyId}`);
    log('━'.repeat(80));
    firstCompany = false;

    for (const docId of docIds) {
      const doc = docMap.get(docId);
      const typesToExtract = docTypesMap.get(docId) ?? [];

      log();
      log(`  ┌─ DOC ${docId}`);
      log(`  │  filename:    ${doc?.original_filename ?? '(unknown)'}`);
      log(`  │  category:    ${doc?.document_category ?? '(unknown)'}  [NOT AUTHORITATIVE — tier must be assigned from content]`);
      log(`  │  company_id:  ${doc?.target_company_id ?? '(unknown)'}`);
      log(`  │  r2_key:      ${doc?.file_path ?? '(unknown)'}`);
      log(`  │  types:       [${typesToExtract.join(', ')}]`);

      if (!doc) {
        log(`  │  ERROR: document row not found in DB`);
        log(`  └─`);
        failures.push({ docId, type: 'ANY', error: 'document row not found in DB' });
        continue;
      }
      if (typesToExtract.length === 0) {
        log(`  │  ERROR: no profit_and_loss or balance_sheet type in stored DAR`);
        log(`  └─`);
        failures.push({ docId, type: 'ANY', error: 'no profit_and_loss/balance_sheet type in document_analysis_results' });
        continue;
      }

      const fileExtension = doc.original_filename.split('.').pop()?.toLowerCase() ?? 'pdf';
      const mimeType = getMimeTypeForFile(fileExtension);

      // Accumulate across types: fiscalYear → YearCapture
      const yearMap = new Map<number, YearCapture>();

      for (const docType of typesToExtract as Array<'profit_and_loss' | 'balance_sheet'>) {
        log(`  │  ── ${docType} started: ${new Date().toISOString()}`);
        totalApiCalls++;

        let result;
        try {
          result = await analyzeDocumentWithGemini({
            filePath: doc.file_path, mimeType, fileName: doc.original_filename, documentType: docType,
          });
        } catch (err) {
          const errStr = err instanceof Error ? err.message : String(err);
          log(`  │  ── ${docType} ERROR: ${errStr}`);
          failures.push({ docId, type: docType, error: errStr });
          continue;
        }

        if (!result.success || !result.analysisData) {
          const errStr = result.error ?? 'no analysisData returned';
          log(`  │  ── ${docType} ERROR: ${errStr}`);
          failures.push({ docId, type: docType, error: errStr });
          continue;
        }

        log(`  │  ── ${docType} OK  model=${result.model ?? 'unknown'}  elapsed=${result.processingTime}ms`);

        const mapped = mapPayloadToEvidence({
          targetCompanyId: 0, documentId: 0, documentAnalysisResultId: null,
          documentType: docType, extractionVersion: 0,
          payload: result.analysisData, model: result.model, promptVersion: PROMPT_VERSION,
        });

        const reportDate = mapped.evidence.reportDate ?? null;

        for (const period of mapped.periods) {
          const fy = period.fiscalYearStated;
          if (!yearMap.has(fy)) {
            yearMap.set(fy, {
              groupA: new Map(),
              groupB: { period_start: null, period_end: null, months_covered: null, report_date: null },
              typesExtracted: [],
            });
          }
          const yc = yearMap.get(fy)!;
          if (!yc.typesExtracted.includes(docType)) yc.typesExtracted.push(docType);

          for (const fig of period.figures) {
            const sp = shortPath(fig.payloadPath);
            if (GROUP_A_SHORT_PATHS.has(sp)) {
              yc.groupA.set(sp, fig.value !== null ? String(fig.value) : null);
            }
          }

          if (!yc.groupB.period_start   && period.periodStart) yc.groupB.period_start   = period.periodStart;
          if (!yc.groupB.period_end     && period.periodEnd)   yc.groupB.period_end     = period.periodEnd;
          if (!yc.groupB.months_covered && period.monthsCoveredStated !== null && period.monthsCoveredStated !== undefined)
            yc.groupB.months_covered = String(period.monthsCoveredStated);
          if (!yc.groupB.report_date    && reportDate) yc.groupB.report_date = reportDate;
        }
      }

      // Write inline capture detail for this document
      const docFailures = failures.filter(f => f.docId === docId);
      if (docFailures.length > 0) {
        log(`  │  FAILURES: ${docFailures.map(f => `${f.type}: ${f.error}`).join(' | ')}`);
      }

      if (yearMap.size === 0) {
        log(`  │  (no fiscal years captured — see failures above)`);
      } else {
        log(`  │`);
        const sortedFYs = [...yearMap.keys()].sort((a, b) => a - b);
        for (const fy of sortedFYs) {
          const yc = yearMap.get(fy)!;
          log(`  │  ┌─ FY ${fy}  (types contributed: [${yc.typesExtracted.join(', ')}])`);
          log(`  │  │`);
          log(`  │  │  GROUP B:`);
          log(`  │  │    period_start:   ${yc.groupB.period_start   ?? 'null'}`);
          log(`  │  │    period_end:     ${yc.groupB.period_end     ?? 'null'}`);
          log(`  │  │    months_covered: ${yc.groupB.months_covered ?? 'null'}`);
          log(`  │  │    report_date:    ${yc.groupB.report_date    ?? 'null'}`);
          log(`  │  │`);
          log(`  │  │  GROUP A (30 paths):`);
          for (const sp of GROUP_A_ORDERED) {
            const val = yc.groupA.has(sp) ? (yc.groupA.get(sp) ?? 'null') : 'null';
            log(`  │  │    ${sp.padEnd(54)} = ${val}`);
          }
          log(`  │  └─`);
        }
      }
      log(`  └─`);
    }
  }

  // ── Failures summary ──────────────────────────────────────────────────────
  log();
  log('='.repeat(80));
  if (isAppend) {
    log(`FAILURES (company ${CONTINUATION_CO} continuation)`);
  } else {
    log('FAILURES');
  }
  log('='.repeat(80));
  if (failures.length === 0) {
    log('No failures. All documents in this run completed successfully.');
  } else {
    for (const f of failures) {
      log(`  doc=${f.docId}  type=${f.type}  error=${f.error}`);
    }
  }
  log();

  // ── AFTER row counts ──────────────────────────────────────────────────────
  const after = await db.execute<{ tbl: string; cnt: string }>(sql`
    SELECT 'document_analysis_results' AS tbl, COUNT(*)::text AS cnt FROM document_analysis_results
    UNION ALL SELECT 'document_evidence',        COUNT(*)::text FROM document_evidence
    UNION ALL SELECT 'document_evidence_period',  COUNT(*)::text FROM document_evidence_period
    UNION ALL SELECT 'document_evidence_figure',  COUNT(*)::text FROM document_evidence_figure
  `);
  const afterCounts = new Map(after.rows.map(r => [r.tbl, r.cnt]));

  const BEFORE_COUNTS: Record<string, string> = {
    'document_analysis_results': '548',
    'document_evidence': '391',
    'document_evidence_period': '743',
    'document_evidence_figure': '16712',
  };

  log('WRITES-NOTHING PROOF — row counts:');
  let allUnchanged = true;
  for (const tbl of ['document_analysis_results','document_evidence','document_evidence_period','document_evidence_figure']) {
    const pre  = isAppend ? BEFORE_COUNTS[tbl] : BEFORE_COUNTS[tbl]; // same source of truth either way
    const post = afterCounts.get(tbl) ?? '?';
    const ok   = pre === post ? 'UNCHANGED' : '*** CHANGED ***';
    if (pre !== post) allUnchanged = false;
    log(`  ${tbl}: before=${pre}  after=${post}  → ${ok}`);
  }
  log(allUnchanged ? 'All tables UNCHANGED. No writes occurred.' : '*** WRITE DETECTED — INVESTIGATE ***');
  log();
  log(`total API calls this segment: ${totalApiCalls}`);
  log(`completed: ${new Date().toISOString()}`);
  log('='.repeat(80));

  await new Promise<void>((resolve, reject) => outStream.end((err?: Error | null) => err ? reject(err) : resolve()));
  console.log(`\nReport written to ${outputPath}`);
}

main().catch(e => {
  console.error('[audit1-extract-capture] fatal:', e);
  process.exit(1);
});
