// Dev database only: point existing app users at their Clerk DEVELOPMENT accounts (matched by email).
const fs = require('fs'); const path = require('path');
const req = require('module').createRequire(path.join(process.cwd(), 'package.json'));
const { Client } = req('pg');
const rd = (f) => { const m = {}; for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { if (/^#/.test(l) || !l.includes('=')) continue; const i = l.indexOf('='); m[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, ''); } return m; };
const url = rd('.env.dev').DST_URL; const sk = rd('.env.do-dev').CLERK_SECRET_KEY;
if (!/ep-holy-resonance-zazrpf52/.test(url) || /ep-cold-night/.test(url)) { console.error('not dev, refusing'); process.exit(1); }
if (!/^sk_test_/.test(sk)) { console.error('not a Clerk test key, refusing'); process.exit(1); }
(async () => {
  const cu = await (await fetch('https://api.clerk.com/v1/users?limit=100', { headers: { Authorization: 'Bearer ' + sk } })).json();
  const c = new Client({ connectionString: url }); await c.connect();
  const rollback = [];
  await c.query('begin');
  for (const u of cu) {
    const emails = (u.email_addresses || []).map(e => e.email_address.toLowerCase());
    const q = await c.query('select id, clerk_user_id from users where lower(email) = any($1)', [emails]);
    if (q.rows.length !== 1 || q.rows[0].clerk_user_id === u.id) continue;
    rollback.push({ id: q.rows[0].id, old_clerk_user_id: q.rows[0].clerk_user_id });
    const r = await c.query('update users set clerk_user_id = $1 where id = $2', [u.id, q.rows[0].id]);
    console.log('linked user id', q.rows[0].id, emails[0], 'rows', r.rowCount);
  }
  await c.query('commit');
  fs.writeFileSync(process.argv[2], JSON.stringify(rollback, null, 1));
  console.log('linked', rollback.length, '| rollback file written');
  await c.end();
})().catch(e => { console.error('ERR', e.code || String(e.message).replace(/postgres\S+/g, '[url]')); process.exit(1); });
