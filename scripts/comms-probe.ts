/**
 * Probe script: inspect offer document_data keys + clean up orphaned dev clones
 */
import pg from 'pg';
pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false } });

async function main() {
  // 1. Inspect deal_documents offer shape
  console.log('=== deal_documents offer_letter / heads_of_terms document_data keys ===');
  const { rows: dd } = await prodPool.query(`
    SELECT id, document_type, document_data
    FROM deal_documents
    WHERE document_type IN ('offer_letter','heads_of_terms')
      AND document_data IS NOT NULL
    LIMIT 5
  `);
  for (const r of dd) {
    try {
      const d = JSON.parse(r.document_data as string);
      console.log(`  id=${r.id} type=${r.document_type} keys: ${Object.keys(d).join(', ')}`);
      // Print any EV-like keys
      for (const k of Object.keys(d)) {
        if (/ev|enterprise|value|price|offer/i.test(k)) {
          console.log(`    ${k}: ${JSON.stringify(d[k])?.substring(0,80)}`);
        }
      }
    } catch { console.log(`  id=${r.id} document_data parse error`); }
  }

  // 2. Inspect current_offers
  console.log('\n=== current_offers ===');
  const { rows: co } = await prodPool.query(`SELECT id, enterprise_value, offer_price FROM current_offers LIMIT 5`).catch(() => ({ rows: [] }));
  for (const r of co) {
    console.log(`  id=${r.id} enterprise_value=${r.enterprise_value} offer_price=${r.offer_price}`);
  }

  // 3. Orphaned dev clones
  console.log('\n=== Orphaned [COMMS-ANALYSIS] dev clones ===');
  const { rows: orph } = await devPool.query(`SELECT id, company_name FROM target_companies WHERE company_name LIKE '[COMMS-ANALYSIS]%' ORDER BY id`);
  console.log(`  Count: ${orph.length}`);
  for (const r of orph) {
    console.log(`  tc_id=${r.id}  ${r.company_name}`);
  }

  // 4. Clean them up
  if (orph.length > 0) {
    console.log('\n  Cleaning up orphans...');
    const devClient = await devPool.connect();
    try {
      for (const r of orph) {
        const id = r.id as number;
        await devClient.query('DELETE FROM financial_contributions WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM ebitda_adjustments WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM staff_data WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM income_statements WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM balance_sheets WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM financial_periods WHERE target_company_id = $1', [id]);
        await devClient.query(`DELETE FROM deal_model_contingent_consideration WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [id]);
        await devClient.query(`DELETE FROM deal_model_seller_payments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [id]);
        await devClient.query(`DELETE FROM deal_model_funding_lines WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [id]);
        await devClient.query(`DELETE FROM deal_model_adjustments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)`, [id]);
        await devClient.query('DELETE FROM deal_models WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM documents WHERE target_company_id = $1', [id]);
        await devClient.query('DELETE FROM target_companies WHERE id = $1', [id]);
        process.stdout.write(`  deleted tc=${id}\n`);
      }
    } finally { devClient.release(); }
    console.log('  Done.');
  }
}

main()
  .catch(e => console.error('Fatal:', e))
  .finally(async () => { await prodPool.end(); await devPool.end(); });
