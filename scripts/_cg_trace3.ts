import pg from 'pg';
pg.types.setTypeParser(114, (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;
async function main() {
  const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const TC = 138;

  // Full financial expert analysis_data for tc=138, most recent success
  const { rows: fin } = await prod.query(`
    SELECT id, expert_type, status, created_at, analysis_data
    FROM expert_analysis_results
    WHERE target_company_id = $1 AND expert_type = 'financial' AND status = 'success'
    ORDER BY created_at DESC LIMIT 1
  `, [TC]);

  if (!fin.length) { console.log('No financial expert result'); }
  else {
    const d = fin[0];
    console.log(`ear=${d.id}  type=${d.expert_type}  status=${d.status}  at=${d.created_at}\n`);
    const j = typeof d.analysis_data === 'string' ? JSON.parse(d.analysis_data) : d.analysis_data;

    console.log('=== KEY FINDINGS ===');
    (j.key_findings ?? []).forEach((f: string, i: number) => console.log(`  ${i+1}. ${f}`));
    console.log('\n=== RED FLAGS ===');
    (j.red_flags ?? []).forEach((f: string, i: number) => console.log(`  ${i+1}. ${f}`));
    console.log('\n=== NARRATIVE ===');
    console.log(j.narrative ?? '(none)');

    // Balance sheet section if present
    if (j.balance_sheet_analysis || j.latest_balance_sheet) {
      console.log('\n=== BALANCE SHEET in expert output ===');
      console.log(JSON.stringify(j.balance_sheet_analysis ?? j.latest_balance_sheet, null, 2));
    }

    // Search for 295 or 180 anywhere in the JSON
    const raw = JSON.stringify(j);
    const matches295 = [...raw.matchAll(/295[\d,\.]{0,10}/g)].map(m => {
      const start = Math.max(0, m.index! - 40);
      return raw.substring(start, m.index! + 60);
    });
    const matches180 = [...raw.matchAll(/18[0-9][\d,\.]{0,8}/g)].map(m => {
      const start = Math.max(0, m.index! - 40);
      return raw.substring(start, m.index! + 60);
    });
    console.log('\n=== Occurrences of ~295k in financial expert output ===');
    matches295.forEach(m => console.log(' ', m));
    console.log('\n=== Occurrences of ~180k in financial expert output ===');
    matches180.forEach(m => console.log(' ', m));
  }

  // Also: check the dar=2618 full data for the FY2026 company accounts balance sheet
  const { rows: dar2618 } = await prod.query(`
    SELECT analysis_data FROM document_analysis_results WHERE id = 2618
  `);
  if (dar2618.length) {
    const j2 = typeof dar2618[0].analysis_data === 'string' ? JSON.parse(dar2618[0].analysis_data) : dar2618[0].analysis_data;
    const raw2 = JSON.stringify(j2);
    // Pull current_assets and liabilities sections
    const cashMatch = raw2.match(/"current_assets":\{[^}]{0,400}/)?.[0] ?? 'not found';
    const liabMatch = raw2.match(/"current_liabilities":\{[^}]{0,400}/)?.[0] ?? 'not found';
    const credMatch = raw2.match(/"creditors":\{[^}]{0,400}/)?.[0] ?? 'not found';
    console.log('\n=== dar=2618 current_assets ===\n', cashMatch);
    console.log('\n=== dar=2618 current_liabilities ===\n', liabMatch);
    console.log('\n=== dar=2618 creditors ===\n', credMatch);
    // search for 295 or 180
    [...raw2.matchAll(/295[\d,\.]{0,10}/g)].forEach(m => {
      const start = Math.max(0, m.index! - 60);
      console.log('  295 match:', raw2.substring(start, m.index! + 80));
    });
    [...raw2.matchAll(/18[0-9][\d,\.]{0,8}/g)].forEach(m => {
      const start = Math.max(0, m.index! - 60);
      console.log('  180 match:', raw2.substring(start, m.index! + 80));
    });
  }

  await prod.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
