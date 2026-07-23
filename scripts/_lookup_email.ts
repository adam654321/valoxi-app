import pg from 'pg';
pg.types.setTypeParser(114, (v: string) => v);
const { Pool } = pg;
async function main() {
  const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const { rows } = await prod.query(`
    SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
           ucm.user_company_id, ucm.is_company_admin,
           COALESCE(s.status::text,'none') AS sub_status
    FROM users u
    JOIN user_company_memberships ucm ON ucm.user_id = u.id
    LEFT JOIN subscriptions s ON s.user_company_id = ucm.user_company_id
    WHERE LOWER(u.email) = 'annamarieabike@gmail.com'
  `);
  if (rows.length === 0) { console.log('USER NOT FOUND IN PROD'); await prod.end(); return; }
  for (const r of rows) console.log(`USER: ${r.first_name} ${r.last_name} <${r.email}> | uc=${r.user_company_id} | admin=${r.is_company_admin} | sub=${r.sub_status}`);

  const ucId = rows[0].user_company_id;
  const { rows: deals } = await prod.query(`
    SELECT id, company_name, stage, is_archived FROM target_companies
    WHERE user_company_id = $1 ORDER BY id
  `, [ucId]);
  console.log('\nDEALS:');
  for (const d of deals) console.log(`  tc=${d.id}  "${d.company_name}"  stage=${d.stage}  archived=${d.is_archived}`);

  const fs = await import('fs');
  const results = JSON.parse(fs.readFileSync('/tmp/comms-relock-slice22.json', 'utf8')) as Array<{tcId:number;companyName:string;material:boolean;isActive:boolean;direction:string;whatMoved:string}>;
  const dealIds = new Set(deals.map((d: {id:number}) => d.id));
  const matched = results.filter(r => dealIds.has(r.tcId));
  console.log('\nIN RELOCK RESULTS:');
  if (matched.length === 0) console.log('  (none of this owner\'s deals appear in the affected set)');
  for (const r of matched) console.log(`  tc=${r.tcId} "${r.companyName}" | material=${r.material} | active=${r.isActive} | dir=${r.direction} | ${r.whatMoved}`);

  await prod.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
