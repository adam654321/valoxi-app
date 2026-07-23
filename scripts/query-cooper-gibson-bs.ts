#!/usr/bin/env tsx
import pg from 'pg';

pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);

const pool = new pg.Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const fmt = (v: unknown) => v == null ? 'null' : String(v);
const date = (v: unknown) => {
  if (v == null) return 'null';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return s.split('T')[0];
};

async function main() {
  const { rows: [{ db }] } = await pool.query('SELECT current_database() AS db');
  if (!process.env.PROD_DATABASE_URL?.includes('ep-old-recipe')) throw new Error('Not prod!');
  console.log(`DB: ${db}  (read-only)\n`);

  // ── All documents for tc=138 ────────────────────────────────────────────────
  const { rows: docs } = await pool.query(`
    SELECT id, document_name, document_category, created_at
    FROM documents WHERE target_company_id = 138 ORDER BY id
  `);
  console.log('=== DOCUMENTS (tc=138 Cooper Gibson) ===');
  for (const d of docs) {
    console.log(`  doc_id=${d.id}  cat='${d.document_category}'  created=${date(d.created_at)}  name='${d.document_name}'`);
  }

  // ── All balance sheets ─────────────────────────────────────────────────────
  const { rows: bals } = await pool.query(`
    SELECT
      bs.id                             AS bs_id,
      fp.id                             AS fp_id,
      fp.period_type,
      fp.period_end,
      fp.fiscal_year,
      fp.is_full_year,
      fp.months_covered,
      fp.source_document_id             AS fp_source_doc,
      d.document_name,
      d.document_category,
      bs.cash_at_bank,
      bs.directors_current_account,
      bs.amounts_owed_by_directors,
      bs.amounts_owed_to_directors,
      bs.total_equity,
      bs.bank_loans_overdraft_current,
      bs.bank_loans_long_term,
      bs.hire_purchase_current,
      bs.hire_purchase_long_term,
      bs.source_document_id             AS bs_source_doc
    FROM balance_sheets bs
    JOIN financial_periods fp ON fp.id = bs.financial_period_id
    LEFT JOIN documents d ON d.id = fp.source_document_id
    WHERE bs.target_company_id = 138
    ORDER BY fp.period_end DESC NULLS LAST, fp.id
  `);

  console.log('\n=== BALANCE SHEETS (tc=138) ===');
  for (const b of bals) {
    console.log(`\n  bs_id=${b.bs_id}  fp=${b.fp_id}  type=${b.period_type}  FY=${b.fiscal_year}  full_year=${b.is_full_year}  months=${fmt(b.months_covered)}  end=${date(b.period_end)}`);
    console.log(`    source_doc: ${b.fp_source_doc} '${b.document_name ?? '(none)'}'  cat='${b.document_category ?? '-'}'`);
    console.log(`    cash_at_bank             = ${fmt(b.cash_at_bank)}`);
    console.log(`    directors_current_account= ${fmt(b.directors_current_account)}`);
    console.log(`    amounts_owed_by_directors= ${fmt(b.amounts_owed_by_directors)}`);
    console.log(`    amounts_owed_to_directors= ${fmt(b.amounts_owed_to_directors)}`);
    console.log(`    total_equity             = ${fmt(b.total_equity)}`);
    console.log(`    bank_loans_current       = ${fmt(b.bank_loans_overdraft_current)}`);
    console.log(`    bank_loans_long_term     = ${fmt(b.bank_loans_long_term)}`);
    console.log(`    hp_current               = ${fmt(b.hire_purchase_current)}`);
    console.log(`    hp_long_term             = ${fmt(b.hire_purchase_long_term)}`);
  }

  // ── All income statements ──────────────────────────────────────────────────
  const { rows: incs } = await pool.query(`
    SELECT
      is2.id                            AS is_id,
      fp.id                             AS fp_id,
      fp.period_type,
      fp.period_end,
      fp.fiscal_year,
      fp.is_full_year,
      fp.months_covered,
      fp.source_document_id             AS fp_source_doc,
      d.document_name,
      is2.operating_profit,
      is2.depreciation_amortisation,
      is2.revenue,
      is2.source_document_id            AS is_source_doc
    FROM income_statements is2
    JOIN financial_periods fp ON fp.id = is2.financial_period_id
    LEFT JOIN documents d ON d.id = fp.source_document_id
    WHERE is2.target_company_id = 138
    ORDER BY fp.period_end DESC NULLS LAST, fp.id
  `);

  console.log('\n=== INCOME STATEMENTS (tc=138) ===');
  for (const r of incs) {
    console.log(`\n  is_id=${r.is_id}  fp=${r.fp_id}  type=${r.period_type}  FY=${r.fiscal_year}  fp.full_year=${r.is_full_year}  months=${fmt(r.months_covered)}  end=${date(r.period_end)}`);
    console.log(`    source_doc: ${r.fp_source_doc} '${r.document_name ?? '(none)'}'`);
    console.log(`    OP=${fmt(r.operating_profit)}  DA=${fmt(r.depreciation_amortisation)}  revenue=${fmt(r.revenue)}`);
  }

  // ── Deal model ─────────────────────────────────────────────────────────────
  const { rows: dms } = await pool.query(`
    SELECT id, name, ebitda_multiple, averaging_years,
           plus_excess_cash, minus_primary_debt, minus_other_debt, minus_corp_tax_due,
           plus_property_value
    FROM deal_models WHERE target_company_id = 138
  `);
  console.log('\n=== DEAL MODELS (tc=138) ===');
  for (const dm of dms) {
    console.log(`  model_id=${dm.id}  name='${dm.name}'  multiple=${dm.ebitda_multiple}  avg_years=${dm.averaging_years}`);
    console.log(`  plus_excess_cash=${dm.plus_excess_cash}  minus_primary_debt=${dm.minus_primary_debt}  minus_other_debt=${dm.minus_other_debt}  minus_corp_tax_due=${dm.minus_corp_tax_due}  plus_property_value=${dm.plus_property_value}`);
  }

  await pool.end();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
