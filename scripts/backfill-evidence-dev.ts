/**
 * scripts/backfill-evidence-dev.ts
 *
 * Backfills document_evidence / document_evidence_period / document_evidence_figure
 * rows for profit_and_loss and balance_sheet DARs that were analysed before the
 * evidence shadow-write path existed, and therefore have no evidence row yet.
 *
 * SCOPE
 *   document_type IN ('profit_and_loss', 'balance_sheet') only.
 *   company_accounts, sales_ledger, asset_register, staff_matrix are
 *   explicitly out of scope and are refused even if somehow passed.
 *
 * IDEMPOTENCY
 *   Skip key = document_analysis_result_id.  A DAR that already has a
 *   document_evidence row (any extraction_version) is skipped regardless of
 *   what the unique constraint on (document_id, document_type, extraction_version)
 *   would do.  Re-running after a completed or interrupted run processes 0 rows.
 *
 * SAFETY GUARDS
 *   1. Hard dev guard — aborts with exit(1) if current_database() !== 'heliumdb'.
 *   2. Kill-switch guard (apply path only) — if writeFromPayload returns
 *      { written: false, reason: 'flag_off' } the script aborts immediately.
 *   3. DRY RUN IS THE DEFAULT — no writes occur without --apply.
 *      The dry-run path calls mapPayloadToEvidence directly and never calls
 *      writeFromPayload.
 *
 * Usage
 *   npx tsx scripts/backfill-evidence-dev.ts            # dry run (default)
 *   npx tsx scripts/backfill-evidence-dev.ts --apply    # write to DB
 */

import { sql, eq, isNull, inArray, and } from 'drizzle-orm';
import { db, pool } from '../server/db';
import {
  documentAnalysisResults,
  documents,
  documentEvidence,
  documentEvidencePeriod,
} from '@shared/schema';
import { mapPayloadToEvidence } from '@shared/utils/evidence-mapper';
import { evidenceRepository } from '../server/repositories/evidence.repository';

// ─── Configuration ────────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply');
const PROGRESS_EVERY = 50;

