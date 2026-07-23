import pg from 'pg';
pg.types.setTypeParser(114, (v: string) => v);
const { Pool } = pg;

const TC_IDS = [80,89,90,142,162,82,83,86,101,128,215,119,130,138,157,208,214,217,219,172,174,206,216,220];

async function main() {
  const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const { rows } = await prod.query(`
    SELECT
      tc.id,
      tc.company_name,
      tc.is_archived,
      tc.stage,
      u.first_name || ' ' || u.last_name AS owner_name,
      u.email AS owner_email
    FROM target_companies tc
    JOIN user_company_memberships ucm ON ucm.user_company_id = tc.user_company_id AND ucm.is_company_admin = true
    JOIN users u ON u.id = ucm.user_id
    WHERE tc.id = ANY($1::int[])
    ORDER BY tc.id
  `, [TC_IDS]);

  console.log('\n─── DEAL-LEVEL SWEEP ───────────────────────────────────────────────────────');
  console.log('TC   | Archived | Stage                   | Company                          | Owner');
  console.log('─'.repeat(100));
  for (const r of rows) {
    const arch = r.is_archived ? '⚠ YES' : 'no';
    console.log(
      String(r.id).padEnd(5) + '| ' +
      arch.padEnd(9) + '| ' +
      String(r.stage ?? '').padEnd(25) + '| ' +
      String(r.company_name).substring(0,32).padEnd(34) + '| ' +
      `${r.owner_name} <${r.owner_email}>`
    );
  }

  const excluded = rows.filter((r: {is_archived: boolean}) => r.is_archived);
  console.log('\n─── EXCLUDE LIST (deal-level archived=true) ────────────────────────────────');
  if (excluded.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of excluded) {
      console.log(`  tc=${r.id}  "${r.company_name}"  owner=${r.owner_name} <${r.owner_email}>  stage=${r.stage}`);
    }
  }

  const kept = rows.filter((r: {is_archived: boolean}) => !r.is_archived);
  console.log('\n─── CORRECTED SEND LIST (grouped by owner, deal-archived removed) ──────────');

  // load movement details from relock JSON
  const fs = await import('fs');
  const results = JSON.parse(fs.readFileSync('/tmp/comms-relock-slice22.json', 'utf8')) as Array<{tcId:number;companyName:string;direction:string;whatMoved:string;offerAffected:boolean;slice22Flag:boolean}>;
  const byId = new Map(results.map(r => [r.tcId, r]));

  const byOwner = new Map<string, typeof rows>();
  for (const r of kept) {
    const key = `${r.owner_email}||${r.owner_name}`;
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(r);
  }

  for (const [key, companies] of byOwner) {
    const [email, name] = key.split('||');
    console.log(`\n  ${name} <${email}>`);
    for (const c of companies) {
      const detail = byId.get(c.id);
      const s22   = detail?.slice22Flag ? '  [Slice 22]' : '';
      const offer = detail?.offerAffected ? '  ⚠ ISSUED-OFFER' : '';
      console.log(`    • "${c.company_name}"  dir=${detail?.direction ?? '?'}${s22}${offer}`);
      if (detail?.whatMoved) console.log(`      ${detail.whatMoved}`);
    }
  }

  console.log(`\n─── TOTALS ─────────────────────────────────────────────────────────────────`);
  console.log(`  Input:    ${TC_IDS.length} companies`);
  console.log(`  Excluded: ${excluded.length} (deal-level archived)`);
  console.log(`  Kept:     ${kept.length} on corrected send list`);

  await prod.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
