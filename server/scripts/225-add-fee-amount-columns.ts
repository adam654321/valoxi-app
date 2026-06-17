import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add new amount columns
    await client.query(`
      ALTER TABLE deal_models
        ADD COLUMN IF NOT EXISTS fee_legal_dd_amount numeric,
        ADD COLUMN IF NOT EXISTS fee_accounting_dd_amount numeric,
        ADD COLUMN IF NOT EXISTS fee_loan_arrangement_amount numeric,
        ADD COLUMN IF NOT EXISTS fee_deal_maker_amount numeric,
        ADD COLUMN IF NOT EXISTS custom_fees jsonb NOT NULL DEFAULT '[]'
    `);

    // Drop broker columns
    await client.query(`
      ALTER TABLE deal_models
        DROP COLUMN IF EXISTS fee_broker_percent,
        DROP COLUMN IF EXISTS fee_broker_type
    `);

    await client.query('COMMIT');
    console.log('S1 schema changes committed');

    // Verify
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'deal_models'
      AND (column_name LIKE '%fee%' OR column_name = 'custom_fees')
      ORDER BY ordinal_position
    `);
    console.log('Columns after migration:');
    for (const r of rows) {
      console.log(`  ${r.column_name} (${r.data_type})`);
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
