/**
 * scripts/_primary-vs-comparative.ts
 * PRIMARY-VS-COMPARATIVE — read-only evidence assessment.
 * No writes, no API calls.
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const hr  = '='.repeat(80);
const sep = '-'.repeat(80);

// The four fields for disagreement checking (base paths)
const WATCH_FIELDS = [
  'profit_and_loss.depreciation_amortisation',
  'profit_and_loss.revenue',
  'profit_and_loss.operating_profit',
  'profit_and_loss.net_profit',
] as const;

async function main() {

  // ── STEP 1 — doc 5831 at every extraction_version ─────────────────────────
  const s1 = await db.execute<{
    document_id: number;
    extraction_version: number;
    fiscal_year_stated: number;
    max_year_in_doc_ev: number;
    base_path: string;
    val: string;
  }>(sql`
    WITH doc_years AS (
      SELECT
        de.id        AS evidence_id,
        de.document_id,
        de.extraction_version,
        dep.fiscal_year_stated,
        MAX(dep.fiscal_year_stated) OVER (PARTITION BY de.document_id, de.extraction_version) AS max_year_in_doc_ev
      FROM document_evidence de
      JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
      WHERE de.document_id = 5831
    ),
    figs AS (
      SELECT
        dy.document_id,
        dy.extraction_version,
        dy.fiscal_year_stated,
        dy.max_year_in_doc_ev,
        regexp_replace(def.payload_path, '^years\\.\\d+\\.', '') AS base_path,
        def.value::text AS val
      FROM doc_years dy
      JOIN document_evidence_figure def ON def.document_evidence_period_id = (
        SELECT dep2.id FROM document_evidence_period dep2
        WHERE dep2.document_evidence_id = dy.evidence_id
          AND dep2.fiscal_year_stated    = dy.fiscal_year_stated
        LIMIT 1
      )
      WHERE regexp_replace(def.payload_path, '^years\\.\\d+\\.', '') IN (
        'profit_and_loss.depreciation_amortisation',
        'profit_and_loss.revenue',
        'profit_and_loss.operating_profit',
        'profit_and_loss.net_profit'
      )
    )
    SELECT DISTINCT * FROM figs
    ORDER BY extraction_version, fiscal_year_stated, base_path
  `);

  console.log(hr);
  console.log('PRIMARY-VS-COMPARATIVE');
  console.log(hr);
  console.log();
  console.log('STEP 1 — Document 5831 (all extraction_versions)');
  console.log(sep);

  // Pivot: (ev, fy) → field → value
  const s1map = new Map<string, Map<string, string>>();
  let s1maxYearByEv = new Map<number, number>();
  for (const r of s1.rows) {
    const k = `ev=${r.extraction_version}|fy=${r.fiscal_year_stated}`;
    if (!s1map.has(k)) s1map.set(k, new Map());
    s1map.get(k)!.set(r.base_path, r.val);
    s1maxYearByEv.set(r.extraction_version, Math.max(s1maxYearByEv.get(r.extraction_version) ?? 0, r.fiscal_year_stated));
  }

  // Get unique (ev, fy) combos sorted
  const s1combos = [...s1map.keys()].sort();
  const fieldShort = (p: string) => p.replace('profit_and_loss.', '');
  const FIELDS = [
    'profit_and_loss.depreciation_amortisation',
    'profit_and_loss.revenue',
    'profit_and_loss.operating_profit',
    'profit_and_loss.net_profit',
  ];

  console.log(`  ${'ev/fy'.padEnd(14)} ${'d_a'.padStart(10)} ${'revenue'.padStart(12)} ${'op_profit'.padStart(12)} ${'net_profit'.padStart(12)}  is_max?`);
  console.log('  ' + '-'.repeat(70));
  for (const k of s1combos) {
    const [evPart, fyPart] = k.split('|');
    const ev = parseInt(evPart.replace('ev=', ''));
    const fy = parseInt(fyPart.replace('fy=', ''));
    const maxY = s1maxYearByEv.get(ev) ?? 0;
    const fmap = s1map.get(k)!;
    const vals = FIELDS.map((f) => (fmap.get(f) ?? 'null').padStart(12));
    console.log(`  ${k.padEnd(14)} ${vals.join('')}  ${fy === maxY ? 'PRIMARY (max)' : 'comparative'}`);
  }
  // State the max year per ev
  console.log();
  for (const [ev, maxY] of [...s1maxYearByEv.entries()].sort()) {
    console.log(`  extraction_version=${ev}: maximum fiscal_year_stated = ${maxY}`);
  }
  console.log();

  // ── STEP 2 — doc 5830 at latest extraction_version ────────────────────────
  const s2 = await db.execute<{
    extraction_version: number;
    fiscal_year_stated: number;
    max_year_in_doc: number;
    base_path: string;
    val: string;
  }>(sql`
    WITH latest_ev AS (
      SELECT MAX(extraction_version) AS ev FROM document_evidence WHERE document_id = 5830
    ),
    doc_years AS (
      SELECT
        de.id        AS evidence_id,
        de.document_id,
        de.extraction_version,
        dep.fiscal_year_stated,
        MAX(dep.fiscal_year_stated) OVER (PARTITION BY de.document_id, de.extraction_version) AS max_year_in_doc
      FROM document_evidence de
      JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
      WHERE de.document_id = 5830
        AND de.extraction_version = (SELECT ev FROM latest_ev)
    ),
    figs AS (
      SELECT
        dy.extraction_version,
        dy.fiscal_year_stated,
        dy.max_year_in_doc,
        regexp_replace(def.payload_path, '^years\\.\\d+\\.', '') AS base_path,
        def.value::text AS val
      FROM doc_years dy
      JOIN document_evidence_figure def ON def.document_evidence_period_id = (
        SELECT dep2.id FROM document_evidence_period dep2
        WHERE dep2.document_evidence_id = dy.evidence_id
          AND dep2.fiscal_year_stated    = dy.fiscal_year_stated
        LIMIT 1
      )
      WHERE regexp_replace(def.payload_path, '^years\\.\\d+\\.', '') IN (
        'profit_and_loss.depreciation_amortisation',
        'profit_and_loss.revenue',
        'profit_and_loss.operating_profit',
        'profit_and_loss.net_profit'
      )
    )
    SELECT DISTINCT * FROM figs
    ORDER BY fiscal_year_stated, base_path
  `);

  console.log('STEP 2 — Document 5830 (latest extraction_version only)');
  console.log(sep);

  const s2map  = new Map<number, Map<string, string>>();
  let s2maxYear = 0;
  let s2ev = 0;
  for (const r of s2.rows) {
    if (!s2map.has(r.fiscal_year_stated)) s2map.set(r.fiscal_year_stated, new Map());
    s2map.get(r.fiscal_year_stated)!.set(r.base_path, r.val);
    s2maxYear = Math.max(s2maxYear, r.fiscal_year_stated);
    s2ev = r.extraction_version;
  }
  console.log(`  extraction_version used: ${s2ev}   maximum fiscal_year_stated: ${s2maxYear}`);
  console.log();
  console.log(`  ${'fy'.padEnd(8)} ${'d_a'.padStart(10)} ${'revenue'.padStart(12)} ${'op_profit'.padStart(12)} ${'net_profit'.padStart(12)}  is_max?`);
  console.log('  ' + '-'.repeat(68));
  for (const [fy, fmap] of [...s2map.entries()].sort((a, b) => a[0] - b[0])) {
    const vals = FIELDS.map((f) => (fmap.get(f) ?? 'null').padStart(12));
    console.log(`  ${String(fy).padEnd(8)} ${vals.join('')}  ${fy === s2maxYear ? 'PRIMARY (max)' : 'comparative'}`);
  }
  console.log();

  // ── STEP 3 — (company, fiscal_year) across 1877/1880/1881 ────────────────
  // For each document at its latest extraction_version, determine max fiscal year
  // and classify each (doc, fiscal_year) as primary or comparative.
  const s3 = await db.execute<{
    target_company_id: number;
    document_id: number;
    fiscal_year_stated: number;
    max_year_in_doc: number;
    is_primary: boolean;
    d_a: string;
    revenue: string;
    op_profit: string;
    net_profit: string;
  }>(sql`
    WITH latest_ev_per_doc AS (
      SELECT document_id, MAX(extraction_version) AS ev
      FROM document_evidence
      WHERE target_company_id IN (1877, 1880, 1881)
      GROUP BY document_id
    ),
    doc_periods AS (
      SELECT
        de.target_company_id,
        de.document_id,
        de.extraction_version,
        dep.id   AS period_id,
        dep.fiscal_year_stated,
        MAX(dep.fiscal_year_stated) OVER (PARTITION BY de.document_id, de.extraction_version) AS max_year_in_doc
      FROM document_evidence de
      JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
      JOIN latest_ev_per_doc l ON l.document_id = de.document_id AND l.ev = de.extraction_version
    ),
    figs_raw AS (
      SELECT
        dp.target_company_id,
        dp.document_id,
        dp.fiscal_year_stated,
        dp.max_year_in_doc,
        MAX(CASE WHEN regexp_replace(def.payload_path,'^years\\.\\d+\\.','') = 'profit_and_loss.depreciation_amortisation' THEN def.value::text END) AS d_a,
        MAX(CASE WHEN regexp_replace(def.payload_path,'^years\\.\\d+\\.','') = 'profit_and_loss.revenue'                  THEN def.value::text END) AS revenue,
        MAX(CASE WHEN regexp_replace(def.payload_path,'^years\\.\\d+\\.','') = 'profit_and_loss.operating_profit'         THEN def.value::text END) AS op_profit,
        MAX(CASE WHEN regexp_replace(def.payload_path,'^years\\.\\d+\\.','') = 'profit_and_loss.net_profit'               THEN def.value::text END) AS net_profit
      FROM doc_periods dp
      JOIN document_evidence_figure def ON def.document_evidence_period_id = dp.period_id
      GROUP BY dp.target_company_id, dp.document_id, dp.fiscal_year_stated, dp.max_year_in_doc
    )
    SELECT
      target_company_id,
      document_id,
      fiscal_year_stated,
      max_year_in_doc,
      (fiscal_year_stated = max_year_in_doc) AS is_primary,
      d_a,
      revenue,
      op_profit,
      net_profit
    FROM figs_raw
    ORDER BY target_company_id, fiscal_year_stated, document_id
  `);

  console.log('STEP 3 — (company, fiscal_year) source inventory');
  console.log('(latest extraction_version per document; primary = year is max in that document)');
  console.log(sep);

  // Group by (company, fiscal_year)
  const byCoFy = new Map<string, typeof s3.rows>();
  for (const r of s3.rows) {
    const k = `co=${r.target_company_id}|fy=${r.fiscal_year_stated}`;
    if (!byCoFy.has(k)) byCoFy.set(k, []);
    byCoFy.get(k)!.push(r);
  }

  console.log(`  ${'company'.padEnd(8)} ${'fy'.padEnd(6)} ${'doc_id'.padEnd(8)} ${'role'.padEnd(14)} ${'d_a'.padStart(10)} ${'revenue'.padStart(12)} ${'op_profit'.padStart(12)} ${'net_profit'.padStart(12)}`);
  console.log('  ' + '-'.repeat(84));

  const sortedKeys = [...byCoFy.keys()].sort();
  for (const k of sortedKeys) {
    const rows = byCoFy.get(k)!;
    for (const r of rows) {
      const role = r.is_primary ? 'PRIMARY' : 'comparative';
      console.log(
        `  ${String(r.target_company_id).padEnd(8)} ${String(r.fiscal_year_stated).padEnd(6)} ${String(r.document_id).padEnd(8)} ${role.padEnd(14)}` +
        ` ${(r.d_a ?? 'null').padStart(10)} ${(r.revenue ?? 'null').padStart(12)} ${(r.op_profit ?? 'null').padStart(12)} ${(r.net_profit ?? 'null').padStart(12)}`
      );
    }
  }
  console.log();

  // ── STEP 4 — arithmetic ───────────────────────────────────────────────────
  console.log('STEP 4 — primary vs comparative-only counts');
  console.log(sep);

  let withPrimary = 0;
  let comparativeOnly = 0;
  for (const k of sortedKeys) {
    const rows = byCoFy.get(k)!;
    const hasPrimary = rows.some((r) => r.is_primary);
    if (hasPrimary) withPrimary++;
    else comparativeOnly++;
  }
  const totalCoFy = sortedKeys.length;
  console.log(`  Total distinct (company, fiscal_year) combinations:        ${totalCoFy}`);
  console.log(`  With at least one primary source:                          ${withPrimary}`);
  console.log(`  Exist only as comparatives (no primary source):            ${comparativeOnly}`);
  console.log(`  Check: ${withPrimary} + ${comparativeOnly} = ${withPrimary + comparativeOnly} (should equal ${totalCoFy})`);
  console.log();

  // ── STEP 5 — disagreements where both primary and comparative exist ────────
  console.log('STEP 5 — disagreements on watch fields where primary AND comparative both present');
  console.log(sep);

  let disagreeFound = false;
  for (const k of sortedKeys) {
    const rows = byCoFy.get(k)!;
    const primaries   = rows.filter((r) => r.is_primary);
    const comparatives = rows.filter((r) => !r.is_primary);
    if (primaries.length === 0 || comparatives.length === 0) continue;

    const [coPart, fyPart] = k.split('|');
    const fy = fyPart.replace('fy=', '');
    const co = coPart.replace('co=', '');

    // Compare each primary × comparative combination on each watch field
    for (const p of primaries) {
      for (const c of comparatives) {
        const fieldPairs: [string, string | null, string | null][] = [
          ['profit_and_loss.depreciation_amortisation', p.d_a, c.d_a],
          ['profit_and_loss.revenue',                   p.revenue, c.revenue],
          ['profit_and_loss.operating_profit',          p.op_profit, c.op_profit],
          ['profit_and_loss.net_profit',                p.net_profit, c.net_profit],
        ];
        for (const [field, pVal, cVal] of fieldPairs) {
          if (pVal === null && cVal === null) continue;
          if (pVal === cVal) continue;
          // They differ (or one is null)
          disagreeFound = true;
          console.log(`  company=${co}  fy=${fy}  field=${field}`);
          console.log(`    PRIMARY   doc=${p.document_id}  value=${pVal ?? 'null'}`);
          console.log(`    compar.   doc=${c.document_id}  value=${cVal ?? 'null'}`);
        }
      }
    }
  }

  if (!disagreeFound) {
    console.log('  (no disagreements found on any watch field)');
  }

  console.log();
  console.log(hr);
  console.log('PRIMARY-VS-COMPARATIVE');
}

main().catch((e) => {
  console.error('[primary-vs-comparative] fatal:', e);
  process.exit(1);
});
