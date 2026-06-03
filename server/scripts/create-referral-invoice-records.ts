import { sql } from 'drizzle-orm';
import { db } from '../db';

const EXECUTE = process.env.EXECUTE === 'true';

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE - writes will be committed' : 'DRY-RUN - no writes'}`);

  const statement = sql`
    CREATE TABLE IF NOT EXISTS referral_invoice_records (
      id SERIAL PRIMARY KEY,
      user_company_id INTEGER NOT NULL REFERENCES user_companies(id),
      invoice_month VARCHAR(7) NOT NULL,
      amount_cents INTEGER NOT NULL,
      member_email VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT referral_invoice_records_user_company_id_unique UNIQUE (user_company_id)
    );
  `;

  if (!EXECUTE) {
    console.log('Would run: CREATE TABLE IF NOT EXISTS referral_invoice_records (... UNIQUE(user_company_id) ...)');
    return;
  }

  await db.execute(statement);
  console.log('referral_invoice_records table created');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
