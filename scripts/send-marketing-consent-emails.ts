#!/usr/bin/env tsx
/**
 * Send marketing consent request emails.
 *
 * Generates a one-time token per recipient, writes it to
 * marketing_consent_tokens, and sends a transactional email asking the
 * recipient to confirm marketing consent by clicking the embedded link.
 *
 * Idempotent: skips recipients with an existing open (unconsumed,
 * unexpired) token. Safe to re-run after a partial failure.
 *
 * Usage:
 *   tsx scripts/send-marketing-consent-emails.ts                       # full run (defaults: external users + waitlist, no internal)
 *   tsx scripts/send-marketing-consent-emails.ts --dry-run             # no DB writes, no emails, just logs the plan
 *   tsx scripts/send-marketing-consent-emails.ts --limit=3             # first 3 recipients only (users first)
 *   tsx scripts/send-marketing-consent-emails.ts --user-id=42          # single user
 *   tsx scripts/send-marketing-consent-emails.ts --waitlist-id=UUID    # single waitlist entry
 *   tsx scripts/send-marketing-consent-emails.ts --include-internal    # include user_company_id=5 cohort
 *   tsx scripts/send-marketing-consent-emails.ts --dry-run --limit=3   # combinable
 */
import { randomBytes } from 'crypto';
import pLimit from 'p-limit';
import { eq, and, isNotNull, ne, asc, inArray } from 'drizzle-orm';
import { db } from '../server/db';
import { users, waitlist, marketingConsentTokens } from '@shared/schema';
import { config } from '../server/config';
import { emailApiService } from '../server/services/email.service';
import { marketingConsentTokenRepository } from '../server/repositories/marketing-consent-token.repository';

const TOKEN_EXPIRY_DAYS = 30;
const INTER_SEND_DELAY_MS = 500;
const INTERNAL_USER_COMPANY_ID = 5;

interface Args {
  dryRun: boolean;
  limit: number | null;
  userId: number | null;
  waitlistId: string | null;
  includeInternal: boolean;
}

function parseArgs(): Args {
  const dryRun = process.argv.includes('--dry-run');
  const includeInternal = process.argv.includes('--include-internal');
  let limit: number | null = null;
  let userId: number | null = null;
  let waitlistId: string | null = null;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    }
    if (arg.startsWith('--user-id=')) {
      const n = Number.parseInt(arg.slice('--user-id='.length), 10);
      if (Number.isFinite(n) && n > 0) userId = n;
    }
    if (arg.startsWith('--waitlist-id=')) {
      const v = arg.slice('--waitlist-id='.length).trim();
      if (v.length > 0) waitlistId = v;
    }
  }

  return { dryRun, limit, userId, waitlistId, includeInternal };
}

interface UserRecipient {
  kind: 'user';
  id: number;
  email: string;
  firstName: string;
}

interface WaitlistRecipient {
  kind: 'waitlist';
  id: string;
  email: string;
  firstName: string;
}

type Recipient = UserRecipient | WaitlistRecipient;

function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'there';
}

async function loadUserRecipients(args: Args): Promise<UserRecipient[]> {
  if (args.waitlistId !== null) return [];

  const conditions = [
    eq(users.marketingConsent, false),
    eq(users.isActive, true),
    isNotNull(users.clerkUserId),
  ];
  if (args.userId !== null) {
    conditions.push(eq(users.id, args.userId));
  } else if (!args.includeInternal) {
    conditions.push(ne(users.userCompanyId, INTERNAL_USER_COMPANY_ID));
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.id));

  return rows.map((r) => ({
    kind: 'user' as const,
    id: r.id,
    email: r.email,
    firstName: r.firstName || 'there',
  }));
}

async function loadWaitlistRecipients(args: Args): Promise<WaitlistRecipient[]> {
  if (args.userId !== null) return [];

  const conditions = [
    eq(waitlist.marketingConsent, false),
    inArray(waitlist.status, ['new', 'approved']),
  ];
  if (args.waitlistId !== null) {
    conditions.push(eq(waitlist.id, args.waitlistId));
  }

  const rows = await db
    .select({
      id: waitlist.id,
      email: waitlist.email,
      fullName: waitlist.fullName,
    })
    .from(waitlist)
    .where(and(...conditions))
    .orderBy(asc(waitlist.createdAt));

  return rows.map((r) => ({
    kind: 'waitlist' as const,
    id: r.id,
    email: r.email,
    firstName: extractFirstName(r.fullName),
  }));
}

