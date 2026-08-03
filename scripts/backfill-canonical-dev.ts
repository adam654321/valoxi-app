/**
 * scripts/backfill-canonical-dev.ts
 *
 * Slice 3c.3. Resolves every company holding evidence into a canonical run.
 *
 * SCOPE
 *   Every distinct target_company_id present in document_evidence. One run per
 *   company per invocation.
 *
 * NOT IDEMPOTENT, DELIBERATELY.
 *   Runs accumulate. Each invocation inserts a new run per company and the diff
 *   report selects the latest run per company. Re-running neither skips nor
 *   overwrites. Re-running the same corpus MUST reproduce the same output
 *   fingerprint per company, and this script prints it so that is checkable.
 *
 * SAFETY GUARDS
 *   1. Hard dev guard, first statement: aborts unless connected to the dev
 *      database.
 *   2. DRY RUN IS THE DEFAULT. Without --apply nothing is written, and the dry
 *      run calls the same read-and-resolve code the write path calls, so a clean
 *      dry run is evidence about the code that will actually write.
 *   3. Apply path only: aborts on the first company refused by a kill switch,
 *      because a half-written backfill is not a run.
 *
 * Usage
 *   npx tsx scripts/backfill-canonical-dev.ts                    dry run, default
 *   npx tsx scripts/backfill-canonical-dev.ts --apply            write
 *   npx tsx scripts/backfill-canonical-dev.ts --as-of=2026-08-03 pin the clock
 */

import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import { documentEvidence } from '@shared/schema';
import { canonicalRepository } from '../server/repositories/canonical.repository';

const APPLY = process.argv.includes('--apply');
const AS_OF_FLAG = '--as-of=';
const asOfArg = process.argv.find((a) => a.startsWith(AS_OF_FLAG));
const AS_OF_DATE = asOfArg ? asOfArg.slice(AS_OF_FLAG.length) : undefined;

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

