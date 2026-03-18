import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { promoCodeService, computeFreeMonthsElapsed } from '../services/promo-code.service';
import { magicLinkService } from '../services/magic-link.service';
import { db } from '../db';
import { webhookEvents, users, userCompanies } from '@shared/schema/core';
import { subscriptions } from '@shared/schema/billing';
import type { PlanKey, BillingInterval, SubscriptionStatus } from '@shared/schema/billing';
import { isAuthenticated, isSystemAdmin } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';
import { emailApiService } from '../services/email.service';
import { seedDefaultPipelineStages } from '../scripts/seed-pipeline-stages';

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
  payload: unknown,
  status: string,
  error?: string
) {
  try {
    await db.insert(webhookEvents).values({
      source: 'stripe',
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

router.post('/webhook/stripe', async (req: Request, res: Response) => {
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
    return res.status(200).json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userCompanyId = parseInt(session.metadata?.userCompanyId ?? '0', 10);
        const planKey = (session.metadata?.planKey as PlanKey) ?? 'CORE';
        const billingInterval = (session.metadata?.billingInterval as BillingInterval) ?? 'month';
        const promoCodeId = session.metadata?.promoCodeId || '';
        const isNewSignup = session.metadata?.isNewSignup === 'true';

        if (isNewSignup) {
          const customerEmail = session.customer_details?.email || session.customer_email;

          if (!customerEmail) {
            console.error('[webhook] New signup checkout completed but no email found');
            await logWebhookEvent(event.type, event.data.object, 'error', 'no_customer_email');
            break;
          }

          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, customerEmail),
          });

          if (existingUser) {
            if (existingUser.userCompanyId && session.customer && session.subscription) {
              await billingService.activateSubscription(existingUser.userCompanyId, {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                planKey,
                billingInterval,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(),
              });
            }

            await emailApiService.sendPaymentLinkedEmail({
              to: customerEmail,
              firstName: existingUser.firstName || 'there',
              planKey,
            });

            console.log('[webhook] Payment linked to existing user:', customerEmail, planKey);
          } else {
            const [userCompany] = await db.insert(userCompanies).values({
              companyName: session.customer_details?.name || 'My Company',
            }).returning();

            const tempPassword = crypto.randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(tempPassword, 12);
            const nameParts = (session.customer_details?.name || '').split(' ');

            const [user] = await db.insert(users).values({
              email: customerEmail,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              passwordHash,
              userCompanyId: userCompany.id,
              onboardingCompleted: false,
            }).returning();

            const trialEndsAt = promoCodeId ? null : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            const sessionCurrency = (session as any).currency || 'gbp';
            await db.insert(subscriptions).values({
              userCompanyId: userCompany.id,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              planKey,
              status: 'active',
              billingInterval,
              trialEndsAt,
              currency: sessionCurrency,
            });

            if (promoCodeId) {
              await promoCodeService.claimCode(promoCodeId, userCompany.id, session.customer as string);
            }

            await seedDefaultPipelineStages();

            const magicLink = await magicLinkService.generateMagicLink(user.id, 'welcome');

            await emailApiService.sendWelcomeEmail({
              to: customerEmail,
              firstName: nameParts[0] || 'there',
              planKey,
              magicLink,
              freeMonths: promoCodeId ? 6 : 0,
              trialDays: promoCodeId ? 0 : 3,
            });

            console.log('[webhook] New user created via Stripe checkout:', customerEmail, planKey);
          }
        } else {
          if (userCompanyId && session.customer && session.subscription) {
            await billingService.activateSubscription(userCompanyId, {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              planKey,
              billingInterval,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
            });
          }
        }

        await logWebhookEvent(event.type, event.data.object, 'processed');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        // Stripe v20: current_period_start/end remain on Stripe.Subscription
        // but are deprecated in favour of SubscriptionItem. Cast retained as
        // a narrow extension for the period fields accessed below.
        const subData = event.data.object as Stripe.Subscription & {
          current_period_start?: number;
          current_period_end?: number;
        };
        const lookupKey = subscription.items.data[0]?.price?.lookup_key ?? '';
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

          const periodStart = subData.current_period_start
            ? new Date(subData.current_period_start * 1000)
            : undefined;
          const periodEnd = subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
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

        await logWebhookEvent(event.type, event.data.object, 'processed');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const matchingSub = await billingRepository.getByStripeSubscriptionId(subscription.id);

        if (matchingSub) {
          await billingService.updateSubscriptionStatus(
            matchingSub.userCompanyId,
            { status: 'canceled' },
            event.id
          );
        }

        await logWebhookEvent(event.type, event.data.object, 'processed');
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
                currentPeriodStart: invoice.period_start
                  ? new Date(invoice.period_start * 1000)
                  : undefined,
                currentPeriodEnd: invoice.period_end
                  ? new Date(invoice.period_end * 1000)
                  : undefined,
              },
              event.id
            );
          }
        }

        await logWebhookEvent(event.type, event.data.object, 'processed');
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

          if (matchingSub) {
            await billingService.updateSubscriptionStatus(
              matchingSub.userCompanyId,
              { status: 'past_due' },
              event.id
            );
          }
        }

        await logWebhookEvent(event.type, event.data.object, 'processed');
        break;
      }

      default:
        return res.status(200).json({ received: true, unhandled: true });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`[Billing] Error processing ${event.type}:`, err);
    await logWebhookEvent(event.type, event.data.object, 'error', err.message);
    return res.status(200).json({ received: true });
  }
});

