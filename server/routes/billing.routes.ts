import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { db } from '../db';
import { webhookEvents } from '@shared/schema/core';
import type { PlanKey, BillingInterval } from '@shared/schema/billing';

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

        await logWebhookEvent(event.type, event.data.object, 'processed');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subData = event.data.object as any;
        const lookupKey = subscription.items.data[0]?.price?.lookup_key ?? '';
        const planKey = derivePlanKeyFromLookupKey(lookupKey);

        const allSubs = await billingRepository.getAllSubscriptions();
        const matchingSub = allSubs.find(
          (s) => s.stripeSubscriptionId === subscription.id
        );

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

        const allSubs = await billingRepository.getAllSubscriptions();
        const matchingSub = allSubs.find(
          (s) => s.stripeSubscriptionId === subscription.id
        );

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
        const invoiceData = event.data.object as any;
        const subscriptionId: string | undefined =
          typeof invoiceData.subscription === 'string'
            ? invoiceData.subscription
            : invoiceData.subscription?.id ?? invoiceData.parent?.subscription_details?.subscription;

        if (subscriptionId) {
          const allSubs = await billingRepository.getAllSubscriptions();
          const matchingSub = allSubs.find(
            (s) => s.stripeSubscriptionId === subscriptionId
          );

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
        const invoiceData = event.data.object as any;
        const subscriptionId: string | undefined =
          typeof invoiceData.subscription === 'string'
            ? invoiceData.subscription
            : invoiceData.subscription?.id ?? invoiceData.parent?.subscription_details?.subscription;

        if (subscriptionId) {
          const allSubs = await billingRepository.getAllSubscriptions();
          const matchingSub = allSubs.find(
            (s) => s.stripeSubscriptionId === subscriptionId
          );

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

export default router;
