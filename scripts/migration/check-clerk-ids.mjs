// READ-ONLY. Do the clerk_user_id values in the restored database exist in the Clerk instance
// the new app will use? Samples users with a clerk_user_id and GETs each from the Clerk Backend API.
//
//   DATABASE_URL=<restored new Neon url> CLERK_SECRET_KEY=<prod sk_live_...> \
//     node scripts/migration/check-clerk-ids.mjs [--sample 30 | --all] [--dry-run] [--allow-test]
//
// --dry-run reads the database only and calls no API (safe with no Clerk key).
// Output lists DB user ids only (no emails). Exit 1 if any problem. Only GET requests are made.
import pg from 'pg';
import { assertNotOldProd, keyMode, parseArgs, sample, compareClerkUser } from './rehearsal-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const host = assertNotOldProd(process.env.DATABASE_URL);
const n = args.all ? Infinity : args.sample ?? 30;

const mode = keyMode(process.env.CLERK_SECRET_KEY, ['sk_live_'], ['sk_test_']);
if (!args.dryRun) {
  if (mode === 'missing') throw new Error('ABORT: CLERK_SECRET_KEY not set (use --dry-run to check the DB only)');
  if (mode === 'test' && !args.allowTest) throw new Error('ABORT: test Clerk key. The restored data holds PROD Clerk ids; use the prod key or --allow-test.');
  if (mode === 'unknown') throw new Error('ABORT: CLERK_SECRET_KEY has an unexpected prefix');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(
  `SELECT id, email, clerk_user_id FROM users WHERE clerk_user_id IS NOT NULL AND clerk_user_id <> '' ORDER BY id`,
);
const total = (await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
await client.end();

const picked = n >= rows.length ? rows : sample(rows, n);
console.log(`db host: ${host}`);
console.log(`users total: ${total}, with clerk_user_id: ${rows.length}, without: ${total - rows.length}`);
console.log(`clerk key mode: ${mode}, checking ${picked.length} user(s)${args.dryRun ? ' (DRY RUN, no API calls)' : ''}`);
if (args.dryRun) process.exit(0);

let missing = 0, mismatched = 0, ok = 0;
const problems = [];
for (const u of picked) {
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(u.clerk_user_id)}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });
  if (res.status === 404) { missing++; problems.push(`db user ${u.id}: not found in Clerk`); continue; }
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); picked.push(u); continue; }
  if (!res.ok) { problems.push(`db user ${u.id}: Clerk HTTP ${res.status}`); continue; }
  const found = compareClerkUser(u, await res.json());
  if (found.length) { mismatched++; problems.push(`db user ${u.id}: ${found.join('; ')}`); } else ok++;
  await new Promise((r) => setTimeout(r, 120));
}

console.log(`\nok: ${ok}  not found: ${missing}  mismatched: ${mismatched}`);
problems.forEach((p) => console.log('PROBLEM ' + p));
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll sampled users match Clerk');
process.exit(problems.length ? 1 : 0);
