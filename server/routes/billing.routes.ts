import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { promoCodeService, computeFreeMonthsElapsed, getFreePeriodState } from '../services/promo-code.service';
import { db } from '../db';
import { webhookEvents, users } from '@shared/schema/core';
import { subscriptions, promoCodeCampaigns } from '@shared/schema/billing';
import type { PlanKey, BillingInterval, SubscriptionStatus } from '@shared/schema/billing';
import { isAuthenticated, isSystemAdmin } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';
import { emailApiService } from '../services/email.service';

export const billingWebhookRoutes = Router();
const router = Router();

export function derivePlanKeyFromLookupKey(lookupKey: string): PlanKey {
  const normalized = lookupKey.toLowerCase();
  if (normalized.includes('enterprise')) return 'ENTERPRISE';
  if (normalized.includes('expert')) return 'EXPERT';
  if (normalized.includes('professional')) return 'PROFESSIONAL';
  if (normalized.includes('core')) return 'CORE';
  console.warn(`[Billing] Unknown Stripe lookup key: "${lookupKey}", defaulting to CORE`);
  return 'CORE';
}

function deriveBillingInterval(lookupKey: string): BillingInterval {
  return lookupKey.toLowerCase().includes('annual') ? 'year' : 'month';
}

async function logWebhookEvent(
  eventType: string,
  stripeEventId: string | null,
  payload: unknown,
  status: string,
  error?: string
) {
  try {
    await db.insert(webhookEvents).values({
      source: 'stripe',
      stripeEventId,
      eventType,
      payload: payload as Record<string, unknown>,
      status,
      error: error ?? null,
      processedAt: new Date(),
    });
  } catch (err) {
    console.error('[Billing] Failed to log webhook event:', err);
  }
}

