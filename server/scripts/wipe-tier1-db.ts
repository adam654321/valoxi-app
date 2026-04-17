/**
 * TIER 1 DATABASE WIPE — FK detachment + leaf/audit/analytics cleanup
 *
 * Kept user_company IDs : 5 (Valoxi.ai), 11 (5DCP), 13 (Goldwire Capital)
 * Kept user IDs         : 1 (Adam), 2 (Viv), 11 (Daniel), 13 (Jagdev)
 *
 * Default mode : DRY-RUN  — counts only, no writes.
 * Execute mode : EXECUTE=true npx tsx server/scripts/wipe-tier1-db.ts
 *
 * Exit codes:
 *   0 = success (dry-run completed, or execute committed)
 *   1 = safety-check failed → rolled back
 *   2 = unexpected error
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
  countSql: string;   // SELECT COUNT(*) with identical WHERE — used in dry-run and pre-check
  execSql:  string;   // DML statement — used in execute mode
}

interface Result extends Statement {
  actual:  number;
  delta:   number;
  status:  'ok' | 'ROLLBACK';
  note?:   string;
}

// ─── Safety tolerance ─────────────────────────────────────────────────────────
// Allowed deviation: ±10 % of expected, or ±5 rows (whichever is larger).

function withinTolerance(expected: number, actual: number): boolean {
  const pctBand  = Math.ceil(expected * 0.10);
  const absBand  = Math.max(pctBand, 5);
  return Math.abs(actual - expected) <= absBand;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskDbUrl(url: string | undefined): string {
  if (!url) return '(DATABASE_URL not set)';
  try {
    const u    = new URL(url);
    const host = u.hostname;
    const db   = u.pathname.replace('/', '');
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
  // ── UPDATEs ──────────────────────────────────────────────────────────────

  {
    id:       1,
    purpose:  'NULL user_id + user_company_id on beta_feedback for non-kept companies',
    kind:     'UPDATE',
    expected: 62,
    countSql: `SELECT COUNT(*) AS n FROM beta_feedback
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `UPDATE beta_feedback
               SET user_id = NULL, user_company_id = NULL
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       2,
    purpose:  'NULL updated_by_user_id on system_config for non-kept users',
    kind:     'UPDATE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM system_config
               WHERE updated_by_user_id IS NOT NULL
                 AND updated_by_user_id NOT IN (${KEPT_USER_IDS.join(',')})`,
    execSql:  `UPDATE system_config
               SET updated_by_user_id = NULL
               WHERE updated_by_user_id IS NOT NULL
                 AND updated_by_user_id NOT IN (${KEPT_USER_IDS.join(',')})`,
  },

  // ── DELETEs ──────────────────────────────────────────────────────────────

  {
    id:       3,
    purpose:  'DELETE dashboard_alerts for non-kept companies',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM dashboard_alerts
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM dashboard_alerts
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       4,
    purpose:  'DELETE team_notifications for non-kept companies',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM team_notifications
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM team_notifications
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       5,
    purpose:  'DELETE funnel_events for non-kept companies',
    kind:     'DELETE',
    expected: 845,
    countSql: `SELECT COUNT(*) AS n FROM funnel_events
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM funnel_events
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       6,
    purpose:  'DELETE token_usage for non-kept users',
    kind:     'DELETE',
    expected: 1420,
    countSql: `SELECT COUNT(*) AS n FROM token_usage
               WHERE user_id NOT IN (${KEPT_USER_IDS.join(',')})`,
    execSql:  `DELETE FROM token_usage
               WHERE user_id NOT IN (${KEPT_USER_IDS.join(',')})`,
  },
  {
    id:       7,
    purpose:  'DELETE deal_metrics_snapshots for non-kept companies',
    kind:     'DELETE',
    expected: 386,
    countSql: `SELECT COUNT(*) AS n FROM deal_metrics_snapshots
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM deal_metrics_snapshots
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       8,
    purpose:  'DELETE portal_activity_log via non-kept portal_access_tokens',
    kind:     'DELETE',
    expected: 813,
    countSql: `SELECT COUNT(*) AS n FROM portal_activity_log
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM portal_activity_log
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       9,
    purpose:  'DELETE document_access_log via non-kept documents → target_companies',
    kind:     'DELETE',
    expected: 45,
    countSql: `SELECT COUNT(*) AS n FROM document_access_log
               WHERE document_id IN (
                 SELECT id FROM documents
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
    execSql:  `DELETE FROM document_access_log
               WHERE document_id IN (
                 SELECT id FROM documents
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
  },
  {
    id:       10,
    purpose:  'DELETE file_upload_events via non-kept target_companies',
    kind:     'DELETE',
    expected: 256,
    countSql: `SELECT COUNT(*) AS n FROM file_upload_events
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM file_upload_events
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       11,
    purpose:  'DELETE stage_history via non-kept target_companies',
    kind:     'DELETE',
    expected: 33,
    countSql: `SELECT COUNT(*) AS n FROM stage_history
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM stage_history
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       12,
    purpose:  'DELETE stage1_analysis_events via non-kept target_companies',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM stage1_analysis_events
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM stage1_analysis_events
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       13,
    purpose:  'DELETE chase_up_emails via non-kept portal_access_tokens',
    kind:     'DELETE',
    expected: 36,
    countSql: `SELECT COUNT(*) AS n FROM chase_up_emails
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM chase_up_emails
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       14,
    purpose:  'DELETE chase_up_schedules via non-kept portal_access_tokens',
    kind:     'DELETE',
    expected: 9,
    countSql: `SELECT COUNT(*) AS n FROM chase_up_schedules
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM chase_up_schedules
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       15,
    purpose:  'DELETE portal_communications_log via non-kept portal_link_campaigns',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM portal_communications_log
               WHERE campaign_id IN (
                 SELECT id FROM portal_link_campaigns
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM portal_communications_log
               WHERE campaign_id IN (
                 SELECT id FROM portal_link_campaigns
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          TIER 1 DATABASE WIPE — wipe-tier1-db.ts        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Mode     : ${EXECUTE ? '*** EXECUTE — writes will be committed ***' : 'DRY-RUN  (no writes)'}`);
  console.log(`Database : ${maskDbUrl(process.env.DATABASE_URL)}`);
  console.log(`Kept companies : ${KEPT_COMPANY_IDS.join(', ')}`);
  console.log(`Kept users     : ${KEPT_USER_IDS.join(', ')}`);
  console.log('');

  const results: Result[] = [];

  if (EXECUTE) {
    // ── Execute mode: single transaction ─────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('Transaction opened.\n');

      for (const stmt of STATEMENTS) {
        // Count first (same WHERE clause, consistent read inside txn)
        const countRes = await client.query(stmt.countSql);
        const actual   = parseInt(countRes.rows[0].n, 10);

        if (!withinTolerance(stmt.expected, actual)) {
          const note = `Safety check FAILED: expected ${stmt.expected}, got ${actual} (tolerance ±${Math.max(Math.ceil(stmt.expected * 0.10), 5)})`;
          console.error(`\n[ROLLBACK] Statement ${stmt.id}: ${note}`);
          await client.query('ROLLBACK');

          results.push({ ...stmt, actual, delta: actual - stmt.expected, status: 'ROLLBACK', note });
          // Push remaining as unrun
          for (const s of STATEMENTS.slice(STATEMENTS.indexOf(stmt) + 1)) {
            results.push({ ...s, actual: -1, delta: 0, status: 'ROLLBACK', note: 'not reached — prior rollback' });
          }
          printSummary(results);
          await pool.end();
          process.exit(1);
        }

        // Execute the DML
        const execRes = await client.query(stmt.execSql);
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
    // ── Dry-run mode: SELECT COUNT(*) only ───────────────────────────────
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
  console.log('║                              TIER 1 SUMMARY                                ║');
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
