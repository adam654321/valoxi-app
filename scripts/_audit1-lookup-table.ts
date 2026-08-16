import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // target_companies for 1877, 1880, 1881 — join user_companies (owner org) and
  // resolve created_by, stage_updated_by to user names
  const cos = await db.execute(sql`
    SELECT
      tc.id,
      tc.company_name,
      tc.user_company_id,
      uc.company_name   AS owner_org,
      tc.created_by,
      cb.first_name || ' ' || cb.last_name AS created_by_name,
      tc.stage_updated_by,
      sb.first_name || ' ' || sb.last_name AS stage_updated_by_name,
      tc.initial_discussion_by,
      ib.first_name || ' ' || ib.last_name AS initial_discussion_by_name,
      tc.stage
    FROM target_companies tc
    LEFT JOIN user_companies uc ON uc.id = tc.user_company_id
    LEFT JOIN users cb ON cb.id = tc.created_by
    LEFT JOIN users sb ON sb.id = tc.stage_updated_by
    LEFT JOIN users ib ON ib.id = tc.initial_discussion_by
    WHERE tc.id IN (1877, 1880, 1881)
    ORDER BY tc.id
  `);

  console.log('\n=== COMPANIES ===');
  for (const r of cos.rows as any[]) {
    console.log(JSON.stringify(r));
  }

  // All documents for these three companies
  const docs = await db.execute(sql`
    SELECT
      d.id              AS document_id,
      d.target_company_id AS company_id,
      d.original_filename,
      d.document_category,
      d.uploaded_by,
      u.first_name || ' ' || u.last_name AS uploaded_by_name
    FROM documents d
    LEFT JOIN users u ON u.id = d.uploaded_by
    WHERE d.target_company_id IN (1877, 1880, 1881)
    ORDER BY d.target_company_id, d.id
  `);

  console.log('\n=== DOCUMENTS ===');
  for (const r of docs.rows as any[]) {
    console.log(JSON.stringify(r));
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
