import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE deal_models
        ADD COLUMN IF NOT EXISTS offer_driver varchar(20) DEFAULT 'ebitda',
        ADD COLUMN IF NOT EXISTS target_offer_price numeric
    `);

    await client.query('COMMIT');
    console.log('226 schema changes committed');

    const { rows } = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'deal_models'
        AND column_name IN ('offer_driver', 'target_offer_price')
      ORDER BY ordinal_position
    `);
    console.log('Columns after migration:');
    for (const r of rows) {
      console.log(`  ${r.column_name} (${r.data_type}) default=${r.column_default}`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ROLLED BACK:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
