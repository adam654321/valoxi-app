import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_model_seller_payments (
      id serial PRIMARY KEY,
      deal_model_id integer NOT NULL,
      payment_type varchar(50) NOT NULL DEFAULT 'fixed_schedule',
      amount decimal DEFAULT '0',
      term_months integer,
      interest_rate decimal,
      label varchar(255),
      include_in_dscr boolean NOT NULL DEFAULT true,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer DEFAULT 0,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT deal_model_seller_payments_deal_model_id_fk FOREIGN KEY (deal_model_id) REFERENCES deal_models(id)
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_model_contingent_consideration (
      id serial PRIMARY KEY,
      deal_model_id integer NOT NULL,
      consideration_type varchar(50) NOT NULL DEFAULT 'custom',
      maximum_amount decimal DEFAULT '0',
      term_months integer,
      trigger_description text,
      include_in_dscr boolean NOT NULL DEFAULT true,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer DEFAULT 0,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT deal_model_contingent_consideration_deal_model_id_fk FOREIGN KEY (deal_model_id) REFERENCES deal_models(id)
    );
  `);
  await db.execute(sql`
    ALTER TABLE deal_model_funding_lines
    ADD COLUMN IF NOT EXISTS repayment_structure varchar(50) NOT NULL DEFAULT 'amortizing';
  `);
  console.log('098 funding schema applied');
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
