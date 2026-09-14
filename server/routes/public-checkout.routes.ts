import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { config } from '../config';
import { asyncHandler } from '../utils/async-handler';
import { promoCodeService, isFiveDNewMember } from '../services/promo-code.service';
import { VALID_PLAN_KEYS, LOOKUP_KEY_MAP } from './billing.routes';
import type { PlanKey } from '@shared/schema/billing';
import { systemConfigService } from '../services/system-config.service';

const router = Router();

const checkoutSchema = z.object({
  planKey: z.string().min(1).max(20),
  interval: z.enum(['month', 'year']),
  promoSlug: z.string().max(50).optional().nullable(),
});

/**
 * POST /api/v2/public/checkout
 * Stripe-first self-serve checkout. Unauthenticated, rate-limited at the mount.
 * No account exists yet: Stripe Checkout collects email + name + card, and the
 * signature-verified checkout.session.completed webhook (C-new.2) provisions
 * the account.
 *
 * Deliberately sets NO metadata.userCompanyId. Its absence is the signal the
 * webhook uses to branch into self-serve provisioning.
 */
router.post('/checkout', asyncHandler(async (req: Request, res: Response) => {
  if (!((await systemConfigService.getConfig('open_access_enabled')) === 'true')) {
    return res.status(400).json({
      error: 'open_access_disabled',
      message: 'Self-serve checkout is not currently available.',
    });
  }

  if (!config.stripe.secretKey) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'planKey, interval (month|year) and optional promoSlug required.',
    });
  }

  const planKey = parsed.data.planKey as PlanKey;
  const interval = parsed.data.interval;
  const promoSlug = parsed.data.promoSlug?.trim().toLowerCase() || null;

  if (!VALID_PLAN_KEYS.includes(planKey)) {
    return res.status(400).json({
      error: 'invalid_plan',
      message: 'Plan must be CORE, PROFESSIONAL, or EXPERT. Enterprise is invoice-only.',
    });
  }

  // Resolve the promo campaign, if one was supplied. resolveCampaignBySlug
  // already enforces is_active, expiry and the claim cap.
  let campaign = null;
  if (promoSlug) {
    campaign = await promoCodeService.resolveCampaignBySlug(promoSlug);
    if (!campaign) {
      return res.status(400).json({
        error: 'promo_not_found',
        message: 'This promo link is not valid.',
      });
    }
  }

  const isFiveD = campaign !== null && isFiveDNewMember(campaign);

  // 5D New Member: the funded benefit is 6 months free on CORE, monthly only.
  // Picking PRO/EXPERT or annual at signup is rejected. Upgrading after signup
  // is a separate prorated path.
  if (isFiveD) {
    if (planKey !== 'CORE') {
      return res.status(400).json({
        error: 'fived_core_only',
        message: '5D New Member signup starts on Core. You can upgrade after signing up.',
      });
    }
    if (interval !== 'month') {
      return res.status(400).json({
        error: 'fived_monthly_only',
        message: '5D New Member signup is monthly.',
      });
    }
  }

  // Coupon selection.
  // 5D New Member: use postFreePeriodCouponId (the ongoing 15%-forever coupon),
  // applied from day one. The 6-month trial below delivers the free period.
  // Mirrors resolveCheckoutCoupon's 5D branch.
  // Other campaigns: use stripeCouponId.
  let couponId: string | null = null;
  if (campaign) {
    if (isFiveD) {
      if (!campaign.postFreePeriodCouponId) {
        console.error(`[public-checkout] 5D campaign ${campaign.id} (${campaign.name}) has no post_free_period_coupon_id`);
        return res.status(500).json({
          error: 'promo_misconfigured',
          message: 'This promo is not correctly configured. Please contact support.',
        });
      }
      couponId = campaign.postFreePeriodCouponId;
    } else if (campaign.freeMonthsTotal > 0) {
      // Trial-only promotional campaign (e.g. the event campaign). The free
      // period IS the benefit and is delivered by the Stripe trial below.
      // stripe_coupon_id is NOT NULL on the table, so such a campaign carries a
      // placeholder value that must NOT be applied: applying it would stack a
      // discount on top of the free period. Only post_free_period_coupon_id, if
      // set, grants an ongoing discount after the trial ends.
      couponId = campaign.postFreePeriodCouponId ?? null;
    } else {
      couponId = campaign.stripeCouponId;
    }
  }

  const lookupKey = LOOKUP_KEY_MAP[planKey]?.[interval];
  if (!lookupKey) {
    return res.status(400).json({
      error: 'invalid_combination',
      message: 'Invalid plan and interval combination.',
    });
  }

  const stripe = new Stripe(config.stripe.secretKey);

  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (!prices.data.length) {
    return res.status(400).json({
      error: 'price_not_found',
      message: `No active price found for lookup key: ${lookupKey}`,
    });
  }

  // checkoutParams typed as any to match the authenticated /checkout handler
  // in billing.routes.ts (avoids Stripe v20 discounts typing friction).
  const checkoutParams: any = {
    mode: 'subscription',
    line_items: [{ price: prices.data[0].id, quantity: 1 }],
    payment_method_collection: 'always',
    success_url: `${config.baseUrl}/post-checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.marketing.siteUrl}/#pricing`,
    metadata: {
      planKey,
      billingInterval: interval,
      promoSlug: promoSlug ?? '',
    },
  };

  if (couponId) {
    checkoutParams.discounts = [{ coupon: couponId }];
  }

  // 5D New Member: a Stripe-native trial delivers the free period. Invoices
  // are 0 during the trial; the card is still collected (payment_method_
  // collection: 'always') for the first post-trial bill. At trial end Stripe
  // bills CORE with the 15% coupon already attached. No Valoxi free-period
  // row, no cron.
  // A Stripe-native trial delivers the free period for ANY campaign carrying
  // free months, not just 5D. Invoices are 0 during the trial; the card is
  // still collected (payment_method_collection: 'always') for the first
  // post-trial bill. No Valoxi free-period row, no cron.
  if (campaign && campaign.freeMonthsTotal > 0) {
    const trialEnd = new Date();
    // Calendar-month trial. setMonth can drift 1-2 days on month-end signups;
    // acceptable for a trial length.
    trialEnd.setMonth(trialEnd.getMonth() + campaign.freeMonthsTotal);
    const trialDays = Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    checkoutParams.subscription_data = {
      trial_period_days: trialDays,
      metadata: {
        trial_type: isFiveD ? '5d_new_member' : 'promo_free_months',
        promoSlug: campaign.slug,
        freeMonthsTotal: String(campaign.freeMonthsTotal),
      },
    };
  } else {
    checkoutParams.subscription_data = {
      trial_period_days: 7,
      metadata: {
        trial_type: 'standard_7d',
      },
    };
  }

  const session = await stripe.checkout.sessions.create(checkoutParams);

  return res.status(200).json({ checkoutUrl: session.url });
}));

export default router;