async function main(): Promise<void> {
  const dbRes = await db.execute(sql`SELECT current_database() AS db`);
  const currentDb = (dbRes.rows?.[0] as { db: string } | undefined)?.db ?? '';
  console.log(`[guard] connected database = '${currentDb}'`);
  if (currentDb !== 'heliumdb') {
    console.error(
      `[ABORT] Expected the dev database, got '${currentDb}'. ` +
        `This script must only run against dev. Exiting.`,
    );
    process.exit(1);
  }

  const companyRows = await db
    .select({ targetCompanyId: documentEvidence.targetCompanyId })
    .from(documentEvidence);
  const companyIds = Array.from(
    new Set(companyRows.map((r) => r.targetCompanyId)),
  ).sort((a, b) => a - b);
  console.log(`[scope] ${companyIds.length} companies hold evidence`);
  console.log(`[mode]  ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const totals = {
    companies: 0,
    inputEvidence: 0,
    inputPeriods: 0,
    inputFigures: 0,
    outPeriods: 0,
    outFigures: 0,
    valuationEligible: 0,
    anchorComplete: 0,
  };
  const skippedTotals: Record<string, number> = {};
  const trustStates: Record<string, number> = {};
  const spanKinds: Record<string, number> = {};
  const refusals: { targetCompanyId: number; reason: string }[] = [];
  const errors: { targetCompanyId: number; message: string }[] = [];
  let asOfSeen = '';

  for (const targetCompanyId of companyIds) {
    try {
      let runId: number | null = null;
      let prepared;
      if (APPLY) {
        const written = await canonicalRepository.writeForCompany({
          targetCompanyId,
          asOfDate: AS_OF_DATE,
        });
        if (!written.written) {
          if (written.reason === 'flag_off' || written.reason === 'evidence_flag_off') {
            console.error(
              `[ABORT] company ${targetCompanyId} refused with '${written.reason}'. ` +
                `A half-written backfill is not a run. Exiting.`,
            );
            await pool.end();
            process.exit(1);
          }
          refusals.push({ targetCompanyId, reason: written.reason });
          continue;
        }
        runId = written.runId;
        prepared = {
          asOfDate: written.asOfDate,
          input: written.input,
          skipped: written.skipped,
          output: written.output,
        };
      } else {
        const resolvedResult = await canonicalRepository.resolveForCompany({
          targetCompanyId,
          asOfDate: AS_OF_DATE,
        });
        if (!resolvedResult.resolved) {
          refusals.push({ targetCompanyId, reason: resolvedResult.reason });
          continue;
        }
        prepared = {
          asOfDate: resolvedResult.asOfDate,
          input: resolvedResult.input,
          skipped: resolvedResult.skipped,
          output: resolvedResult.output,
        };
      }

      if (asOfSeen === '') {
        asOfSeen = prepared.asOfDate;
      }

      let figuresOut = 0;
      for (const period of prepared.output.periods) {
        figuresOut += period.figures.length;
        bump(trustStates, period.trustState);
        bump(spanKinds, period.spanKind);
        if (period.valuationEligible) {
          totals.valuationEligible += 1;
        }
        if (period.anchorComplete) {
          totals.anchorComplete += 1;
        }
      }

      totals.companies += 1;
      totals.inputEvidence += prepared.input.evidence;
      totals.inputPeriods += prepared.input.periods;
      totals.inputFigures += prepared.input.figures;
      totals.outPeriods += prepared.output.periods.length;
      totals.outFigures += figuresOut;
      for (const [key, value] of Object.entries(prepared.skipped)) {
        skippedTotals[key] = (skippedTotals[key] ?? 0) + value;
      }

      console.log(
        `  company ${pad(targetCompanyId, 5)}  in ${pad(prepared.input.periods, 3)}p ` +
          `${pad(prepared.input.figures, 6)}f  out ${pad(prepared.output.periods.length, 3)}p ` +
          `${pad(figuresOut, 6)}f  fp ${prepared.output.run.outputFingerprint}` +
          (runId === null ? '' : `  run ${runId}`),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ targetCompanyId, message });
      console.error(`  company ${targetCompanyId} ERROR: ${message}`);
    }
  }

  console.log('');
  console.log('===============================================');
  console.log(`  Backfill canonical - ${APPLY ? 'APPLY' : 'DRY RUN'} report`);
  console.log('===============================================');
  console.log(`  as_of_date used:          ${asOfSeen}`);
  console.log(`  Companies processed:      ${totals.companies}`);
  console.log(`  Refused:                  ${refusals.length}`);
  console.log(`  Errors:                   ${errors.length}`);
  console.log('');
  console.log(`  Evidence rows read:       ${totals.inputEvidence}`);
  console.log(`  Evidence periods fed in:  ${totals.inputPeriods}`);
  console.log(`  Evidence figures fed in:  ${totals.inputFigures}`);
  console.log('');
  console.log(`  Canonical periods ${APPLY ? 'written' : 'resolved'}: ${totals.outPeriods}`);
  console.log(`  Canonical figures ${APPLY ? 'written' : 'resolved'}: ${totals.outFigures}`);
  console.log(`  valuation_eligible true:  ${totals.valuationEligible}`);
  console.log(`  anchor_complete true:     ${totals.anchorComplete}`);
  console.log('');
  console.log('  Trust states:');
  for (const [key, value] of Object.entries(trustStates).sort()) {
    console.log(`    ${key}: ${value}`);
  }
  console.log('  Span kinds:');
  for (const [key, value] of Object.entries(spanKinds).sort()) {
    console.log(`    ${key}: ${value}`);
  }
  console.log('');
  console.log('  Adapter skip counters, all expected to be zero:');
  for (const [key, value] of Object.entries(skippedTotals).sort()) {
    console.log(`    ${key}: ${value}`);
  }

  if (refusals.length > 0) {
    console.log('');
    console.log('  Refusals:');
    for (const r of refusals) {
      console.log(`    company ${r.targetCompanyId}: ${r.reason}`);
    }
  }
  if (errors.length > 0) {
    console.log('');
    console.log('  Errors:');
    for (const e of errors) {
      console.log(`    company ${e.targetCompanyId}: ${e.message}`);
    }
  }
  console.log('===============================================');

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
