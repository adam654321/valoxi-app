import pg from 'pg';
pg.types.setTypeParser(114, (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;
async function main() {
  const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const TC = 138;

  // Check if expert_analysis_results table exists at all
  const { rows: tableCheck } = await prod.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expert_analysis_results'
  `);
  console.log(`expert_analysis_results table exists in prod: ${tableCheck.length > 0}`);

  // Count expert rows for tc=138
  if (tableCheck.length > 0) {
    const { rows: cnt } = await prod.query(`SELECT COUNT(*) AS n FROM expert_analysis_results WHERE target_company_id = $1`, [TC]);
    console.log(`expert_analysis_results rows for tc=138: ${cnt[0].n}`);
    if (Number(cnt[0].n) > 0) {
      const { rows: ear } = await prod.query(`
        SELECT id, expert_type, status, created_at,
               LEFT(analysis_data::text, 600) AS snip
        FROM expert_analysis_results WHERE target_company_id = $1 ORDER BY created_at DESC LIMIT 10
      `, [TC]);
      for (const e of ear) {
        console.log(`  ear=${e.id}  type=${e.expert_type}  status=${e.status}  at=${e.created_at}`);
        console.log(`  ${e.snip?.substring(0, 300)}\n`);
      }
    }
  }

  // document_analysis_results — search for cash/director figures
  const { rows: dar } = await prod.query(`
    SELECT dar.id, dar.document_type, d.document_name, d.document_category,
           LEFT(dar.analysis_data::text, 1000) AS snip
    FROM document_analysis_results dar
    JOIN documents d ON d.id = dar.document_id
    WHERE d.target_company_id = $1
    ORDER BY dar.id DESC
  `, [TC]).catch(() => ({ rows: [] as any[] }));

  console.log(`\ndocument_analysis_results rows for tc=138: ${dar.length}`);
  for (const d of dar) {
    // look for cash/director values in the text
    const raw = d.snip ?? '';
    const hasCash = raw.match(/cash.{0,60}/i)?.[0] ?? '';
    const hasDir  = raw.match(/director.{0,80}/i)?.[0] ?? '';
    console.log(`  dar=${d.id}  type=${d.document_type}  doc="${d.document_name}" [${d.document_category}]`);
    if (hasCash) console.log(`    cash match: ${hasCash}`);
    if (hasDir)  console.log(`    dir match:  ${hasDir}`);
  }

  // Also: what does the live financial-data service return for tc=138 BS?
  // (the deal model snapshot already showed bs_id=967 which is the YTD 25 Jun 2026)
  // Double-check: which balance sheet has cash closest to 295k or dir loan ~180k?
  const { rows: bsAll } = await prod.query(`
    SELECT bs.id, fp.period_end, fp.period_type, fp.fiscal_year, fp.is_full_year,
           bs.cash_at_bank, bs.amounts_owed_to_directors,
           d.document_name
    FROM balance_sheets bs
    JOIN financial_periods fp ON fp.id = bs.financial_period_id
    LEFT JOIN documents d ON d.id = bs.source_document_id
    WHERE bs.target_company_id = $1
    ORDER BY fp.period_end DESC
  `, [TC]);
  console.log('\nAll BS rows — searching for £295k cash or ~£180k dir loan:');
  for (const b of bsAll) {
    const cash = Number(b.cash_at_bank ?? 0);
    const dir  = Number(b.amounts_owed_to_directors ?? 0);
    const near295 = Math.abs(cash - 295000) < 50000;
    const near180 = Math.abs(Math.abs(dir) - 180000) < 50000;
    const marker = near295 || near180 ? ' ◄◄◄' : '';
    console.log(`  bs=${b.id}  end=${String(b.period_end).substring(0,10)}  ${b.period_type}  FY=${b.fiscal_year}  full=${b.is_full_year}  cash=${b.cash_at_bank}  dir=${b.amounts_owed_to_directors}  doc="${b.document_name}"${marker}`);
  }

  await prod.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
