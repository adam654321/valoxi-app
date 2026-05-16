import { eq, count } from 'drizzle-orm';
import { db } from '../db';
import { promoCodeCampaigns, subscriptions } from '@shared/schema/billing';
import { users } from '@shared/schema/core';
import type { PromoCodeCampaign, Subscription } from '@shared/schema/billing';

export function computeFreeMonthsElapsed(freeMonthsStartedAt: Date): number {
  const now = new Date();
  const months =
    (now.getFullYear() - freeMonthsStartedAt.getFullYear()) * 12 +
    (now.getMonth() - freeMonthsStartedAt.getMonth());
  if (now.getDate() < freeMonthsStartedAt.getDate()) {
    return Math.max(0, months - 1);
  }
  return Math.max(0, months);
}

export function isFreePeriodEndingSoon(
  freeMonthsStartedAt: Date,
  freeMonthsTotal: number
): boolean {
  const elapsed = computeFreeMonthsElapsed(freeMonthsStartedAt);
  return elapsed === freeMonthsTotal - 1;
}

class PromoCodeService {
  /**
   * Resolve a promo campaign by URL slug.
   * Returns null if slug not found, campaign inactive, expired, or claim cap reached.
   * Used by the public signup flow (Phase C) and admin direct-add (Phase D).
   */
  async resolveCampaignBySlug(slug: string): Promise<PromoCodeCampaign | null> {
    const [campaign] = await db
      .select()
      .from(promoCodeCampaigns)
      .where(eq(promoCodeCampaigns.slug, slug));

    if (!campaign) return null;
    if (!campaign.isActive) return null;
    if (campaign.expiresAt && campaign.expiresAt < new Date()) return null;

    if (campaign.maxTotalClaims !== null) {
      const [{ claimed }] = await db
        .select({ claimed: count() })
        .from(users)
        .where(eq(users.assignedPromoCampaignId, campaign.id));
      if (claimed >= campaign.maxTotalClaims) return null;
    }

    return campaign;
  }

  /**
   * Assign a promo campaign to a user. Single source of truth for all three
   * allocation paths: admin-waitlist invite, admin direct-add, public signup.
   *
   * Executor parameter is required. Pass `db` for standalone calls, or a
   * transaction handle (`tx`) when called inside a db.transaction(async (tx) => ...) block.
   * Caller is responsible for transaction boundaries.
   *
   * Idempotent: re-assigning the same campaign updates assignedAt timestamp.
   * Overwrites: re-assigning a different campaign replaces the previous assignment.
   */
  async assignCampaignToUser(
    userId: number,
    campaignId: number,
    attributedBy: number | null,
    executor: typeof db
  ): Promise<void> {
    await executor
      .update(users)
      .set({
        assignedPromoCampaignId: campaignId,
        assignedByAdminId: attributedBy,
        assignedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async resolveCheckoutCoupon(userId: number): Promise<{ stripeCouponId: string } | null> {
    const [user] = await db
      .select({
        id: users.id,
        userCompanyId: users.userCompanyId,
        assignedPromoCampaignId: users.assignedPromoCampaignId,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user || user.assignedPromoCampaignId === null) {
      return null;
    }

    const [campaign] = await db
      .select()
      .from(promoCodeCampaigns)
      .where(eq(promoCodeCampaigns.id, user.assignedPromoCampaignId));

    if (!campaign) {
      console.warn(`[promo-code] resolveCheckoutCoupon: user ${userId} has assigned_promo_campaign_id=${user.assignedPromoCampaignId} but campaign row missing`);
      return null;
    }

    const isNewMember = isFiveDNewMember(campaign);

    if (!isNewMember) {
      return { stripeCouponId: campaign.stripeCouponId };
    }

    // 5D New Member path. Need subscription to decide free-period state.
    if (user.userCompanyId === null) {
      return null;
    }

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userCompanyId, user.userCompanyId));

    // No subscription row: user has not completed signup-triggered trial creation. Skip.
    if (!subscription) {
      return null;
    }

    // 5D New Member users always receive the post-free-period coupon on checkout:
    // - During free period: user is deliberately exiting early; /checkout applies a balance credit separately
    // - After free period ends naturally: cron has already applied the coupon to any existing Stripe sub;
    //   if they then create a fresh sub via /checkout, they still get the coupon attached

    // Post-free-period 5D New Member. Must have a post_free_period_coupon_id.
    if (!campaign.postFreePeriodCouponId) {
      throw new Error(
        `[promo-code] resolveCheckoutCoupon: campaign ${campaign.id} (${campaign.name}) is 5D New Member but has no post_free_period_coupon_id. Fix campaign config.`
      );
    }

    return { stripeCouponId: campaign.postFreePeriodCouponId };
  }

}

export const promoCodeService = new PromoCodeService();

export interface WaitlistPromoCopy {
  benefitSentence: string;
  trialLineOverride: string | null;
}

export function getWaitlistPromoCopy(campaign: {
  referralSource: string;
  freeMonthsTotal: number;
}): WaitlistPromoCopy | null {
  if (campaign.referralSource === 'early_bird') {
    return {
      benefitSentence: "You've been assigned 20 percent off your Valoxi subscription for life, on any paid plan. The discount applies automatically when you subscribe.",
      trialLineOverride: null,
    };
  }
  if (campaign.referralSource === '5d_community' && campaign.freeMonthsTotal === 6) {
    return {
      benefitSentence: "You've been given 6 months of Valoxi Core free, starting when you sign up. After your free period ends, 15 percent off applies to whatever plan you choose, for life.",
      trialLineOverride: "Your 6 month free period of Valoxi Core starts the moment you sign up.",
    };
  }
  if (campaign.referralSource === '5d_community' && campaign.freeMonthsTotal === 0) {
    return {
      benefitSentence: "You've been assigned 15 percent off your Valoxi subscription for life, on any paid plan. The discount applies automatically when you subscribe.",
      trialLineOverride: null,
    };
  }
  return null;
}

export function isFiveDNewMember(campaign: {
  referralSource: string;
  freeMonthsTotal: number;
}): boolean {
  return campaign.referralSource === '5d_community' && campaign.freeMonthsTotal === 6;
}

export interface FreePeriodState {
  isActive: boolean;
  elapsedMonths: number;
  remainingMonths: number;
}

export function getFreePeriodState(subscription: Subscription): FreePeriodState {
  if (subscription.freeMonthsTotal <= 0 || !subscription.freeMonthsStartedAt) {
    return { isActive: false, elapsedMonths: 0, remainingMonths: 0 };
  }
  const elapsed = computeFreeMonthsElapsed(subscription.freeMonthsStartedAt);
  const remaining = Math.max(0, subscription.freeMonthsTotal - elapsed);
  const isActive = elapsed < subscription.freeMonthsTotal;
  return {
    isActive,
    elapsedMonths: elapsed,
    remainingMonths: remaining,
  };
}