const IN_SCOPE_TYPES = ['profit_and_loss', 'balance_sheet'] as const;
const OUT_OF_SCOPE_TYPES = [
  'company_accounts',
  'sales_ledger',
  'asset_register',
  'staff_matrix',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function max(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Step 0: Hard dev guard ────────────────────────────────────────────────
  const dbRes = await db.execute(sql`SELECT current_database() AS db`);
  const currentDb = (dbRes.rows?.[0] as { db: string } | undefined)?.db ?? '';
  console.log(`[guard] current_database() = '${currentDb}'`);
  if (currentDb !== 'heliumdb') {
    console.error(
      `[ABORT] Expected database 'heliumdb', got '${currentDb}'. ` +
        `This script must only run against dev. Exiting.`,
    );
    process.exit(1);
  }

  // ── Step 0b: Refuse out-of-scope types ───────────────────────────────────
  // (belt-and-braces: the query already filters, but guard here too)
  for (const t of OUT_OF_SCOPE_TYPES) {
    if (IN_SCOPE_TYPES.includes(t as (typeof IN_SCOPE_TYPES)[number])) {
      // should never happen; kept for exhaustiveness
      console.error(`[ABORT] Logic error: ${t} appears in both scope lists.`);
      process.exit(1);
    }
  }
  // company_accounts, sales_ledger, asset_register, staff_matrix are refused:
  // they are not included in IN_SCOPE_TYPES above; the candidate query
  // filters to IN_SCOPE_TYPES only; any attempt to process them is impossible.

  console.log(`[config] mode = ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  console.log(`[config] in-scope types: ${IN_SCOPE_TYPES.join(', ')}`);
  console.log(`[config] out-of-scope (excluded): ${OUT_OF_SCOPE_TYPES.join(', ')}`);
  console.log('');

  // ── Step 1: Build candidate set ──────────────────────────────────────────
  // Candidates = DARs where:
  //   document_type IN ('profit_and_loss','balance_sheet')
  //   AND no existing document_evidence row references this DAR's id
  //
  // Idempotency key: document_analysis_result_id on document_evidence.
  // We LEFT JOIN and filter de.id IS NULL.
  const candidates = await db
    .select({
      darId: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
      targetCompanyId: documents.targetCompanyId,
    })
    .from(documentAnalysisResults)
    .innerJoin(documents, eq(documents.id, documentAnalysisResults.documentId))
    .leftJoin(
      documentEvidence,
      eq(documentEvidence.documentAnalysisResultId, documentAnalysisResults.id),
    )
    .where(
      and(
        inArray(documentAnalysisResults.documentType, [...IN_SCOPE_TYPES]),
        isNull(documentEvidence.id),
      ),
    )
    .orderBy(documentAnalysisResults.id);

  const total = candidates.length;
  const byType: Record<string, number> = {};
  for (const c of candidates) {
    byType[c.documentType] = (byType[c.documentType] ?? 0) + 1;
  }

  console.log(`[candidates] Total: ${total}`);
  for (const [t, n] of Object.entries(byType)) {
    console.log(`[candidates]   ${t}: ${n}`);
  }
  console.log('');

  if (total === 0) {
    console.log('[done] No candidates to process. Nothing to do.');
    await pool.end();
    return;
  }

  // ── Step 2: Process candidates ───────────────────────────────────────────
  const periodsPerDar: number[] = [];
  const figuresPerPeriod: number[] = []; // dry-run path only; exact per-period counts
  const zeroPeriodDarIds: number[] = [];
  const errors: { darId: number; message: string }[] = [];
  let totalFiguresExact = 0;               // apply path: exact sum from writeFromPayload
  const writtenEvidenceIds: number[] = []; // apply path: collected for reconciliation

  let processedCount = 0;

  if (APPLY) {
    // ── APPLY PATH: call writeFromPayload ───────────────────────────────
    console.log('[apply] Writing to database ...');
    console.log('');

    for (const candidate of candidates) {
      processedCount++;

      if (processedCount % PROGRESS_EVERY === 0 || processedCount === 1) {
        console.log(`[progress] ${processedCount} / ${total} ...`);
      }

      try {
        const result = await evidenceRepository.writeFromPayload({
          targetCompanyId: candidate.targetCompanyId,
          documentId: candidate.documentId,
          documentAnalysisResultId: candidate.darId,
          documentType: candidate.documentType,
          payload: candidate.analysisData as Record<string, unknown>,
        });

        if (!result.written) {
          // Kill switch is off — abort immediately, do not loop through no-ops
          console.error(
            `[ABORT] writeFromPayload returned { written: false, reason: '${result.reason}' } ` +
              `on DAR ${candidate.darId}. ` +
              `The kill switch (evidence_shadow_write_enabled) is off. ` +
              `Set it to 'true' in system_config before running --apply, or omit --apply for a dry run.`,
          );
          await pool.end();
          process.exit(1);
        }

        periodsPerDar.push(result.periodCount);
        if (result.periodCount === 0) {
          zeroPeriodDarIds.push(candidate.darId);
        }
        totalFiguresExact += result.figureCount;
        writtenEvidenceIds.push(result.evidenceId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ darId: candidate.darId, message: msg });
      }
    }

    // ── Step 2.5: Post-run reconciliation guard ───────────────────────────
    // Queries the database for the actual row counts attributable to this run
    // and compares them against the script's own tallies. A mismatch means a
    // write was silently dropped or duplicated — the script exits non-zero.
    if (writtenEvidenceIds.length > 0) {
      const scriptEvidenceCount = writtenEvidenceIds.length;
      const scriptPeriodCount   = periodsPerDar.reduce((a, b) => a + b, 0);
      const scriptFigureCount   = totalFiguresExact;

      const [dbEvidenceRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(documentEvidence)
        .where(inArray(documentEvidence.id, writtenEvidenceIds));

      const [dbPeriodRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(documentEvidencePeriod)
        .where(inArray(documentEvidencePeriod.documentEvidenceId, writtenEvidenceIds));

      const dbFigureRes = await db.execute(
        sql.raw(
          `SELECT count(*)::int AS count
           FROM document_evidence_figure f
           JOIN document_evidence_period p ON p.id = f.document_evidence_period_id
           WHERE p.document_evidence_id = ANY(ARRAY[${writtenEvidenceIds.join(',')}])`,
        ),
      );
      const dbFigureCount =
        (dbFigureRes.rows?.[0] as { count: number } | undefined)?.count ?? 0;

      const dbEvidenceCount = dbEvidenceRow?.count ?? 0;
      const dbPeriodCount   = dbPeriodRow?.count   ?? 0;

      const evidenceOk = scriptEvidenceCount === dbEvidenceCount;
      const periodsOk  = scriptPeriodCount   === dbPeriodCount;
      const figuresOk  = scriptFigureCount   === dbFigureCount;

      console.log('');
      console.log('── Reconciliation (script tally vs database) ──');
      console.log(`  document_evidence:        script=${scriptEvidenceCount}  db=${dbEvidenceCount}  ${evidenceOk ? '✓' : 'MISMATCH'}`);
      console.log(`  document_evidence_period: script=${scriptPeriodCount}  db=${dbPeriodCount}  ${periodsOk ? '✓' : 'MISMATCH'}`);
      console.log(`  document_evidence_figure: script=${scriptFigureCount}  db=${dbFigureCount}  ${figuresOk ? '✓' : 'MISMATCH'}`);

      if (!evidenceOk || !periodsOk || !figuresOk) {
        console.error('');
        console.error('RECONCILIATION FAILED — script tally does not match database counts.');
        console.error('Investigate before proceeding. No further action taken.');
        await pool.end();
        process.exit(1);
      }
    }

  } else {
    // ── DRY RUN PATH: call mapPayloadToEvidence directly, NO writeFromPayload ─
    console.log('[dry-run] Calling mapPayloadToEvidence for each candidate ...');
    console.log('');

    for (const candidate of candidates) {
      processedCount++;

      if (processedCount % PROGRESS_EVERY === 0 || processedCount === 1) {
        console.log(`[progress] ${processedCount} / ${total} ...`);
      }

      try {
        const { periods } = mapPayloadToEvidence({
          targetCompanyId: candidate.targetCompanyId,
          documentId: candidate.documentId,
          documentAnalysisResultId: candidate.darId,
          documentType: candidate.documentType,
          extractionVersion: 1,
          payload: candidate.analysisData as Record<string, unknown>,
        });

        periodsPerDar.push(periods.length);
        if (periods.length === 0) {
          zeroPeriodDarIds.push(candidate.darId);
        }
        for (const p of periods) {
          figuresPerPeriod.push(p.figures.length);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ darId: candidate.darId, message: msg });
      }
    }
  }

  // ── Step 3: Report ──────────────────────────────────────────────────────
  const successCount = total - errors.length;
  const totalPeriods = periodsPerDar.reduce((a, b) => a + b, 0);
  const totalFigures = APPLY
    ? totalFiguresExact
    : figuresPerPeriod.reduce((a, b) => a + b, 0);

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Backfill evidence — ${APPLY ? 'APPLY' : 'DRY RUN'} report`);
  console.log('═══════════════════════════════════════════════');
  console.log(`  Candidates:               ${total}`);
  for (const [t, n] of Object.entries(byType)) {
    console.log(`    ${t}: ${n}`);
  }
  console.log(`  Successfully processed:   ${successCount}`);
  console.log(`  Errors:                   ${errors.length}`);
  console.log('');
  console.log(`  Total periods ${APPLY ? 'written' : 'would be written'}:   ${totalPeriods}`);
  console.log(`  Total figures ${APPLY ? 'written' : 'would be written'}:   ${totalFigures}`);
  console.log('');
  console.log(`  Periods per DAR — mean:   ${fmt(mean(periodsPerDar))}`);
  console.log(`  Periods per DAR — max:    ${max(periodsPerDar)}`);
  console.log(`  Figures per period — mean: ${APPLY ? fmt(totalPeriods > 0 ? totalFiguresExact / totalPeriods : 0) : fmt(mean(figuresPerPeriod))}`);
  console.log(`  Figures per period — max:  ${APPLY ? 'not available in apply mode' : String(max(figuresPerPeriod))}`);
  console.log('');

  if (zeroPeriodDarIds.length === 0) {
    console.log('  Zero-period DARs:         none');
  } else {
    console.log(`  Zero-period DARs (${zeroPeriodDarIds.length}):`);
    for (const id of zeroPeriodDarIds) {
      const candidate = candidates.find((c) => c.darId === id)!;
      console.log(`    DAR id=${id}  document_type=${candidate.documentType}  document_id=${candidate.documentId}`);
    }
  }

  if (errors.length > 0) {
    console.log('');
    console.log(`  Errors (${errors.length}):`);
    for (const e of errors) {
      console.log(`    DAR id=${e.darId}: ${e.message}`);
    }
  }

  console.log('═══════════════════════════════════════════════');

  if (!APPLY) {
    console.log('');
    console.log('[dry-run] No data was written. Re-run with --apply to write.');
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
