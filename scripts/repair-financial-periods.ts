import pg from 'pg';
const { Pool } = pg;

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const companyIdx = args.indexOf('--company');
const COMPANY_FILTER: number | null = companyIdx !== -1 ? parseInt(args[companyIdx + 1], 10) : null;

// ─── DB setup ────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) { console.error('DATABASE_URL is not set'); process.exit(1); }

let dbHostDisplay: string;
try {
  const url = new URL(DB_URL.replace(/^postgres(ql)?:\/\//, 'http://'));
  dbHostDisplay = url.hostname;
} catch {
  dbHostDisplay = '(unparseable)';
}

const pool = new Pool({ connectionString: DB_URL });

// ─── Constants ───────────────────────────────────────────────────────────────
// Special-merge tables: survivor null-fill from loser, then delete loser row (or re-point)
const SPECIAL_TABLES = ['income_statements', 'balance_sheets', 'staff_data'] as const;
// Re-point-only tables: UPDATE financial_period_id → survivor, no row merging
const REPOINT_TABLES = ['ebitda_adjustments'] as const;
const ALL_CHILD_TABLES = [...SPECIAL_TABLES, ...REPOINT_TABLES];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sep(char = '─', len = 66): string { return char.repeat(len); }

async function childCount(client: pg.PoolClient | pg.Pool, table: string, periodId: number): Promise<number> {
  const r = await client.query(`SELECT COUNT(*) AS cnt FROM ${table} WHERE financial_period_id = $1`, [periodId]);
  return parseInt(r.rows[0].cnt, 10);
}

// Returns non-PK, non-FK, non-timestamp column names for a table
const colCache: Record<string, string[]> = {};
async function dataColumns(table: string): Promise<string[]> {
  if (colCache[table]) return colCache[table];
  const r = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
      AND column_name NOT IN ('id','financial_period_id','target_company_id','created_at','updated_at')
    ORDER BY ordinal_position
  `, [table]);
  colCache[table] = r.rows.map((x: any) => x.column_name);
  return colCache[table];
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
  console.log(sep());
  console.log(`repair-financial-periods`);
  console.log(sep());
  console.log(`DB host:      ${dbHostDisplay}`);
  console.log(`Mode:         ${EXECUTE ? '*** EXECUTE — WRITES ENABLED ***' : 'DRY-RUN (read-only)'}`);
  if (COMPANY_FILTER != null) console.log(`Company:      ${COMPANY_FILTER}`);
  console.log('');

  // Warm column cache before transactions
  await Promise.all([...SPECIAL_TABLES].map(dataColumns));

  // ── Companies to process ──────────────────────────────────────────────────
  const compRes = await pool.query(`
    SELECT DISTINCT target_company_id
    FROM financial_periods
    ${COMPANY_FILTER != null ? `WHERE target_company_id = ${COMPANY_FILTER}` : ''}
    ORDER BY target_company_id
  `);
  const companies: number[] = compRes.rows.map((r: any) => r.target_company_id);

  if (companies.length === 0) {
    console.log('No companies found.');
    await pool.end(); return;
  }

  // ── Summary counters ──────────────────────────────────────────────────────
  let totalDupeGroups = 0;
  let totalPeriodsDeleted = 0;
  let totalRowsRepointed = 0;
  let totalBackfills = 0;
  let totalSuspects = 0;

  for (const companyId of companies) {
    console.log(`\n${sep('═')}`);
    console.log(`COMPANY ${companyId}`);
    console.log(sep('═'));

    // ── Step 1: fiscal_year backfill candidates ───────────────────────────
    const fy0Res = await pool.query(`
      SELECT id, period_end::text,
             EXTRACT(YEAR FROM period_end::date)::int AS proposed_fy
      FROM financial_periods
      WHERE target_company_id = $1 AND fiscal_year IS NULL
      ORDER BY period_end
    `, [companyId]);

    if (fy0Res.rows.length > 0) {
      console.log(`\n[1] Fiscal-year backfill candidates: ${fy0Res.rows.length}`);
      for (const r of fy0Res.rows)
        console.log(`    period ${r.id}  period_end=${r.period_end}  →  fiscal_year=${r.proposed_fy}`);
    } else {
      console.log(`\n[1] Fiscal-year backfill: none needed`);
    }

    // ── Step 2: is_full_year → false candidates ───────────────────────────
    const span0Res = await pool.query(`
      SELECT fp.id, fp.period_label, d.document_category
      FROM financial_periods fp
      LEFT JOIN documents d ON d.id = fp.source_document_id
      WHERE fp.target_company_id = $1
        AND fp.is_full_year = true
        AND (d.document_category ILIKE '%ytd%' OR fp.period_label = 'Staff Matrix')
      ORDER BY fp.id
    `, [companyId]);

    if (span0Res.rows.length > 0) {
      console.log(`\n[2] Span backfill (is_full_year → false): ${span0Res.rows.length}`);
      for (const r of span0Res.rows)
        console.log(`    period ${r.id}  label="${r.period_label}"  category="${r.document_category}"`);
    } else {
      console.log(`\n[2] Span backfill: none needed`);
    }

    // ── Step 3: Dedup groups (post-backfill effective values) ─────────────
    const dupRes = await pool.query(`
      WITH effective AS (
        SELECT
          fp.id,
          fp.period_type,
          fp.period_end,
          fp.period_label,
          fp.source_document_id,
          fp.is_full_year,
          COALESCE(fp.fiscal_year, EXTRACT(YEAR FROM fp.period_end::date)::int) AS eff_fy,
          CASE
            WHEN fp.period_label = 'Staff Matrix' THEN false
            WHEN d.document_category ILIKE '%ytd%' THEN false
            ELSE fp.is_full_year
          END AS eff_full
        FROM financial_periods fp
        LEFT JOIN documents d ON d.id = fp.source_document_id
        WHERE fp.target_company_id = $1
      )
      SELECT
        eff_fy, period_type, eff_full,
        COUNT(*)::int AS cnt,
        ARRAY_AGG(id ORDER BY id) AS period_ids
      FROM effective
      GROUP BY eff_fy, period_type, eff_full
      HAVING COUNT(*) > 1
      ORDER BY eff_fy, period_type
    `, [companyId]);

    totalDupeGroups += dupRes.rows.length;

    if (dupRes.rows.length === 0) {
      console.log(`\n[3] Dedup groups: none`);
    } else {
      console.log(`\n[3] Dedup groups: ${dupRes.rows.length}`);
    }

    // ── Per-group survivor/loser analysis ─────────────────────────────────
    type GroupPlan = {
      survivorId: number;
      loserIds: number[];
    };
    const groupPlans: GroupPlan[] = [];

    for (const grp of dupRes.rows) {
      console.log(`\n  Group: fy=${grp.eff_fy}  type=${grp.period_type}  full_year=${grp.eff_full}  (${grp.cnt} periods: [${grp.period_ids.join(', ')}])`);

      // Survivor selection query
      const candRes = await pool.query(`
        SELECT
          fp.id,
          fp.period_end::text,
          fp.source_document_id,
          i.operating_profit,
          i.revenue
        FROM financial_periods fp
        LEFT JOIN income_statements i ON i.financial_period_id = fp.id
        WHERE fp.id = ANY($1)
        ORDER BY
          (fp.source_document_id IS NOT NULL)::int DESC,
          (i.operating_profit IS NOT NULL)::int DESC,
          (i.revenue IS NOT NULL)::int DESC,
          fp.period_end DESC
      `, [grp.period_ids]);

      const survivor = candRes.rows[0];
      const losers = candRes.rows.slice(1);
      groupPlans.push({ survivorId: survivor.id, loserIds: losers.map((r: any) => r.id) });

      console.log(`    SURVIVOR  period ${survivor.id}  period_end=${survivor.period_end}  src_doc=${survivor.source_document_id}  op=${survivor.operating_profit}  rev=${survivor.revenue}`);

      for (const loser of losers) {
        console.log(`    LOSER     period ${loser.id}  period_end=${loser.period_end}  src_doc=${loser.source_document_id}  op=${loser.operating_profit}  rev=${loser.revenue}`);

        // Child rows on loser
        for (const tbl of ALL_CHILD_TABLES) {
          const cnt = await childCount(pool, tbl, loser.id);
          if (cnt > 0) console.log(`      child rows → ${tbl}: ${cnt}`);
        }

        // Null-fill preview for special tables
        for (const tbl of SPECIAL_TABLES) {
          const cols = await dataColumns(tbl);
          const sRes = await pool.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [survivor.id]);
          const lRes = await pool.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [loser.id]);
          if (sRes.rows.length > 0 && lRes.rows.length > 0) {
            const s = sRes.rows[0]; const l = lRes.rows[0];
            const fillable = cols.filter(c => s[c] == null && l[c] != null);
            if (fillable.length > 0)
              console.log(`      null-fill survivor ${tbl}: [${fillable.join(', ')}]`);
          } else if (sRes.rows.length === 0 && lRes.rows.length > 0) {
            console.log(`      survivor lacks ${tbl} row → loser row will be re-pointed`);
          }
        }
      }
    }

    // ── Step 4: Execute merge (one transaction per company) ───────────────
    if (EXECUTE) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const plan of groupPlans) {
          const { survivorId, loserIds } = plan;

          for (const loserId of loserIds) {
            // Special-merge tables
            for (const tbl of SPECIAL_TABLES) {
              const sRes = await client.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [survivorId]);
              const lRes = await client.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [loserId]);

              if (lRes.rows.length === 0) continue;

              if (sRes.rows.length > 0) {
                // Both have a row: null-fill survivor from loser, then delete loser row
                const cols = await dataColumns(tbl);
                const s = sRes.rows[0]; const l = lRes.rows[0];
                const fillCols = cols.filter(c => s[c] == null && l[c] != null);
                if (fillCols.length > 0) {
                  const setStr = fillCols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
                  const vals = fillCols.map(c => l[c]);
                  await client.query(
                    `UPDATE ${tbl} SET ${setStr} WHERE financial_period_id = $1`,
                    [survivorId, ...vals]
                  );
                  totalRowsRepointed += fillCols.length;
                }
                await client.query(`DELETE FROM ${tbl} WHERE financial_period_id = $1`, [loserId]);
              } else {
                // Survivor lacks the row: re-point loser row to survivor
                await client.query(
                  `UPDATE ${tbl} SET financial_period_id = $1 WHERE financial_period_id = $2`,
                  [survivorId, loserId]
                );
                totalRowsRepointed++;
              }
            }

            // Re-point-only tables
            for (const tbl of REPOINT_TABLES) {
              const cnt = await childCount(client, tbl, loserId);
              if (cnt > 0) {
                await client.query(
                  `UPDATE ${tbl} SET financial_period_id = $1 WHERE financial_period_id = $2`,
                  [survivorId, loserId]
                );
                totalRowsRepointed += cnt;
              }
            }

            // Safety check: loser must now be childless
            let remaining = 0;
            for (const tbl of ALL_CHILD_TABLES) remaining += await childCount(client, tbl, loserId);
            if (remaining > 0) {
              throw new Error(`SAFETY: period ${loserId} still has ${remaining} child rows after merge — rolling back`);
            }

            // Delete loser period row
            await client.query(`DELETE FROM financial_periods WHERE id = $1`, [loserId]);
            totalPeriodsDeleted++;
            console.log(`  [EXECUTE] Deleted loser period ${loserId}, re-pointed children → survivor ${survivorId}`);
          }
        }

        // Apply fiscal_year backfills
        for (const r of fy0Res.rows) {
          await client.query(
            `UPDATE financial_periods SET fiscal_year = $1 WHERE id = $2`,
            [r.proposed_fy, r.id]
          );
          totalBackfills++;
        }

        // Apply is_full_year → false backfills
        for (const r of span0Res.rows) {
          await client.query(
            `UPDATE financial_periods SET is_full_year = false WHERE id = $1`,
            [r.id]
          );
          totalBackfills++;
        }

        await client.query('COMMIT');
        console.log(`  [EXECUTE] Transaction committed for company ${companyId}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  [EXECUTE] ROLLBACK for company ${companyId}: ${err}`);
        throw err;
      } finally {
        client.release();
      }
    }

    // ── Step 5: Suspect flags (report-only, never written) ────────────────
    const modalRes = await pool.query(`
      SELECT TO_CHAR(period_end::date, 'MM-DD') AS md, COUNT(*) AS cnt
      FROM financial_periods
      WHERE target_company_id = $1
        AND period_type = 'statutory'
        AND period_end IS NOT NULL
      GROUP BY TO_CHAR(period_end::date, 'MM-DD')
      ORDER BY cnt DESC
      LIMIT 1
    `, [companyId]);

    if (modalRes.rows.length > 0) {
      const modal = modalRes.rows[0].md;
      const suspRes = await pool.query(`
        SELECT fp.id, fp.period_end::text, fp.period_label,
               fp.source_document_id, d.document_name AS doc_name
        FROM financial_periods fp
        LEFT JOIN documents d ON d.id = fp.source_document_id
        WHERE fp.target_company_id = $1
          AND fp.is_full_year = true
          AND fp.period_type = 'management'
          AND TO_CHAR(fp.period_end::date, 'MM-DD') != $2
        ORDER BY fp.period_end
      `, [companyId, modal]);

      if (suspRes.rows.length > 0) {
        console.log(`\n[5] RE-ANALYSIS CANDIDATES (modal period-end month/day = ${modal}):`);
        for (const r of suspRes.rows) {
          console.log(`    period ${r.id}  period_end=${r.period_end}  label="${r.period_label}"  src_doc=${r.source_document_id}  doc="${r.doc_name}"`);
        }
        totalSuspects += suspRes.rows.length;
      } else {
        console.log(`\n[5] RE-ANALYSIS CANDIDATES: none`);
      }
    } else {
      console.log(`\n[5] RE-ANALYSIS CANDIDATES: no statutory periods (cannot compute modal month/day)`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${sep('═')}`);
  console.log('SUMMARY');
  console.log(sep('═'));
  console.log(`Dupe groups found:  ${totalDupeGroups}`);
  if (EXECUTE) {
    console.log(`Periods deleted:    ${totalPeriodsDeleted}`);
    console.log(`Rows re-pointed:    ${totalRowsRepointed}`);
    console.log(`Backfills applied:  ${totalBackfills}`);
  }
  console.log(`Suspects flagged:   ${totalSuspects}`);
  if (!EXECUTE) console.log('\n(dry-run — pass --execute to apply changes)');

  await pool.end();
}

run().catch(async err => {
  console.error('\nFatal error:', err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