billingWebhookRoutes.post('/webhook/stripe', async (req: Request, res: Response) => {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    console.error('[Billing] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'stripe_not_configured' });
  }

  const stripe = new Stripe(config.stripe.secretKey);
  const signature = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    console.error('[Billing] Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  console.log('[billing-webhook] Received event:', event.type);

  const existing = await billingRepository.getEventByStripeId(event.id);
  if (existing) {
    await logWebhookEvent(event.type, event.id, event.data.object, 'skipped');
    return res.status(200).json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userCompanyId = parseInt(session.metadata?.userCompanyId ?? '0', 10);
        const planKey = (session.metadata?.planKey as PlanKey) ?? 'CORE';
        const billingInterval = (session.metadata?.billingInterval as BillingInterval) ?? 'month';

        if (userCompanyId && session.customer && session.subscription) {
          const subscriptionId = session.subscription as string;
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
          const primaryItem = stripeSub.items.data[0];
          const periodStart = primaryItem?.current_period_start
            ? new Date(primaryItem.current_period_start * 1000)
            : new Date();
          const periodEnd = primaryItem?.current_period_end
            ? new Date(primaryItem.current_period_end * 1000)
            : new Date();
          const stripeStatusMap: Record<string, SubscriptionStatus> = {
            active: 'active',
            trialing: 'trialing',
            past_due: 'past_due',
            canceled: 'canceled',
            incomplete: 'incomplete',
            incomplete_expired: 'canceled',
            unpaid: 'past_due',
          };
          const mappedStatus: SubscriptionStatus = stripeStatusMap[stripeSub.status] ?? 'active';

          await billingService.activateSubscription(userCompanyId, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            planKey,
            billingInterval,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            status: mappedStatus,
          });
        }

        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        // Stripe v20: current_period_start/end moved from Subscription to
        // SubscriptionItem. Read from primary item.
        const primaryItem = subscription.items.data[0];
        const lookupKey = primaryItem?.price?.lookup_key ?? '';
        const planKey = derivePlanKeyFromLookupKey(lookupKey);

        const matchingSub = await billingRepository.getByStripeSubscriptionId(subscription.id);

        if (matchingSub) {
          const statusMap: Record<string, string> = {
            active: 'active',
            past_due: 'past_due',
            canceled: 'canceled',
            incomplete: 'incomplete',
            trialing: 'trialing',
            incomplete_expired: 'canceled',
            unpaid: 'past_due',
          };

          const periodStart = primaryItem?.current_period_start
            ? new Date(primaryItem.current_period_start * 1000)
            : undefined;
          const periodEnd = primaryItem?.current_period_end
            ? new Date(primaryItem.current_period_end * 1000)
            : undefined;

          await billingService.updateSubscriptionStatus(
            matchingSub.userCompanyId,
            {
              status: (statusMap[subscription.status] ?? 'active') as any,
              planKey,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
            event.id
          );
        }

        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const matchingSub = await billingRepository.getByStripeSubscriptionId(subscription.id);

        if (matchingSub) {
          // Capture if this cancellation was triggered by our dunning cron
          // BEFORE flipping status (the audit row is recent and queryable).
          const wasDunningCancel = await billingRepository.hasRecentEvent(
            matchingSub.userCompanyId,
            'dunning.auto_cancel_requested',
            10 * 60 * 1000
          );

          await billingService.updateSubscriptionStatus(
            matchingSub.userCompanyId,
            { status: 'canceled' },
            event.id
          );

          // Fire the cancellation email only when the cancel was dunning-driven.
          // For user-initiated cancels (portal, admin), other code paths handle
          // their own messaging.
          if (wasDunningCancel) {
            const adminEmail = await billingRepository.getAdminEmailForCompany(matchingSub.userCompanyId);
            if (adminEmail) {
              await emailApiService.sendDunningCancellationEmail({
                to: adminEmail.email,
                firstName: adminEmail.firstName || 'there',
                planKey: matchingSub.planKey,
              });
              await billingRepository.logEvent({
                userCompanyId: matchingSub.userCompanyId,
                eventType: 'dunning.cancellation_email_sent',
                previousStatus: 'past_due',
                previousPlanKey: matchingSub.planKey,
                newStatus: 'canceled',
                newPlanKey: matchingSub.planKey,
                payload: { stripeEventId: event.id, sentAt: new Date() },
              });
            }
          }
        }

        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // Stripe v20: Invoice.subscription removed from SDK types; parent.subscription_details added.
        // Narrow extension restores both fields without escaping to any.
        const invoiceData = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          parent?: { subscription_details?: { subscription?: string } };
        };
        const subscriptionId: string | undefined =
          typeof invoiceData.subscription === 'string'
            ? invoiceData.subscription
            : invoiceData.subscription?.id ?? invoiceData.parent?.subscription_details?.subscription;

        if (subscriptionId) {
          const matchingSub = await billingRepository.getByStripeSubscriptionId(subscriptionId);

          if (matchingSub) {
            await billingService.updateSubscriptionStatus(
              matchingSub.userCompanyId,
              {
                status: 'active',
              },
              event.id
            );
          }
        }

        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Stripe v20: Invoice.subscription removed from SDK types; parent.subscription_details added.
        // Narrow extension restores both fields without escaping to any.
        const invoiceData = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          parent?: { subscription_details?: { subscription?: string } };
        };
        const subscriptionId: string | undefined =
          typeof invoiceData.subscription === 'string'
            ? invoiceData.subscription
            : invoiceData.subscription?.id ?? invoiceData.parent?.subscription_details?.subscription;

        if (subscriptionId) {
          const matchingSub = await billingRepository.getByStripeSubscriptionId(subscriptionId);

          if (matchingSub && matchingSub.status !== 'admin_comped') {
            await billingService.updateSubscriptionStatus(
              matchingSub.userCompanyId,
              { status: 'past_due' },
              event.id
            );

            // Day 0 dunning email. Idempotent because Stripe redelivery is
            // short-circuited by the route-level dedup at lines 81-85, which
            // checks subscription_events.stripe_event_id.
            const adminEmail = await billingRepository.getAdminEmailForCompany(matchingSub.userCompanyId);
            if (adminEmail) {
              await emailApiService.sendPaymentFailedEmail({
                to: adminEmail.email,
                firstName: adminEmail.firstName || 'there',
                planKey: matchingSub.planKey,
              });
              await billingRepository.logEvent({
                userCompanyId: matchingSub.userCompanyId,
                eventType: 'dunning.day0_sent',
                previousStatus: matchingSub.status,
                previousPlanKey: matchingSub.planKey,
                newStatus: 'past_due',
                newPlanKey: matchingSub.planKey,
                payload: { stripeEventId: event.id },
              });
            }
          } else if (matchingSub && matchingSub.status === 'admin_comped') {
            console.log(`[billing] invoice.payment_failed for admin_comped sub ${matchingSub.id} (company ${matchingSub.userCompanyId}) - guard active, no past_due transition`);
          }
        }

        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceData = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          parent?: { subscription_details?: { subscription?: string } };
        };
        const subscriptionId: string | undefined =
          typeof invoiceData.subscription === 'string'
            ? invoiceData.subscription
            : invoiceData.subscription?.id ?? invoiceData.parent?.subscription_details?.subscription;

        if (subscriptionId) {
          const matchingSub = await billingRepository.getByStripeSubscriptionId(subscriptionId);
          if (matchingSub) {
            const renewalDate = invoice.period_end
              ? new Date(invoice.period_end * 1000)
              : new Date();
            const amountDue = invoice.amount_due ?? 0;

            if (matchingSub.billingInterval === 'year') {
              const adminEmail = await billingRepository.getAdminEmailForCompany(matchingSub.userCompanyId);
              if (adminEmail) {
                await emailApiService.sendRenewalWarningEmail({
                  to: adminEmail.email,
                  firstName: adminEmail.firstName,
                  planKey: matchingSub.planKey,
                  renewalDate,
                  amountDue,
                  currency: matchingSub.currency ?? 'usd',
                });
                console.log(`[billing] Renewal warning email sent to ${adminEmail.email} for company ${matchingSub.userCompanyId}`);
              }
            }

            await billingRepository.logEvent({
              userCompanyId: matchingSub.userCompanyId,
              stripeEventId: event.id,
              eventType: 'invoice.upcoming',
              previousStatus: matchingSub.status,
              previousPlanKey: matchingSub.planKey,
              newStatus: matchingSub.status,
              newPlanKey: matchingSub.planKey,
              payload: {
                renewalDate,
                amountDue,
                currency: matchingSub.currency ?? 'usd',
                billingInterval: matchingSub.billingInterval,
              },
            });
          }
        }
        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      default:
        return res.status(200).json({ received: true, unhandled: true });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`[Billing] Error processing ${event.type}:`, err);
    await logWebhookEvent(event.type, event.id, event.data.object, 'error', err.message);
    return res.status(200).json({ received: true });
  }
});

