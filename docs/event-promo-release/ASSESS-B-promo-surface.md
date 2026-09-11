# ASSESS-B promo surface

## STEP 1 — SCHEMA DRIFT, FROM THE REPO

```text
$ git diff --stat a7a3726..HEAD -- shared/schema shared/schema.ts migrations

$ git diff a7a3726..HEAD -- shared/schema shared/schema.ts | head -400

$ ls migrations
0000_glossy_northstar.sql  0002_lively_puff_adder.sql  meta
0001_brief_tusk.sql   0003_deep_wraith.sql

$ git log --oneline a7a3726..HEAD -- migrations
```

NO SCHEMA CHANGE SINCE PRESUMED PROD BASELINE

## STEP 2 — THE PROMO CAMPAIGN MODEL

```text
$ rg -n "promoCodeCampaigns" shared --glob "*.ts" | head -20
shared/schema/billing.ts:71:export const promoCodeCampaigns = pgTable("promo_code_campaigns", {
shared/schema/billing.ts:128:export const insertPromoCodeCampaignSchema = createInsertSchema(promoCodeCampaigns).omit({
shared/schema/billing.ts:134:export type PromoCodeCampaign = typeof promoCodeCampaigns.$inferSelect;

$ sed -n '71,84p' shared/schema/billing.ts
export const promoCodeCampaigns = pgTable("promo_code_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  stripeCouponId: varchar("stripe_coupon_id", { length: 50 }).notNull(),
  referralSource: varchar("referral_source", { length: 50 }).notNull(),
  freeMonthsTotal: integer("free_months_total").notNull().default(0),
  maxTotalClaims: integer("max_total_claims"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  postFreePeriodCouponId: varchar("post_free_period_coupon_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
});

$ psql "$DATABASE_URL" -c "SELECT id, name, slug, is_active FROM promo_code_campaigns ORDER BY id;"
 id |          name           |     slug     | is_active 
----+-------------------------+--------------+-----------
  9 | Standard 5D community   | 5d-community | t
 10 | Early Bird              | early-bird   | f
 11 | 5D New Member           | 5d           | t
 14 | Welcome Discount        | welcome      | t
 15 | 5D New Member (1 month) | 5d1m         | t
(5 rows)

$ psql "$DATABASE_URL" -c "SELECT count(*) AS total FROM promo_code_campaigns;"
 total 
-------
     5
(1 row)
```

## STEP 3 — THE CHECKOUT PATH

