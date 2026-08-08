/**
 * scripts/tier1-classification-stability.ts
 *
 * Tier 1 classification stability run for slice 1c.3.
 *
 * Calls classifyDocumentWithGemini for 37 documents across 3 companies,
 * applies the step-2 fan-out rule, compares resulting DAR set against
 * what is stored in document_analysis_results, and records a per-document
 * PASS / CHANGE / ERROR verdict.
 *
 * READS ONLY — no INSERT / UPDATE / DELETE to any table.
 * mimeType source field: file_upload_events.file_name (same as event.fileName in the pipeline).
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import {
  classifyDocumentWithGemini,
  type DocumentClassificationResult,
} from '../server/services/gemini-document-classification-service';
import { PROMPT_VERSION } from '../shared/prompt-version';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// ─── Exact copy of getMimeTypeForFile from file-analysis.service.ts (not exported) ───
function getMimeTypeForFile(fileType: string): string {
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    txt: 'text/plain',
    rtf: 'application/rtf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    webp: 'image/webp',
    numbers: 'application/vnd.apple.numbers',
    pages: 'application/vnd.apple.pages',
    key: 'application/vnd.apple.keynote',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
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
  return mimeMap[normalized] ?? 'application/octet-stream';
}

// ─── Fan-out rule — lines 255-260 of file-analysis.service.ts ────────────────
// company_accounts fans out to profit_and_loss and balance_sheet;
// all other document types pass through unchanged.
function applyFanOut(documentTypes: string[]): string[] {
  const expanded = [...documentTypes];
  if (documentTypes.includes('company_accounts')) {
    if (!expanded.includes('profit_and_loss')) expanded.push('profit_and_loss');
    if (!expanded.includes('balance_sheet')) expanded.push('balance_sheet');
  }
  return expanded;
}

// ─── Corpus ───────────────────────────────────────────────────────────────────
const CORPUS: number[] = [
  // Company 1877 (11 documents)
  5830, 5831, 5832, 5833, 5834, 5835, 5836, 5837, 5838, 5839, 5840,
  // Company 1880 (16 documents)
  5857, 5858, 5859, 5860, 5861, 5862, 5863, 5864, 5865, 5866, 5867, 5868, 5869, 5870, 5871, 5872,
  // Company 1881 (11 documents)
  5873, 5874, 5875, 5876, 5877, 5878, 5879, 5880, 5881, 5882, 5883,
];
// Total: 38

// doc_id 5878 — SKIPPED_MISSING_BYTES
// Reason: companies/138/doc-1778838811755-535012742.pdf returns NotFound in R2.
const SKIP_REASON: Record<number, string> = {
  5878: 'SKIPPED_MISSING_BYTES — YE23 Accounts.pdf NotFound in R2: companies/138/doc-1778838811755-535012742.pdf',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const headSha = execSync('git rev-parse --short HEAD').toString().trim();
  const mimeTypeSourceField = 'file_upload_events.file_name';
  const runDate = '2026-08-08';

  const lines: string[] = [];

  lines.push('TIER 1 CLASSIFICATION STABILITY RUN');
  lines.push(`Date: ${runDate}`);
  lines.push(`PROMPT_VERSION: ${PROMPT_VERSION}`);
  lines.push(`HEAD SHA: ${headSha}`);
  lines.push(`mimeType source field: ${mimeTypeSourceField}`);
  lines.push(`Corpus: 38 documents (5830-5840, 5857-5872, 5873-5883)`);
  lines.push(`Skipped: doc_id 5878 — SKIPPED_MISSING_BYTES (YE23 Accounts.pdf, NotFound in R2)`);
  lines.push('');

  // ── Fetch document data in one query ────────────────────────────────────────
  type RawRow = {
    doc_id: string | number;
    file_path: string;
    file_name: string;
    stored_dar_types: string[] | null;
  };

  const corpusIds = CORPUS.join(', ');
  const queryResult = await db.execute(sql.raw(`
    SELECT
      d.id AS doc_id,
      d.file_path,
      fue.file_name,
      array_agg(DISTINCT dar.document_type ORDER BY dar.document_type)
        FILTER (WHERE dar.document_type IS NOT NULL) AS stored_dar_types
    FROM documents d
    LEFT JOIN file_upload_events fue ON fue.document_id = d.id
    LEFT JOIN document_analysis_results dar ON dar.document_id = d.id
    WHERE d.id IN (${corpusIds})
    GROUP BY d.id, d.file_path, fue.file_name
    ORDER BY d.id
  `));

  const docMap = new Map<
    number,
    { filePath: string; fileName: string; storedDarTypes: string[] }
  >();
  for (const row of queryResult.rows as RawRow[]) {
    docMap.set(Number(row.doc_id), {
      filePath: row.file_path,
      fileName: row.file_name ?? '',
      storedDarTypes: row.stored_dar_types ?? [],
    });
  }

  // ── Process documents sequentially ──────────────────────────────────────────
  let passCount = 0;
  let changeCount = 0;
  let errorCount = 0;
  const verdictTable: string[] = [];
  const changeOrErrorBlocks: string[] = [];

  for (const docId of CORPUS) {
    lines.push('────────────────────────────────────────────────────────────────');

    // Skipped
    if (SKIP_REASON[docId] !== undefined) {
      lines.push(`doc_id: ${docId}`);
      lines.push(`verdict: SKIPPED_MISSING_BYTES`);
      lines.push(`reason: ${SKIP_REASON[docId]}`);
      lines.push('');
      verdictTable.push(`${String(docId).padEnd(6)} | SKIPPED_MISSING_BYTES`);
      continue;
    }

    const docData = docMap.get(docId);
    if (!docData) {
      const errMsg = 'document not found in DB query result';
      lines.push(`doc_id: ${docId}`);
      lines.push(`verdict: ERROR`);
      lines.push(`error: ${errMsg}`);
      lines.push('');
      verdictTable.push(`${String(docId).padEnd(6)} | ERROR`);
      changeOrErrorBlocks.push(
        `════ ERROR doc_id ${docId} ════`,
        `error: ${errMsg}`,
        '',
      );
      errorCount++;
      continue;
    }

    const { filePath, fileName, storedDarTypes } = docData;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() ?? 'pdf';
    const mimeType = getMimeTypeForFile(fileExtension);

    lines.push(`doc_id: ${docId}`);
    lines.push(`fileName: ${fileName}`);
    lines.push(`filePath: ${filePath}`);
    lines.push(`mimeType: ${mimeType}`);
    lines.push(`storedDarTypes: [${storedDarTypes.join(', ')}]`);

    // ── Classify (retry once on failure) ──────────────────────────────────────
    let classResult: DocumentClassificationResult | null = null;
    let lastError = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        classResult = await classifyDocumentWithGemini({ filePath, mimeType, fileName });
        if (classResult.success) break;
        lastError = classResult.error ?? 'unknown error';
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
        classResult = { success: false, documentTypes: [], error: lastError };
      }
      if (attempt === 1) {
        lines.push(`attempt 1 failed — retrying: ${lastError}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (!classResult || !classResult.success) {
      lines.push(`verdict: ERROR`);
      lines.push(`error: ${lastError}`);
      lines.push(`rawResult: ${JSON.stringify(classResult)}`);
      lines.push('');
      verdictTable.push(`${String(docId).padEnd(6)} | ERROR`);
      changeOrErrorBlocks.push(
        `════ ERROR doc_id ${docId} ════`,
        `fileName: ${fileName}`,
        `error: ${lastError}`,
        `rawResult: ${JSON.stringify(classResult)}`,
        '',
      );
      errorCount++;
      continue;
    }

    lines.push(`rawResult: ${JSON.stringify(classResult)}`);

    // ── Fan-out + set comparison ──────────────────────────────────────────────
    const expandedTypes = applyFanOut(classResult.documentTypes);
    // Exclude 'none' from the expected set (not a stored DAR type)
    const expectedDarSet = new Set(expandedTypes.filter((t) => t !== 'none'));
    const storedDarSet = new Set(storedDarTypes);

    const setsIdentical =
      expectedDarSet.size === storedDarSet.size &&
      [...expectedDarSet].every((t) => storedDarSet.has(t));

    const expectedSorted = [...expectedDarSet].sort().join(', ');
    const storedSorted = [...storedDarSet].sort().join(', ');

    if (setsIdentical) {
      lines.push(`verdict: PASS`);
      lines.push(`expectedDarSet: [${expectedSorted}]`);
      lines.push('');
      verdictTable.push(
        `${String(docId).padEnd(6)} | PASS   | stored=[${storedSorted}]`,
      );
      passCount++;
    } else {
      lines.push(`verdict: CHANGE`);
      lines.push(`expectedDarSet: [${expectedSorted}]`);
      lines.push(`storedDarSet:   [${storedSorted}]`);
      lines.push('');
      verdictTable.push(
        `${String(docId).padEnd(6)} | CHANGE | stored=[${storedSorted}] expected=[${expectedSorted}]`,
      );
      changeOrErrorBlocks.push(
        `════ CHANGE doc_id ${docId} ════`,
        `fileName: ${fileName}`,
        `storedDarSet:   [${storedSorted}]`,
        `expectedDarSet: [${expectedSorted}]`,
        `rawResult: ${JSON.stringify(classResult)}`,
        '',
      );
      changeCount++;
    }
  }

  // ── Summary block ─────────────────────────────────────────────────────────
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('SUMMARY');
  lines.push(`Attempted: 37  Skipped: 1  Total corpus: 38`);
  lines.push(`PASS:   ${passCount}`);
  lines.push(`CHANGE: ${changeCount}`);
  lines.push(`ERROR:  ${errorCount}`);
  lines.push(`PASS + CHANGE + ERROR = ${passCount + changeCount + errorCount}  (must equal 37)`);
  lines.push('');
  lines.push('VERDICT TABLE');
  lines.push(...verdictTable);
  lines.push('');
  if (changeOrErrorBlocks.length > 0) {
    lines.push('CHANGE / ERROR DETAIL');
    lines.push(...changeOrErrorBlocks);
  }

  // ── Write report ──────────────────────────────────────────────────────────
  const outPath = path.join(
    process.cwd(),
    'docs',
    'pipeline-fidelity-fix',
    'tier1-classification-2026-08-08.txt',
  );
  await fs.writeFile(outPath, lines.join('\n'), 'utf-8');

  console.log(`\nReport written to ${outPath}`);
  console.log(`PASS=${passCount}  CHANGE=${changeCount}  ERROR=${errorCount}  SKIPPED=1  TOTAL=38`);
  console.log(`PASS + CHANGE + ERROR = ${passCount + changeCount + errorCount} (must equal 37)`);
}

main().catch((e) => {
  console.error('[tier1-classification-stability] fatal:', e);
  process.exit(1);
});