const VALID_PLAN_KEYS: PlanKey[] = ['CORE', 'PROFESSIONAL', 'EXPERT'];
const LOOKUP_KEY_MAP: Record<string, Record<'month' | 'year', string>> = {
  CORE: { month: 'ma_core_monthly_usd', year: 'ma_core_annual_usd' },
  PROFESSIONAL: { month: 'ma_professional_monthly_usd', year: 'ma_professional_annual_usd' },
  EXPERT: { month: 'ma_expert_monthly_usd', year: 'ma_expert_annual_usd' },
};

router.get('/subscription', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const result = await billingService.getEntitlements(userCompanyId);
    if (!result) {
      return res.status(200).json({ subscription: null, limits: null, features: null });
    }

    // Load the current user's assigned promo campaign, if any.
    const userId = req.session.userId;
    let assignedPromoCampaign: {
      id: number;
      name: string;
      referralSource: string;
      freeMonthsTotal: number;
    } | null = null;

    if (userId) {
      const [userRow] = await db
        .select({ assignedPromoCampaignId: users.assignedPromoCampaignId })
        .from(users)
        .where(eq(users.id, userId));

      if (userRow?.assignedPromoCampaignId) {
        const [campaign] = await db
          .select({
            id: promoCodeCampaigns.id,
            name: promoCodeCampaigns.name,
            referralSource: promoCodeCampaigns.referralSource,
            freeMonthsTotal: promoCodeCampaigns.freeMonthsTotal,
          })
          .from(promoCodeCampaigns)
          .where(eq(promoCodeCampaigns.id, userRow.assignedPromoCampaignId));
        if (campaign) {
          assignedPromoCampaign = campaign;
        }
      }
    }

    // Derive free-period state when the subscription carries free months.
    const freePeriodState =
      result.subscription.freeMonthsTotal > 0
        ? getFreePeriodState(result.subscription)
        : null;

    const { getMaxSeats } = await import('@shared/entitlements');
    const effectiveMaxSeats = getMaxSeats(
      result.subscription.planKey as PlanKey,
      result.subscription.additionalSeats,
      result.subscription.enterpriseOverrides as Record<string, unknown> | null
    );

    let consumedSeats = 0;
    try {
      const { db } = await import('../db');
      const { users } = await import('@shared/schema/core');
      const { eq, or, and, sql: sqlTag } = await import('drizzle-orm');
      const activeUsers = await db.select({ count: sqlTag<number>`count(*)::int` })
        .from(users)
        .where(and(
          or(eq(users.userCompanyId, userCompanyId), eq(users.currentCompanyId, userCompanyId)),
          eq(users.isActive, true)
        ));
      // Seat-count fix for #100 (Hotfix 3): mirror the gate formula in
      // team.service.ts. Pre-created invitee shells are now in activeUsers
      // (isActive=true with userCompanyId set at invite time). Summing
      // pendingInvitations on top of that double-counts every shell.
      consumedSeats = activeUsers[0]?.count ?? 0;
    } catch {
      consumedSeats = 0;
    }

    return res.status(200).json({
      ...result,
      effectiveMaxSeats,
      consumedSeats,
      assignedPromoCampaign,
      freePeriodState,
    });
  } catch (err: any) {
    console.error('[Billing] Error fetching subscription:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to fetch subscription.' });
  }
});

