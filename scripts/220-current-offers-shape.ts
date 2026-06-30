import pg from 'pg';
const { Pool } = pg;

// READ-ONLY — SELECT only. No INSERT/UPDATE/DELETE/ALTER/DDL.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Identity guard
    const guard = await client.query(
      `SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 3`);
    const names = guard.rows.map((r: any) => r.last_name);
    const env = names.includes('Coxon') ? 'PROD' : names.includes('David') ? 'DEV' : 'UNKNOWN';
    console.log(`\n=== IDENTITY GUARD: [${names.join(', ')}] — branch = ${env} ===\n`);

    // ── 1. All current_offers rows: typed columns ─────────────────────────────
    console.log('═'.repeat(70));
    console.log('PART 1: current_offers typed columns (id, deal_model_id, status, offer_price, enterprise_value)');
    console.log('═'.repeat(70));

    const rows = await client.query(`
      SELECT
        id,
        deal_model_id,
        target_company_id,
        user_company_id,
        status,
        sent_at,
        accepted_at,
        offer_price,
        enterprise_value,
        delivery_method,
        (document_data IS NULL) AS document_data_is_null,
        document_data
      FROM current_offers
      ORDER BY id
    `);

    for (const r of rows.rows) {
      console.log(`\n  offer id=${r.id}  deal_model_id=${r.deal_model_id ?? 'NULL'}  target_company_id=${r.target_company_id}  user_company_id=${r.user_company_id}`);
      console.log(`  status=${r.status}  delivery_method=${r.delivery_method ?? 'NULL'}`);
      console.log(`  sent_at=${r.sent_at ? new Date(r.sent_at).toISOString() : 'NULL'}  accepted_at=${r.accepted_at ? new Date(r.accepted_at).toISOString() : 'NULL'}`);
      console.log(`  offer_price=${r.offer_price ?? 'NULL'}  (type=${typeof r.offer_price})`);
      console.log(`  enterprise_value=${r.enterprise_value ?? 'NULL'}  (type=${typeof r.enterprise_value})`);
      console.log(`  document_data IS NULL: ${r.document_data_is_null}`);
    }

    // ── 2. document_data top-level keys per row ───────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log('PART 2: document_data top-level keys per row');
    console.log('═'.repeat(70));

    const keysRes = await client.query(`
      SELECT id, jsonb_object_keys(document_data) AS k
      FROM current_offers
      WHERE document_data IS NOT NULL
      ORDER BY id, k
    `);

    const keysByRow: Record<number, string[]> = {};
    for (const r of keysRes.rows) {
      if (!keysByRow[r.id]) keysByRow[r.id] = [];
      keysByRow[r.id].push(r.k);
    }

    for (const [offerId, keys] of Object.entries(keysByRow)) {
      console.log(`\n  offer id=${offerId}  keys: ${keys.join(', ')}`);
    }

    // ── 3. Price-like keys extracted from document_data ───────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log('PART 3: price-like values from document_data (up to 5 rows)');
    console.log('═'.repeat(70));

    const priceRes = await client.query(`
      SELECT
        id,
        deal_model_id,
        document_data->>'offerPrice'         AS dd_offer_price,
        document_data->>'enterpriseValue'    AS dd_enterprise_value,
        document_data->>'totalPurchasePrice' AS dd_total_purchase_price,
        document_data->>'dayOnePayment'      AS dd_day_one_payment,
        document_data->>'deferredTotal'      AS dd_deferred_total,
        document_data->'_raw'->>'offerPrice'         AS raw_offer_price,
        document_data->'_raw'->>'enterpriseValue'    AS raw_enterprise_value
      FROM current_offers
      WHERE document_data IS NOT NULL
      ORDER BY id
      LIMIT 5
    `);

    for (const r of priceRes.rows) {
      console.log(`\n  offer id=${r.id}  deal_model_id=${r.deal_model_id}`);
      console.log(`  document_data.offerPrice         = ${r.dd_offer_price ?? 'NULL'}`);
      console.log(`  document_data.enterpriseValue    = ${r.dd_enterprise_value ?? 'NULL'}`);
      console.log(`  document_data.totalPurchasePrice = ${r.dd_total_purchase_price ?? 'NULL'}`);
      console.log(`  document_data.dayOnePayment      = ${r.dd_day_one_payment ?? 'NULL'}`);
      console.log(`  document_data.deferredTotal      = ${r.dd_deferred_total ?? 'NULL'}`);
      console.log(`  document_data._raw.offerPrice    = ${r.raw_offer_price ?? 'NULL'}`);
      console.log(`  document_data._raw.enterpriseValue = ${r.raw_enterprise_value ?? 'NULL'}`);
    }

    // ── 4. NULL analysis summary ──────────────────────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log('PART 4: NULL analysis summary');
    console.log('═'.repeat(70));

    const summary = await client.query(`
      SELECT
        COUNT(*)::int                                                  AS total_rows,
        COUNT(*) FILTER (WHERE offer_price IS NULL)::int              AS offer_price_null,
        COUNT(*) FILTER (WHERE offer_price IS NOT NULL)::int          AS offer_price_populated,
        COUNT(*) FILTER (WHERE enterprise_value IS NULL)::int         AS ev_null,
        COUNT(*) FILTER (WHERE enterprise_value IS NOT NULL)::int     AS ev_populated,
        COUNT(*) FILTER (WHERE document_data IS NULL)::int            AS doc_data_null,
        COUNT(*) FILTER (WHERE document_data IS NOT NULL)::int        AS doc_data_populated,
        COUNT(*) FILTER (WHERE document_data->>'offerPrice' IS NULL)::int   AS dd_offer_price_null,
        COUNT(*) FILTER (WHERE document_data->>'offerPrice' IS NOT NULL)::int AS dd_offer_price_populated
      FROM current_offers
    `);

    const s = summary.rows[0];
    console.log(`\n  Total rows:              ${s.total_rows}`);
    console.log(`  offer_price NULL:        ${s.offer_price_null} / ${s.total_rows}`);
    console.log(`  offer_price populated:   ${s.offer_price_populated} / ${s.total_rows}`);
    console.log(`  enterprise_value NULL:   ${s.ev_null} / ${s.total_rows}`);
    console.log(`  enterprise_value populated: ${s.ev_populated} / ${s.total_rows}`);
    console.log(`  document_data NULL:      ${s.doc_data_null} / ${s.total_rows}`);
    console.log(`  document_data populated: ${s.doc_data_populated} / ${s.total_rows}`);
    console.log(`  document_data.offerPrice NULL:      ${s.dd_offer_price_null} / ${s.doc_data_populated} (of non-null doc_data rows)`);
    console.log(`  document_data.offerPrice populated: ${s.dd_offer_price_populated} / ${s.doc_data_populated}`);

    console.log(`\n${'═'.repeat(70)}`);
    console.log('=== WRITE-SAFETY CONFIRMATION ===');
    console.log('  SELECT only. No INSERT/UPDATE/DELETE/ALTER/DDL.');
    console.log(`${'═'.repeat(70)}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
