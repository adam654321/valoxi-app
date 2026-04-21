import { sql } from 'drizzle-orm';
import { db } from '../db';

const EXECUTE = process.env.EXECUTE === 'true';

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE - writes will be committed' : 'DRY-RUN - no writes'}`);

  const statement = sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS assigned_promo_campaign_id integer
    CONSTRAINT users_assigned_promo_campaign_id_promo_code_campaigns_id_fk
    REFERENCES promo_code_campaigns(id);
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS assigned_by_admin_id integer
    CONSTRAINT users_assigned_by_admin_id_users_id_fk
    REFERENCES users(id);
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
  `;

  if (!EXECUTE) {
    console.log('Would run: ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_promo_campaign_id integer CONSTRAINT users_assigned_promo_campaign_id_promo_code_campaigns_id_fk REFERENCES promo_code_campaigns(id); ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_by_admin_id integer CONSTRAINT users_assigned_by_admin_id_users_id_fk REFERENCES users(id); ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_at timestamptz;');
    return;
  }

  await db.execute(statement);
  console.log('User promo assignment columns added');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});