router.get('/upgrade-preview', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (!config.stripe.secretKey) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    const planKey = req.query.planKey as PlanKey;
    const billingInterval = req.query.billingInterval as 'month' | 'year';

    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
      return res.status(400).json({ error: 'invalid_plan' });
    }

    if (!billingInterval || !['month', 'year'].includes(billingInterval)) {
      return res.status(400).json({ error: 'invalid_interval' });
    }

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);

    // Detect free-period exit: user in active 5D free period clicking Get Started.
    // Return a synthetic preview with credit info instead of the generic isNewSubscription flag,
    // so the client can show the confirmation dialog with credit breakdown.
    if (
      existingSub &&
      existingSub.freeMonthsTotal > 0 &&
      existingSub.freeMonthsStartedAt &&
      !existingSub.stripeSubscriptionId &&
      !existingSub.communityDiscountCouponId &&
      existingSub.status === 'trialing'
    ) {
      const elapsed = computeFreeMonthsElapsed(existingSub.freeMonthsStartedAt);
      const unusedFreeMonths = Math.max(0, existingSub.freeMonthsTotal - elapsed);

      if (unusedFreeMonths > 0) {
        const INVOICE_RATE_CENTS = 7395;
        const freePeriodCredit = unusedFreeMonths * INVOICE_RATE_CENTS;

        const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
        if (!lookupKey) {
          return res.status(400).json({ error: 'invalid_combination' });
        }
        const stripe = new Stripe(config.stripe.secretKey);
        const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
        if (!prices.data.length) {
          return res.status(400).json({ error: 'price_not_found' });
        }
        const recurringPrice = prices.data[0].unit_amount ?? 0;

        // 15% off applied via post-free-period coupon
        const discountedFirstInvoice = Math.round(recurringPrice * 0.85);
        const chargeAfterCredit = Math.max(0, discountedFirstInvoice - freePeriodCredit);

        return res.status(200).json({
          isFreePeriodExit: true,
          currentPlan: existingSub.planKey,
          currentInterval: existingSub.billingInterval,
          newPlan: planKey,
          newInterval: billingInterval,
          creditAmount: 0,
          chargeAmount: chargeAfterCredit,
          nextInvoiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          nextInvoiceAmount: discountedFirstInvoice,
          currency: 'usd',
          freePeriodCredit,
          unusedFreeMonths,
        });
      }
    }

    if (!existingSub?.stripeSubscriptionId || (existingSub.status !== 'active' && existingSub.status !== 'trialing')) {
      return res.status(200).json({ isNewSubscription: true });
    }

    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
    if (!lookupKey) {
      return res.status(400).json({ error: 'invalid_combination' });
    }

    const stripe = new Stripe(config.stripe.secretKey);

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (!prices.data.length) {
      return res.status(400).json({ error: 'price_not_found' });
    }

    const currentStripeSub = await stripe.subscriptions.retrieve(existingSub.stripeSubscriptionId);
    const existingItemId = currentStripeSub.items.data[0]?.id;
    if (!existingItemId) {
      return res.status(400).json({ error: 'no_subscription_item' });
    }

    // @ts-expect-error — stripe.invoices.retrieveUpcoming() removed from SDK types in v20.
    // v20 replacement is stripe.invoices.createPreview(). Raw API still accepts these params.
    // TODO: migrate to createPreview() when billing layer is stable.
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      subscription: existingSub.stripeSubscriptionId,
      subscription_items: [{ id: existingItemId, price: prices.data[0].id }],
      subscription_proration_behavior: 'always_invoice',
    });

    const lines: Array<{ amount: number }> = upcomingInvoice.lines?.data ?? [];
    const creditLines = lines.filter((l: { amount: number }) => l.amount < 0);
    const chargeLines = lines.filter((l: { amount: number }) => l.amount > 0);
    const creditAmount = Math.abs(creditLines.reduce((sum: number, l: { amount: number }) => sum + l.amount, 0));
    const chargeAmount = chargeLines.reduce((sum: number, l: { amount: number }) => sum + l.amount, 0);

    const recurringPrice = prices.data[0].unit_amount ?? 0;

    const periodEnd = upcomingInvoice.period_end
      ? new Date(upcomingInvoice.period_end * 1000).toISOString()
      : new Date().toISOString();

    let freePeriodCredit = 0;
    let unusedFreeMonths = 0;

    if (existingSub.freeMonthsTotal > 0 && existingSub.freeMonthsStartedAt && !existingSub.communityDiscountCouponId) {
      const elapsed = computeFreeMonthsElapsed(existingSub.freeMonthsStartedAt);
      unusedFreeMonths = Math.max(0, existingSub.freeMonthsTotal - elapsed);
      const INVOICE_RATE_CENTS = 7395;
      freePeriodCredit = unusedFreeMonths * INVOICE_RATE_CENTS;
    }

    return res.status(200).json({
      currentPlan: existingSub.planKey,
      currentInterval: existingSub.billingInterval,
      newPlan: planKey,
      newInterval: billingInterval,
      creditAmount,
      chargeAmount: Math.max(0, upcomingInvoice.amount_due ?? (chargeAmount - creditAmount)),
      nextInvoiceDate: periodEnd,
      nextInvoiceAmount: recurringPrice,
      currency: 'usd',
      freePeriodCredit,
      unusedFreeMonths,
    });
  } catch (err: any) {
    console.error('[Billing] Error fetching upgrade preview:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to fetch upgrade preview.' });
  }
});

