import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Migrate all four fees
    // Legal DD and Accounting DD: all rows are fixed, direct copy
    // Loan Arrangement and Deal Maker: CASE on type — fixed = direct copy, percent = total_purchase_price * percent / 100
    const result = await client.query(`
      UPDATE deal_models SET
        fee_legal_dd_amount = CASE
          WHEN fee_legal_dd_type = 'fixed' THEN fee_legal_dd_percent
          ELSE COALESCE(total_purchase_price, 0) * fee_legal_dd_percent / 100
        END,
        fee_accounting_dd_amount = CASE
          WHEN fee_accounting_dd_type = 'fixed' THEN fee_accounting_dd_percent
          ELSE COALESCE(total_purchase_price, 0) * fee_accounting_dd_percent / 100
        END,
        fee_loan_arrangement_amount = CASE
          WHEN fee_loan_arrangement_type = 'fixed' THEN fee_loan_arrangement_percent
          ELSE COALESCE(total_purchase_price, 0) * fee_loan_arrangement_percent / 100
        END,
        fee_deal_maker_amount = CASE
          WHEN fee_deal_maker_type = 'fixed' THEN fee_deal_maker_percent
          ELSE COALESCE(total_purchase_price, 0) * fee_deal_maker_percent / 100
        END
      WHERE
        fee_legal_dd_amount IS NULL
        OR fee_accounting_dd_amount IS NULL
        OR fee_loan_arrangement_amount IS NULL
        OR fee_deal_maker_amount IS NULL
    `);

    await client.query('COMMIT');
    console.log(`S2 migration committed. Rows updated: ${result.rowCount}`);

    // Verify — spot check first 5 rows
    const { rows } = await client.query(`
      SELECT
        id,
        fee_legal_dd_type, fee_legal_dd_percent, fee_legal_dd_amount,
        fee_accounting_dd_type, fee_accounting_dd_percent, fee_accounting_dd_amount,
        fee_loan_arrangement_type, fee_loan_arrangement_percent, fee_loan_arrangement_amount,
        fee_deal_maker_type, fee_deal_maker_percent, fee_deal_maker_amount
      FROM deal_models
      ORDER BY id
      LIMIT 5
    `);
    for (const r of rows) {
      console.log(JSON.stringify(r));
    }

    // Confirm nothing left NULL
    const { rows: nullCheck } = await client.query(`
      SELECT COUNT(*) FILTER (WHERE fee_legal_dd_amount IS NULL) AS legal_null,
             COUNT(*) FILTER (WHERE fee_accounting_dd_amount IS NULL) AS accounting_null,
             COUNT(*) FILTER (WHERE fee_loan_arrangement_amount IS NULL) AS loan_null,
             COUNT(*) FILTER (WHERE fee_deal_maker_amount IS NULL) AS dealmaker_null
      FROM deal_models
    `);
    console.log('NULL check after migration:', JSON.stringify(nullCheck[0]));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ROLLED BACK:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
