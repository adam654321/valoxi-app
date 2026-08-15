/**
 * scripts/_audit1-r2-check.ts
 * AUDIT-1: R2 existence check for all evidence-bearing documents,
 * companies 1877, 1880, 1881. Read-only. No writes.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { fileStorageService } from '../server/services/file-storage.service';

async function main() {
  // Get one row per distinct document (not per fiscal year)
  const r = await db.execute<{
    document_id: number;
    company_id: number;
    filename: string;
    r2_key: string;
    document_category: string;
    fiscal_years: string;
  }>(sql`
    SELECT
      d.id                  AS document_id,
      d.target_company_id   AS company_id,
      d.original_filename   AS filename,
      d.file_path           AS r2_key,
      d.document_category,
      STRING_AGG(DISTINCT dep.fiscal_year_stated::text, ',' ORDER BY dep.fiscal_year_stated::text) AS fiscal_years
    FROM documents d
    JOIN document_evidence de  ON de.document_id          = d.id
    JOIN document_evidence_period dep ON dep.document_evidence_id = de.id
    WHERE d.target_company_id IN (1877, 1880, 1881)
    GROUP BY d.id, d.target_company_id, d.original_filename, d.file_path, d.document_category
    ORDER BY d.target_company_id, d.id
  `);

  const docs = r.rows;
  console.log(`Total distinct evidence-bearing documents: ${docs.length}`);
  console.log();

  let fetchable = 0;
  let notFetchable = 0;

  for (const doc of docs) {
    let ok = false;
    let bytes = 0;
    try {
      const buf = await fileStorageService.download(doc.r2_key);
      if (buf && buf.length > 0) {
        ok = true;
        bytes = buf.length;
      }
    } catch (_) {}

    const status = ok ? `FETCHABLE  bytes=${bytes}` : 'NOT FETCHABLE';
    const flag5878 = doc.document_id === 5878 ? '  <-- 5878 exclusion' : '';
    console.log(`doc=${doc.document_id}  co=${doc.company_id}  cat=${String(doc.document_category).padEnd(20)}  fy=[${doc.fiscal_years}]  ${status}${flag5878}`);
    console.log(`     file=${doc.filename}`);
    console.log(`     r2=${doc.r2_key}`);

    if (ok) fetchable++; else notFetchable++;
  }

  console.log();
  console.log(`FETCHABLE:     ${fetchable}`);
  console.log(`NOT FETCHABLE: ${notFetchable}`);
  console.log(`TOTAL:         ${docs.length}`);
  const expectedFetchable = 24;
  if (fetchable === expectedFetchable) {
    console.log(`Fetchable count matches brief expectation of ${expectedFetchable}.`);
  } else {
    console.log(`MISMATCH: brief expects ${expectedFetchable} fetchable, found ${fetchable}.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