router.post('/verify-session', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ success: false, reason: 'unauthorized' });
    }

    if (!config.stripe.secretKey) {
      return res.status(500).json({ success: false, reason: 'stripe_not_configured' });
    }

    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, reason: 'missing_session_id' });
    }

    const stripe = new Stripe(config.stripe.secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const sessionCompanyId = parseInt(session.metadata?.userCompanyId ?? '0', 10);
    if (sessionCompanyId !== userCompanyId) {
      return res.status(403).json({ success: false, reason: 'company_mismatch' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(200).json({ success: false, reason: 'not_paid' });
    }

    const planKey = (session.metadata?.planKey as PlanKey) ?? 'CORE';
    const billingInterval = (session.metadata?.billingInterval as BillingInterval) ?? 'month';

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);

    if (existingSub && (existingSub.status === 'active' || existingSub.status === 'admin_comped')) {
      if (existingSub.planKey === planKey) {
        return res.status(200).json({ success: true, planKey: existingSub.planKey, status: existingSub.status, alreadyActive: true });
      }

      const oldStripeSubId = existingSub.stripeSubscriptionId;

      if (session.customer && session.subscription) {
        await billingService.activateSubscription(userCompanyId, {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          planKey,
          billingInterval,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        });

        if (oldStripeSubId && oldStripeSubId !== (session.subscription as string)) {
          try {
            await stripe.subscriptions.cancel(oldStripeSubId);
            console.log(`[billing] Cancelled old subscription ${oldStripeSubId} on upgrade for company ${userCompanyId}`);
          } catch (cancelErr: any) {
            console.error(`[billing] Failed to cancel old subscription ${oldStripeSubId}:`, cancelErr.message);
          }

          await billingRepository.logEvent({
            userCompanyId,
            eventType: 'subscription.cancelled_on_upgrade',
            previousPlanKey: existingSub.planKey as PlanKey | null,
            newPlanKey: planKey,
            previousStatus: existingSub.status,
            newStatus: 'active',
            payload: { cancelledSubscriptionId: oldStripeSubId, newSubscriptionId: session.subscription },
          });
        }
      }

      console.log(`[billing] Session verified — upgraded company ${userCompanyId} from ${existingSub.planKey} to ${planKey}`);
      return res.status(200).json({ success: true, planKey, status: 'active' });
    }

    if (session.customer && session.subscription) {
      await billingService.activateSubscription(userCompanyId, {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        planKey,
        billingInterval,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });
    }

    console.log(`[billing] Session verified and subscription activated for company ${userCompanyId}, plan: ${planKey}`);
    return res.status(200).json({ success: true, planKey, status: 'active' });
  } catch (err: any) {
    console.error('[billing] Error verifying checkout session:', err);
    return res.status(500).json({ success: false, reason: 'internal_error' });
  }
});

router.post('/checkout', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (!config.stripe.secretKey) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    const { planKey, billingInterval } = req.body as {
      planKey: PlanKey;
      billingInterval: 'month' | 'year';
    };

    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Plan must be CORE, PROFESSIONAL, or EXPERT. Enterprise plans are invoice-only.' });
    }

    if (!billingInterval || !['month', 'year'].includes(billingInterval)) {
      return res.status(400).json({ error: 'invalid_interval', message: 'Billing interval must be month or year.' });
    }

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);

    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let resolvedCoupon: { stripeCouponId: string } | null;
    try {
      resolvedCoupon = await promoCodeService.resolveCheckoutCoupon(userId);
    } catch (err: any) {
      console.error('[Billing] resolveCheckoutCoupon failed:', err);
      return res.status(500).json({
        error: 'coupon_resolution_failed',
        message: err?.message || 'Could not resolve assigned promo campaign.',
      });
    }

    if (
      existingSub?.stripeSubscriptionId &&
      (existingSub.status === 'active' || existingSub.status === 'trialing')
    ) {
      return res.status(200).json({ requiresUpgrade: true });
    }

    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
    if (!lookupKey) {
      return res.status(400).json({ error: 'invalid_combination', message: 'Invalid plan and interval combination.' });
    }

    const stripe = new Stripe(config.stripe.secretKey);
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    let customerId: string | undefined | null = existingSub?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userCompanyId: String(userCompanyId) },
      });
      customerId = customer.id;
    }

    // Free-period exit: apply pro-rata credit for unused free months, mark free period as
    // exited so cron jobs skip this row going forward. Mirrors the /upgrade credit pattern
    // but fires from /checkout because free-period users have no Stripe subscription yet.
    if (
      existingSub &&
      existingSub.freeMonthsTotal > 0 &&
      existingSub.freeMonthsStartedAt &&
      !existingSub.stripeSubscriptionId &&
      !existingSub.communityDiscountCouponId &&
      existingSub.status === 'trialing' &&
      customerId
    ) {
      const elapsed = computeFreeMonthsElapsed(existingSub.freeMonthsStartedAt);
      const unusedFreeMonths = Math.max(0, existingSub.freeMonthsTotal - elapsed);

      if (unusedFreeMonths > 0) {
        const INVOICE_RATE_CENTS = 7395;
        const creditAmount = unusedFreeMonths * INVOICE_RATE_CENTS;

        try {
          await stripe.customers.createBalanceTransaction(customerId, {
            amount: -creditAmount,
            currency: 'usd',
            description: `Pro-rata credit for ${unusedFreeMonths} unused free month(s) — upgraded during free period`,
          });
          console.log(`[billing] Applied $${(creditAmount / 100).toFixed(2)} free-period credit at checkout for company ${userCompanyId} (${unusedFreeMonths} months)`);

          await billingRepository.updateByCompanyId(userCompanyId, {
            stripeCustomerId: customerId,
            freeMonthsTotal: elapsed,
            communityDiscountCouponId: 'upgraded_early',
            trialEndsAt: null,
            trialEnd: null,
          });

          await billingRepository.logEvent({
            userCompanyId,
            eventType: 'referral.free_period_upgraded_early',
            previousStatus: existingSub.status as SubscriptionStatus,
            previousPlanKey: existingSub.planKey as PlanKey,
            newStatus: existingSub.status as SubscriptionStatus,
            newPlanKey: planKey,
            payload: {
              unusedFreeMonths,
              creditAmountCents: creditAmount,
              elapsed,
              originalFreeMonthsTotal: existingSub.freeMonthsTotal,
            },
          });
        } catch (creditErr: any) {
          console.error(`[billing] Failed to apply free-period credit for company ${userCompanyId}:`, creditErr);
          return res.status(500).json({
            error: 'credit_application_failed',
            message: 'Could not apply your free-period credit. Please try again or contact support.',
          });
        }
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

    return res.status(200).json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error('[Billing] Error creating checkout session:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to create checkout session.' });
  }
});

