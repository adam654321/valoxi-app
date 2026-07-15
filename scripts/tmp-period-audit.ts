import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.PROD_DATABASE_URL });

// Item 10: financial_periods with income/balance/staff for tc 172, 196, 204
const ids10 = [172, 196, 204];
const r10 = await pool.query(`
  SELECT 
    fp.target_company_id, fp.id AS period_id, fp.fiscal_year, fp.period_end,
    fp.period_type, fp.period_label, fp.source_document_id,
    d.document_category, d.document_name,
    is_val.revenue, is_val.operating_profit, is_val.depreciation_amortisation,
    (COALESCE(is_val.operating_profit,0) + COALESCE(is_val.depreciation_amortisation,0)) AS ebitda,
    (SELECT COUNT(*) FROM balance_sheets WHERE financial_period_id = fp.id) AS has_balance,
    (SELECT COUNT(*) FROM staff_data WHERE financial_period_id = fp.id) AS has_staff
  FROM financial_periods fp
  LEFT JOIN documents d ON d.id = fp.source_document_id
  LEFT JOIN income_statements is_val ON is_val.financial_period_id = fp.id
  WHERE fp.target_company_id = ANY($1)
  ORDER BY fp.target_company_id, fp.fiscal_year, fp.period_type
`, [ids10]);
console.log('=== ITEM 10: financial_periods for tc 172,196,204 ===');
console.log(JSON.stringify(r10.rows, null, 2));

// Item 11: dupes on account 42
const r11 = await pool.query(`
  SELECT fp.target_company_id, tc.company_name, fp.period_type, fp.fiscal_year,
         COUNT(*) AS period_count,
         array_agg(fp.id ORDER BY fp.id) AS period_ids,
         array_agg(fp.source_document_id ORDER BY fp.id) AS source_doc_ids
  FROM financial_periods fp
  JOIN target_companies tc ON tc.id = fp.target_company_id
  WHERE tc.user_company_id = 42
  GROUP BY fp.target_company_id, tc.company_name, fp.period_type, fp.fiscal_year
  HAVING COUNT(*) > 1
  ORDER BY fp.target_company_id, fp.fiscal_year
`);
console.log('=== ITEM 11: duplicate (tc, period_type, fiscal_year) on account 42 ===');
console.log(JSON.stringify(r11.rows, null, 2));

// Item 12a: fleet dupe census
const r12a = await pool.query(`
  SELECT COUNT(*) AS dupe_groups,
         COUNT(DISTINCT target_company_id) AS dupe_companies
  FROM (
    SELECT target_company_id, period_type, fiscal_year
    FROM financial_periods
    GROUP BY target_company_id, period_type, fiscal_year
    HAVING COUNT(*) > 1
  ) x
`);
console.log('=== ITEM 12a: fleet dupe groups ===');
console.log(JSON.stringify(r12a.rows, null, 2));

// Item 12b: null source_document_id
const r12b = await pool.query(`
  SELECT COUNT(*) AS null_source_periods,
         COUNT(DISTINCT target_company_id) AS null_source_companies
  FROM financial_periods
  WHERE source_document_id IS NULL
`);
console.log('=== ITEM 12b: null source_document_id ===');
console.log(JSON.stringify(r12b.rows, null, 2));

// Item 12c: companies in both a and b
const r12c = await pool.query(`
  SELECT COUNT(DISTINCT tc_id) AS in_both
  FROM (
    SELECT target_company_id AS tc_id
    FROM financial_periods
    GROUP BY target_company_id, period_type, fiscal_year
    HAVING COUNT(*) > 1
  ) dupes
  WHERE tc_id IN (
    SELECT DISTINCT target_company_id FROM financial_periods WHERE source_document_id IS NULL
  )
`);
console.log('=== ITEM 12c: companies in both dupe and null-source sets ===');
console.log(JSON.stringify(r12c.rows, null, 2));

// Item 13a: account 37 — zero docs but >0 financial rows
const r13a = await pool.query(`
  SELECT tc.id, tc.company_name
  FROM target_companies tc
  WHERE tc.user_company_id = 37
    AND (SELECT COUNT(*) FROM documents WHERE target_company_id = tc.id) = 0
    AND (
      (SELECT COUNT(*) FROM financial_periods WHERE target_company_id = tc.id) > 0
      OR (SELECT COUNT(*) FROM income_statements WHERE target_company_id = tc.id) > 0
    )
  ORDER BY tc.id
`);
console.log('=== ITEM 13a: account 37 zero-docs + financial rows ===');
console.log('Count:', r13a.rows.length);
console.log('IDs:', r13a.rows.map(r => r.id).join(', '));

// Item 13b: account 42 same
const r13b = await pool.query(`
  SELECT tc.id, tc.company_name
  FROM target_companies tc
  WHERE tc.user_company_id = 42
    AND (SELECT COUNT(*) FROM documents WHERE target_company_id = tc.id) = 0
    AND (
      (SELECT COUNT(*) FROM financial_periods WHERE target_company_id = tc.id) > 0
      OR (SELECT COUNT(*) FROM income_statements WHERE target_company_id = tc.id) > 0
    )
  ORDER BY tc.id
`);
console.log('=== ITEM 13b: account 42 zero-docs + financial rows ===');
console.log('Count:', r13b.rows.length);
console.log('IDs:', r13b.rows.map(r => r.id).join(', '));

// Item 13c: confirm account owners
const r13c = await pool.query(`
  SELECT uc.id AS user_company_id, uc.company_name,
         u.id AS user_id, u.email, u.last_name, u.first_name,
         ucm.is_company_admin
  FROM user_companies uc
  JOIN user_company_memberships ucm ON ucm.user_company_id = uc.id
  JOIN users u ON u.id = ucm.user_id
  WHERE uc.id IN (37, 42)
    AND ucm.is_company_admin = true
  ORDER BY uc.id
`);
console.log('=== ITEM 13c: account owners for 37 and 42 ===');
console.log(JSON.stringify(r13c.rows, null, 2));

await pool.end();
