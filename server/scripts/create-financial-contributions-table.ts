import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(sql`SELECT current_database() AS db, inet_server_addr() AS host`);
  console.log('Connected:', res.rows[0]);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS financial_contributions (
      id serial PRIMARY KEY,
      target_company_id integer NOT NULL REFERENCES target_companies(id),
      fiscal_year integer,
      statement_type varchar(10) NOT NULL,
      source_document_id integer REFERENCES documents(id),
      source_tier varchar(30) NOT NULL,
      is_full_year boolean NOT NULL DEFAULT true,
      months_covered integer,
      period_end date,
      as_at_date date,
      figures jsonb NOT NULL,
      created_at timestamp DEFAULT now()
    )
  `);
  console.log('financial_contributions table created (IF NOT EXISTS)');

  const count = await db.execute(sql`SELECT COUNT(*) AS n FROM financial_contributions`);
  console.log('financial_contributions row count:', count.rows[0]);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
