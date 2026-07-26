import { db } from '../db';
import { reselect } from '../services/projection-reselect.service';
import { targetCompanies } from '@shared/schema';
import { sql, between, asc } from 'drizzle-orm';

async function main(): Promise<void> {
  // ── Guard (a): EXPECT_DB_HOST — hostname check ────────────────────────────
  // Parse hostname from DATABASE_URL. Never log DATABASE_URL or rawUrl;
  // only the resolved hostname is printed.
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('[RUNNER] DATABASE_URL is not set. Refusing.');
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    console.error('[RUNNER] DATABASE_URL is not parseable. Refusing.');
    process.exit(1);
  }
  const expectHost = process.env.EXPECT_DB_HOST;
  if (!expectHost) {
    console.error(
      '[RUNNER] EXPECT_DB_HOST is not set. Refusing. Set it to a distinctive substring of the host you intend to hit.',
    );
    process.exit(1);
  }
  if (!host.includes(expectHost)) {
    console.error(
      `[RUNNER] HOST MISMATCH. Connected host is ${host}, EXPECT_DB_HOST="${expectHost}" did not match. Refusing.`,
    );
    process.exit(1);
  }
  console.log(`[RUNNER] host=${host}`);

  // ── Guard (b): EXPECT_DB_NAME — database name check ──────────────────────
  // Resolved through the same db instance that reselect() writes through,
  // so there is no gap between the guard and the work.
  const expectDbName = process.env.EXPECT_DB_NAME;
  if (!expectDbName) {
    console.error('[RUNNER] EXPECT_DB_NAME is not set. Refusing.');
    process.exit(1);
  }
  const dbNameRes = await db.execute(sql`SELECT current_database() AS db`);
  const actualDbName = (dbNameRes.rows?.[0] as Record<string, unknown>)?.db as string;
  if (actualDbName !== expectDbName) {
    console.error(
      `[RUNNER] DB NAME MISMATCH. Connected database is "${actualDbName}", EXPECT_DB_NAME="${expectDbName}". Refusing.`,
    );
    process.exit(1);
  }
  console.log(`[RUNNER] current_database()=${actualDbName}  EXPECT_DB_NAME=${expectDbName}  ✓`);

  // ── Guard (c): CONFIRM_WRITE — explicit write token ───────────────────────
  // There is no dry-run mode. The token must be typed deliberately.
  const confirmWrite = process.env.CONFIRM_WRITE;
  if (confirmWrite !== 'phase4-reselect') {
    console.error(
      '[RUNNER] WRITE NOT CONFIRMED. This runner has NO dry-run mode and always writes. ' +
        'The rehearsal database IS the dry run. Set CONFIRM_WRITE=phase4-reselect only when pointed at the intended target.',
    );
    process.exit(1);
  }

  // ── Guard (d): FROM_ID / TO_ID — mandatory scope ──────────────────────────
  // An unscoped run (all companies) must be impossible. Both bounds are required.
  const fromIdRaw = process.env.FROM_ID;
  const toIdRaw   = process.env.TO_ID;
  if (!fromIdRaw || !toIdRaw) {
    console.error(
      '[RUNNER] FROM_ID and TO_ID must both be set. No default scope; an unscoped run is not permitted.',
    );
    process.exit(1);
  }
  const fromId = parseInt(fromIdRaw, 10);
  const toId   = parseInt(toIdRaw,   10);
  if (!Number.isInteger(fromId) || fromId <= 0 || !Number.isInteger(toId) || toId <= 0) {
    console.error(
      `[RUNNER] FROM_ID and TO_ID must be positive integers. Got FROM_ID="${fromIdRaw}" TO_ID="${toIdRaw}". Refusing.`,
    );
    process.exit(1);
  }
  if (fromId > toId) {
    console.error(`[RUNNER] FROM_ID (${fromId}) must be <= TO_ID (${toId}). Refusing.`);
    process.exit(1);
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  console.log(
    '[RUNNER] ============================================================\n' +
    `[RUNNER] host       = ${host}\n` +
    `[RUNNER] database   = ${actualDbName}\n` +
    `[RUNNER] FROM_ID    = ${fromId}\n` +
    `[RUNNER] TO_ID      = ${toId}\n` +
    `[RUNNER] started    = ${new Date().toISOString()}\n` +
    '[RUNNER] ============================================================',
  );

  // ── Fetch company ids in scope ─────────────────────────────────────────────
  const rows = await db
    .select({ id: targetCompanies.id })
    .from(targetCompanies)
    .where(between(targetCompanies.id, fromId, toId))
    .orderBy(asc(targetCompanies.id));

  const ids = rows.map(r => r.id);
  const total = ids.length;
  console.log(`[RUNNER] ${total} companies in scope (ids ${fromId}–${toId})`);

  // ── Main loop — stop on first error ───────────────────────────────────────
  const runStart = Date.now();
  let n = 0;

  for (const id of ids) {
    n += 1;
    const companyStart = Date.now();
    try {
      await reselect(id);
    } catch (err) {
      console.error(`[RUNNER] FAILED at company=${id}:`, err);
      process.exit(1);
    }
    const elapsed = Date.now() - companyStart;
    console.log(`[RUNNER] company=${id} ok ${elapsed}ms (${n}/${total})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalElapsed = Date.now() - runStart;
  const mean = total > 0 ? Math.round(totalElapsed / total) : 0;
  console.log(
    '[RUNNER] ============================================================\n' +
    `[RUNNER] companies processed : ${total}\n` +
    `[RUNNER] total elapsed       : ${totalElapsed}ms\n` +
    `[RUNNER] mean per company    : ${mean}ms\n` +
    '[RUNNER] ============================================================',
  );
  process.exit(0);
}

main().catch(err => {
  console.error('[RUNNER] Unhandled error:', err);
  process.exit(1);
});
