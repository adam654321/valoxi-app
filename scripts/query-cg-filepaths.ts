#!/usr/bin/env tsx
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  if (!process.env.PROD_DATABASE_URL?.includes('ep-old-recipe')) throw new Error('Not prod!');
  const { rows } = await pool.query(`
    SELECT id, document_name, document_category, file_path, file_size, file_type
    FROM documents WHERE target_company_id = 138 ORDER BY id
  `);
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
