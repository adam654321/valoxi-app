/**
 * TIER 6 DATABASE WIPE — users, user_companies
 *
 * Kept user_company IDs : 5 (Valoxi.ai), 11 (5DCP), 13 (Goldwire Capital Partners)
 * Kept user IDs         : 1 (Adam), 2 (Viv), 11 (Daniel), 13 (Jagdev)
 *
 * Default mode : DRY-RUN  — counts only, no writes.
 * Execute mode : EXECUTE=true npx tsx server/scripts/wipe-tier6-db.ts
 *
 * Exit codes:
 *   0 = success (dry-run completed, or execute committed)
 *   1 = safety-check failed → rolled back
 *   2 = unexpected error
 *
 * ── Tier dependency ──────────────────────────────────────────────────────────
 * Tiers 1 through 5 must be complete before running this script.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Post-completion state ─────────────────────────────────────────────────────
 * After this commits, the database will contain exactly 4 users (Adam, Viv,
 * Daniel, Jagdev) and exactly 3 user_companies (Valoxi.ai, 5DCP, Goldwire
 * Capital Partners). Tier 7 is a single UPDATE to system_config, not a data wipe.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Statement ordering rationale ─────────────────────────────────────────────
 * Tier 6 ordering: 3 statements in strict order.
 *   Stmt 1 — DELETE users NOT IN (1,2,11,13)
 *   Stmt 2 — UPDATE token_usage SET user_company_id = NULL (FK hygiene)
 *   Stmt 3 — DELETE user_companies NOT IN (5,11,13)
 *
 * users has two nullable FKs into user_companies:
 *   - users.user_company_id    → user_companies (nullable, ON DELETE NO ACTION)
 *   - users.current_company_id → user_companies (nullable, ON DELETE NO ACTION)
 * After stmt 1 the 4 remaining kept users reference only kept user_companies.
 *
 * token_usage.user_company_id is a nullable FK into user_companies. 190 rows
 * belong to kept user Adam (user_id=1) but carry user_company_id references to
 * non-kept companies {2,4,6,7,8} from pre-lockdown admin access. These are kept
 * rows (user_id is kept) so they cannot be deleted — stmt 2 nulls the FK column
 * to sever the reference before stmt 3 deletes the parent user_companies rows.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── FK blocker verification ───────────────────────────────────────────────────
 * Zero NOT NULL FK blockers confirmed by Tier 6 scoping. All 38 NOT NULL FKs
 * into users/user_companies were exhaustively checked. Every child table with
 * rows either references kept parents or was wiped in a prior tier (T1–T5).
 * All nullable FKs were also verified at zero non-kept references.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { pool } from '../db';

// ─── Constants ────────────────────────────────────────────────────────────────

const KEPT_USER_IDS    = [1, 2, 11, 13];
const KEPT_COMPANY_IDS = [5, 11, 13];
const EXECUTE          = process.env.EXECUTE === 'true';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Statement {
  id:       number;
  purpose:  string;
  kind:     'UPDATE' | 'DELETE';
  expected: number;
  countSql: string;
  execSql:  string;
}

interface Result extends Statement {
  actual:  number;
  delta:   number;
  status:  'ok' | 'ROLLBACK';
  note?:   string;
}

// ─── Safety tolerance ─────────────────────────────────────────────────────────
// ±10% of expected, or ±5 rows floor (whichever is larger).

function withinTolerance(expected: number, actual: number): boolean {
  const pctBand = Math.ceil(expected * 0.10);
  const absBand = Math.max(pctBand, 5);
  return Math.abs(actual - expected) <= absBand;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskDbUrl(url: string | undefined): string {
  if (!url) return '(DATABASE_URL not set)';
  try {
    const u      = new URL(url);
    const host   = u.hostname;
    const db     = u.pathname.replace('/', '');
    const masked = db.length <= 4 ? '****' : `${db.slice(0, 4)}...${db.slice(-4)}`;
    return `host=${host}  db=${masked}`;
  } catch {
    return '(unparseable URL)';
  }
}

function pad(s: string | number, width: number): string {
  return String(s).padEnd(width);
}

// ─── Statement definitions ────────────────────────────────────────────────────

const STATEMENTS: Statement[] = [

  {
    id:       1,
    purpose:  'DELETE non-kept users — must run before user_companies (users FKs into user_companies)',
    kind:     'DELETE',
    expected: 26,
    countSql: `SELECT COUNT(*) AS n FROM users
               WHERE id NOT IN (${KEPT_USER_IDS.join(',')})`,
    execSql:  `DELETE FROM users
               WHERE id NOT IN (${KEPT_USER_IDS.join(',')})`,
  },

  {
    id:       2,
    purpose:  'NULL user_company_id on token_usage for kept users pointing at non-kept user_companies (hygiene: severs FK blocker before DELETE user_companies)',
    kind:     'UPDATE',
    expected: 190,
    countSql: `SELECT COUNT(*) AS n FROM token_usage
               WHERE user_company_id IS NOT NULL
                 AND user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `UPDATE token_usage
               SET user_company_id = NULL
               WHERE user_company_id IS NOT NULL
                 AND user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },

  {
    id:       3,
    purpose:  'DELETE non-kept user_companies — runs after users and token_usage FK are cleared',
    kind:     'DELETE',
    expected: 26,
    countSql: `SELECT COUNT(*) AS n FROM user_companies
               WHERE id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM user_companies
               WHERE id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },

];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          TIER 6 DATABASE WIPE — wipe-tier6-db.ts        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Mode     : ${EXECUTE ? '*** EXECUTE — writes will be committed ***' : 'DRY-RUN  (no writes)'}`);
  console.log(`Database : ${maskDbUrl(process.env.DATABASE_URL)}`);
  console.log(`Kept companies : ${KEPT_COMPANY_IDS.join(', ')}`);
  console.log(`Kept users     : ${KEPT_USER_IDS.join(', ')}`);
  console.log('');

  const results: Result[] = [];

  if (EXECUTE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('Transaction opened.\n');

      for (const stmt of STATEMENTS) {
        const countRes = await client.query(stmt.countSql);
        const actual   = parseInt(countRes.rows[0].n, 10);

        if (!withinTolerance(stmt.expected, actual)) {
          const note = `Safety check FAILED: expected ${stmt.expected}, got ${actual} (tolerance ±${Math.max(Math.ceil(stmt.expected * 0.10), 5)})`;
          console.error(`\n[ROLLBACK] Statement ${stmt.id}: ${note}`);
          await client.query('ROLLBACK');

          results.push({ ...stmt, actual, delta: actual - stmt.expected, status: 'ROLLBACK', note });
          for (const s of STATEMENTS.slice(STATEMENTS.indexOf(stmt) + 1)) {
            results.push({ ...s, actual: -1, delta: 0, status: 'ROLLBACK', note: 'not reached — prior rollback' });
          }
          printSummary(results);
          await pool.end();
          process.exit(1);
        }

        const execRes  = await client.query(stmt.execSql);
        const affected = execRes.rowCount ?? actual;

        console.log(`[${stmt.id}] ${stmt.kind} — ${stmt.purpose}`);
        console.log(`    expected: ${stmt.expected}  actual: ${affected}  delta: ${affected - stmt.expected}`);

        results.push({ ...stmt, actual: affected, delta: affected - stmt.expected, status: 'ok' });
      }

      await client.query('COMMIT');
      console.log('\nTransaction COMMITTED.\n');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('\nUnexpected error — ROLLBACK issued:', err);
      await pool.end();
      process.exit(2);
    } finally {
      client.release();
    }

  } else {
    const client = await pool.connect();
    try {
      console.log('DRY-RUN — running SELECT COUNT(*) for each statement:\n');

      for (const stmt of STATEMENTS) {
        const countRes = await client.query(stmt.countSql);
        const actual   = parseInt(countRes.rows[0].n, 10);
        const ok       = withinTolerance(stmt.expected, actual);
        const status   = ok ? 'ok' : 'ROLLBACK';
        const note     = ok ? undefined : `Would fail safety check: expected ${stmt.expected}, got ${actual}`;

        console.log(`[${stmt.id}] ${stmt.kind} — ${stmt.purpose}`);
        console.log(`    expected: ${stmt.expected}  would-affect: ${actual}  delta: ${actual - stmt.expected}  [${status}]`);
        if (note) console.warn(`    ⚠  ${note}`);

        results.push({ ...stmt, actual, delta: actual - stmt.expected, status });
      }
    } finally {
      client.release();
    }
  }

  printSummary(results);
  await pool.end();

  const anyFailed = results.some(r => r.status === 'ROLLBACK');
  process.exit(anyFailed ? 1 : 0);
}

// ─── Summary printer ──────────────────────────────────────────────────────────

function printSummary(results: Result[]): void {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              TIER 6 SUMMARY                                ║');
  console.log('╠════╦═══════════╦══════════╦════════════╦══════════╦════════════════════════╣');
  console.log('║ ID ║ Kind      ║ Expected ║ Actual     ║ Delta    ║ Status                 ║');
  console.log('╠════╬═══════════╬══════════╬════════════╬══════════╬════════════════════════╣');

  for (const r of results) {
    const actualStr = r.actual === -1 ? '(skipped)' : String(r.actual);
    const deltaStr  = r.actual === -1 ? '—'         : (r.delta >= 0 ? `+${r.delta}` : String(r.delta));
    const statusStr = r.status === 'ok' ? 'ok' : `ROLLBACK${r.note ? ` — ${r.note.slice(0, 28)}` : ''}`;
    console.log(
      `║ ${pad(r.id, 2)} ║ ${pad(r.kind, 9)} ║ ${pad(r.expected, 8)} ║ ${pad(actualStr, 10)} ║ ${pad(deltaStr, 8)} ║ ${pad(statusStr, 22)} ║`
    );
  }

  console.log('╚════╩═══════════╩══════════╩════════════╩══════════╩════════════════════════╝');

  const totalExpected = results.reduce((s, r) => s + r.expected, 0);
  const totalActual   = results.filter(r => r.actual >= 0).reduce((s, r) => s + r.actual, 0);
  console.log(`\nTotal expected rows affected : ${totalExpected}`);
  console.log(`Total actual rows affected   : ${totalActual}`);
  console.log(`Overall status               : ${results.some(r => r.status === 'ROLLBACK') ? '*** ROLLBACK ***' : 'ALL OK'}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
