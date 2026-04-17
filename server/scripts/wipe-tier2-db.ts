/**
 * TIER 2 DATABASE WIPE — analysis results, deal models, deal documents, value creation, documents
 *
 * Kept user_company IDs : 5 (Valoxi.ai), 11 (5DCP), 13 (Goldwire Capital)
 * Kept user IDs         : 1 (Adam), 2 (Viv), 11 (Daniel), 13 (Jagdev)
 *
 * Default mode : DRY-RUN  — counts only, no writes.
 * Execute mode : EXECUTE=true npx tsx server/scripts/wipe-tier2-db.ts
 *
 * Exit codes:
 *   0 = success (dry-run completed, or execute committed)
 *   1 = safety-check failed → rolled back
 *   2 = unexpected error
 *
 * ── Tier 1 dependency ────────────────────────────────────────────────────────
 * This script depends on Tier 1 being complete — specifically,
 * document_analysis_results, file_upload_events, and document_access_log must
 * already be wiped for non-kept documents. If run against a DB that has not had
 * Tier 1 applied, statements #13 (documents DELETE) and #14
 * (external_document_submissions DELETE) will fail with NOT NULL FK violations
 * from those T1 tables.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Statement ordering rationale (FK-sweep verified) ─────────────────────────
 * Stmts 1-6  : NULL out T3 source_document_id refs → documents (NO ACTION FKs,
 *              786 blocking rows across 6 T3 tables).
 * Stmt  8    : deal_document_responses before deal_documents (NOT NULL FK).
 * Stmts 9-10 : dd_requirement_documents before dd_requirement_status (NOT NULL FK),
 *              and before documents (15 NO ACTION document_id blocking rows).
 * Stmt  12   : deal_documents before deal_models (12 NO ACTION deal_model_id rows).
 * Stmt  13   : documents before external_document_submissions — 59 documents rows
 *              hold NO ACTION external_submission_id references; reordering avoids
 *              an otherwise required 7th UPDATE.
 * Stmts 16-19: value_creation leaf tables before value_creation_scenarios before
 *              deal_models (all NOT NULL FKs).
 * Stmts 20-21: deal_model_adjustments + deal_model_funding_lines before deal_models
 *              (NOT NULL FKs).
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

  // ── UPDATEs: NULL out T3 source_document_id refs before documents DELETE ──

  {
    id:       1,
    purpose:  'NULL source_document_id on aged_debtors referencing non-kept documents',
    kind:     'UPDATE',
    expected: 11,
    countSql: `SELECT COUNT(*) AS n FROM aged_debtors
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
    execSql:  `UPDATE aged_debtors
               SET source_document_id = NULL
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
  },
  {
    id:       2,
    purpose:  'NULL source_document_id on balance_sheets referencing non-kept documents',
    kind:     'UPDATE',
    expected: 221,
    countSql: `SELECT COUNT(*) AS n FROM balance_sheets
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
    execSql:  `UPDATE balance_sheets
               SET source_document_id = NULL
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
  },
  {
    id:       3,
    purpose:  'NULL source_document_id on financial_periods referencing non-kept documents',
    kind:     'UPDATE',
    expected: 280,
    countSql: `SELECT COUNT(*) AS n FROM financial_periods
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
    execSql:  `UPDATE financial_periods
               SET source_document_id = NULL
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
  },
  {
    id:       4,
    purpose:  'NULL source_document_id on fixed_assets_register referencing non-kept documents',
    kind:     'UPDATE',
    expected: 12,
    countSql: `SELECT COUNT(*) AS n FROM fixed_assets_register
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
    execSql:  `UPDATE fixed_assets_register
               SET source_document_id = NULL
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
  },
  {
    id:       5,
    purpose:  'NULL source_document_id on income_statements referencing non-kept documents',
    kind:     'UPDATE',
    expected: 249,
    countSql: `SELECT COUNT(*) AS n FROM income_statements
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
    execSql:  `UPDATE income_statements
               SET source_document_id = NULL
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
  },
  {
    id:       6,
    purpose:  'NULL source_document_id on staff_data referencing non-kept documents',
    kind:     'UPDATE',
    expected: 13,
    countSql: `SELECT COUNT(*) AS n FROM staff_data
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
    execSql:  `UPDATE staff_data
               SET source_document_id = NULL
               WHERE source_document_id IS NOT NULL
                 AND source_document_id IN (
                   SELECT id FROM documents
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )`,
  },

  // ── DELETEs ───────────────────────────────────────────────────────────────

  {
    id:       7,
    purpose:  'DELETE expert_analysis_results via non-kept target_companies',
    kind:     'DELETE',
    expected: 497,
    countSql: `SELECT COUNT(*) AS n FROM expert_analysis_results
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM expert_analysis_results
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       8,
    purpose:  'DELETE deal_document_responses via non-kept deal_documents (before deal_documents)',
    kind:     'DELETE',
    expected: 19,
    countSql: `SELECT COUNT(*) AS n FROM deal_document_responses
               WHERE deal_document_id IN (
                 SELECT id FROM deal_documents
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM deal_document_responses
               WHERE deal_document_id IN (
                 SELECT id FROM deal_documents
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       9,
    purpose:  'DELETE dd_requirement_documents via non-kept target_companies (before dd_requirement_status + documents)',
    kind:     'DELETE',
    expected: 15,
    countSql: `SELECT COUNT(*) AS n FROM dd_requirement_documents
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM dd_requirement_documents
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       10,
    purpose:  'DELETE dd_requirement_status via non-kept target_companies',
    kind:     'DELETE',
    expected: 7,
    countSql: `SELECT COUNT(*) AS n FROM dd_requirement_status
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM dd_requirement_status
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       11,
    purpose:  'DELETE portal_document_requirements via non-kept portal_access_tokens',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM portal_document_requirements
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM portal_document_requirements
               WHERE portal_token_id IN (
                 SELECT id FROM portal_access_tokens
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       12,
    purpose:  'DELETE deal_documents for non-kept companies (before deal_models)',
    kind:     'DELETE',
    expected: 21,
    countSql: `SELECT COUNT(*) AS n FROM deal_documents
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM deal_documents
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       13,
    purpose:  'DELETE documents via non-kept target_companies (before external_document_submissions — 59 NO ACTION ext_submission_id refs)',
    kind:     'DELETE',
    expected: 296,
    countSql: `SELECT COUNT(*) AS n FROM documents
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM documents
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       14,
    purpose:  'DELETE external_document_submissions via non-kept target_companies (after documents)',
    kind:     'DELETE',
    expected: 62,
    countSql: `SELECT COUNT(*) AS n FROM external_document_submissions
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM external_document_submissions
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
  {
    id:       15,
    purpose:  'DELETE current_offers for non-kept companies',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM current_offers
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
    execSql:  `DELETE FROM current_offers
               WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})`,
  },
  {
    id:       16,
    purpose:  'DELETE value_creation_assumptions via non-kept deal_models (before value_creation_scenarios)',
    kind:     'DELETE',
    expected: 405,
    countSql: `SELECT COUNT(*) AS n FROM value_creation_assumptions
               WHERE scenario_id IN (
                 SELECT id FROM value_creation_scenarios
                 WHERE deal_model_id IN (
                   SELECT id FROM deal_models
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )
               )`,
    execSql:  `DELETE FROM value_creation_assumptions
               WHERE scenario_id IN (
                 SELECT id FROM value_creation_scenarios
                 WHERE deal_model_id IN (
                   SELECT id FROM deal_models
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )
               )`,
  },
  {
    id:       17,
    purpose:  'DELETE value_creation_synergies via non-kept deal_models (before value_creation_scenarios)',
    kind:     'DELETE',
    expected: 0,
    countSql: `SELECT COUNT(*) AS n FROM value_creation_synergies
               WHERE scenario_id IN (
                 SELECT id FROM value_creation_scenarios
                 WHERE deal_model_id IN (
                   SELECT id FROM deal_models
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )
               )`,
    execSql:  `DELETE FROM value_creation_synergies
               WHERE scenario_id IN (
                 SELECT id FROM value_creation_scenarios
                 WHERE deal_model_id IN (
                   SELECT id FROM deal_models
                   WHERE target_company_id IN (
                     SELECT id FROM target_companies
                     WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                   )
                 )
               )`,
  },
  {
    id:       18,
    purpose:  'DELETE value_creation_exit_assumptions via non-kept deal_models (before deal_models)',
    kind:     'DELETE',
    expected: 27,
    countSql: `SELECT COUNT(*) AS n FROM value_creation_exit_assumptions
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
    execSql:  `DELETE FROM value_creation_exit_assumptions
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
  },
  {
    id:       19,
    purpose:  'DELETE value_creation_scenarios via non-kept deal_models (after assumptions/synergies, before deal_models)',
    kind:     'DELETE',
    expected: 81,
    countSql: `SELECT COUNT(*) AS n FROM value_creation_scenarios
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
    execSql:  `DELETE FROM value_creation_scenarios
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
  },
  {
    id:       20,
    purpose:  'DELETE deal_model_adjustments via non-kept deal_models (before deal_models)',
    kind:     'DELETE',
    expected: 174,
    countSql: `SELECT COUNT(*) AS n FROM deal_model_adjustments
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
    execSql:  `DELETE FROM deal_model_adjustments
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
  },
  {
    id:       21,
    purpose:  'DELETE deal_model_funding_lines via non-kept deal_models (before deal_models)',
    kind:     'DELETE',
    expected: 116,
    countSql: `SELECT COUNT(*) AS n FROM deal_model_funding_lines
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
    execSql:  `DELETE FROM deal_model_funding_lines
               WHERE deal_model_id IN (
                 SELECT id FROM deal_models
                 WHERE target_company_id IN (
                   SELECT id FROM target_companies
                   WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
                 )
               )`,
  },
  {
    id:       22,
    purpose:  'DELETE deal_models via non-kept target_companies',
    kind:     'DELETE',
    expected: 36,
    countSql: `SELECT COUNT(*) AS n FROM deal_models
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
    execSql:  `DELETE FROM deal_models
               WHERE target_company_id IN (
                 SELECT id FROM target_companies
                 WHERE user_company_id NOT IN (${KEPT_COMPANY_IDS.join(',')})
               )`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          TIER 2 DATABASE WIPE — wipe-tier2-db.ts        ║');
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
  console.log('║                              TIER 2 SUMMARY                                ║');
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
