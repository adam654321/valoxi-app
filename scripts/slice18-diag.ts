/**
 * scripts/slice18-diag.ts
 *
 * For tc=220 (Canoports) and tc=137 (Manor), list EVERY FY2026 income-statement
 * period with its source document, period_end, months_covered, is_full_year,
 * period_type, and computed EBITDA.  Read-only against prod.
 *
 * Run: npx tsx scripts/slice18-diag.ts
 */

import pg from 'pg';

pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const fmtGBP = (n: number | null) =>
  n == null ? 'NULL' : `£${Math.round(n).toLocaleString('en-GB')}`;

async function probe(tcId: number, label: string): Promise<void> {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`tc=${tcId}  ${label}`);
  console.log('─'.repeat(72));

  // Every FY2026 financial_period that has an income_statement row,
  // plus its source documents (from the period AND the income_statement rows).
  // Uses only columns confirmed to exist on prod.
  const { rows } = await prodPool.query(`
    SELECT
      fp.id                AS period_id,
      fp.fiscal_year,
      fp.period_start,
      fp.period_end,
      fp.months_covered,
      fp.is_full_year,
      fp.period_type,
      fp.source_document_id  AS period_doc_id,
      pd.original_filename   AS period_doc_filename,
      pd.document_name       AS period_doc_name,
      pd.document_category   AS period_doc_category,
      is_.id                 AS is_id,
      is_.source_document_id AS is_doc_id,
      idd.original_filename  AS is_doc_filename,
      idd.document_name      AS is_doc_name,
      idd.document_category  AS is_doc_category,
      is_.operating_profit,
      is_.depreciation_amortisation,
      COALESCE(is_.operating_profit,0)
        + COALESCE(is_.depreciation_amortisation,0)  AS ebitda
    FROM financial_periods fp
    JOIN income_statements is_
      ON is_.financial_period_id = fp.id
    LEFT JOIN documents pd
      ON pd.id = fp.source_document_id
    LEFT JOIN documents idd
      ON idd.id = is_.source_document_id
    WHERE fp.target_company_id = $1
      AND fp.fiscal_year = 2026
    ORDER BY fp.id, is_.id
  `, [tcId]);

  console.log(`\nFY2026 income_statement rows (${rows.length}):`);
  for (const r of rows) {
    const pFile = r.period_doc_filename ?? r.period_doc_name ?? '(none)';
    const iFile = r.is_doc_filename    ?? r.is_doc_name     ?? '(none)';
    // If the income_statement has no source_document_id, it falls back
    // to the period's source_document_id for document attribution.
    const effectiveDocId   = r.is_doc_id   ?? r.period_doc_id;
    const effectiveDocFile = (r.is_doc_filename ?? r.is_doc_name) ? iFile : pFile;
    const sameDoc = r.period_doc_id != null && r.period_doc_id === r.is_doc_id;
    console.log(`
  period_id       : ${r.period_id}
  period_start    : ${r.period_start ?? 'NULL'}
  period_end      : ${r.period_end ?? 'NULL'}
  months_covered  : ${r.months_covered ?? 'NULL'}
  is_full_year    : ${r.is_full_year}
  period_type     : ${r.period_type}
  period doc      : id=${r.period_doc_id ?? 'NULL'}  cat=${r.period_doc_category ?? '?'}
                    "${pFile}"
  IS doc          : id=${r.is_doc_id ?? 'NULL'}  cat=${r.is_doc_category ?? '?'}  same_as_period_doc=${sameDoc}
                    "${iFile}"
  effective doc   : id=${effectiveDocId ?? 'NULL'}  "${effectiveDocFile}"
  op_profit       : ${r.operating_profit ?? 'NULL'}
  D&A             : ${r.depreciation_amortisation ?? 'NULL'}
  EBITDA          : ${fmtGBP(Number(r.ebitda))}`);
  }

  // All documents that are referenced by ANY FY2026 period for this company
  const { rows: docs } = await prodPool.query(`
    SELECT DISTINCT d.id, d.original_filename, d.document_name,
                    d.document_category
    FROM documents d
    WHERE d.target_company_id = $1
      AND (
        d.id IN (
          SELECT DISTINCT source_document_id
          FROM financial_periods
          WHERE target_company_id = $1 AND fiscal_year = 2026
            AND source_document_id IS NOT NULL
        )
        OR d.id IN (
          SELECT DISTINCT is_.source_document_id
          FROM income_statements is_
          JOIN financial_periods fp ON fp.id = is_.financial_period_id
          WHERE fp.target_company_id = $1 AND fp.fiscal_year = 2026
            AND is_.source_document_id IS NOT NULL
        )
      )
    ORDER BY d.id
  `, [tcId]);

  console.log(`\nDistinct documents referenced by FY2026 data (${docs.length}):`);
  for (const d of docs) {
    const fname = d.original_filename ?? d.document_name ?? '(none)';
    console.log(`  doc ${d.id}:  cat=${d.document_category ?? '?'}  "${fname}"`);
  }

  // Count ALL FY2026 periods (even without income_statements, to spot orphans)
  const { rows: allPeriods } = await prodPool.query(`
    SELECT fp.id, fp.period_end, fp.is_full_year, fp.period_type, fp.months_covered,
           pd.original_filename AS doc_filename, pd.document_name AS doc_name,
           (SELECT COUNT(*) FROM income_statements WHERE financial_period_id = fp.id) AS is_count
    FROM financial_periods fp
    LEFT JOIN documents pd ON pd.id = fp.source_document_id
    WHERE fp.target_company_id = $1 AND fp.fiscal_year = 2026
    ORDER BY fp.id
  `, [tcId]);

  console.log(`\nALL FY2026 periods incl. those without income_statements (${allPeriods.length}):`);
  for (const p of allPeriods) {
    const fname = p.doc_filename ?? p.doc_name ?? '(none)';
    console.log(`  period ${p.id}: end=${p.period_end ?? 'NULL'}  months=${p.months_covered ?? 'NULL'}  full_year=${p.is_full_year}  type=${p.period_type}  IS_rows=${p.is_count}  doc="${fname}"`);
  }
}

async function main(): Promise<void> {
  const prodUrl = process.env.PROD_DATABASE_URL ?? '';
  if (!prodUrl.includes('ep-old-recipe'))
    throw new Error('ABORT: PROD_DATABASE_URL missing fingerprint (ep-old-recipe)');
  console.log('PROD read-only  host=ep-old-recipe\n');

  await probe(220, 'Canoports (active)');
  await probe(137, 'Manor Building Solutions');

  await prodPool.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