async function hasOpenToken(recipient: Recipient): Promise<boolean> {
  const now = new Date();
  const whereClause = recipient.kind === 'user'
    ? eq(marketingConsentTokens.userId, recipient.id)
    : eq(marketingConsentTokens.waitlistId, recipient.id);
  const rows = await db.select().from(marketingConsentTokens).where(whereClause);
  return rows.some((t) => t.consentRecordedAt === null && t.expiresAt > now);
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function formatRecipientLabel(r: Recipient): string {
  if (r.kind === 'user') {
    return `user  ${String(r.id).padStart(4)} ${r.email}`;
  }
  const idShort = r.id.slice(0, 8);
  return `wlist ${idShort} ${r.email}`;
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('Marketing consent request send');
  console.log('Mode:             ', args.dryRun ? 'DRY RUN (no writes, no emails)' : 'LIVE');
  console.log('Include internal: ', args.includeInternal ? 'yes (user_company_id=5)' : 'no');
  console.log('Limit:            ', args.limit ?? 'none');
  if (args.userId !== null) console.log('Filter:           user_id=', args.userId);
  if (args.waitlistId !== null) console.log('Filter:           waitlist_id=', args.waitlistId);
  console.log('Token expiry:     ', `${TOKEN_EXPIRY_DAYS} days`);
  console.log('Inter-send delay: ', `${INTER_SEND_DELAY_MS}ms`);
  console.log('Base URL:         ', config.baseUrl);
  console.log('='.repeat(60));

  const userRecipients = await loadUserRecipients(args);
  const waitlistRecipients = await loadWaitlistRecipients(args);

  let allRecipients: Recipient[] = [...userRecipients, ...waitlistRecipients];
  if (args.limit !== null) {
    allRecipients = allRecipients.slice(0, args.limit);
  }

  console.log(`Cohort: ${userRecipients.length} users, ${waitlistRecipients.length} waitlist → ${allRecipients.length} after limit`);
  console.log('='.repeat(60));

  if (allRecipients.length === 0) {
    console.log('No recipients. Exiting.');
    process.exit(0);
  }

  if (args.dryRun) {
    for (const r of allRecipients) {
      const skip = await hasOpenToken(r);
      const tag = skip ? '[SKIP   ]' : '[PLAN   ]';
      console.log(`${tag} ${formatRecipientLabel(r)} (firstName: ${r.firstName})`);
    }
    console.log('='.repeat(60));
    console.log(`Dry run complete. ${allRecipients.length} recipients planned.`);
    process.exit(0);
  }

  const tally = { sent: 0, skipped: 0, failed: 0 };
  const failures: { label: string; reason: string }[] = [];

  const limiter = pLimit(1);
  const tasks = allRecipients.map((r, idx) =>
    limiter(async () => {
      if (idx > 0) await new Promise((res) => setTimeout(res, INTER_SEND_DELAY_MS));

      const label = formatRecipientLabel(r);

      try {
        if (await hasOpenToken(r)) {
          tally.skipped++;
          console.log(`[SKIPPED] ${label} (existing open token)`);
          return;
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await marketingConsentTokenRepository.create({
          token,
          userId: r.kind === 'user' ? r.id : null,
          waitlistId: r.kind === 'waitlist' ? r.id : null,
          email: r.email,
          expiresAt,
        });

        const consentUrl = `${config.baseUrl}/marketing-consent/${token}`;
        const result = await emailApiService.sendMarketingConsentRequest({
          to: r.email,
          firstName: r.firstName,
          consentUrl,
        });

        if (result.success) {
          tally.sent++;
          console.log(`[SENT   ] ${label}`);
        } else {
          tally.failed++;
          failures.push({ label, reason: result.message });
          console.log(`[FAILED ] ${label} (${result.message})`);
        }
      } catch (err: any) {
        tally.failed++;
        const reason = err?.message || String(err);
        failures.push({ label, reason });
        console.log(`[FAILED ] ${label} (${reason})`);
      }
    }),
  );

  await Promise.all(tasks);

  console.log('='.repeat(60));
  console.log('Send complete');
  console.log(`Sent:    ${tally.sent}`);
  console.log(`Skipped: ${tally.skipped}`);
  console.log(`Failed:  ${tally.failed}`);
  console.log('='.repeat(60));

  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f.label}: ${f.reason}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Sender crashed:', err);
  process.exit(1);
});
