/**
 * TIER 3 DATABASE WIPE — financials, financial_periods, portal_access_tokens,
 *                         target_contacts, target_companies
 *
 * Kept user_company IDs : 5 (Valoxi.ai), 11 (5DCP), 13 (Goldwire Capital)
 * Kept user IDs         : 1 (Adam), 2 (Viv), 11 (Daniel), 13 (Jagdev)
 *
 * Default mode : DRY-RUN  — counts only, no writes.
 * Execute mode : EXECUTE=true npx tsx server/scripts/wipe-tier3-db.ts
 *
 * Exit codes:
 *   0 = success (dry-run completed, or execute committed)
 *   1 = safety-check failed → rolled back
 *   2 = unexpected error
 *
 * ── Tier dependency ──────────────────────────────────────────────────────────
 * This script depends on Tiers 1 and 2 being complete. If run against a DB
 * that has not had Tiers 1 and 2 applied, multiple statements will fail with
 * NOT NULL FK violations from T1/T2 tables that still reference these tables
 * (e.g. documents, external_document_submissions, deal_documents,
 * dd_requirement_documents, dd_requirement_status, portal_document_requirements,
 * expert_analysis_results, file_upload_events, etc. all carry NOT NULL or
 * nullable NO ACTION FKs into target_companies and financial_periods).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Statement ordering rationale (FK-sweep verified) ─────────────────────────
 * Stmts 1-4  : Financial tables with financial_period_id NOT NULL FK
 *              (balance_sheets, income_statements, staff_data, ebitda_adjustments)
 *              must run BEFORE financial_periods.
 * Stmts 5-8  : Remaining financial leaf tables (fixed_assets_register,
 *              loan_facilities, valuations, aged_debtors) — only target_company_id
 *              FK, must run BEFORE target_companies.
 * Stmt  9    : financial_periods — after all financial leaf tables,
 *              before target_companies.
 * Stmts 10-11: deal_notes + user_deal_assignments — before target_companies.
 * Stmt  12   : portal_access_tokens — target_contact_id NOT NULL FK →
 *              must run BEFORE target_contacts; target_company_id NOT NULL →
 *              must run BEFORE target_companies.
 * Stmt  13   : target_contacts — target_company_id NOT NULL → before
 *              target_companies.
 * Stmt  14   : target_companies — last; all T3 tables depend on it.
 *
 * Zero UPDATEs needed: all nullable FKs to documents (source_document_id)
 * were nulled in Tier 2 stmts 1-6. Zero external blockers: Tiers 1 and 2
 * already wiped every external table that referenced T3 tables.
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
    purpose:  'DELETE balance_sheets via non-kept target_companies (financial_period_id NOT NULL → before financial_periods)',
    kind:     'DELETE',
    expected: 221,
    countSql: `SELECT COUNT(*) AS n FROM balance_sheets
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM balance_sheets
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       2,
    purpose:  'DELETE income_statements via non-kept target_companies (financial_period_id NOT NULL → before financial_periods)',
    kind:     'DELETE',
    expected: 249,
    countSql: `SELECT COUNT(*) AS n FROM income_statements
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM income_statements
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       3,
    purpose:  'DELETE staff_data via non-kept target_companies (financial_period_id NOT NULL → before financial_periods)',
    kind:     'DELETE',
    expected: 13,
    countSql: `SELECT COUNT(*) AS n FROM staff_data
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM staff_data
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       4,
    purpose:  'DELETE ebitda_adjustments via non-kept target_companies (financial_period_id NOT NULL → before financial_periods)',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM ebitda_adjustments
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM ebitda_adjustments
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       5,
    purpose:  'DELETE fixed_assets_register via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 12,
    countSql: `SELECT COUNT(*) AS n FROM fixed_assets_register
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM fixed_assets_register
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       6,
    purpose:  'DELETE loan_facilities via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM loan_facilities
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM loan_facilities
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       7,
    purpose:  'DELETE valuations via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM valuations
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM valuations
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       8,
    purpose:  'DELETE aged_debtors via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 11,
    countSql: `SELECT COUNT(*) AS n FROM aged_debtors
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM aged_debtors
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       9,
    purpose:  'DELETE financial_periods via non-kept target_companies (after financial leaf tables, before target_companies)',
    kind:     'DELETE',
    expected: 280,
    countSql: `SELECT COUNT(*) AS n FROM financial_periods
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM financial_periods
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       10,
    purpose:  'DELETE deal_notes via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM deal_notes
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM deal_notes
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       11,
    purpose:  'DELETE user_deal_assignments via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM user_deal_assignments
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM user_deal_assignments
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       12,
    purpose:  'DELETE portal_access_tokens for non-kept companies (target_contact_id NOT NULL → before target_contacts; target_company_id NOT NULL → before target_companies)',
    kind:     'DELETE',
    expected: 9,
    countSql: `SELECT COUNT(*) AS n FROM portal_access_tokens
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM portal_access_tokens
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       13,
    purpose:  'DELETE target_contacts via non-kept target_companies (before target_companies)',
    kind:     'DELETE',
    expected: 17,
    countSql: `SELECT COUNT(*) AS n FROM target_contacts
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM target_contacts
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       14,
    purpose:  'DELETE target_companies for non-kept user_companies (last — all T3 tables depend on this)',
    kind:     'DELETE',
    expected: 56,
    countSql: `SELECT COUNT(*) AS n FROM target_companies
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM target_companies
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          TIER 3 DATABASE WIPE — wipe-tier3-db.ts        ║');
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
  console.log('║                              TIER 3 SUMMARY                                ║');
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
