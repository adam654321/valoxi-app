/**
 * TIER 4 DATABASE WIPE — subscription_events, subscriptions, promo_codes,
 *                         promo_code_campaigns, user_invitations, issue_reports
 *
 * Kept user_company IDs : 5 (Valoxi.ai), 11 (5DCP), 13 (Goldwire Capital)
 * Kept user IDs         : 1 (Adam), 2 (Viv), 11 (Daniel), 13 (Jagdev)
 *
 * Default mode : DRY-RUN  — counts only, no writes.
 * Execute mode : EXECUTE=true npx tsx server/scripts/wipe-tier4-db.ts
 *
 * Exit codes:
 *   0 = success (dry-run completed, or execute committed)
 *   1 = safety-check failed → rolled back
 *   2 = unexpected error
 *
 * ── Tier dependency ──────────────────────────────────────────────────────────
 * Tiers 1, 2, and 3 must be complete before running this script.
 * Tier 1 wiped portal_communications_log (which had a nullable FK into
 * portal_link_campaigns) and deal_documents (nullable FK into
 * deal_document_templates). Tiers 2 and 3 wiped all referencing rows in
 * tables that point back to target_companies and related T2/T3 tables.
 * Pre-check confirmed zero NOT NULL FK blockers into any T4 parent table.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Tables with zero rows (no statements needed) ─────────────────────────────
 * portal_email_templates, portal_analytics, portal_link_campaigns,
 * company_document_requirements, document_stage_progression,
 * document_requirement_submissions, addon_purchases — all 0 rows at time of
 * scoping. deal_document_templates — 3 rows, all is_system=true (kept).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Statement ordering rationale ─────────────────────────────────────────────
 * Stmt 1  : subscription_events — no FK to subscriptions table (no
 *           subscription_id column), but wiped before subscriptions by
 *           convention and to reduce noise.
 * Stmt 2  : subscriptions non-kept — removes the bulk of promo_code
 *           references from non-kept companies before the whole-table wipe.
 * Stmt 3  : UPDATE subscriptions SET promo_code_id = NULL for kept
 *           companies — intentional hygiene step to clean the two dangling
 *           promo_code_id references (sub_id=11 → pc=11, sub_id=13 → pc=12)
 *           on kept subscriptions before the whole-table promo_codes wipe.
 *           subscriptions.promo_code_id is nullable with no FK constraint,
 *           so deletion of promo_codes would not cause a constraint error,
 *           but this UPDATE leaves kept subscriptions in a clean state.
 * Stmt 4  : DELETE FROM promo_codes (entire table — all 61 rows are
 *           obsolete beta codes; a new coupon set will be loaded separately).
 *           Must run BEFORE promo_code_campaigns because promo_codes.campaign_id
 *           is NOT NULL with NO ACTION FK into promo_code_campaigns.
 * Stmt 5  : DELETE FROM promo_code_campaigns (entire table, 4 rows) — after
 *           promo_codes so the NOT NULL FK is satisfied.
 * Stmts 6-7: user_invitations and issue_reports — no intra-tier FK
 *           dependencies, order is arbitrary.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { pool } from '../db';

// ─── Constants ────────────────────────────────────────────────────────────────

const KEPT_COMPANY_IDS = [5, 11, 13];
const KEPT_USER_IDS    = [1, 2, 11, 13];
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
// ±10% of expected, or ±5 rows (whichever is larger).

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
    purpose:  'DELETE subscription_events for non-kept companies (before subscriptions by convention)',
    kind:     'DELETE',
    expected: 4,
    countSql: `SELECT COUNT(*) AS n FROM subscription_events
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM subscription_events
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },

  {
    id:       2,
    purpose:  'DELETE subscriptions for non-kept companies (removes bulk of promo_code refs before whole-table promo_codes wipe)',
    kind:     'DELETE',
    expected: 26,
    countSql: `SELECT COUNT(*) AS n FROM subscriptions
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM subscriptions
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },

  {
    id:       3,
    purpose:  'UPDATE kept subscriptions — NULL out promo_code_id before whole-table promo_codes wipe (hygiene: 2 kept subs reference promo_code_id 11 and 12)',
    kind:     'UPDATE',
    expected: 2,
    countSql: `SELECT COUNT(*) AS n FROM subscriptions
               WHERE user_company_id IN (${KEPT_COMPANY_IDS.join(',')})
                 AND promo_code_id IS NOT NULL`,
    execSql:  `UPDATE subscriptions
               SET promo_code_id = NULL
               WHERE user_company_id IN (${KEPT_COMPANY_IDS.join(',')})
                 AND promo_code_id IS NOT NULL`,
  },

  {
    id:       4,
    purpose:  'DELETE FROM promo_codes — entire table (all 61 beta codes obsolete; new coupon set to be loaded separately). Must precede promo_code_campaigns due to NOT NULL FK.',
    kind:     'DELETE',
    expected: 61,
    countSql: `SELECT COUNT(*) AS n FROM promo_codes`,
    execSql:  `DELETE FROM promo_codes`,
  },

  {
    id:       5,
    purpose:  'DELETE FROM promo_code_campaigns — entire table (4 rows, after promo_codes due to NOT NULL FK on campaign_id)',
    kind:     'DELETE',
    expected: 4,
    countSql: `SELECT COUNT(*) AS n FROM promo_code_campaigns`,
    execSql:  `DELETE FROM promo_code_campaigns`,
  },

  {
    id:       6,
    purpose:  'DELETE user_invitations for non-kept companies',
    kind:     'DELETE',
    expected: 1,
    countSql: `SELECT COUNT(*) AS n FROM user_invitations
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM user_invitations
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },

  {
    id:       7,
    purpose:  'DELETE issue_reports for non-kept companies',
    kind:     'DELETE',
    expected: 6,
    countSql: `SELECT COUNT(*) AS n FROM issue_reports
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM issue_reports
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },

];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          TIER 4 DATABASE WIPE — wipe-tier4-db.ts        ║');
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

// ─── Summary printer ─────────────────────────────────────────────────────────

function printSummary(results: Result[]): void {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              TIER 4 SUMMARY                                ║');
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
