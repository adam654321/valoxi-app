// READ-ONLY. Do the subscriptions in the restored database agree with live Stripe?
// For each row with a stripe_subscription_id, retrieves the subscription from Stripe and compares
// status, customer id and cancel_at_period_end.
//
//   DATABASE_URL=<restored new Neon url> STRIPE_SECRET_KEY=<rk_live_... restricted read-only key preferred> \
//     node scripts/migration/check-stripe-subs.mjs [--sample 40 | --all] [--dry-run] [--allow-test]
//
// Use a RESTRICTED key with read access to Subscriptions only. --dry-run reads the database only.
// Output lists DB subscription ids only (no emails). Exit 1 if any problem. Only GET calls are made.
import pg from 'pg';
import Stripe from 'stripe';
import { assertNotOldProd, keyMode, parseArgs, sample, compareSubscription } from './rehearsal-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const host = assertNotOldProd(process.env.DATABASE_URL);
const n = args.all ? Infinity : args.sample ?? 40;

const key = process.env.STRIPE_SECRET_KEY;
const mode = keyMode(key, ['sk_live_', 'rk_live_'], ['sk_test_', 'rk_test_']);
if (!args.dryRun) {
  if (mode === 'missing') throw new Error('ABORT: STRIPE_SECRET_KEY not set (use --dry-run to check the DB only)');
  if (mode === 'test' && !args.allowTest) throw new Error('ABORT: test Stripe key. Production subscriptions live in live mode; use a live key or --allow-test.');
  if (mode === 'unknown') throw new Error('ABORT: STRIPE_SECRET_KEY has an unexpected prefix');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(
  `SELECT id, status, stripe_customer_id, stripe_subscription_id, cancel_at_period_end
     FROM subscriptions WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> '' ORDER BY id`,
);
const byStatus = (await client.query(`SELECT status, count(*)::int AS n FROM subscriptions GROUP BY status ORDER BY status`)).rows;
const noStripe = (await client.query(`SELECT count(*)::int AS n FROM subscriptions WHERE stripe_subscription_id IS NULL OR stripe_subscription_id = ''`)).rows[0].n;
await client.end();

const picked = n >= rows.length ? rows : sample(rows, n);
console.log(`db host: ${host}`);
console.log('subscriptions by status:', byStatus.map((r) => `${r.status}=${r.n}`).join(', '));
console.log(`with stripe_subscription_id: ${rows.length}, without (comped or none): ${noStripe}`);
console.log(`stripe key mode: ${mode}, checking ${picked.length} subscription(s)${args.dryRun ? ' (DRY RUN, no API calls)' : ''}`);
if (args.dryRun) process.exit(0);

const stripe = new Stripe(key);
let ok = 0;
const problems = [];
for (const s of picked) {
  try {
    const sub = await stripe.subscriptions.retrieve(s.stripe_subscription_id);
    const found = compareSubscription(s, sub);
    if (found.length) problems.push(`db subscription ${s.id}: ${found.join('; ')}`); else ok++;
  } catch (e) {
    problems.push(`db subscription ${s.id}: ${e?.code || e?.type || 'error'} ${e?.statusCode ?? ''}`.trim());
  }
}

console.log(`\nok: ${ok}  problems: ${problems.length}`);
problems.forEach((p) => console.log('PROBLEM ' + p));
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll checked subscriptions match Stripe');
process.exit(problems.length ? 1 : 0);