router.post('/upgrade', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (!config.stripe.secretKey) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    const { planKey, billingInterval } = req.body as { planKey: PlanKey; billingInterval: 'month' | 'year' };

    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Plan must be CORE, PROFESSIONAL, or EXPERT.' });
    }

    if (!billingInterval || !['month', 'year'].includes(billingInterval)) {
      return res.status(400).json({ error: 'invalid_interval', message: 'Billing interval must be month or year.' });
    }

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);
    if (!existingSub?.stripeSubscriptionId || (existingSub.status !== 'active' && existingSub.status !== 'trialing')) {
      return res.status(400).json({ error: 'no_active_subscription', message: 'No active Stripe subscription found. Use checkout for new subscriptions.' });
    }

    const userId = req.session.userId;
    let resolvedCoupon: { stripeCouponId: string } | null = null;
    if (userId) {
      try {
        resolvedCoupon = await promoCodeService.resolveCheckoutCoupon(userId);
      } catch (err: any) {
        console.error('[billing] /upgrade: resolveCheckoutCoupon failed (non-fatal, upgrade will proceed without discount):', err?.message || err);
      }
    }

    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
    if (!lookupKey) {
      return res.status(400).json({ error: 'invalid_combination', message: 'Invalid plan and interval combination.' });
    }

    const stripe = new Stripe(config.stripe.secretKey);

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (!prices.data.length) {
      return res.status(400).json({ error: 'price_not_found', message: `No active price found for lookup key: ${lookupKey}` });
    }

    const currentStripeSub = await stripe.subscriptions.retrieve(existingSub.stripeSubscriptionId);
    const existingItemId = currentStripeSub.items.data[0]?.id;
    if (!existingItemId) {
      return res.status(400).json({ error: 'no_subscription_item', message: 'Could not find existing subscription item in Stripe.' });
    }

    if (existingSub.freeMonthsTotal > 0 && existingSub.freeMonthsStartedAt && !existingSub.communityDiscountCouponId) {
      const elapsed = computeFreeMonthsElapsed(existingSub.freeMonthsStartedAt);
      const unusedFreeMonths = Math.max(0, existingSub.freeMonthsTotal - elapsed);
      if (unusedFreeMonths > 0 && existingSub.stripeCustomerId) {
        const INVOICE_RATE_CENTS = 7395;
        const creditAmount = unusedFreeMonths * INVOICE_RATE_CENTS;
        await stripe.customers.createBalanceTransaction(existingSub.stripeCustomerId, {
          amount: -creditAmount,
          currency: 'usd',
          description: `Pro-rata credit for ${unusedFreeMonths} unused free month(s) from community referral`,
        });
        console.log(`[billing] Applied $${(creditAmount / 100).toFixed(2)} free-period credit for company ${userCompanyId} (${unusedFreeMonths} months)`);

        await billingRepository.updateByCompanyId(userCompanyId, {
          freeMonthsTotal: elapsed,
          communityDiscountCouponId: 'upgraded_early',
        });
      }
    }

    await stripe.subscriptions.update(existingSub.stripeSubscriptionId, {
      items: [{ id: existingItemId, price: prices.data[0].id }],
      proration_behavior: 'always_invoice',
      ...(resolvedCoupon ? { discounts: [{ coupon: resolvedCoupon.stripeCouponId }] } : {}),
    });

    if (resolvedCoupon) {
      console.log(`[billing] /upgrade: reapplied coupon ${resolvedCoupon.stripeCouponId} to subscription ${existingSub.stripeSubscriptionId} for company ${userCompanyId}`);
    }

    const previousPlanKey = existingSub.planKey;
    const previousInterval = existingSub.billingInterval;

    await billingRepository.updateByCompanyId(userCompanyId, {
      planKey,
      billingInterval,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'subscription.upgraded',
      previousPlanKey: previousPlanKey as PlanKey | null,
      newPlanKey: planKey,
      previousStatus: existingSub.status,
      newStatus: 'active',
      payload: {
        previousPlanKey,
        previousInterval,
        newPlanKey: planKey,
        newInterval: billingInterval,
      },
    });

    console.log(`[billing] Upgraded company ${userCompanyId} from ${previousPlanKey}/${previousInterval} to ${planKey}/${billingInterval}`);
    return res.status(200).json({ upgraded: true, planKey, billingInterval, status: 'active' });
  } catch (err: any) {
    console.error('[Billing] Error upgrading subscription:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to upgrade subscription.' });
  }
});

