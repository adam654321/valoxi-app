import { db } from '../db';
import { expertAnalysisService } from '../services/expert-analysis.service';
import { expertAnalysisResults } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const EXPERT_TYPES = [
  'data_quality',
  'screening',
  'financial',
  'operational',
  'risk',
  'qoe',
  'sector',
  'valuation',
  'deal_structure',
  'synthesis',
] as const;

async function printStatusTable(companyId: number): Promise<void> {
  // Fetch all rows for the company ordered by createdAt DESC, then
  // deduplicate to keep the latest row per expert_type.
  const rows = await db
    .select({
      id: expertAnalysisResults.id,
      expertType: expertAnalysisResults.expertType,
      status: expertAnalysisResults.status,
      processingTime: expertAnalysisResults.processingTime,
      createdAt: expertAnalysisResults.createdAt,
    })
    .from(expertAnalysisResults)
    .where(eq(expertAnalysisResults.targetCompanyId, companyId))
    .orderBy(desc(expertAnalysisResults.createdAt));

  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const row of rows) {
    if (!seen.has(row.expertType)) {
      seen.add(row.expertType);
      latest.push(row);
    }
  }

  // Display in canonical EXPERT_TYPES order for readability.
  latest.sort((a, b) => {
    const ai = (EXPERT_TYPES as readonly string[]).indexOf(a.expertType);
    const bi = (EXPERT_TYPES as readonly string[]).indexOf(b.expertType);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (latest.length === 0) {
    console.log('[RUNNER] No expert_analysis_results rows found for this company.');
    return;
  }

  console.log('');
  console.log(
    'id      '.padEnd(8) +
    'expert_type     '.padEnd(16) +
    'status      '.padEnd(12) +
    'processing_ms   '.padEnd(16) +
    'created_at',
  );
  console.log('-'.repeat(72));
  for (const row of latest) {
    console.log(
      String(row.id).padEnd(8) +
      row.expertType.padEnd(16) +
      row.status.padEnd(12) +
      (row.processingTime != null ? String(row.processingTime) : 'null').padEnd(16) +
      (row.createdAt ? row.createdAt.toISOString() : 'null'),
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  // ── Guard (a): EXPECT_DB_HOST — hostname check ──────────────────────────────
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

  // ── Guard (b): EXPECT_DB_NAME — database name check ────────────────────────
  // Resolved through the same db instance the service uses, so there is no
  // gap between the guard and the work.
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

  // ── Guard (c): MODE ─────────────────────────────────────────────────────────
  const mode = process.env.MODE;
  if (mode !== 'status' && mode !== 'trigger' && mode !== 'resume') {
    console.error(
      `[RUNNER] MODE must be one of: status | trigger | resume. Got "${mode ?? '(unset)'}". Refusing.`,
    );
    process.exit(1);
  }

  // ── Guard (d): COMPANY_ID ───────────────────────────────────────────────────
  const companyIdRaw = process.env.COMPANY_ID;
  if (!companyIdRaw) {
    console.error('[RUNNER] COMPANY_ID is not set. Refusing. One company per invocation.');
    process.exit(1);
  }
  const companyId = parseInt(companyIdRaw, 10);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    console.error(
      `[RUNNER] COMPANY_ID must be a positive integer. Got "${companyIdRaw}". Refusing.`,
    );
    process.exit(1);
  }

  // ── Guard (e): CONFIRM_WRITE and USER_ID — write modes only ────────────────
  // MODE=status is SELECT-only and does not require the write token or USER_ID.
  let userId: number | undefined;
  if (mode === 'trigger' || mode === 'resume') {
    const confirmWrite = process.env.CONFIRM_WRITE;
    if (confirmWrite !== 'phase4b-reanalysis') {
      console.error(
        '[RUNNER] WRITE NOT CONFIRMED. Set CONFIRM_WRITE=phase4b-reanalysis to proceed with MODE=trigger or MODE=resume.',
      );
      process.exit(1);
    }
    const userIdRaw = process.env.USER_ID;
    if (!userIdRaw) {
      console.error('[RUNNER] USER_ID is not set. Required for MODE=trigger and MODE=resume. Refusing.');
      process.exit(1);
    }
    userId = parseInt(userIdRaw, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      console.error(
        `[RUNNER] USER_ID must be a positive integer. Got "${userIdRaw}". Refusing.`,
      );
      process.exit(1);
    }
  }

  // ── MODE=status ─────────────────────────────────────────────────────────────
  if (mode === 'status') {
    console.log(`[RUNNER] STATUS for company=${companyId}`);
    await printStatusTable(companyId);
    process.exit(0);
  }

  // ── Banner — write modes ────────────────────────────────────────────────────
  console.log(
    '[RUNNER] ============================================================\n' +
    `[RUNNER] host       = ${host}\n` +
    `[RUNNER] database   = ${actualDbName}\n` +
    `[RUNNER] mode       = ${mode}\n` +
    `[RUNNER] company_id = ${companyId}\n` +
    `[RUNNER] user_id    = ${userId}\n` +
    `[RUNNER] started    = ${new Date().toISOString()}\n` +
    '[RUNNER] ============================================================',
  );

  const runStart = Date.now();

  if (mode === 'trigger') {
    // ── MODE=trigger ──────────────────────────────────────────────────────────
    // triggerExpertPipeline inserts pending records for all expert types, runs
    // Layer 1 in parallel, then drives the remaining layers via processNextSteps.
    // If the process is killed mid-run, MODE=resume can continue from DB state.
    console.log(`[RUNNER] Calling triggerExpertPipeline(${companyId}, ${userId})`);
    await expertAnalysisService.triggerExpertPipeline(companyId, userId);
  } else {
    // ── MODE=resume ───────────────────────────────────────────────────────────
    // processNextSteps reads current DB state and advances whichever layers
    // still have status='pending', driving to synthesis completion.
    console.log(`[RUNNER] Calling processNextSteps(${companyId})`);
    await expertAnalysisService.processNextSteps(companyId);
  }

  const totalElapsed = Date.now() - runStart;
  console.log(`[RUNNER] pipeline call completed in ${totalElapsed}ms`);

  await printStatusTable(companyId);

  console.log(`[RUNNER] total elapsed: ${totalElapsed}ms`);
  process.exit(0);
}

main().catch(err => {
  console.error('[RUNNER] Unhandled error:', err);
  process.exit(1);
});
