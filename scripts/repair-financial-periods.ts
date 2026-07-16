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
const SPECIAL_TABLES = ['income_statements', 'balance_sheets', 'staff_data'] as const;
const REPOINT_TABLES = ['ebitda_adjustments'] as const;
const ALL_CHILD_TABLES = [...SPECIAL_TABLES, ...REPOINT_TABLES];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sep(char = '─', len = 66): string { return char.repeat(len); }

async function childCount(client: pg.PoolClient | pg.Pool, table: string, periodId: number): Promise<number> {
  const r = await client.query(`SELECT COUNT(*) AS cnt FROM ${table} WHERE financial_period_id = $1`, [periodId]);
  return parseInt(r.rows[0].cnt, 10);
}

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

// ─── modal computation helpers (Change 1) ────────────────────────────────────

/** True if d is the last calendar day of its UTC month. */
function isEOM(d: Date): boolean {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return next.getUTCMonth() !== d.getUTCMonth();
}

/**
 * Leap-equivalence: two period-end dates represent the same fiscal year-end if
 * they share the same month AND (|day diff| <= 1 OR both are last-of-their-month).
 */
function leapEquiv(d1: Date, d2: Date): boolean {
  if (d1.getUTCMonth() !== d2.getUTCMonth()) return false;
  const diff = Math.abs(d1.getUTCDate() - d2.getUTCDate());
  return diff <= 1 || (isEOM(d1) && isEOM(d2));
}

/**
 * Compute modal year-end date from an array of period-end Date objects.
 * Returns the representative Date of the most frequent equivalence class,
 * or null if no class has >= 2 members.
 */
function computeModal(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  const clusters: { rep: Date; count: number }[] = [];
  for (const d of dates) {
    const existing = clusters.find(c => leapEquiv(c.rep, d));
    if (existing) {
      existing.count++;
    } else {
      clusters.push({ rep: d, count: 1 });
    }
  }
  clusters.sort((a, b) => b.count - a.count);
  if (clusters[0].count >= 2) return clusters[0].rep;
  return null;
}

