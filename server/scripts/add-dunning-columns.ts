import { sql } from 'drizzle-orm';
import { db } from '../db';

const EXECUTE = process.env.EXECUTE === 'true';

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE - writes will be committed' : 'DRY-RUN - no writes'}`);

  const statement = sql`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS past_due_since timestamp,
    ADD COLUMN IF NOT EXISTS dunning_day7_email_sent_at timestamp
  `;

  if (!EXECUTE) {
    console.log('Would run: ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS past_due_since timestamp, ADD COLUMN IF NOT EXISTS dunning_day7_email_sent_at timestamp');
    return;
  }

  await db.execute(statement);
  console.log('Dunning columns added');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});