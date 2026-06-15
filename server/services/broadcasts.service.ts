import { eq, desc, and, isNotNull, gte } from 'drizzle-orm';
import { marked } from 'marked';
import { db } from '../db';
import { users } from '@shared/schema';
import { broadcastsSent, type BroadcastSent } from '@shared/schema/marketing';
import { resendMarketing } from '../lib/resend-marketing';
import { renderBrandedEmail } from './email-template';

function substituteMergeVars(text: string, firstName: string): string {
  return text
    .replace(/\{\{\s*subscriber\.first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName);
}

type SegmentKey = 'all_users' | 'active_subscribers' | 'cancelled_subscribers' | 'past_due' | 'trialing' | 'test_internal';

interface SegmentConfig {
  key: SegmentKey;
  envVar: string;
  label: string;
  description: string;
}

const SEGMENTS: SegmentConfig[] = [
  { key: 'all_users', envVar: 'RESEND_SEGMENT_ALL_USERS', label: 'All users', description: 'Every signed-up user who has not unsubscribed.' },
  { key: 'active_subscribers', envVar: 'RESEND_SEGMENT_ACTIVE_SUBSCRIBERS', label: 'Active subscribers', description: 'Users on paid active or admin-comped plans.' },
  { key: 'cancelled_subscribers', envVar: 'RESEND_SEGMENT_CANCELLED_SUBSCRIBERS', label: 'Cancelled subscribers', description: 'Users who cancelled their subscription.' },
  { key: 'past_due', envVar: 'RESEND_SEGMENT_PAST_DUE', label: 'Past due', description: 'Users with overdue payment.' },
  { key: 'trialing', envVar: 'RESEND_SEGMENT_TRIALING', label: 'Trialing', description: 'Users currently in trial.' },
  { key: 'test_internal', envVar: 'RESEND_SEGMENT_TEST_INTERNAL', label: 'Test internal', description: 'Co-founders only (Adam, Viv, Jag, Dee).' },
];

interface SegmentSummary {
  key: SegmentKey;
  label: string;
  description: string;
  segmentId: string;
  recipientCountEstimate: number;
}

class BroadcastsService {
  private readonly fromAddress: string;

  constructor() {
    this.fromAddress = process.env.RESEND_MARKETING_FROM_ADDRESS || 'Valoxi <hello@news.valoxi.ai>';
  }

  private getSegmentId(key: SegmentKey): string | null {
    const cfg = SEGMENTS.find((s) => s.key === key);
    if (!cfg) return null;
    const id = process.env[cfg.envVar];
    return id && id.length > 0 ? id : null;
  }

  private async estimateRecipientCount(segmentKey: SegmentKey, testInternalUserCompanyId: number | null): Promise<number> {
    if (segmentKey === 'test_internal' && testInternalUserCompanyId !== null) {
      const result = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.userCompanyId, testInternalUserCompanyId), eq(users.isActive, true), isNotNull(users.clerkUserId)));
      return result.length;
    }

    const result = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.isActive, true), isNotNull(users.clerkUserId)));
    return result.length;
  }

  async listSegments(): Promise<SegmentSummary[]> {
    const testInternalUserCompanyId = process.env.TEST_INTERNAL_USER_COMPANY_ID
      ? Number.parseInt(process.env.TEST_INTERNAL_USER_COMPANY_ID, 10)
      : null;

    const summaries: SegmentSummary[] = [];
    for (const cfg of SEGMENTS) {
      const segmentId = this.getSegmentId(cfg.key);
      if (!segmentId) continue;
      const count = await this.estimateRecipientCount(cfg.key, testInternalUserCompanyId);
      summaries.push({
        key: cfg.key,
        label: cfg.label,
        description: cfg.description,
        segmentId,
        recipientCountEstimate: count,
      });
    }
    return summaries;
  }

  private renderBroadcastHtml(subject: string, bodyMarkdown: string, firstName: string): string {
    const resolvedMarkdown = substituteMergeVars(bodyMarkdown, firstName);
    const bodyHtml = marked.parse(resolvedMarkdown, { async: false }) as string;
    return renderBrandedEmail({
      heading: substituteMergeVars(subject, firstName),
      blocks: [
        { type: 'raw_html', html: bodyHtml },
      ],
      footerLine: 'Sent by the Valoxi team to subscribers of this segment.',
    });
  }

  async sendBroadcast(input: {
    subject: string;
    bodyMarkdown: string;
    segmentKey: SegmentKey;
    isTest: boolean;
    composerSessionId: string;
    sentByUserId: number;
  }): Promise<{ status: 'sent' | 'failed'; broadcastId?: string; error?: string; recipientCountEstimate: number }> {

    const segmentId = this.getSegmentId(input.segmentKey);
    if (!segmentId) {
      return { status: 'failed', error: `Segment ${input.segmentKey} not configured`, recipientCountEstimate: 0 };
    }

    if (!resendMarketing) {
      return { status: 'failed', error: 'Marketing Resend client not configured', recipientCountEstimate: 0 };
    }

    if (!input.isTest) {
      const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recentTest] = await db.select({ id: broadcastsSent.id })
        .from(broadcastsSent)
        .where(and(
          eq(broadcastsSent.composerSessionId, input.composerSessionId),
          eq(broadcastsSent.isTest, true),
          eq(broadcastsSent.status, 'sent'),
          gte(broadcastsSent.sentAt, sixtyMinAgo),
        ))
        .limit(1);

      if (!recentTest) {
        return { status: 'failed', error: 'Real send requires a successful test send within the same session in the last hour.', recipientCountEstimate: 0 };
      }
    }

    const testInternalUserCompanyId = process.env.TEST_INTERNAL_USER_COMPANY_ID
      ? Number.parseInt(process.env.TEST_INTERNAL_USER_COMPANY_ID, 10)
      : null;
    const recipientCountEstimate = await this.estimateRecipientCount(
      input.isTest ? 'test_internal' : input.segmentKey,
      testInternalUserCompanyId,
    );

    const [sender] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, input.sentByUserId));
    const rawFirst = sender?.firstName;
    const firstName = input.isTest
      ? (rawFirst != null && rawFirst !== '' ? rawFirst : 'there')
      : 'there';
    console.log(`[broadcasts] sentByUserId=${input.sentByUserId} rawFirst=${JSON.stringify(rawFirst)} → firstName="${firstName}" isTest=${input.isTest}`);

    const html = this.renderBroadcastHtml(input.subject, input.bodyMarkdown, firstName);
    const targetSegmentId = input.isTest ? this.getSegmentId('test_internal') : segmentId;
    if (!targetSegmentId) {
      return { status: 'failed', error: 'Target segment not configured', recipientCountEstimate };
    }

    const { data: createData, error: createError } = await resendMarketing.broadcasts.create({
      segmentId: targetSegmentId,
      from: this.fromAddress,
      subject: input.subject,
      html,
    });

    if (createError || !createData) {
      await db.insert(broadcastsSent).values({
        composerSessionId: input.composerSessionId,
        subject: input.subject,
        bodyMarkdown: input.bodyMarkdown,
        segmentKey: input.segmentKey,
        segmentId: targetSegmentId,
        isTest: input.isTest,
        recipientCountEstimate,
        sentByUserId: input.sentByUserId,
        status: 'failed',
        errorMessage: createError ? `${createError.name}: ${createError.message}` : 'unknown create failure',
      });
      return { status: 'failed', error: createError ? createError.message : 'Resend create failed', recipientCountEstimate };
    }

    const broadcastId = createData.id;
    const { error: sendError } = await resendMarketing.broadcasts.send(broadcastId);

    if (sendError) {
      await db.insert(broadcastsSent).values({
        composerSessionId: input.composerSessionId,
        subject: input.subject,
        bodyMarkdown: input.bodyMarkdown,
        segmentKey: input.segmentKey,
        segmentId: targetSegmentId,
        isTest: input.isTest,
        recipientCountEstimate,
        resendBroadcastId: broadcastId,
        sentByUserId: input.sentByUserId,
        status: 'failed',
        errorMessage: `${sendError.name}: ${sendError.message}`,
      });
      return { status: 'failed', error: sendError.message, broadcastId, recipientCountEstimate };
    }

    await db.insert(broadcastsSent).values({
      composerSessionId: input.composerSessionId,
      subject: input.subject,
      bodyMarkdown: input.bodyMarkdown,
      segmentKey: input.segmentKey,
      segmentId: targetSegmentId,
      isTest: input.isTest,
      recipientCountEstimate,
      resendBroadcastId: broadcastId,
      sentByUserId: input.sentByUserId,
      status: 'sent',
    });

    return { status: 'sent', broadcastId, recipientCountEstimate };
  }

  async listHistory(limit = 50): Promise<BroadcastSent[]> {
    return await db.select()
      .from(broadcastsSent)
      .orderBy(desc(broadcastsSent.sentAt))
      .limit(limit);
  }
}

export const broadcastsService = new BroadcastsService();
