import { randomBytes } from 'crypto';
import Stripe from 'stripe';
import { eq, and, sql, lt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { promoCodes, promoCodeCampaigns, subscriptions } from '@shared/schema/billing';
import { users } from '@shared/schema/core';
import type { PromoCode, PromoCodeCampaign } from '@shared/schema/billing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

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

interface ClaimResult {
  success: boolean;
  freeMonths?: number;
  discountDescription?: string;
  reason?: string;
}

interface ValidationResult {
  valid: boolean;
  campaign?: PromoCodeCampaign;
  promoCode?: PromoCode;
  reason?: string;
}

class PromoCodeService {
  async generateCodes(campaignId: number, quantity: number): Promise<PromoCode[]> {
    const [campaign] = await db
      .select()
      .from(promoCodeCampaigns)
      .where(eq(promoCodeCampaigns.id, campaignId));

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const prefix = campaign.codePrefix || '';
    const codes: { campaignId: number; code: string; maxUses: number; expiresAt: Date | null }[] = [];

    const existingCodes = await db
      .select({ code: promoCodes.code })
      .from(promoCodes)
      .where(eq(promoCodes.campaignId, campaignId));
    const existingSet = new Set(existingCodes.map((c) => c.code));

    for (let i = 0; i < quantity; i++) {
      let code: string;
      let attempts = 0;
      do {
        const random = generateRandomCode(5);
        code = prefix ? `${prefix}-${random}` : random;
        attempts++;
        if (attempts > 100) throw new Error('Too many collisions generating codes');
      } while (existingSet.has(code));
      existingSet.add(code);
      codes.push({
        campaignId,
        code,
        maxUses: campaign.maxUsesPerCode,
        expiresAt: campaign.expiresAt,
      });
    }

    const inserted = await db.insert(promoCodes).values(codes).returning();
    return inserted;
  }

  async validateCode(code: string): Promise<ValidationResult> {
    const upperCode = code.toUpperCase().trim();

    const [promoCode] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, upperCode));

    if (!promoCode) {
      return { valid: false, reason: 'Code not found' };
    }

    if (promoCode.usesCount >= promoCode.maxUses) {
      return { valid: false, reason: 'Code has already been used' };
    }

    if (promoCode.expiresAt && new Date() > promoCode.expiresAt) {
      return { valid: false, reason: 'Code has expired' };
    }

    const [campaign] = await db
      .select()
      .from(promoCodeCampaigns)
      .where(eq(promoCodeCampaigns.id, promoCode.campaignId));

    if (!campaign) {
      return { valid: false, reason: 'Campaign not found' };
    }

    if (campaign.expiresAt && new Date() > campaign.expiresAt) {
      return { valid: false, reason: 'Campaign has expired' };
    }

    return { valid: true, campaign, promoCode };
  }

  async claimCode(
    code: string,
    userCompanyId: number,
    stripeCustomerId: string | null
  ): Promise<ClaimResult> {
    try {
      const validation = await this.validateCode(code);
      if (!validation.valid || !validation.campaign || !validation.promoCode) {
        return { success: false, reason: validation.reason || 'Invalid code' };
      }

      const { campaign, promoCode } = validation;

      const [existingSub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userCompanyId, userCompanyId));

      if (existingSub?.promoCodeId) {
        return { success: false, reason: 'A promo code has already been applied to this account' };
      }

      await db.transaction(async (tx) => {
        await tx
          .update(promoCodes)
          .set({
            usesCount: sql`${promoCodes.usesCount} + 1`,
            claimedByUserCompanyId: userCompanyId,
            claimedAt: new Date(),
          })
          .where(eq(promoCodes.id, promoCode.id));

        if (existingSub) {
          const subUpdate: Record<string, unknown> = {
            referralSource: campaign.referralSource,
            promoCodeId: promoCode.id,
            updatedAt: new Date(),
          };

          if (campaign.freeMonthsTotal > 0) {
            subUpdate.freeMonthsTotal = campaign.freeMonthsTotal;
            subUpdate.freeMonthsStartedAt = new Date();
          }

          await tx
            .update(subscriptions)
            .set(subUpdate)
            .where(eq(subscriptions.userCompanyId, userCompanyId));
        } else {
          await tx.insert(subscriptions).values({
            userCompanyId,
            planKey: 'CORE',
            status: 'active',
            billingInterval: 'month',
            freeMonthsTotal: campaign.freeMonthsTotal,
            freeMonthsStartedAt: campaign.freeMonthsTotal > 0 ? new Date() : null,
            referralSource: campaign.referralSource,
            promoCodeId: promoCode.id,
            communityDiscountCouponId: campaign.freeMonthsTotal > 0 ? null : campaign.stripeCouponId,
          });
        }
      });

      if (stripeCustomerId) {
        try {
          await stripe.customers.update(stripeCustomerId, {
            coupon: campaign.stripeCouponId,
          } as any);
        } catch (err) {
          console.error('[PromoCode] Failed to apply Stripe coupon:', err);
        }
      }

      if (campaign.referralSource === '5d_community' && campaign.freeMonthsTotal > 0) {
        try {
          const partnerCustomerId = process.env.STRIPE_PARTNER_CUSTOMER_5D;
          const partnerPriceId = process.env.STRIPE_PARTNER_PRICE_5D;
          if (partnerCustomerId && partnerPriceId) {
            const invoiceMonths = campaign.freeMonthsTotal;
            const activationDate = new Date().toISOString().split('T')[0];

            const [claimingUser] = await db
              .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
              .from(users)
              .where(eq(users.userCompanyId, userCompanyId));

            const userName = claimingUser
              ? `${claimingUser.firstName || ''} ${claimingUser.lastName || ''}`.trim() || claimingUser.email
              : `Company ${userCompanyId}`;
            const userEmail = claimingUser?.email || 'unknown';

            await stripe.invoiceItems.create({
              customer: partnerCustomerId,
              price: partnerPriceId,
              quantity: invoiceMonths,
              description: `${invoiceMonths}-month Core access — ${userName} (${userEmail}) — activated ${activationDate}`,
            });

            console.log(`[5D Partner] Invoice item created for ${userEmail} — ${invoiceMonths} months`);
          }
        } catch (err) {
          console.error('[5D Partner] Failed to create partner invoice item (non-blocking):', err);
        }
      }

      try {
        const { track } = await import('./funnel.service');
        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userCompanyId, userCompanyId));
        track(userCompanyId, null, 'referral.code_claimed', {
          source: campaign.referralSource,
          campaignName: campaign.name,
          code: code.toUpperCase().trim(),
        });
      } catch (err) {
        console.error('[PromoCode] Failed to track funnel event:', err);
      }

      const freeMonths = campaign.freeMonthsTotal;
      let discountDescription = 'Discount applied';
      if (freeMonths > 0) {
        discountDescription = `${freeMonths} months free, then ongoing discount`;
      }

      return { success: true, freeMonths, discountDescription };
    } catch (err) {
      console.error('[PromoCode] Claim failed:', err);
      return { success: false, reason: 'An unexpected error occurred' };
    }
  }
}

export const promoCodeService = new PromoCodeService();
