// Scrubs real email addresses from the Neon DEV branch so staging can never mail a real customer.
// Every address not at valoxi.ai or shiftopsconsulting.com (or their subdomains) is rewritten to
// adam+<12 hex of md5(original)>@shiftopsconsulting.com. Deterministic, so the same address maps to
// the same replacement everywhere and unique constraints still hold. Re-running is a no-op.
//
// Covers every text, varchar, json, jsonb and text[]/varchar[] column of every table in `public`.
// Names and other PII are NOT touched (same as the 28 Oct scrub).
//
//   node scripts/migration/scrub-dev-emails.mjs --expect ep-xxxx            (scan only, read only)
//   node scripts/migration/scrub-dev-emails.mjs --expect ep-xxxx --apply    (rewrite, one transaction)
//
// Reads DST_URL from .env.dev. Refuses unless the URL's endpoint equals --expect, and always refuses
// the production and old-prod endpoints. Prints table.column counts and domain counts only, never addresses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const FORBIDDEN = ['ep-cold-night-za5w03lp', 'ep-old-recipe-an7e4afw'];
const KEEP_DOMAIN = String.raw`(^|\.)(valoxi\.ai|shiftopsconsulting\.com)$`;
const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`;

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const expect = argv[argv.indexOf('--expect') + 1];
if (!argv.includes('--expect') || !expect?.startsWith('ep-')) { console.error('Need --expect ep-...'); process.exit(2); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const line = fs.readFileSync(path.join(root, '.env.dev'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('DST_URL='));
if (!line) { console.error('.env.dev has no DST_URL'); process.exit(2); }
const url = line.slice(8).trim().replace(/^["']|["']$/g, '');
const endpoint = (url.match(/@(ep-[a-z0-9-]+?)(-pooler)?\./) || [])[1];
if (!endpoint) { console.error('URL host is not a Neon endpoint'); process.exit(2); }
if (FORBIDDEN.includes(endpoint)) { console.error(`REFUSED: ${endpoint} is production or old prod.`); process.exit(3); }
if (endpoint !== expect) { console.error(`REFUSED: .env.dev points at ${endpoint}, expected ${expect}.`); process.exit(3); }
console.log(`target: ${endpoint} (${apply ? 'APPLY' : 'scan only'})`);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();

const { rows: cols } = await client.query(`
  SELECT c.table_name t, c.column_name c, c.data_type dt, c.udt_name udt
  FROM information_schema.columns c
  JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
  WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
    AND (c.data_type IN ('text','character varying','json','jsonb') OR c.udt_name IN ('_text','_varchar'))
  ORDER BY 1, 2`);

const q = (s) => '"' + s.replace(/"/g, '""') + '"';
const asText = (col) => `${q(col.c)}::text`;
const back = (col, expr) =>
  col.dt === 'jsonb' ? `(${expr})::jsonb` : col.dt === 'json' ? `(${expr})::json`
  : col.udt === '_text' ? `(${expr})::text[]` : col.udt === '_varchar' ? `(${expr})::varchar[]` : expr;

async function scan() {
  const hits = []; const domains = new Map(); let total = 0;
  for (const col of cols) {
    const { rows } = await client.query(
      `SELECT lower(split_part(m[1], '@', 2)) d, count(*)::int n
       FROM (SELECT regexp_matches(${asText(col)}, $1, 'g') m FROM ${q(col.t)} WHERE ${asText(col)} ~ $1) x
       WHERE lower(split_part(m[1], '@', 2)) !~ $2 GROUP BY 1`, [`(${EMAIL})`, KEEP_DOMAIN]);
    const n = rows.reduce((a, r) => a + r.n, 0);
    if (n) { hits.push(`${col.t}.${col.c}: ${n}`); total += n; }
    for (const r of rows) domains.set(r.d, (domains.get(r.d) || 0) + r.n);
  }
  return { hits, total, domainCount: domains.size };
}

const before = await scan();
console.log(`foreign addresses found: ${before.total} in ${before.hits.length} columns, ${before.domainCount} distinct domains`);
for (const h of before.hits) console.log('  ' + h);

if (!apply) { await client.end(); process.exit(0); }

await client.query('BEGIN');
try {
  await client.query(`
    CREATE FUNCTION pg_temp.scrub(t text) RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE m text;
    BEGIN
      IF t IS NULL THEN RETURN t; END IF;
      FOR m IN SELECT DISTINCT (regexp_matches(t, '(${EMAIL})', 'g'))[1] LOOP
        IF lower(split_part(m, '@', 2)) !~ '${KEEP_DOMAIN}' THEN
          t := replace(t, m, 'adam+' || left(md5(m), 12) || '@shiftopsconsulting.com');
        END IF;
      END LOOP;
      RETURN t;
    END $f$`);
  let changed = 0;
  for (const col of before.hits.map((h) => h.split(':')[0])) {
    const [t, c] = col.split('.');
    const meta = cols.find((x) => x.t === t && x.c === c);
    const r = await client.query(
      `UPDATE ${q(t)} SET ${q(c)} = ${back(meta, `pg_temp.scrub(${asText(meta)})`)} WHERE ${asText(meta)} ~ $1`, [EMAIL]);
    changed += r.rowCount; console.log(`  updated ${t}.${c}: ${r.rowCount} rows`);
  }
  const after = await scan();
  if (after.total !== 0) throw new Error(`after scrub still ${after.total} foreign addresses: ${after.hits.join(', ')}`);
  await client.query('COMMIT');
  console.log(`COMMITTED. ${changed} rows updated. Re-scan: 0 foreign addresses.`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('ROLLED BACK, nothing changed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
