/**
 * One-shot migration: add is_full_year boolean NOT NULL DEFAULT true to income_statements.
 * Safe to re-run — uses ADD COLUMN IF NOT EXISTS.
 * Dev DB only — aborts if DATABASE_URL contains the prod fingerprint.
 */
import pg from 'pg';

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.includes('ep-old-recipe')) throw new Error('ABORT: DATABASE_URL looks like prod. Refusing.');

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'income_statements' AND column_name = 'is_full_year'
    `);

    if (existing.length > 0) {
      console.log('Column income_statements.is_full_year already exists — nothing to do.');
    } else {
      await client.query(`
        ALTER TABLE income_statements
        ADD COLUMN is_full_year boolean NOT NULL DEFAULT true
      `);
      console.log('✓ Added income_statements.is_full_year boolean NOT NULL DEFAULT true');
    }

    const { rows: stats } = await client.query(`
      SELECT COUNT(*)::int AS total,
             SUM(CASE WHEN is_full_year THEN 1 ELSE 0 END)::int AS full_year_count
      FROM income_statements
    `);
    console.log(`  Rows: ${stats[0].total}  is_full_year=true: ${stats[0].full_year_count}  is_full_year=false: ${stats[0].total - stats[0].full_year_count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
