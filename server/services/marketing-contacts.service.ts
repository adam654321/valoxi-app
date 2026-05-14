import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { users, type User } from '@shared/schema';
import { billingRepository } from '../repositories/billing.repository';
import type { SubscriptionStatus } from '@shared/schema/billing';
import { resendMarketing } from '../lib/resend-marketing';

interface SegmentIds {
  allUsers: string;
  activeSubscribers: string;
  cancelledSubscribers: string;
  pastDue: string;
  trialing: string;
  testInternal: string;
}

class MarketingContactsService {
  private readonly segmentIds: SegmentIds | null;
  private readonly testInternalUserCompanyId: number | null;

  constructor() {
    const ids = {
      allUsers: process.env.RESEND_SEGMENT_ALL_USERS,
      activeSubscribers: process.env.RESEND_SEGMENT_ACTIVE_SUBSCRIBERS,
      cancelledSubscribers: process.env.RESEND_SEGMENT_CANCELLED_SUBSCRIBERS,
      pastDue: process.env.RESEND_SEGMENT_PAST_DUE,
      trialing: process.env.RESEND_SEGMENT_TRIALING,
      testInternal: process.env.RESEND_SEGMENT_TEST_INTERNAL,
    };
    const allPresent = Object.values(ids).every((v) => typeof v === 'string' && v.length > 0);
    if (allPresent) {
      this.segmentIds = ids as SegmentIds;
      console.log('[marketing-contacts] all 6 segment IDs configured');
    } else {
      this.segmentIds = null;
      console.warn('[marketing-contacts] one or more RESEND_SEGMENT_* env vars missing, sync will no-op');
    }
    const testCompanyId = process.env.TEST_INTERNAL_USER_COMPANY_ID;
    const parsed = testCompanyId ? Number.parseInt(testCompanyId, 10) : NaN;
    this.testInternalUserCompanyId = Number.isFinite(parsed) ? parsed : null;
  }

  private isConfigured(): boolean {
    return resendMarketing !== null && this.segmentIds !== null;
  }

  private segmentIdForStatus(status: SubscriptionStatus | null | undefined): string | null {
    if (!this.segmentIds || !status) return null;
    switch (status) {
      case 'trialing': return this.segmentIds.trialing;
      case 'active': return this.segmentIds.activeSubscribers;
      case 'past_due': return this.segmentIds.pastDue;
      case 'canceled': return this.segmentIds.cancelledSubscribers;
      case 'admin_comped': return this.segmentIds.activeSubscribers;
      default: return null;
    }
  }

  private async computeInitialSegments(user: User): Promise<string[]> {
    if (!this.segmentIds) return [];
    const out: string[] = [this.segmentIds.allUsers];

    if (this.testInternalUserCompanyId !== null && user.userCompanyId === this.testInternalUserCompanyId) {
      out.push(this.segmentIds.testInternal);
    }

    if (user.userCompanyId !== null) {
      const sub = await billingRepository.getByCompanyId(user.userCompanyId);
      if (sub) {
        const stateSegment = this.segmentIdForStatus(sub.status as SubscriptionStatus);
        if (stateSegment) out.push(stateSegment);
        if (sub.status === 'past_due') {
          out.push(this.segmentIds.activeSubscribers);
        }
      }
    }

    return out;
  }

  async syncContactOnUserCreate(userId: number): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        console.warn(`[marketing-contacts] syncContactOnUserCreate: user ${userId} not found`);
        return;
      }
      if (user.isActive === false) {
        console.log(`[marketing-contacts] syncContactOnUserCreate: user ${userId} not active, skipping`);
        return;
      }

      const initial = await this.computeInitialSegments(user);

      await resendMarketing!.contacts.create({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        unsubscribed: false,
        segments: initial.map((id) => ({ id })),
      });

      console.log(`[marketing-contacts] created Resend contact for user ${userId} (${user.email}) in ${initial.length} segments`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[marketing-contacts] syncContactOnUserCreate failed for user ${userId}: ${msg}`);
    }
  }

  async reconcileSubscriptionAudiences(userCompanyId: number): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const sub = await billingRepository.getByCompanyId(userCompanyId);
      const status = (sub?.status as SubscriptionStatus | undefined) ?? null;

      const required = new Set<string>();
      const stateSegment = this.segmentIdForStatus(status);
      if (stateSegment) required.add(stateSegment);
      if (status === 'past_due') {
        required.add(this.segmentIds!.activeSubscribers);
      }

      const stateUniverse: string[] = [
        this.segmentIds!.activeSubscribers,
        this.segmentIds!.cancelledSubscribers,
        this.segmentIds!.pastDue,
        this.segmentIds!.trialing,
      ];

      const companyUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.userCompanyId, userCompanyId), eq(users.isActive, true)));

      for (const u of companyUsers) {
        for (const segmentId of stateUniverse) {
          try {
            if (required.has(segmentId)) {
              await resendMarketing!.contacts.segments.add({ email: u.email, segmentId });
            } else {
              await resendMarketing!.contacts.segments.remove({ email: u.email, segmentId });
            }
          } catch (innerErr: unknown) {
            const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
            console.warn(`[marketing-contacts] segment sync (segment=${segmentId}, user=${u.id}): ${msg}`);
          }
        }
      }

      console.log(`[marketing-contacts] reconciled subscription segments for company ${userCompanyId} (${companyUsers.length} users, status=${status ?? 'none'})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[marketing-contacts] reconcileSubscriptionAudiences failed for company ${userCompanyId}: ${msg}`);
    }
  }

  async syncContactOnUserDelete(userId: number): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId));
      if (!user) {
        console.warn(`[marketing-contacts] syncContactOnUserDelete: user ${userId} not found`);
        return;
      }

      await resendMarketing!.contacts.update({
        email: user.email,
        unsubscribed: true,
      });

      console.log(`[marketing-contacts] marked user ${userId} (${user.email}) unsubscribed in Resend`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[marketing-contacts] syncContactOnUserDelete failed for user ${userId}: ${msg}`);
    }
  }
}

export const marketingContactsService = new MarketingContactsService();