router.post('/portal', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (!config.stripe.secretKey) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'no_stripe_customer', message: 'No billing account found. Please subscribe first.' });
    }

    const stripe = new Stripe(config.stripe.secretKey);
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });

    return res.status(200).json({ portalUrl: session.url });
  } catch (err: any) {
    console.error('[Billing] Error creating portal session:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to create portal session.' });
  }
});

const ADDON_LOOKUP_KEYS: Record<string, string> = {
  company_slot: 'ma_addon_company_slot',
  seat: 'ma_addon_seat',
};

router.post('/addon', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { addonType, quantity } = req.body as { addonType: 'company_slot' | 'seat'; quantity: number };

    if (!addonType || !['company_slot', 'seat'].includes(addonType)) {
      return res.status(400).json({ error: 'invalid_addon_type', message: 'Addon type must be company_slot or seat.' });
    }

    if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: 'invalid_quantity', message: 'Quantity must be between 1 and 20.' });
    }

    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) {
      return res.status(400).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    const freePeriod = getFreePeriodState(subscription);
    if (freePeriod.isActive && !subscription.stripeSubscriptionId) {
      console.log(`[billing] addon purchase blocked for company ${userCompanyId}: active free period, ${freePeriod.remainingMonths} months remaining, no Stripe subscription`);
      return res.status(400).json({
        error: 'addon_blocked_free_period',
        message: 'Addons are not available during your free period. They will be available once you enter payment details at the end of your free period.',
      });
    }

    if (!subscription.stripeSubscriptionId) {
      console.log(`[billing] addon purchase blocked for company ${userCompanyId}: no Stripe subscription and not in active free period (suggests data inconsistency)`);
      return res.status(400).json({
        error: 'addon_blocked_no_subscription',
        message: 'Addons require an active paid subscription. Please contact support if you believe this is an error.',
      });
    }

    const existing = addonType === 'company_slot'
      ? (subscription.addOnCompanySlots ?? 0)
      : (subscription.additionalSeats ?? 0);
    const newTotal = existing + quantity;

    if (!config.stripe.secretKey) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }
    const stripe = new Stripe(config.stripe.secretKey);
    const lookupKey = ADDON_LOOKUP_KEYS[addonType];
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (!prices.data.length) {
      return res.status(400).json({ error: 'price_not_found', message: `No active price found for lookup key: ${lookupKey}` });
    }

    const existingItems = await stripe.subscriptionItems.list({ subscription: subscription.stripeSubscriptionId });
    const existingItem = existingItems.data.find(
      (item) => item.price.lookup_key === lookupKey
    );

    if (existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: (existingItem.quantity ?? 0) + quantity,
      });
    } else {
      await stripe.subscriptionItems.create({
        subscription: subscription.stripeSubscriptionId,
        price: prices.data[0].id,
        quantity,
      });
    }

    const updateData: Record<string, unknown> = addonType === 'company_slot'
      ? { addOnCompanySlots: newTotal }
      : { additionalSeats: newTotal };

    await billingRepository.updateByCompanyId(userCompanyId, updateData);

    const eventType = addonType === 'company_slot' ? 'addon.company_slot_added' : 'addon.seat_added';
    await billingRepository.logEvent({
      userCompanyId,
      eventType,
      previousPlanKey: subscription.planKey,
      newPlanKey: subscription.planKey,
      previousStatus: subscription.status,
      newStatus: subscription.status,
      payload: { addonType, quantity, previousCount: existing, newTotal },
    });

    console.log(`[billing] Added ${quantity} ${addonType}(s) for company ${userCompanyId}, new total: ${newTotal}`);
    return res.status(200).json({ success: true, addedQuantity: quantity, newTotal });
  } catch (err: any) {
    console.error('[Billing] Error processing addon purchase:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to process addon purchase.' });
  }
});

router.post('/remove-slot', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { quantity } = req.body as { quantity: number };

    if (!quantity || typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ error: 'invalid_quantity', message: 'Quantity must be at least 1.' });
    }

    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) {
      return res.status(400).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    const currentSlots = subscription.addOnCompanySlots ?? 0;
    if (quantity > currentSlots) {
      return res.status(400).json({ error: 'exceeds_slots', message: `Cannot remove ${quantity} slot(s) — you only have ${currentSlots} additional slot(s).` });
    }

    const newSlotCount = currentSlots - quantity;

    if (subscription.stripeSubscriptionId && config.stripe.secretKey) {
      const stripe = new Stripe(config.stripe.secretKey);
      const slotLookupKey = ADDON_LOOKUP_KEYS['company_slot'];
      const items = await stripe.subscriptionItems.list({ subscription: subscription.stripeSubscriptionId });
      const slotItem = items.data.find((item) => item.price.lookup_key === slotLookupKey);

      if (slotItem) {
        if (newSlotCount <= 0) {
          await stripe.subscriptionItems.del(slotItem.id);
        } else {
          await stripe.subscriptionItems.update(slotItem.id, { quantity: newSlotCount });
        }
      }
    }

    const updated = await billingRepository.updateByCompanyId(userCompanyId, {
      addOnCompanySlots: newSlotCount,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'addon.company_slot_removed',
      previousPlanKey: subscription.planKey,
      newPlanKey: subscription.planKey,
      previousStatus: subscription.status,
      newStatus: subscription.status,
      payload: { quantity, previousSlots: currentSlots, newSlots: newSlotCount },
    });

    console.log(`[billing] Removed ${quantity} company slot(s) for company ${userCompanyId}, new count: ${newSlotCount}`);
    return res.status(200).json({ success: true, removedQuantity: quantity, newTotal: newSlotCount });
  } catch (err: any) {
    console.error('[Billing] Error removing company slots:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to remove company slots.' });
  }
});

