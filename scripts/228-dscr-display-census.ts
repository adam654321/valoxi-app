import pg from 'pg';
const { Pool } = pg;

// READ-ONLY script — SELECT statements only. No INSERT/UPDATE/DELETE/ALTER.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // ── Step 1: Identity guard ──────────────────────────────────────────────
    console.log('\n=== STEP 1: Identity guard ===');
    const idGuard = await client.query(`
      SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 5
    `);
    if (idGuard.rows.length === 0) {
      console.log('No matching last_name rows found — environment unknown.');
    } else {
      idGuard.rows.forEach(r => console.log(`  last_name = ${r.last_name}`));
    }

    // ── Step 2: Total active deal models ───────────────────────────────────
    console.log('\n=== STEP 2: Total deal_models count ===');
    const totalModels = await client.query(`SELECT count(*) AS cnt FROM deal_models`);
    console.log(`  Total deal_models: ${totalModels.rows[0].cnt}`);

    // ── Schema note ─────────────────────────────────────────────────────────
    console.log('\n=== SCHEMA NOTE: deal_model_funding_lines columns used ===');
    console.log('  Table: deal_model_funding_lines');
    console.log('  Columns: deal_model_id, is_active (boolean), funding_type (varchar),');
    console.log('           amount_used (decimal), interest_rate (decimal)');
    console.log('  Table: deal_models');
    console.log('  Relevant persisted columns: id, adjusted_ebitda, calculated_ebitda, target_company_id');
    console.log('  Table: target_companies');
    console.log('  Relevant column: company_name');

    // ── Step 3: Count of affected models ───────────────────────────────────
    console.log('\n=== STEP 3: Count of models with active receivables_finance (non-zero amount + rate) ===');
    const affectedCount = await client.query(`
      SELECT count(DISTINCT dm.id) AS cnt
      FROM deal_models dm
      JOIN deal_model_funding_lines fl ON fl.deal_model_id = dm.id
      WHERE fl.is_active = true
        AND fl.funding_type = 'receivables_finance'
        AND COALESCE(fl.amount_used, '0')::numeric > 0
        AND COALESCE(fl.interest_rate, '0')::numeric > 0
    `);
    console.log(`  Affected deal models: ${affectedCount.rows[0].cnt}`);

    // ── Step 4 + 5: Detail per affected model ──────────────────────────────
    console.log('\n=== STEPS 4 + 5: Per-affected-model detail and divergence ===');
    const detail = await client.query(`
      SELECT
        dm.id                                            AS model_id,
        tc.company_name                                  AS target_company,
        fl.id                                            AS funding_line_id,
        fl.label                                         AS funding_line_label,
        COALESCE(fl.amount_used,  '0')::numeric          AS amount_used,
        COALESCE(fl.interest_rate,'0')::numeric          AS interest_rate,
        (COALESCE(fl.amount_used,'0')::numeric
          * COALESCE(fl.interest_rate,'0')::numeric
          / 100)                                         AS revolving_interest_annual,
        dm.adjusted_ebitda::numeric                      AS stored_adjusted_ebitda,
        dm.calculated_ebitda::numeric                    AS stored_calculated_ebitda
      FROM deal_models dm
      JOIN deal_model_funding_lines fl ON fl.deal_model_id = dm.id
      JOIN target_companies tc ON tc.id = dm.target_company_id
      WHERE fl.is_active = true
        AND fl.funding_type = 'receivables_finance'
        AND COALESCE(fl.amount_used, '0')::numeric > 0
        AND COALESCE(fl.interest_rate, '0')::numeric > 0
      ORDER BY dm.id, fl.id
    `);

    if (detail.rows.length === 0) {
      console.log('  No affected models found — no rows to report.');
    } else {
      for (const row of detail.rows) {
        console.log(`\n  Model ID: ${row.model_id}  |  Company: ${row.target_company}`);
        console.log(`  Funding line ID: ${row.funding_line_id}  |  Label: ${row.funding_line_label ?? '(none)'}`);
        console.log(`  amount_used: £${Number(row.amount_used).toLocaleString('en-GB')}`);
        console.log(`  interest_rate: ${row.interest_rate}%`);
        console.log(`  revolvingInterestAnnual (amount_used × rate / 100): £${Number(row.revolving_interest_annual).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);

        const storedEbitda = row.stored_adjusted_ebitda;
        if (storedEbitda != null) {
          const shown = Number(storedEbitda);
          const correct = shown - Number(row.revolving_interest_annual);
          const absDiff = Math.abs(shown - correct);
          const pctDiff = shown !== 0 ? (absDiff / Math.abs(shown)) * 100 : null;
          console.log(`  stored adjusted_ebitda: £${shown.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
          console.log(`  Shown DSCR numerator (averageAdjustedEbitda):   £${shown.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
          console.log(`  Correct DSCR numerator (adjusted − revolving):  £${correct.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
          console.log(`  Absolute divergence: £${absDiff.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
          console.log(`  Percentage divergence: ${pctDiff != null ? pctDiff.toFixed(3) + '%' : 'n/a (zero EBITDA)'}`);
          console.log(`  NOTE: stored adjusted_ebitda may differ from the runtime-computed averageAdjustedEbitda`);
          console.log(`        (which re-averages accepted adjustments over averagingYears). Treat as indicative.`);
        } else {
          console.log(`  stored adjusted_ebitda: NULL — magnitude of divergence cannot be computed from`);
          console.log(`  stored data alone; a runtime recompute via calculateFullDealModel is required.`);
          console.log(`  stored calculated_ebitda: ${row.stored_calculated_ebitda ?? 'NULL'}`);
        }
      }
    }

    // ── Step 6: Write-safety confirmation ──────────────────────────────────
    console.log('\n=== STEP 6: Write-safety confirmation ===');
    console.log('  This script contains only SELECT statements.');
    console.log('  No INSERT, UPDATE, DELETE, ALTER, or DDL was executed.');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
