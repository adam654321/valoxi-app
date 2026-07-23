import pg from 'pg';
pg.types.setTypeParser(114, (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;
async function main() {
  const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const TC = 138;

  // All financial periods
  const { rows: periods } = await prod.query(`
    SELECT fp.id, fp.period_type, fp.period_start, fp.period_end, fp.fiscal_year,
           fp.is_full_year, fp.months_covered,
           d.document_name, d.document_category, fp.source_document_id
    FROM financial_periods fp
    LEFT JOIN documents d ON d.id = fp.source_document_id
    WHERE fp.target_company_id = $1
    ORDER BY fp.period_end DESC NULLS LAST, fp.id DESC
  `, [TC]);
  console.log('\n=== FINANCIAL PERIODS (tc=138) ===');
  for (const p of periods) {
    console.log(`  fp=${p.id}  ${p.period_type}  end=${p.period_end}  FY=${p.fiscal_year}  full=${p.is_full_year}  doc="${p.document_name}" [${p.document_category}]`);
  }

  // All balance sheets
  const { rows: bss } = await prod.query(`
    SELECT bs.id, bs.financial_period_id AS fp_id,
           fp.period_type, fp.period_end, fp.fiscal_year, fp.is_full_year,
           bs.cash_at_bank, bs.amounts_owed_to_directors,
           bs.directors_current_account, bs.amounts_owed_by_directors,
           bs.source_document_id,
           d.document_name, d.document_category
    FROM balance_sheets bs
    JOIN financial_periods fp ON fp.id = bs.financial_period_id
    LEFT JOIN documents d ON d.id = bs.source_document_id
    WHERE bs.target_company_id = $1
    ORDER BY fp.period_end DESC NULLS LAST, fp.id DESC
  `, [TC]);
  console.log('\n=== BALANCE SHEETS (tc=138) ===');
  for (const b of bss) {
    console.log(`  bs=${b.id}  fp=${b.fp_id}  ${b.period_type}  end=${b.period_end}  FY=${b.fiscal_year}  full=${b.is_full_year}`);
    console.log(`       cash_at_bank=${b.cash_at_bank}  owed_to_dir=${b.amounts_owed_to_directors}  dir_current=${b.directors_current_account}  owed_by_dir=${b.amounts_owed_by_directors}`);
    console.log(`       doc="${b.document_name}" [${b.document_category}]`);
  }

  // financial_contributions balance rows if they exist
  const { rows: contribs } = await prod.query(`
    SELECT fc.id, fc.fiscal_year, fc.is_full_year, fc.source_tier,
           fc.period_end, fc.as_at_date,
           fc.figures->>'cashAtBank' AS cash,
           fc.figures->>'amountsOwedToDirectors' AS owed_to_dir,
           d.document_name
    FROM financial_contributions fc
    LEFT JOIN documents d ON d.id = fc.source_document_id
    WHERE fc.target_company_id = $1 AND fc.statement_type = 'balance'
    ORDER BY fc.period_end DESC NULLS LAST
  `, [TC]).catch(() => ({ rows: [] as any[] }));
  if (contribs.length > 0) {
    console.log('\n=== FINANCIAL CONTRIBUTIONS balance (tc=138) ===');
    for (const c of contribs) {
      console.log(`  fc=${c.id}  FY=${c.fiscal_year}  asAt=${c.as_at_date}  full=${c.is_full_year}  tier=${c.source_tier}  cash=${c.cash}  owed_to_dir=${c.owed_to_dir}  doc="${c.document_name}"`);
    }
  } else {
    console.log('\n=== FINANCIAL CONTRIBUTIONS balance: empty/absent ===');
  }

  // expert_analysis_results
  const { rows: expert } = await prod.query(`
    SELECT id, analysis_type, status, created_at,
           LEFT(result_data::text, 500) AS snip
    FROM expert_analysis_results
    WHERE target_company_id = $1
    ORDER BY created_at DESC LIMIT 10
  `, [TC]).catch(() => ({ rows: [] as any[] }));
  console.log('\n=== EXPERT ANALYSIS RESULTS (tc=138) ===');
  if (!expert.length) { console.log('  (none / table absent)'); }
  for (const e of expert) {
    console.log(`  id=${e.id}  type=${e.analysis_type}  status=${e.status}  at=${e.created_at}`);
    console.log(`  snippet: ${String(e.snip).substring(0, 300)}\n`);
  }

  // deal_model snapshots
  const { rows: dms } = await prod.query(`
    SELECT id, name, status,
           LEFT(financial_data_snapshot::text, 500) AS snap
    FROM deal_models WHERE target_company_id = $1 ORDER BY id
  `, [TC]);
  console.log('\n=== DEAL MODELS (tc=138) ===');
  for (const dm of dms) {
    console.log(`  dm=${dm.id}  "${dm.name}"  status=${dm.status}`);
    console.log(`  financial_data_snapshot: ${dm.snap}`);
  }

  await prod.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