router.post('/remove-seat', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { quantity } = req.body as { quantity: number };

    if (!quantity || typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ error: 'invalid_quantity', message: 'Quantity must be at least 1.' });
    }

    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) {
      return res.status(400).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    const currentSeats = subscription.additionalSeats ?? 0;
    if (quantity > currentSeats) {
      return res.status(400).json({ error: 'exceeds_seats', message: `Cannot remove ${quantity} seat(s) — you only have ${currentSeats} additional seat(s).` });
    }

    const newSeatCount = currentSeats - quantity;

    if (subscription.stripeSubscriptionId && config.stripe.secretKey) {
      const stripe = new Stripe(config.stripe.secretKey);
      const seatLookupKey = ADDON_LOOKUP_KEYS['seat'];
      const items = await stripe.subscriptionItems.list({ subscription: subscription.stripeSubscriptionId });
      const seatItem = items.data.find((item) => item.price.lookup_key === seatLookupKey);

      if (seatItem) {
        if (newSeatCount <= 0) {
          await stripe.subscriptionItems.del(seatItem.id);
        } else {
          await stripe.subscriptionItems.update(seatItem.id, { quantity: newSeatCount });
        }
      }
    }

    const updated = await billingRepository.updateByCompanyId(userCompanyId, {
      additionalSeats: newSeatCount,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'addon.seat_removed',
      previousPlanKey: subscription.planKey,
      newPlanKey: subscription.planKey,
      previousStatus: subscription.status,
      newStatus: subscription.status,
      payload: { quantity, previousSeats: currentSeats, newSeats: newSeatCount },
    });

    console.log(`[billing] Removed ${quantity} seat(s) for company ${userCompanyId}, new count: ${newSeatCount}`);
    return res.status(200).json({ success: true, subscription: updated });
  } catch (err: any) {
    console.error('[Billing] Error removing seats:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to remove seats.' });
  }
});

router.post('/cancel', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) return res.status(401).json({ error: 'unauthorized' });

    if (!config.stripe.secretKey) return res.status(500).json({ error: 'stripe_not_configured' });

    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }
    if (subscription.status === 'canceled') {
      return res.status(400).json({ error: 'already_canceled', message: 'Subscription is already cancelled.' });
    }
    if (subscription.cancelAtPeriodEnd) {
      return res.status(400).json({ error: 'already_scheduled', message: 'Cancellation is already scheduled.' });
    }

    const stripe = new Stripe(config.stripe.secretKey);
    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await billingRepository.updateByCompanyId(userCompanyId, { cancelAtPeriodEnd: true });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'subscription.cancellation_scheduled',
      previousStatus: subscription.status as SubscriptionStatus,
      previousPlanKey: subscription.planKey as PlanKey,
      newStatus: subscription.status as SubscriptionStatus,
      newPlanKey: subscription.planKey as PlanKey,
      payload: { cancelAtPeriodEnd: true, periodEnd: updated.items.data[0]?.current_period_end ?? null },
    });

    console.log(`[billing] Cancellation scheduled for company ${userCompanyId}`);
    return res.status(200).json({
      success: true,
      cancelAtPeriodEnd: true,
      periodEnd: updated.items.data[0]?.current_period_end
        ? new Date(updated.items.data[0].current_period_end * 1000).toISOString()
        : null,
    });
  } catch (err: any) {
    console.error('[Billing] Error scheduling cancellation:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to schedule cancellation.' });
  }
});

router.post('/reactivate', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) return res.status(401).json({ error: 'unauthorized' });

    if (!config.stripe.secretKey) return res.status(500).json({ error: 'stripe_not_configured' });

    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }
    if (!subscription.cancelAtPeriodEnd) {
      return res.status(400).json({ error: 'not_scheduled', message: 'No cancellation is scheduled.' });
    }

    const stripe = new Stripe(config.stripe.secretKey);
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await billingRepository.updateByCompanyId(userCompanyId, { cancelAtPeriodEnd: false });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'subscription.cancellation_reverted',
      previousStatus: subscription.status as SubscriptionStatus,
      previousPlanKey: subscription.planKey as PlanKey,
      newStatus: subscription.status as SubscriptionStatus,
      newPlanKey: subscription.planKey as PlanKey,
      payload: { cancelAtPeriodEnd: false },
    });

    console.log(`[billing] Cancellation reverted for company ${userCompanyId}`);
    return res.status(200).json({ success: true, cancelAtPeriodEnd: false });
  } catch (err: any) {
    console.error('[Billing] Error reverting cancellation:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to revert cancellation.' });
  }
});

export default router;
