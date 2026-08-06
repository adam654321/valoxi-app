/**
 * scripts/diff-evidence-versions.ts
 * Slice 1c.1b – read-only evidence version diff harness.
 *
 * READ-ONLY. No INSERT, no UPDATE, no DELETE, no ALTER, no transaction.
 * Usage: npx tsx scripts/diff-evidence-versions.ts [--companies=1877,1880,1881] [--base=1] [--compare=max]
 *
 * Arguments (all optional):
 *   --companies=1877,1880,1881   comma-separated company ids; the literal word "all" means every company
 *   --base=1                     the base extraction_version (default 1)
 *   --compare=max                "max" = highest extraction_version per (document_id, document_type);
 *                                or an explicit integer
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import {
  diffEvidenceVersions,
  type EvidenceFigureRow,
  type FigureDiff,
  type DiffResult,
} from '../shared/calculators/evidence-version-diff';

// ─── Argument handling ────────────────────────────────────────────────────────

const COMPANIES_FLAG = '--companies=';
const BASE_FLAG      = '--base=';
const COMPARE_FLAG   = '--compare=';

const companiesArg =
  process.argv.find((a) => a.startsWith(COMPANIES_FLAG))?.slice(COMPANIES_FLAG.length) ??
  '1877,1880,1881';
const baseArg =
  process.argv.find((a) => a.startsWith(BASE_FLAG))?.slice(BASE_FLAG.length) ?? '1';
const compareArg =
  process.argv.find((a) => a.startsWith(COMPARE_FLAG))?.slice(COMPARE_FLAG.length) ?? 'max';

const companiesAll = companiesArg === 'all';
const companyIds: number[] = companiesAll
  ? []
  : companiesArg.split(',').map((s) => parseInt(s.trim(), 10));
const baseVersion = parseInt(baseArg, 10);
const compareIsMax = compareArg === 'max';
const compareFixedVersion: number | null = compareIsMax ? null : parseInt(compareArg, 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function line(s: string = '') {
  process.stdout.write(s + '\n');
}

function pct(num: number, den: number): string {
  if (den === 0) return '0.0%';
  return ((num / den) * 100).toFixed(1) + '%';
}

/** Format a field-coverage count from string-typed DB counts. */
function cov(count: string, total: string, note: string = ''): string {
  const n = parseInt(count, 10);
  const t = parseInt(total, 10);
  return `${n} / ${t}  (${pct(n, t)})${note ? '  ' + note : ''}`;
}

