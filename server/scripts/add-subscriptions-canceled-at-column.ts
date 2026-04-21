import { sql } from 'drizzle-orm';
import { db } from '../db';

const EXECUTE = process.env.EXECUTE === 'true';

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE - writes will be committed' : 'DRY-RUN - no writes'}`);

  const statement = sql`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
  `;

  if (!EXECUTE) {
    console.log('Would run: ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at timestamptz;');
    return;
  }

  await db.execute(statement);
  console.log('subscriptions.canceled_at column added');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});