const VALID_PLAN_KEYS: PlanKey[] = ['CORE', 'PROFESSIONAL', 'EXPERT'];
const LOOKUP_KEY_MAP: Record<string, Record<string, Record<string, string>>> = {
  CORE: {
    month: { gbp: 'ma_core_monthly_gbp', usd: 'ma_core_monthly_usd' },
    year: { gbp: 'ma_core_annual_gbp', usd: 'ma_core_annual_usd' },
  },
  PROFESSIONAL: {
    month: { gbp: 'ma_professional_monthly_gbp', usd: 'ma_professional_monthly_usd' },
    year: { gbp: 'ma_professional_annual_gbp', usd: 'ma_professional_annual_usd' },
  },
  EXPERT: {
    month: { gbp: 'ma_expert_monthly_gbp', usd: 'ma_expert_monthly_usd' },
    year: { gbp: 'ma_expert_annual_gbp', usd: 'ma_expert_annual_usd' },
  },
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

    const { getMaxSeats } = await import('@shared/entitlements');
    const effectiveMaxSeats = getMaxSeats(
      result.subscription.planKey as PlanKey,
      result.subscription.additionalSeats,
      result.subscription.enterpriseOverrides as Record<string, unknown> | null
    );

    let consumedSeats = 0;
    try {
      const { teamRepository } = await import('../repositories/team.repository');
      const { db } = await import('../db');
      const { users } = await import('@shared/schema/core');
      const { eq, or, and, sql: sqlTag } = await import('drizzle-orm');
      const activeUsers = await db.select({ count: sqlTag<number>`count(*)::int` })
        .from(users)
        .where(and(
          or(eq(users.userCompanyId, userCompanyId), eq(users.currentCompanyId, userCompanyId)),
          eq(users.isActive, true)
        ));
      const invitations = await teamRepository.getInvitationsByCompany(userCompanyId);
      const pendingInvitations = invitations.filter((inv: any) => inv.invitationStatus === 'pending').length;
      consumedSeats = (activeUsers[0]?.count ?? 0) + pendingInvitations;
    } catch {
      consumedSeats = 0;
    }

    return res.status(200).json({ ...result, effectiveMaxSeats, consumedSeats });
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

    if (!existingSub?.stripeSubscriptionId || (existingSub.status !== 'active' && existingSub.status !== 'trialing')) {
      return res.status(200).json({ isNewSubscription: true });
    }

    const currency = (req.query.currency === 'usd') ? 'usd' : 'gbp';
    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year']?.[currency];
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
      const INVOICE_RATE_CENTS = 6525;
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
      currency: 'gbp',
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

    const { planKey, billingInterval, promoCodeId, isNewSignup, currency: reqCurrency } = req.body as {
      planKey: PlanKey;
      billingInterval: 'month' | 'year';
      promoCodeId?: string;
      isNewSignup?: boolean;
      currency?: string;
    };

    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Plan must be CORE, PROFESSIONAL, or EXPERT. Enterprise plans are invoice-only.' });
    }

    if (!billingInterval || !['month', 'year'].includes(billingInterval)) {
      return res.status(400).json({ error: 'invalid_interval', message: 'Billing interval must be month or year.' });
    }

    const currency = reqCurrency === 'usd' ? 'usd' : 'gbp';

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);

    if (
      existingSub?.stripeSubscriptionId &&
      (existingSub.status === 'active' || existingSub.status === 'trialing')
    ) {
      return res.status(200).json({ requiresUpgrade: true });
    }

    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year']?.[currency];
    if (!lookupKey) {
      return res.status(400).json({ error: 'invalid_combination', message: 'Invalid plan and interval combination.' });
    }

    const stripe = new Stripe(config.stripe.secretKey);
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const newSignup = isNewSignup === true;
    let customerId: string | undefined | null = existingSub?.stripeCustomerId;

    if (!customerId && !newSignup) {
      const customer = await stripe.customers.create({
        metadata: { userCompanyId: String(userCompanyId) },
      });
      customerId = customer.id;
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
      allow_promotion_codes: true,
      metadata: {
        userCompanyId: String(userCompanyId),
        planKey,
        billingInterval,
        promoCodeId: promoCodeId || '',
        isNewSignup: newSignup ? 'true' : 'false',
      },
    };

    if (newSignup) {
      checkoutParams.customer_creation = 'always';
    } else if (customerId) {
      checkoutParams.customer = customerId;
    }

    if (existingSub?.trialEndsAt && !existingSub.promoCodeId && existingSub.status === 'trialing') {
      const remainingMs = existingSub.trialEndsAt.getTime() - Date.now();
      const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      checkoutParams.subscription_data = { trial_period_days: remainingDays };
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);

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

    const { planKey, billingInterval, currency: reqCurrency } = req.body as { planKey: PlanKey; billingInterval: 'month' | 'year'; currency?: string };

    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Plan must be CORE, PROFESSIONAL, or EXPERT.' });
    }

    if (!billingInterval || !['month', 'year'].includes(billingInterval)) {
      return res.status(400).json({ error: 'invalid_interval', message: 'Billing interval must be month or year.' });
    }

    const currency = reqCurrency === 'usd' ? 'usd' : 'gbp';

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);
    if (!existingSub?.stripeSubscriptionId || (existingSub.status !== 'active' && existingSub.status !== 'trialing')) {
      return res.status(400).json({ error: 'no_active_subscription', message: 'No active Stripe subscription found. Use checkout for new subscriptions.' });
    }

    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year']?.[currency];
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
        const INVOICE_RATE_CENTS = 6525;
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
    });

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

    const existing = addonType === 'company_slot'
      ? (subscription.addOnCompanySlots ?? 0)
      : (subscription.additionalSeats ?? 0);
    const newTotal = existing + quantity;

    if (subscription.stripeSubscriptionId && config.stripe.secretKey) {
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

const claimPromoSchema = z.object({
  code: z.string().min(1, 'Promo code is required'),
});

router.post('/claim-promo', isAuthenticated, validateCsrfToken, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ success: false, reason: 'unauthorized' });
    }

    const parsed = claimPromoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, reason: 'Promo code is required' });
    }

    const existingSub = await billingRepository.getByCompanyId(userCompanyId);
    const stripeCustomerId = existingSub?.stripeCustomerId ?? null;

    const result = await promoCodeService.claimCode(parsed.data.code, userCompanyId, stripeCustomerId);

    if (!result.success) {
      return res.status(400).json({ success: false, reason: result.reason });
    }

    return res.status(200).json({
      success: true,
      freeMonths: result.freeMonths,
      discountDescription: result.discountDescription,
    });
  } catch (err: any) {
    console.error('[Billing] Error claiming promo code:', err);
    return res.status(500).json({ success: false, reason: 'An unexpected error occurred' });
  }
});

export default router;
