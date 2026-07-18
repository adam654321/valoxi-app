/**
 * scripts/reselect-runner.ts
 *
 * Reliable CLI entry-point for projection-reselect. Goes entirely through the
 * tested reselect service — no ad-hoc SQL, no HTTP, no CSRF needed.
 *
 * Usage
 *   npx tsx scripts/reselect-runner.ts --company 105
 *   npx tsx scripts/reselect-runner.ts --companies 105,106,107
 *   npx tsx scripts/reselect-runner.ts --all
 *
 * Flags
 *   --apply      Write to DB. Default is DRY-RUN (read-only preview).
 *   --company N  Single company id.
 *   --companies  Comma-separated list of company ids.
 *   --all        Every company that has at least one financial_contribution row.
 */

import { db, pool } from '../server/db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
} from '../shared/schema';
import { eq, count } from 'drizzle-orm';
import {
  selectProjectionWinners,
  type Contribution,
} from '../shared/calculators/projection-selector';
import { reselect } from '../server/services/projection-reselect.service';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL   = args.includes('--all');

let companyIds: number[] = [];

const companyIdx   = args.indexOf('--company');
const companiesIdx = args.indexOf('--companies');

if (companyIdx !== -1) {
  const raw = parseInt(args[companyIdx + 1], 10);
  if (isNaN(raw)) { console.error('--company: invalid number'); process.exit(1); }
  companyIds = [raw];
}

if (companiesIdx !== -1) {
  companyIds = (args[companiesIdx + 1] ?? '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
  if (companyIds.length === 0) {
    console.error('--companies: no valid ids found'); process.exit(1);
  }
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

interface Snapshot {
  periodRows:  number;
  incomeRows:  number;
  balanceRows: number;
  contribCount: number;
  winners: ReturnType<typeof selectProjectionWinners>;
}

async function snapshot(companyId: number): Promise<Snapshot> {
  const [{ n: periodRows }]  = await db.select({ n: count() }).from(financialPeriods)
    .where(eq(financialPeriods.targetCompanyId, companyId));
  const [{ n: incomeRows }]  = await db.select({ n: count() }).from(incomeStatements)
    .where(eq(incomeStatements.targetCompanyId, companyId));
  const [{ n: balanceRows }] = await db.select({ n: count() }).from(balanceSheets)
    .where(eq(balanceSheets.targetCompanyId, companyId));

  const contribs = await db.select().from(financialContributions)
    .where(eq(financialContributions.targetCompanyId, companyId));

  const winners = selectProjectionWinners(contribs as Contribution[]);

  return {
    periodRows:   Number(periodRows),
    incomeRows:   Number(incomeRows),
    balanceRows:  Number(balanceRows),
    contribCount: contribs.length,
    winners,
  };
}

// ─── Per-company processing ───────────────────────────────────────────────────

function sep(): string { return '─'.repeat(60); }
function sign(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

async function processCompany(companyId: number): Promise<void> {
  console.log(sep());
  console.log(`Company ${companyId}  [${APPLY ? 'APPLY' : 'DRY-RUN'}]`);

  const before = await snapshot(companyId);

  // Summarise winner plan from pure selector (no DB writes)
  const tierTally: Record<string, number> = {};
  for (const w of before.winners) {
    tierTally[w.sourceTier] = (tierTally[w.sourceTier] ?? 0) + 1;
  }
  const tierSummary = Object.entries(tierTally)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || 'none';

  const incomeWinners  = before.winners.filter(w => w.statementType === 'income');
  const balanceWinners = before.winners.filter(w => w.statementType === 'balance');

  console.log(`  contributions  : ${before.contribCount}`);
  console.log(`  periods        : ${before.periodRows}`);
  console.log(`  income rows    : ${before.incomeRows}`);
  console.log(`  balance rows   : ${before.balanceRows}`);
  console.log(`  winner plan    : ${before.winners.length} total (${tierSummary})`);
  console.log(`                   income ${incomeWinners.length}, balance ${balanceWinners.length}`);

  if (!APPLY) {
    console.log(`  → dry-run only; pass --apply to write.`);
    return;
  }

  // Write
  await reselect(companyId);

  const after = await snapshot(companyId);

  const dPeriod  = after.periodRows  - before.periodRows;
  const dIncome  = after.incomeRows  - before.incomeRows;
  const dBalance = after.balanceRows - before.balanceRows;

  console.log(`  after:`);
  console.log(`  periods        : ${after.periodRows}  (${sign(dPeriod)})`);
  console.log(`  income rows    : ${after.incomeRows}  (${sign(dIncome)})`);
  console.log(`  balance rows   : ${after.balanceRows}  (${sign(dBalance)})`);

  if (dPeriod === 0 && dIncome === 0 && dBalance === 0) {
    console.log(`  ✓ no-op — projection was already correct.`);
  } else {
    console.log(`  ✓ applied.`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`reselect-runner  mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  if (ALL) {
    const rows = await db
      .selectDistinct({ id: financialContributions.targetCompanyId })
      .from(financialContributions)
      .orderBy(financialContributions.targetCompanyId);
    companyIds = rows.map(r => r.id).filter((x): x is number => x !== null);
    console.log(`--all: found ${companyIds.length} companies with contributions\n`);
  }

  if (companyIds.length === 0) {
    console.error('No company ids. Use --company <id>, --companies <id,...>, or --all.');
    process.exit(1);
  }

  for (const id of companyIds) {
    await processCompany(id);
  }

  console.log(sep());
  console.log(`Done — processed ${companyIds.length} company/companies.`);
}

main()
  .catch(err => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => pool.end());