```text
$ sed -n '1,200p' server/routes/public-checkout.routes.ts
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
  if (campaign && isFiveD) {
    const trialEnd = new Date();
    // Calendar-month trial. setMonth can drift 1-2 days on month-end signups;
    // acceptable for a trial length.
    trialEnd.setMonth(trialEnd.getMonth() + campaign.freeMonthsTotal);
    const trialDays = Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    checkoutParams.subscription_data = { trial_period_days: trialDays };
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

$ rg -n "trial_period_days|trialPeriodDays|trial_end|subscription_data" server --glob "*.ts"
server/cron/billing.cron.ts
269:        trial_end: Math.floor(newTrialEnd.getTime() / 1000),

server/routes/public-checkout.routes.ts
162:    checkoutParams.subscription_data = { trial_period_days: trialDays };
164:    checkoutParams.subscription_data = {
165:      trial_period_days: 7,

server/routes/billing.routes.ts
103:          const trialEnd = stripeSub.trial_end
104:            ? new Date(stripeSub.trial_end * 1000)
148:            const trialEnd = stripeSub.trial_end
149:              ? new Date(stripeSub.trial_end * 1000)
1082:      checkoutParams.subscription_data = { trial_period_days: remainingDays };

$ rg -n "checkout.sessions.create" server --glob "*.ts"
server/routes/public-checkout.routes.ts
172:  const session = await stripe.checkout.sessions.create(checkoutParams);

server/routes/billing.routes.ts
1085:    const session = await stripe.checkout.sessions.create(checkoutParams);

$ sed -n '126,176p' server/routes/public-checkout.routes.ts
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
  if (campaign && isFiveD) {
    const trialEnd = new Date();
    // Calendar-month trial. setMonth can drift 1-2 days on month-end signups;
    // acceptable for a trial length.
    trialEnd.setMonth(trialEnd.getMonth() + campaign.freeMonthsTotal);
    const trialDays = Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    checkoutParams.subscription_data = { trial_period_days: trialDays };
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

$ sed -n '1030,1089p' server/routes/billing.routes.ts
      } else {
        // Free period ended but DB not yet transitioned (cron hasn't run or missed this row).
        // Stamp the marker so cron skips going forward.
        await billingRepository.updateByCompanyId(userCompanyId, {
          stripeCustomerId: customerId,
          communityDiscountCouponId: 'upgraded_early',
          trialEndsAt: null,
          trialEnd: null,
        });
      }
    } else if (!existingSub?.stripeCustomerId && customerId) {
      // Ensure the new customer ID is persisted even for non-free-period first-time checkouts
      // so activateSubscription has the customerId available via the subscription row.
      await billingRepository.updateByCompanyId(userCompanyId, {
        stripeCustomerId: customerId,
      });
    }

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (!prices.data.length) {
      return res.status(400).json({ error: 'price_not_found', message: `No active price found for lookup key: ${lookupKey}` });
    }

    const checkoutParams: any = {
      mode: 'subscription',
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      success_url: `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing?canceled=true`,
      ...(resolvedCoupon
        ? { discounts: [{ coupon: resolvedCoupon.stripeCouponId }] }
        : { allow_promotion_codes: true }),
      metadata: {
        userCompanyId: String(userCompanyId),
        planKey,
        billingInterval,
        assignedCampaignCouponId: resolvedCoupon?.stripeCouponId || '',
      },
    };

    if (customerId) {
      checkoutParams.customer = customerId;
    }

    // Trial extension applies only to standard 14-day trials. Free-period (5D) users
    // receive their remaining period as a customer balance credit in the free-period-exit
    // block above, and MUST NOT additionally receive a Stripe trial extension or the
    // benefits stack. The existing !promoCodeId guard misses this case because 5D
    // free-month state sits on users.assignedPromoCampaignId, not subscriptions.promoCodeId.
    const hasFreeMonthState = !!(existingSub?.freeMonthsTotal && existingSub.freeMonthsTotal > 0 && existingSub?.freeMonthsStartedAt);
    if (existingSub?.trialEndsAt && !existingSub.promoCodeId && existingSub.status === 'trialing' && !hasFreeMonthState) {
      const remainingMs = existingSub.trialEndsAt.getTime() - Date.now();
      const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      checkoutParams.subscription_data = { trial_period_days: remainingDays };
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);

    if (resolvedCoupon) {
      console.log(`[Billing] Checkout session ${session.id} created with coupon ${resolvedCoupon.stripeCouponId} for customer ${customerId} (userCompanyId=${userCompanyId})`);
    }

$ sed -n '1,120p' server/services/promo-code.service.ts
import { eq, count } from 'drizzle-orm';
import { db } from '../db';
import { promoCodeCampaigns, subscriptions } from '@shared/schema/billing';
import { users } from '@shared/schema/core';
import type { PromoCodeCampaign, Subscription } from '@shared/schema/billing';

/**
 * A query executor: either the base db handle or a transaction handle
 * obtained inside db.transaction(async (tx) => ...). Lets service methods
 * run inside or outside a caller's transaction without losing type safety.
 */
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
    executor: DbExecutor
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
```

## STEP 4 — WHAT A TIER MEANS

```text
$ rg -n "'pro'|\"pro\"" server/services/billing.service.ts | head -30

$ rg -n "STRIPE_PRICE|priceId|price_id" server --glob "*.ts" | head -40

$ rg -n "planTier|tier" shared/schema/subscriptions.ts | head -40
rg: shared/schema/subscriptions.ts: IO error for operation on shared/schema/subscriptions.ts: No such file or directory (os error 2)

$ rg -n "planKey|planTier|tier|stripePriceId|priceId|price_id" shared/schema/billing.ts | head -40
6:export const planKeyEnum = pgEnum('plan_key', ['CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE']);
15:  planKey: planKeyEnum("plan_key").notNull().default('CORE'),
52:  previousPlanKey: planKeyEnum("previous_plan_key"),
54:  newPlanKey: planKeyEnum("new_plan_key"),
```

A subscription is marked as Pro today by the `plan_key` tier column using the `PROFESSIONAL` enum value, not by a stored price id.

## STEP 5 — WRITE THE OUTPUT TO THE REPO

```text
$ wc -l docs/event-promo-release/ASSESS-B-promo-surface.md
518 docs/event-promo-release/ASSESS-B-promo-surface.md

$ git status --porcelain
?? docs/event-promo-release/ASSESS-B-promo-surface.md
```

## V-CHECK

```text
$ git status --porcelain
?? docs/event-promo-release/ASSESS-B-promo-surface.md

$ git diff --stat

$ npm run check 2>&1 | tail -20

> rest-express@1.0.0 check
> tsc
```

V-CHECK — git status: PASS (only a file under `docs/event-promo-release/` is untracked).

V-CHECK — git diff --stat: PASS (no tracked source-file changes).

V-CHECK — npm run check: FAIL against the stated expectation (the command completed with zero errors, not exactly one error at `portal.service.ts:81`).