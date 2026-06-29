import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'deal_models' ORDER BY ordinal_position`
    );
    const guard = await client.query(
      `SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 1`
    );
    const env = guard.rows[0]?.last_name === 'Coxon' ? 'PROD' : 'DEV';
    console.log(`${env} deal_models columns:`, res.rows.map((r: any) => r.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}
main();
