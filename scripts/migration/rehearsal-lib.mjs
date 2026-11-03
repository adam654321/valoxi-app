// Shared helpers for the rehearsal checks (check-clerk-ids.mjs, check-stripe-subs.mjs).
// Everything here is pure or read-only. No writes to any database, Clerk or Stripe.

export const OLD_PROD_MARKERS = ['ep-old-recipe', '.prod.'];

export function dbHost(url) {
  return (url || '').match(/@([^/?]+)[/?]?/)?.[1] ?? 'unknown';
}

// The checks read the RESTORED new database. They must never be pointed at the old Replit prod.
export function assertNotOldProd(url) {
  const host = dbHost(url);
  const hit = OLD_PROD_MARKERS.find((m) => host.includes(m));
  if (hit) throw new Error(`ABORT: DATABASE_URL host ${host} matches "${hit}" (old prod). Use the new Neon database.`);
  if (host === 'unknown') throw new Error('ABORT: DATABASE_URL missing or unparseable');
  return host;
}

// Key guard: refuse test keys unless --allow-test, so a rehearsal cannot silently check the wrong mode.
export function keyMode(key, livePrefixes, testPrefixes) {
  if (!key) return 'missing';
  if (livePrefixes.some((p) => key.startsWith(p))) return 'live';
  if (testPrefixes.some((p) => key.startsWith(p))) return 'test';
  return 'unknown';
}

export function parseArgs(argv) {
  const args = { all: false, sample: null, dryRun: false, allowTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--allow-test') args.allowTest = true;
    else if (a === '--sample') args.sample = Number(argv[++i]);
  }
  return args;
}

// Deterministic-enough random sample without replacement.
export function sample(rows, n, rand = Math.random) {
  const a = rows.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// DB subscription_status -> acceptable Stripe statuses. admin_comped has no Stripe subscription.
const STATUS_MAP = {
  active: ['active'],
  trialing: ['trialing'],
  past_due: ['past_due'],
  canceled: ['canceled'],
  incomplete: ['incomplete', 'incomplete_expired'],
};

// Returns an array of problem strings (empty = consistent). Never includes emails or names.
export function compareSubscription(db, stripeSub) {
  const problems = [];
  const allowed = STATUS_MAP[db.status];
  if (!allowed) problems.push(`unexpected db status ${db.status}`);
  else if (!allowed.includes(stripeSub.status)) problems.push(`status db=${db.status} stripe=${stripeSub.status}`);
  const stripeCustomer = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id;
  if (db.stripe_customer_id && stripeCustomer && db.stripe_customer_id !== stripeCustomer) {
    problems.push('customer id differs');
  }
  if (Boolean(db.cancel_at_period_end) !== Boolean(stripeSub.cancel_at_period_end)) {
    problems.push(`cancel_at_period_end db=${db.cancel_at_period_end} stripe=${stripeSub.cancel_at_period_end}`);
  }
  return problems;
}

export function compareClerkUser(db, clerkUser) {
  const problems = [];
  if (clerkUser.banned) problems.push('clerk user banned');
  if (clerkUser.locked) problems.push('clerk user locked');
  const primary = (clerkUser.email_addresses || []).find((e) => e.id === clerkUser.primary_email_address_id);
  const clerkEmail = primary?.email_address?.toLowerCase();
  if (!clerkEmail) problems.push('clerk user has no primary email');
  else if (db.email && clerkEmail !== db.email.toLowerCase()) problems.push('primary email differs from db');
  return problems;
}
