/**
 * scripts/_bleed-calibration.ts
 * BLEED-CALIBRATION — read-only assessment of adjacent-year figure repetition.
 * No writes, no API calls.
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// GROUP A valuation-critical base paths (from STABILITY-1)
const GROUP_A_BASE_PATHS = new Set([
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
]);

const hr = '='.repeat(72);
const sep = '-'.repeat(72);

async function main() {
  // ── STEP 4b denominator ────────────────────────────────────────────────────
  const totRes = await db.execute<{ total_figures: string }>(sql`
    SELECT COUNT(*) AS total_figures
    FROM document_evidence de
    JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
    JOIN document_evidence_figure def ON def.document_evidence_period_id = dep.id
    WHERE de.target_company_id IN (1877, 1880, 1881)
      AND def.value IS NOT NULL
  `);
  const totalFigures = totRes.rows[0].total_figures;

  // ── Build pairs CTE and full distribution ─────────────────────────────────
  // For each evidence record (document + extraction_version), find adjacent
  // fiscal-year pairs (year N and N+1) sharing the same base_path.
  const pairsRes = await db.execute<{
    evidence_id: number;
    target_company_id: number;
    document_id: number;
    extraction_version: number;
    base_path: string;
    year_earlier: number;
    year_later: number;
    val_earlier: string;
    val_later: string;
    abs_diff: string;
    rel_diff: string;
    bucket: string;
  }>(sql`
    WITH base AS (
      SELECT
        de.id                                                        AS evidence_id,
        de.target_company_id,
        de.document_id,
        de.extraction_version,
        dep.fiscal_year_stated,
        regexp_replace(def.payload_path, '^years\\.\\d+\\.', '')    AS base_path,
        def.value::numeric                                           AS val
      FROM document_evidence de
      JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
      JOIN document_evidence_figure def ON def.document_evidence_period_id = dep.id
      WHERE de.target_company_id IN (1877, 1880, 1881)
        AND def.value IS NOT NULL
    ),
    pairs AS (
      SELECT
        a.evidence_id,
        a.target_company_id,
        a.document_id,
        a.extraction_version,
        a.base_path,
        a.fiscal_year_stated                   AS year_earlier,
        b.fiscal_year_stated                   AS year_later,
        a.val                                  AS val_earlier,
        b.val                                  AS val_later,
        ABS(b.val - a.val)                     AS abs_diff,
        CASE
          WHEN GREATEST(ABS(a.val), ABS(b.val)) = 0 THEN 0
          ELSE ABS(b.val - a.val) / GREATEST(ABS(a.val), ABS(b.val))
        END                                    AS rel_diff
      FROM base a
      JOIN base b
        ON  a.evidence_id       = b.evidence_id
        AND a.base_path         = b.base_path
        AND b.fiscal_year_stated = a.fiscal_year_stated + 1
    )
    SELECT
      evidence_id,
      target_company_id,
      document_id,
      extraction_version,
      base_path,
      year_earlier,
      year_later,
      val_earlier::text,
      val_later::text,
      abs_diff::text,
      rel_diff::text,
      CASE
        WHEN val_earlier = val_later                   THEN 'EXACT'
        WHEN rel_diff    <= 0.001                      THEN 'NEAR_0_1'
        WHEN rel_diff    <= 0.01                       THEN 'NEAR_1'
        ELSE                                                'DIFFERENT'
      END AS bucket
    FROM pairs
    ORDER BY base_path, document_id, extraction_version, year_earlier
  `);

  const rows = pairsRes.rows;

  // ── STEP 1 ─────────────────────────────────────────────────────────────────
  const distinctPaths = new Set(rows.map((r) => r.base_path));
  console.log(hr);
  console.log('BLEED-CALIBRATION');
  console.log(hr);
  console.log();
  console.log('STEP 1 — POPULATION');
  console.log(sep);
  console.log(`Total adjacent-year pairs (all buckets):  ${rows.length}`);
  console.log(`Distinct base_paths involved:             ${distinctPaths.size}`);
  console.log();

  // ── STEP 2 — distribution per payload_path ────────────────────────────────
  // Aggregate per base_path
  const byPath = new Map<string, { total: number; EXACT: number; NEAR_0_1: number; NEAR_1: number; DIFFERENT: number }>();
  for (const r of rows) {
    if (!byPath.has(r.base_path)) byPath.set(r.base_path, { total: 0, EXACT: 0, NEAR_0_1: 0, NEAR_1: 0, DIFFERENT: 0 });
    const b = byPath.get(r.base_path)!;
    b.total++;
    b[r.bucket as 'EXACT' | 'NEAR_0_1' | 'NEAR_1' | 'DIFFERENT']++;
  }

  // Filter: paths with at least 1 EXACT or NEAR_0_1 UNION top 30 by total
  const sortedByTotal = [...byPath.entries()].sort((a, b) => b[1].total - a[1].total);
  const top30Paths = new Set(sortedByTotal.slice(0, 30).map(([p]) => p));
  const hasExactOrNear = new Set(
    [...byPath.entries()].filter(([, v]) => v.EXACT > 0 || v.NEAR_0_1 > 0).map(([p]) => p)
  );
  const reportPaths = new Set([...top30Paths, ...hasExactOrNear]);

  const reportRows = [...byPath.entries()]
    .filter(([p]) => reportPaths.has(p))
    .sort((a, b) => b[1].NEAR_0_1 - a[1].NEAR_0_1 || b[1].total - a[1].total);

  console.log('STEP 2 — DISTRIBUTION PER PAYLOAD_PATH');
  console.log('(sorted by NEAR_0_1 desc; shows all with EXACT|NEAR_0_1 plus top-30 by total)');
  console.log(sep);
  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);
  const colR = (s: string, w: number) => s.padStart(w).slice(-w);
  const hdr = col('BASE_PATH', 60) + colR('TOTAL', 7) + colR('EXACT', 7) + colR('N_0_1', 7) + colR('N_1', 7) + colR('DIFF', 7);
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const [path, v] of reportRows) {
    console.log(
      col(path, 60) +
      colR(String(v.total), 7) +
      colR(String(v.EXACT), 7) +
      colR(String(v.NEAR_0_1), 7) +
      colR(String(v.NEAR_1), 7) +
      colR(String(v.DIFFERENT), 7)
    );
  }
  console.log();

  // ── STEP 3a — paths with EXACT pairs ──────────────────────────────────────
  const exactPaths = [...byPath.entries()]
    .filter(([, v]) => v.EXACT > 0)
    .sort((a, b) => b[1].EXACT - a[1].EXACT);

  console.log('STEP 3a — PATHS WITH EXACT PAIRS');
  console.log(sep);
  if (exactPaths.length === 0) {
    console.log('  (none)');
  } else {
    for (const [path, v] of exactPaths) {
      console.log(`  EXACT=${v.EXACT}  ${path}`);
    }
  }
  console.log();

  // ── STEP 3b — NEAR_0_1 pairs: every row printed ───────────────────────────
  const near01Rows = rows.filter((r) => r.bucket === 'NEAR_0_1');

  console.log('STEP 3b — NEAR_0_1 PAIRS (every row)');
  console.log(sep);
  if (near01Rows.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of near01Rows) {
      const is5830DA = (
        r.document_id === 5830 &&
        r.base_path === 'profit_and_loss.depreciation_amortisation'
      );
      const marker = is5830DA ? '  *** 5830 D&A PAIR ***' : '';
      console.log(`  doc=${r.document_id}  ev=${r.extraction_version}  path=${r.base_path}`);
      console.log(`    fy_earlier=${r.year_earlier}  val_earlier=${r.val_earlier}`);
      console.log(`    fy_later=${r.year_later}    val_later=${r.val_later}`);
      console.log(`    abs_diff=${r.abs_diff}  rel_diff=${r.rel_diff}${marker}`);
    }
  }
  console.log();

  // ── STEP 4a — NEAR_0_1 on GROUP A vs elsewhere ────────────────────────────
  const near01GroupA = near01Rows.filter((r) => GROUP_A_BASE_PATHS.has(r.base_path));
  const near01Other  = near01Rows.filter((r) => !GROUP_A_BASE_PATHS.has(r.base_path));

  console.log('STEP 4a — NEAR_0_1 PAIRS: GROUP A vs ELSEWHERE');
  console.log(sep);
  console.log(`  NEAR_0_1 on GROUP A valuation-critical paths: ${near01GroupA.length}`);
  if (near01GroupA.length > 0) {
    for (const r of near01GroupA) {
      console.log(`    doc=${r.document_id}  ev=${r.extraction_version}  ${r.base_path}  fy=${r.year_earlier}/${r.year_later}  vals=${r.val_earlier}/${r.val_later}`);
    }
  }
  console.log(`  NEAR_0_1 elsewhere:                           ${near01Other.length}`);
  if (near01Other.length > 0) {
    for (const r of near01Other) {
      console.log(`    doc=${r.document_id}  ev=${r.extraction_version}  ${r.base_path}  fy=${r.year_earlier}/${r.year_later}  vals=${r.val_earlier}/${r.val_later}`);
    }
  }
  console.log();

  // ── STEP 4b — denominator ─────────────────────────────────────────────────
  console.log('STEP 4b — TOTAL EVIDENCE FIGURES IN QUERIED POPULATION');
  console.log(sep);
  console.log(`  Total evidence figures (value IS NOT NULL):  ${totalFigures}`);
  console.log();

  console.log(hr);
  console.log('BLEED-CALIBRATION');
}

main().catch((e) => {
  console.error('[bleed-calibration] fatal:', e);
  process.exit(1);
});