// Raw shape returned by the database query (camelCase aliases)
type RawRow = {
  documentId:           number;
  documentType:         string;
  extractionVersion:    number;
  targetCompanyId:      number;
  fiscalYearStated:     number | null;
  payloadPath:          string | null;
  value:                string | null;
  pageNumber:           number | null;
  labelTextAsPrinted:   string | null;
  statementType:        string;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {

  // ── Fetch all figure rows for the selected companies (all versions) ────────
  // The WHERE clause is omitted entirely when --companies=all.
  const whereClause = companiesAll
    ? sql``
    : sql`WHERE de.target_company_id IN (${sql.raw(companyIds.join(','))})`;

  const queryResult = await db.execute<RawRow>(sql`
    SELECT
      de.document_id            AS "documentId",
      de.document_type          AS "documentType",
      de.extraction_version     AS "extractionVersion",
      de.target_company_id      AS "targetCompanyId",
      dep.fiscal_year_stated    AS "fiscalYearStated",
      def.payload_path          AS "payloadPath",
      def.value::text           AS "value",
      def.page_number           AS "pageNumber",
      def.label_text_as_printed AS "labelTextAsPrinted",
      def.statement_type        AS "statementType"
    FROM document_evidence de
    JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
    JOIN document_evidence_figure  def ON def.document_evidence_period_id = dep.id
    ${whereClause}
    ORDER BY de.target_company_id, de.document_id, de.document_type, de.extraction_version
  `);

  const allRows = queryResult.rows;
  const totalFetched = allRows.length;

  // ── Header ────────────────────────────────────────────────────────────────
  line('='.repeat(72));
  line('DIFF REPORT: evidence version comparator');
  line('='.repeat(72));
  line(`companies:    ${companiesAll ? 'ALL' : companyIds.join(', ')}`);
  line(`base:         version ${baseVersion}`);
  line(`compare:      ${compareIsMax ? 'max (highest extraction_version per document_id + document_type)' : 'version ' + String(compareFixedVersion)}`);
  line(`rows fetched: ${totalFetched}`);
  line();

  // ── Group by company ──────────────────────────────────────────────────────
  const byCompany = new Map<number, RawRow[]>();
  for (const r of allRows) {
    const list = byCompany.get(r.targetCompanyId) ?? [];
    list.push(r);
    byCompany.set(r.targetCompanyId, list);
  }

  // ── Per-company diff ──────────────────────────────────────────────────────
  const companyResults: Array<{ companyId: number; result: DiffResult }> = [];

  for (const [companyId, compRows] of [...byCompany.entries()].sort((a, b) => a[0] - b[0])) {
    // Step 1: compute max extraction_version per (document_id, document_type)
    const maxVersionMap = new Map<string, number>();
    for (const r of compRows) {
      if (r.documentId === null) continue;
      const pairKey = `${r.documentId}|${r.documentType}`;
      const cur = maxVersionMap.get(pairKey) ?? 0;
      if (r.extractionVersion > cur) maxVersionMap.set(pairKey, r.extractionVersion);
    }

    // Step 2: partition into base and compare sets
    const baseRows:    EvidenceFigureRow[] = [];
    const compareRows: EvidenceFigureRow[] = [];

    for (const r of compRows) {
      // Rows with null document_id or null payload_path cannot form a valid key;
      // skip them — the comparator would skip them too, but we exclude up front
      // so counts are correct.
      if (r.documentId === null || r.payloadPath === null) continue;

      const pairKey = `${r.documentId}|${r.documentType}`;
      const maxVer = maxVersionMap.get(pairKey) ?? r.extractionVersion;
      const targetCompareVer = compareIsMax ? maxVer : (compareFixedVersion ?? maxVer);

      const figRow: EvidenceFigureRow = {
        documentId:          r.documentId,
        documentType:        r.documentType,
        extractionVersion:   r.extractionVersion,
        fiscalYearStated:    r.fiscalYearStated,
        payloadPath:         r.payloadPath,
        value:               r.value,
        pageNumber:          r.pageNumber,
        labelTextAsPrinted:  r.labelTextAsPrinted,
        statementType:       r.statementType,
      };

      if (r.extractionVersion === baseVersion)          baseRows.push(figRow);
      if (r.extractionVersion === targetCompareVer) compareRows.push(figRow);
    }

    const result = diffEvidenceVersions(baseRows, compareRows);
    companyResults.push({ companyId, result });
  }

  // ── Per-company summary ───────────────────────────────────────────────────
  line('─'.repeat(72));
  line('PER-COMPANY SUMMARY');
  line('─'.repeat(72));
  for (const { companyId, result: r } of companyResults) {
    line(`company ${companyId}:`);
    line(`  baseCount=${r.baseCount}  compareCount=${r.compareCount}  equal=${r.equal}  differ=${r.differ}  baseOnly=${r.baseOnly}  compareOnly=${r.compareOnly}`);
  }
  line();

  // ── Aggregate totals ──────────────────────────────────────────────────────
  let totalBaseCount    = 0;
  let totalCompareCount = 0;
  let totalEqual        = 0;
  let totalDiffer       = 0;
  let totalBaseOnly     = 0;
  let totalCompareOnly  = 0;
  let totalAnchorTotal  = 0;
  let totalWithPage     = 0;
  let totalWithLabel    = 0;
  let totalWithBoth     = 0;

  const allDiffs:              FigureDiff[] = [];
  const allDuplicateBaseKeys:  string[]     = [];
  const allDuplicateCompKeys:  string[]     = [];

  for (const { result: r } of companyResults) {
    totalBaseCount    += r.baseCount;
    totalCompareCount += r.compareCount;
    totalEqual        += r.equal;
    totalDiffer       += r.differ;
    totalBaseOnly     += r.baseOnly;
    totalCompareOnly  += r.compareOnly;
    totalAnchorTotal  += r.anchorCoverage.compareTotal;
    totalWithPage     += r.anchorCoverage.withPage;
    totalWithLabel    += r.anchorCoverage.withLabel;
    totalWithBoth     += r.anchorCoverage.withBoth;
    allDiffs.push(...r.diffs);
    allDuplicateBaseKeys.push(...r.duplicateBaseKeys);
    allDuplicateCompKeys.push(...r.duplicateCompareKeys);
  }

  // ── Totals with reconciliation identities ─────────────────────────────────
  line('─'.repeat(72));
  line('TOTALS');
  line('─'.repeat(72));
  line(`baseCount:    ${totalBaseCount}`);
  line(`compareCount: ${totalCompareCount}`);
  line(`equal:        ${totalEqual}`);
  line(`differ:       ${totalDiffer}`);
  line(`baseOnly:     ${totalBaseOnly}`);
  line(`compareOnly:  ${totalCompareOnly}`);
  line();

  const id1RHS    = totalEqual + totalDiffer + totalBaseOnly;
  const id1Result = totalBaseCount === id1RHS ? 'MATCH' : 'MISMATCH';
  line(`Identity 1: baseCount = equal + differ + baseOnly`);
  line(`  ${totalBaseCount} = ${totalEqual} + ${totalDiffer} + ${totalBaseOnly} = ${id1RHS}  → ${id1Result}`);

  const id2RHS    = totalEqual + totalDiffer + totalCompareOnly;
  const id2Result = totalCompareCount === id2RHS ? 'MATCH' : 'MISMATCH';
  line(`Identity 2: compareCount = equal + differ + compareOnly`);
  line(`  ${totalCompareCount} = ${totalEqual} + ${totalDiffer} + ${totalCompareOnly} = ${id2RHS}  → ${id2Result}`);
  line();

  // ── Duplicate key report ──────────────────────────────────────────────────
  line('─'.repeat(72));
  line('DUPLICATE KEY REPORT');
  line('─'.repeat(72));
  if (allDuplicateBaseKeys.length === 0) {
    line('duplicateBaseKeys:    NONE');
  } else {
    line('duplicateBaseKeys:');
    for (const k of allDuplicateBaseKeys) line(`  ${k}`);
  }
  if (allDuplicateCompKeys.length === 0) {
    line('duplicateCompareKeys: NONE');
  } else {
    line('duplicateCompareKeys:');
    for (const k of allDuplicateCompKeys) line(`  ${k}`);
  }
  line();

  // ── Anchor coverage ───────────────────────────────────────────────────────
  line('─'.repeat(72));
  line('ANCHOR COVERAGE (over COMPARE set)');
  line('─'.repeat(72));
  line(`compareTotal:           ${totalAnchorTotal}`);
  line(`with page_number:       ${totalWithPage}  (${pct(totalWithPage, totalAnchorTotal)})`);
  line(`with label_text:        ${totalWithLabel}  (${pct(totalWithLabel, totalAnchorTotal)})`);
  line(`with both:              ${totalWithBoth}  (${pct(totalWithBoth, totalAnchorTotal)})`);
  line();

  // ── PRE-1c field coverage ────────────────────────────────────────────────
  const deFields = await db.execute<{
    total: string;
    company_names_found: string; registered_numbers_found: string; year_end_stated: string;
    directors_named: string; accountant_name: string; is_draft: string; is_abridged: string;
    is_signed: string; report_date: string; identity_verdict: string;
    content_hash: string; extractor: string;
  }>(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(CASE WHEN company_names_found IS NOT NULL AND jsonb_array_length(company_names_found) > 0 THEN 1 END)::text AS company_names_found,
      COUNT(CASE WHEN registered_numbers_found IS NOT NULL AND jsonb_array_length(registered_numbers_found) > 0 THEN 1 END)::text AS registered_numbers_found,
      COUNT(year_end_stated)::text AS year_end_stated,
      COUNT(CASE WHEN directors_named IS NOT NULL AND jsonb_array_length(directors_named) > 0 THEN 1 END)::text AS directors_named,
      COUNT(accountant_name)::text AS accountant_name,
      COUNT(is_draft)::text AS is_draft,
      COUNT(is_abridged)::text AS is_abridged,
      COUNT(is_signed)::text AS is_signed,
      COUNT(report_date)::text AS report_date,
      COUNT(identity_verdict)::text AS identity_verdict,
      COUNT(content_hash)::text AS content_hash,
      COUNT(extractor)::text AS extractor
    FROM document_evidence de
    ${whereClause}
  `);
  const deF = deFields.rows[0];

  const depFields = await db.execute<{
    total: string;
    period_start: string; period_end: string; period_label_as_printed: string;
    fiscal_year_stated: string; months_covered_stated: string; months_covered_computed: string;
    is_full_year_computed: string; provenance: string; anomalies: string;
  }>(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(period_start)::text AS period_start,
      COUNT(period_end)::text AS period_end,
      COUNT(period_label_as_printed)::text AS period_label_as_printed,
      COUNT(fiscal_year_stated)::text AS fiscal_year_stated,
      COUNT(months_covered_stated)::text AS months_covered_stated,
      COUNT(months_covered_computed)::text AS months_covered_computed,
      COUNT(is_full_year_computed)::text AS is_full_year_computed,
      COUNT(provenance)::text AS provenance,
      COUNT(CASE WHEN anomalies IS NOT NULL AND jsonb_array_length(anomalies) > 0 THEN 1 END)::text AS anomalies
    FROM document_evidence_period dep
    JOIN document_evidence de ON de.id = dep.document_evidence_id
    ${whereClause}
  `);
  const depF = depFields.rows[0];

  const defFields = await db.execute<{
    total: string;
    page_number: string; label_text_as_printed: string; payload_path: string; is_model_derived: string;
  }>(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(page_number)::text AS page_number,
      COUNT(label_text_as_printed)::text AS label_text_as_printed,
      COUNT(payload_path)::text AS payload_path,
      COUNT(is_model_derived)::text AS is_model_derived
    FROM document_evidence_figure def
    JOIN document_evidence_period dep ON dep.id = def.document_evidence_period_id
    JOIN document_evidence de ON de.id = dep.document_evidence_id
    ${whereClause}
  `);
  const defF = defFields.rows[0];

  line('─'.repeat(72));
  line('PRE-1c FIELD COVERAGE');
  line('─'.repeat(72));
  line('document_evidence:');
  line(`  company_names_found (jsonb array):        ${cov(deF.company_names_found, deF.total, '[array: non-null + length >= 1]')}`);
  line(`  registered_numbers_found (jsonb array):   ${cov(deF.registered_numbers_found, deF.total, '[array: non-null + length >= 1]')}`);
  line(`  year_end_stated:                          ${cov(deF.year_end_stated, deF.total)}`);
  line(`  directors_named (jsonb array):            ${cov(deF.directors_named, deF.total, '[array: non-null + length >= 1]')}`);
  line(`  accountant_name:                          ${cov(deF.accountant_name, deF.total)}`);
  line(`  is_draft:                                 ${cov(deF.is_draft, deF.total)}`);
  line(`  is_abridged:                              ${cov(deF.is_abridged, deF.total)}`);
  line(`  is_signed:                                ${cov(deF.is_signed, deF.total)}`);
  line(`  report_date:                              ${cov(deF.report_date, deF.total)}`);
  line(`  identity_verdict:                         ${cov(deF.identity_verdict, deF.total)}`);
  line(`  content_hash:                             ${cov(deF.content_hash, deF.total)}`);
  line(`  extractor:                                ${cov(deF.extractor, deF.total)}`);
  line();
  line('document_evidence_period:');
  line(`  period_start:                             ${cov(depF.period_start, depF.total)}`);
  line(`  period_end:                               ${cov(depF.period_end, depF.total)}`);
  line(`  period_label_as_printed:                  ${cov(depF.period_label_as_printed, depF.total)}`);
  line(`  fiscal_year_stated:                       ${cov(depF.fiscal_year_stated, depF.total)}`);
  line(`  months_covered_stated:                    ${cov(depF.months_covered_stated, depF.total)}`);
  line(`  months_covered_computed:                  ${cov(depF.months_covered_computed, depF.total)}`);
  line(`  is_full_year_computed:                    ${cov(depF.is_full_year_computed, depF.total)}`);
  line(`  provenance:                               ${cov(depF.provenance, depF.total)}`);
  line(`  anomalies (jsonb array):                  ${cov(depF.anomalies, depF.total, '[array: non-null + length >= 1]')}`);
  line();
  line('document_evidence_figure:');
  line(`  page_number:                              ${cov(defF.page_number, defF.total)}`);
  line(`  label_text_as_printed:                    ${cov(defF.label_text_as_printed, defF.total)}`);
  line(`  payload_path:                             ${cov(defF.payload_path, defF.total)}`);
  line(`  is_model_derived:                         ${cov(defF.is_model_derived, defF.total)}`);
  line();

  // ── DIFFER rows ───────────────────────────────────────────────────────────
  const differRows = allDiffs.filter((d) => d.bucket === 'DIFFER');
  line('─'.repeat(72));
  line(`DIFFER ROWS (${differRows.length})`);
  line('─'.repeat(72));
  if (differRows.length === 0) {
    line('NONE');
  } else {
    for (const d of differRows) {
      line(`  document_id=${d.documentId}  fiscal_year=${d.fiscalYearStated ?? 'null'}  payload_path=${d.payloadPath}`);
      line(`    baseValue=${d.baseValue}  compareValue=${d.compareValue}  absoluteDifference=${d.absoluteDifference}`);
    }
  }
  line();

  // ── BASE_ONLY rows ────────────────────────────────────────────────────────
  const baseOnlyRows = allDiffs.filter((d) => d.bucket === 'BASE_ONLY');
  line('─'.repeat(72));
  line(`BASE_ONLY ROWS (${baseOnlyRows.length})`);
  line('─'.repeat(72));
  if (baseOnlyRows.length === 0) {
    line('NONE');
  } else {
    for (const d of baseOnlyRows) {
      line(`  document_id=${d.documentId}  fiscal_year=${d.fiscalYearStated ?? 'null'}  payload_path=${d.payloadPath}  baseValue=${d.baseValue}`);
    }
  }
  line();

  // ── COMPARE_ONLY rows ─────────────────────────────────────────────────────
  const compareOnlyRows = allDiffs.filter((d) => d.bucket === 'COMPARE_ONLY');
  line('─'.repeat(72));
  line(`COMPARE_ONLY ROWS (${compareOnlyRows.length})`);
  line('─'.repeat(72));
  if (compareOnlyRows.length === 0) {
    line('NONE');
  } else {
    for (const d of compareOnlyRows) {
      line(`  document_id=${d.documentId}  fiscal_year=${d.fiscalYearStated ?? 'null'}  payload_path=${d.payloadPath}  compareValue=${d.compareValue}`);
    }
  }
  line();

  line('='.repeat(72));
  line('END OF REPORT');
  line('='.repeat(72));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
