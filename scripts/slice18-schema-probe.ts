import pg from 'pg';
pg.types.setTypeParser(114, (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;
const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
async function cols(tbl: string) {
  const { rows } = await prod.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [tbl]);
  console.log(`${tbl}: ${rows.map((r: any) => r.column_name).join(', ')}`);
}
await cols('financial_periods');
await cols('financial_contributions');
await cols('income_statements');
await prod.end();