/** Format a Date as YYYY-MM-DD (UTC) for display / SQL. */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format a modal Date as MM-DD for display. */
function toMMDD(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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
  let totalOrphans = 0;
  let totalHollowsDeleted = 0;
  let totalMonthsBackfilled = 0;

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

    // ── Step 2: Classification pass (Change 1) ────────────────────────────
    // Fetch all periods for this company with doc category
    const allPeriodsRes = await pool.query(`
      SELECT
        fp.id,
        fp.period_end::text,
        fp.period_label,
        fp.period_type,
        fp.is_full_year,
        fp.fiscal_year,
        fp.source_document_id,
        fp.months_covered,
        COALESCE(fp.fiscal_year, EXTRACT(YEAR FROM fp.period_end::date)::int) AS eff_fy,
        d.document_category AS doc_category
      FROM financial_periods fp
      LEFT JOIN documents d ON d.id = fp.source_document_id
      WHERE fp.target_company_id = $1
      ORDER BY fp.id
    `, [companyId]);

    const allPeriods: any[] = allPeriodsRes.rows;

    // Compute modal from statutory period-end dates
    const statutoryDates = allPeriods
      .filter(p => p.period_type === 'statutory' && p.period_end)
      .map(p => new Date(p.period_end));
    const modal = computeModal(statutoryDates);
    const modalReliable = modal !== null;

    // Build effective is_full_year for every period (Change 1b/1c)
    const effMap = new Map<number, { eff: boolean; reason: string }>();
    for (const p of allPeriods) {
      let eff: boolean;
      let reason: string;
      if (modalReliable && p.period_end) {
        const matches = leapEquiv(new Date(p.period_end), modal!);
        eff = matches;
        reason = matches ? 'modal-match' : 'modal-mismatch';
      } else {
        // category fallback (Change 1c)
        const isCatYTD = typeof p.doc_category === 'string' && p.doc_category.toLowerCase().includes('ytd');
        const isStaffMatrix = p.period_label === 'Staff Matrix';
        eff = !(isCatYTD || isStaffMatrix);
        reason = 'category-fallback';
      }
      effMap.set(p.id, { eff, reason });
    }

    // Print classification pass (Change 1d): only periods with a stored/eff mismatch
    const classDiffs = allPeriods.filter(p => {
      const e = effMap.get(p.id)!;
      return e.eff !== p.is_full_year;
    });

    if (modalReliable) {
      console.log(`\n[2] Classification pass (modal year-end = ${toMMDD(modal!)}): ${classDiffs.length > 0 ? classDiffs.length + ' mismatch(es)' : 'no mismatches'}`);
    } else {
      console.log(`\n[2] Classification pass (no reliable modal — category fallback): ${classDiffs.length > 0 ? classDiffs.length + ' mismatch(es)' : 'no mismatches'}`);
    }
    for (const p of classDiffs) {
      const e = effMap.get(p.id)!;
      console.log(`    period ${p.id}  label="${p.period_label}"  stored=${p.is_full_year} → eff=${e.eff}  reason=${e.reason}`);
    }

    // ── Step 2b: Orphan cleanup candidates (Change 2) ────────────────────
    // Single query: null source doc AND no children across all FK tables
    const orphanRes = await pool.query(`
      SELECT fp.id
      FROM financial_periods fp
      WHERE fp.target_company_id = $1
        AND fp.source_document_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM income_statements   WHERE financial_period_id = fp.id)
        AND NOT EXISTS (SELECT 1 FROM balance_sheets      WHERE financial_period_id = fp.id)
        AND NOT EXISTS (SELECT 1 FROM staff_data          WHERE financial_period_id = fp.id)
        AND NOT EXISTS (SELECT 1 FROM ebitda_adjustments  WHERE financial_period_id = fp.id)
      ORDER BY fp.id
    `, [companyId]);
    const orphanIds: number[] = orphanRes.rows.map((r: any) => r.id);

    if (orphanIds.length > 0) {
      console.log(`\n[2b] ORPHANS (no source doc, no children): ${orphanIds.length}`);
      for (const oid of orphanIds) {
        const p = allPeriods.find((x: any) => x.id === oid)!;
        console.log(`    period ${oid}  label="${p.period_label}"  period_end=${p.period_end}  type=${p.period_type}`);
      }
      totalOrphans += orphanIds.length;
    } else {
      console.log(`\n[2b] ORPHANS: none`);
    }

    // ── Step 3: Dedup groups keyed on effective is_full_year (Change 5) ──
    // Exclude orphans from dedup (they will be deleted before merge runs)
    const orphanIdSet = new Set(orphanIds);
    const deduplicable = allPeriods.filter(p => !orphanIdSet.has(p.id));

    type GroupKey = string;
    const groupMap = new Map<GroupKey, any[]>();
    for (const p of deduplicable) {
      const e = effMap.get(p.id)!;
      const key = `${p.eff_fy}|${p.period_type}|${e.eff}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(p);
    }

    const dupGroups = [...groupMap.entries()]
      .filter(([, periods]) => periods.length > 1)
      .sort(([ka], [kb]) => {
        const [fyA, typeA] = ka.split('|');
        const [fyB, typeB] = kb.split('|');
        if (fyA !== fyB) return parseInt(fyA) - parseInt(fyB);
        return typeA.localeCompare(typeB);
      });

    totalDupeGroups += dupGroups.length;

    if (dupGroups.length === 0) {
      console.log(`\n[3] Dedup groups: none`);
    } else {
      console.log(`\n[3] Dedup groups: ${dupGroups.length}`);
    }

    // ── Per-group survivor/loser analysis ─────────────────────────────────
    type GroupPlan = {
      survivorId: number;
      loserIds: number[];
      effFull: boolean;
    };
    const groupPlans: GroupPlan[] = [];

    const modalDateStr = modal ? toDateStr(modal) : null;

    // SQL modal-match expression (reused in two places in survivor ORDER BY)
    const MODAL_MATCH_EXPR = `
      CASE
        WHEN $2::date IS NOT NULL
          AND EXTRACT(MONTH FROM fp.period_end::date) = EXTRACT(MONTH FROM $2::date)
          AND (
            ABS(EXTRACT(DAY FROM fp.period_end::date)::int - EXTRACT(DAY FROM $2::date)::int) <= 1
            OR (
              fp.period_end::date = (DATE_TRUNC('month', fp.period_end::date) + INTERVAL '1 month' - INTERVAL '1 day')::date
              AND $2::date = (DATE_TRUNC('month', $2::date) + INTERVAL '1 month' - INTERVAL '1 day')::date
            )
          )
        THEN 1 ELSE 0
      END
    `;

    for (const [key, periods] of dupGroups) {
      const [effFyStr, periodType, effFullStr] = key.split('|');
      const effFull = effFullStr === 'true';
      const periodIds = periods.map((p: any) => p.id);

      console.log(`\n  Group: fy=${effFyStr}  type=${periodType}  full_year=${effFull}  (${periods.length} periods: [${periodIds.join(', ')}])`);

      // Survivor selection — Change 3 ordering:
      // 1) has source_document_id
      // 2) has operating_profit (non-null)
      // 3) highest revenue (numeric desc)
      // 4) period_end matches modal (leap-equiv)
      // 5) latest period_end
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
          COALESCE(i.revenue, 0) DESC,
          ${MODAL_MATCH_EXPR} DESC,
          fp.period_end DESC
      `, [periodIds, modalDateStr]);

      const survivor = candRes.rows[0];
      const losers = candRes.rows.slice(1);
      groupPlans.push({ survivorId: survivor.id, loserIds: losers.map((r: any) => r.id), effFull });

      console.log(`    SURVIVOR  period ${survivor.id}  period_end=${survivor.period_end}  src_doc=${survivor.source_document_id}  op=${survivor.operating_profit}  rev=${survivor.revenue}`);

      for (const loser of losers) {
        console.log(`    LOSER     period ${loser.id}  period_end=${loser.period_end}  src_doc=${loser.source_document_id}  op=${loser.operating_profit}  rev=${loser.revenue}`);

        // Fetch special-table rows upfront (used for both audit logging and null-fill)
        const specialRows: Record<string, { survivor: any | null; loser: any | null }> = {};
        for (const tbl of SPECIAL_TABLES) {
          const sRes = await pool.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [survivor.id]);
          const lRes = await pool.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [loser.id]);
          specialRows[tbl] = {
            survivor: sRes.rows[0] ?? null,
            loser: lRes.rows[0] ?? null,
          };
        }

        // AUDIT-ARCHIVE (Change 4): loser row will be deleted when survivor already has one
        // Print BEFORE child-row counts and null-fill summary
        for (const tbl of ['income_statements', 'balance_sheets'] as const) {
          const { survivor: sRow, loser: lRow } = specialRows[tbl];
          if (sRow !== null && lRow !== null) {
            console.log(`      AUDIT-ARCHIVE  period=${loser.id}  doc=${loser.source_document_id}  table=${tbl}`);
            console.log(`      ${JSON.stringify(lRow)}`);
          }
        }

        // Child row counts
        for (const tbl of ALL_CHILD_TABLES) {
          const cnt = await childCount(pool, tbl, loser.id);
          if (cnt > 0) console.log(`      child rows → ${tbl}: ${cnt}`);
        }

        // Null-fill / re-point preview
        for (const tbl of SPECIAL_TABLES) {
          const { survivor: sRow, loser: lRow } = specialRows[tbl];
          if (lRow === null) continue;
          if (sRow !== null) {
            const cols = await dataColumns(tbl);
            const fillable = cols.filter(c => sRow[c] == null && lRow[c] != null);
            if (fillable.length > 0)
              console.log(`      null-fill survivor ${tbl}: [${fillable.join(', ')}]`);
          } else {
            console.log(`      survivor lacks ${tbl} row → loser row will be re-pointed`);
          }
        }
      }
    }

    // ── Step 4: Hollow-shell balance_sheet rows ───────────────────────────
    // A shell is a BS row where every financial value field is null.
    // We exclude non-value metadata: source_document_id, debtors_list,
    // creditors_list, fixed_assets_detail.
    const NON_VALUE_BS = new Set(['source_document_id', 'debtors_list', 'creditors_list', 'fixed_assets_detail']);
    const bsAllCols = await dataColumns('balance_sheets');
    const bsValueCols = bsAllCols.filter(c => !NON_VALUE_BS.has(c));
    const hollowWhere = bsValueCols.map(c => `"${c}" IS NULL`).join(' AND ');

    const hollowRes = await pool.query(`
      SELECT b.id, b.financial_period_id, b.source_document_id
      FROM balance_sheets b
      WHERE b.target_company_id = $1 AND (${hollowWhere})
      ORDER BY b.id
    `, [companyId]);
    const hollowRows: any[] = hollowRes.rows;
    if (EXECUTE) totalHollowsDeleted += hollowRows.length;

    if (hollowRows.length > 0) {
      console.log(`\n[4] HOLLOW-SHELLS (all value fields null): ${hollowRows.length}`);
      for (const r of hollowRows) {
        const confirmed = bsValueCols.map(c => `${c}=null`).join(', ');
        console.log(`    BS id=${r.id}  period=${r.financial_period_id}  src_doc=${r.source_document_id ?? 'null'}  [${confirmed}]`);
      }
    } else {
      console.log(`\n[4] HOLLOW-SHELLS: none`);
    }

    // ── Step 4b: Months-backfill candidates ───────────────────────────────
    // Consecutive statutory period-end pairs ~365 days apart prove months_covered = 12.
    const statutorySorted = [...allPeriods]
      .filter((p: any) => p.period_type === 'statutory')
      .sort((a: any, b: any) => new Date(a.period_end).getTime() - new Date(b.period_end).getTime());

    const monthsBackfillMap = new Map<number, { periodEnd: string; current: number | null }>();
    for (let i = 0; i + 1 < statutorySorted.length; i++) {
      const d1 = new Date(statutorySorted[i].period_end);
      const d2 = new Date(statutorySorted[i + 1].period_end);
      const diffDays = (d2.getTime() - d1.getTime()) / 86_400_000;
      if (diffDays >= 362 && diffDays <= 367) {
        for (const p of [statutorySorted[i], statutorySorted[i + 1]]) {
          // Only backfill periods whose effective classification is full-year
          if (effMap.get(p.id)?.eff !== true) continue;
          if (p.months_covered !== 12 && !monthsBackfillMap.has(p.id)) {
            monthsBackfillMap.set(p.id, { periodEnd: p.period_end, current: p.months_covered });
          }
        }
      }
    }
    if (EXECUTE) totalMonthsBackfilled += monthsBackfillMap.size;

    if (monthsBackfillMap.size > 0) {
      console.log(`\n[4b] MONTHS-BACKFILL (consecutive year-ends prove 12): ${monthsBackfillMap.size}`);
      for (const [pid, info] of monthsBackfillMap) {
        console.log(`    period ${pid}  period_end=${info.periodEnd}  months_covered=${info.current ?? 'null'} → 12`);
      }
    } else {
      console.log(`\n[4b] MONTHS-BACKFILL: none needed`);
    }

    // ── Step 5: Execute merge (one transaction per company) ───────────────
    if (EXECUTE) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Delete hollow BS shells first (before dedup, so dedup sees clean state)
        for (const r of hollowRows) {
          await client.query(`DELETE FROM balance_sheets WHERE id = $1`, [r.id]);
          console.log(`  [EXECUTE] Deleted hollow BS shell id=${r.id}  period=${r.financial_period_id}`);
        }

        // Delete orphans (Change 2)
        for (const oid of orphanIds) {
          await client.query(`DELETE FROM financial_periods WHERE id = $1`, [oid]);
          totalPeriodsDeleted++;
          console.log(`  [EXECUTE] Deleted orphan period ${oid}`);
        }

        // Dedup merges
        for (const plan of groupPlans) {
          const { survivorId, loserIds, effFull } = plan;

          for (const loserId of loserIds) {
            // Special-merge tables
            for (const tbl of SPECIAL_TABLES) {
              const sRes = await client.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [survivorId]);
              const lRes = await client.query(`SELECT * FROM ${tbl} WHERE financial_period_id = $1`, [loserId]);

              if (lRes.rows.length === 0) continue;

              if (sRes.rows.length > 0) {
                // Both have a row: null-fill survivor, then delete loser row
                const cols = await dataColumns(tbl);
                const s = sRes.rows[0]; const l = lRes.rows[0];
                const fillCols = cols.filter(c => s[c] == null && l[c] != null);
                if (fillCols.length > 0) {
                  const setStr = fillCols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
                  await client.query(
                    `UPDATE ${tbl} SET ${setStr} WHERE financial_period_id = $1`,
                    [survivorId, ...fillCols.map(c => l[c])]
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

          // Write effective is_full_year onto the survivor (Change 5)
          await client.query(
            `UPDATE financial_periods SET is_full_year = $1 WHERE id = $2`,
            [effFull, survivorId]
          );
        }

        // Apply fiscal_year backfills
        for (const r of fy0Res.rows) {
          await client.query(
            `UPDATE financial_periods SET fiscal_year = $1 WHERE id = $2`,
            [r.proposed_fy, r.id]
          );
          totalBackfills++;
        }

        // Apply effective is_full_year to all periods with classification mismatches
        // (replaces old category-only span backfill; orphans already deleted so skip them)
        for (const p of allPeriods) {
          if (orphanIdSet.has(p.id)) continue;
          const e = effMap.get(p.id)!;
          if (e.eff !== p.is_full_year) {
            await client.query(
              `UPDATE financial_periods SET is_full_year = $1 WHERE id = $2`,
              [e.eff, p.id]
            );
            totalBackfills++;
          }
        }

        // Apply months_covered = 12 where consecutive year-ends prove it
        for (const [pid] of monthsBackfillMap) {
          await client.query(
            `UPDATE financial_periods SET months_covered = 12 WHERE id = $1`,
            [pid]
          );
          console.log(`  [EXECUTE] Set months_covered=12 on period ${pid}`);
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
    // Re-query modal from DB for suspects section (post-execute state)
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
      const modal5 = modalRes.rows[0].md;
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
      `, [companyId, modal5]);

      if (suspRes.rows.length > 0) {
        console.log(`\n[5] RE-ANALYSIS CANDIDATES (modal period-end month/day = ${modal5}):`);
        for (const r of suspRes.rows)
          console.log(`    period ${r.id}  period_end=${r.period_end}  label="${r.period_label}"  src_doc=${r.source_document_id}  doc="${r.doc_name}"`);
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
  console.log(`Orphans found:      ${totalOrphans}`);
  console.log(`Hollow shells:      ${EXECUTE ? totalHollowsDeleted + ' deleted' : '(see [4] sections above)'}`);
  if (EXECUTE) {
    console.log(`Periods deleted:    ${totalPeriodsDeleted}`);
    console.log(`Rows re-pointed:    ${totalRowsRepointed}`);
    console.log(`Backfills applied:  ${totalBackfills}`);
    console.log(`Months backfilled:  ${totalMonthsBackfilled}`);
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
