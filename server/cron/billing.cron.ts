import cron from 'node-cron';
import Stripe from 'stripe';
import { config } from '../config';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { eq, and, gt, gte, isNull, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions, promoCodeCampaigns } from '@shared/schema/billing';
import { computeFreeMonthsElapsed, isFreePeriodEndingSoon } from '../services/promo-code.service';
import { emailService } from '../email';
import { emailApiService } from '../services/email.service';
import { systemConfigService } from '../services/system-config.service';
import { userCompanies, users } from '@shared/schema/core';

export async function runDunningDay7ReminderJob(): Promise<void> {
  const now = Date.now();
  const from = new Date(now - 8 * 24 * 60 * 60 * 1000);
  const to = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({ subscription: subscriptions, company: userCompanies })
    .from(subscriptions)
    .innerJoin(userCompanies, eq(subscriptions.userCompanyId, userCompanies.id))
    .where(
      and(
        eq(subscriptions.status, 'past_due'),
        isNotNull(subscriptions.pastDueSince),
        isNull(subscriptions.dunningDay7EmailSentAt),
        lte(subscriptions.pastDueSince, to),
        gt(subscriptions.pastDueSince, from)
      )
    );

  console.log(`[billing-cron] Day-7 dunning: ${candidates.length} candidate(s)`);

  for (const row of candidates) {
    const sub = row.subscription;
    try {
      const latest = await billingRepository.getByCompanyId(sub.userCompanyId);
      if (
        !latest ||
        latest.status !== 'past_due' ||
        latest.dunningDay7EmailSentAt ||
        !latest.pastDueSince ||
        latest.pastDueSince > to ||
        latest.pastDueSince <= from
      ) continue;

      const adminEmail = await billingRepository.getAdminEmailForCompany(sub.userCompanyId);
      if (!adminEmail) {
        console.warn(`[billing-cron] No admin email for company ${sub.userCompanyId}, skipping day-7 reminder`);
        continue;
      }

      await emailApiService.sendDunningDay7Email({
        to: adminEmail.email,
        firstName: adminEmail.firstName || 'there',
        planKey: latest.planKey,
      });
      await billingRepository.updateByCompanyId(sub.userCompanyId, {
        dunningDay7EmailSentAt: new Date(),
      });
      await billingRepository.logEvent({
        userCompanyId: sub.userCompanyId,
        eventType: 'dunning.day7_sent',
        previousStatus: latest.status,
        previousPlanKey: latest.planKey,
        newStatus: latest.status,
        newPlanKey: latest.planKey,
        payload: { pastDueSince: latest.pastDueSince },
      });
    } catch (err) {
      console.error(`[billing-cron] Day-7 dunning failed for company ${sub.userCompanyId}:`, err);
    }
  }
}

export async function runDunningCancellationJob(): Promise<void> {
  const stripe = new Stripe(config.stripe.secretKey);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({ subscription: subscriptions })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'past_due'),
        isNotNull(subscriptions.pastDueSince),
        lte(subscriptions.pastDueSince, cutoff)
      )
    );

  console.log(`[billing-cron] Day-14 dunning auto-cancel: ${candidates.length} candidate(s)`);

  for (const row of candidates) {
    const sub = row.subscription;
    try {
      const latest = await billingRepository.getByCompanyId(sub.userCompanyId);
      if (
        !latest ||
        latest.status !== 'past_due' ||
        !latest.pastDueSince ||
        latest.pastDueSince > cutoff ||
        !latest.stripeSubscriptionId
      ) continue;

      // Write audit BEFORE Stripe cancel so customer.subscription.deleted
      // handler can detect it via hasRecentEvent.
      await billingRepository.logEvent({
        userCompanyId: sub.userCompanyId,
        eventType: 'dunning.auto_cancel_requested',
        previousStatus: latest.status,
        previousPlanKey: latest.planKey,
        newStatus: 'canceled',
        newPlanKey: latest.planKey,
        payload: {
          stripeSubscriptionId: latest.stripeSubscriptionId,
          pastDueSince: latest.pastDueSince,
          graceDays: 14,
        },
      });

      await stripe.subscriptions.cancel(latest.stripeSubscriptionId);
      console.log(`[billing-cron] Stripe sub ${latest.stripeSubscriptionId} cancelled (dunning) for company ${sub.userCompanyId}`);
      // Local status flip and email both happen on the resulting
      // customer.subscription.deleted webhook.
    } catch (err) {
      console.error(`[billing-cron] Day-14 dunning cancel failed for company ${sub.userCompanyId}:`, err);
    }
  }
}

export async function runTrialExpiryJob(): Promise<void> {
  const stripe = new Stripe(config.stripe.secretKey);
  try {
    const expiring = await billingRepository.getSubscriptionsExpiringBefore(new Date());
    const trialing = expiring.filter((s) => s.status === 'trialing' && s.freeMonthsTotal === 0 && (
      (s.trialEnd && new Date(s.trialEnd) < new Date()) ||
      (s.trialEndsAt && new Date(s.trialEndsAt) < new Date())
    ));

    const trialEndsAtExpired = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          isNotNull(subscriptions.trialEndsAt),
          lt(subscriptions.trialEndsAt, new Date()),
          eq(subscriptions.status, 'trialing'),
          eq(subscriptions.freeMonthsTotal, 0)
        )
      );

    const allExpiring = [...trialing];
    for (const sub of trialEndsAtExpired) {
      if (!allExpiring.find(s => s.id === sub.id)) {
        allExpiring.push(sub);
      }
    }
    console.log(`[billing-cron] Trial expiry: processing ${allExpiring.length} non-free-period trial(s). Free-period trials handled by separate cron at 09:15.`);

    let count = 0;

    for (const sub of allExpiring) {
      try {
        if (sub.stripeSubscriptionId) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
            if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
              continue;
            }
          } catch (stripeErr) {
            console.error(`[billing-cron] Failed to check Stripe sub for company ${sub.userCompanyId}:`, stripeErr);
          }
        }

        if (!sub.stripeSubscriptionId && sub.stripeCustomerId) {
          try {
            const result = await stripe.subscriptions.list({
              customer: sub.stripeCustomerId,
              status: 'all',
              limit: 10,
            });
            const liveStripeSub = result.data.find(
              s => s.status === 'active' || s.status === 'trialing'
            );
            if (liveStripeSub) {
              console.warn(
                `[billing-cron] Trial expiry skipped for company ${sub.userCompanyId}: ` +
                `stripeSubscriptionId is NULL but found live Stripe sub ${liveStripeSub.id} ` +
                `(status=${liveStripeSub.status}) via customer ${sub.stripeCustomerId}. ` +
                `Will re-evaluate tomorrow.`
              );
              continue;
            }
          } catch (stripeErr) {
            console.error(
              `[billing-cron] Stripe lookup failed for company ${sub.userCompanyId} ` +
              `(customerId=${sub.stripeCustomerId}), skipping cancel:`,
              stripeErr
            );
            continue;
          }
        }

        await billingService.expireTrial(sub.userCompanyId);

        await billingRepository.logEvent({
          userCompanyId: sub.userCompanyId,
          eventType: 'subscription.trial_expired',
          previousStatus: sub.status as any,
          previousPlanKey: sub.planKey as any,
          newStatus: 'canceled',
          newPlanKey: sub.planKey as any,
          payload: { trialEndsAt: sub.trialEndsAt, trialEnd: sub.trialEnd },
        });

        count++;
      } catch (err) {
        console.error(`[billing-cron] Failed to expire trial for company ${sub.userCompanyId}:`, err);
      }
    }

    console.log(`[billing-cron] Expired ${count} trial(s)`);
  } catch (err) {
    console.error('[billing-cron] Trial expiry job failed:', err);
    throw err;
  }
}

export async function runTrialExtensionJob(): Promise<void> {
  const stripe = new Stripe(config.stripe.secretKey);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const candidates = await db
    .select({ subscription: subscriptions })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'trialing'),
        eq(subscriptions.freeMonthsTotal, 0),
        isNull(subscriptions.trialExtensionSentAt),
        isNotNull(subscriptions.trialEndsAt),
        gte(subscriptions.trialEndsAt, now),
        lte(subscriptions.trialEndsAt, windowEnd),
        isNotNull(subscriptions.stripeSubscriptionId)
      )
    );

  console.log(`[billing-cron] Trial extension: ${candidates.length} candidate(s)`);

  for (const row of candidates) {
    const sub = row.subscription;
    try {
      const latest = await billingRepository.getByCompanyId(sub.userCompanyId);
      if (
        !latest ||
        latest.status !== 'trialing' ||
        latest.freeMonthsTotal !== 0 ||
        latest.trialExtensionSentAt ||
        !latest.trialEndsAt ||
        !latest.stripeSubscriptionId
      ) continue;

      // The 24-hour extension and its email are written for the standard short
      // trial: the copy says "over the last 48 hours". A promotional trial of a
      // month must never receive it. While a subscription is trialing,
      // currentPeriodStart is the trial start, so the trial length is derivable
      // without a schema change. A null currentPeriodStart falls through to the
      // existing behaviour rather than silently skipping.
      const STANDARD_TRIAL_MAX_DAYS = 14;
      const trialLengthDays = latest.currentPeriodStart
        ? (latest.trialEndsAt.getTime() - latest.currentPeriodStart.getTime()) / (24 * 60 * 60 * 1000)
        : 0;
      if (trialLengthDays > STANDARD_TRIAL_MAX_DAYS) {
        console.log(`[billing-cron] Trial extension skipped for company ${sub.userCompanyId}: promotional trial of ${Math.round(trialLengthDays)} days`);
        continue;
      }

      const newTrialEnd = new Date(latest.trialEndsAt.getTime() + 24 * 60 * 60 * 1000);

      await stripe.subscriptions.update(latest.stripeSubscriptionId, {
        trial_end: Math.floor(newTrialEnd.getTime() / 1000),
      });

      await billingRepository.updateByCompanyId(sub.userCompanyId, {
        trialEndsAt: newTrialEnd,
        trialEnd: newTrialEnd,
        trialExtensionSentAt: new Date(),
      });

      const adminEmail = await billingRepository.getAdminEmailForCompany(sub.userCompanyId);
      if (!adminEmail) {
        console.warn(`[billing-cron] No admin email for company ${sub.userCompanyId}, skipping trial extension email`);
      } else {
        await emailApiService.sendTrialExtensionEmail({
          to: adminEmail.email,
          firstName: adminEmail.firstName || 'there',
          newTrialEnd,
        });
      }

      await billingRepository.logEvent({
        userCompanyId: sub.userCompanyId,
        eventType: 'trial.extended',
        previousStatus: latest.status,
        previousPlanKey: latest.planKey,
        newStatus: 'trialing',
        newPlanKey: latest.planKey,
        payload: { originalTrialEnd: latest.trialEndsAt, newTrialEnd, extensionHours: 24 },
      });

      console.log(`[billing-cron] Trial extension: extended company ${sub.userCompanyId} to ${newTrialEnd.toISOString()}`);
    } catch (err) {
      console.error(`[billing-cron] Trial extension failed for company ${sub.userCompanyId}:`, err);
    }
  }
}

export async function runTrialWarningJob(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const candidates = await db
    .select({ subscription: subscriptions })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'trialing'),
        eq(subscriptions.freeMonthsTotal, 0),
        isNull(subscriptions.trialWarningEmailSentAt),
        isNotNull(subscriptions.trialExtensionSentAt),
        isNotNull(subscriptions.trialEndsAt),
        gte(subscriptions.trialEndsAt, now),
        lte(subscriptions.trialEndsAt, windowEnd)
      )
    );

  console.log(`[billing-cron] Trial warning: ${candidates.length} candidate(s)`);

  for (const row of candidates) {
    const sub = row.subscription;
    try {
      const latest = await billingRepository.getByCompanyId(sub.userCompanyId);
      if (
        !latest ||
        latest.status !== 'trialing' ||
        latest.freeMonthsTotal !== 0 ||
        latest.trialWarningEmailSentAt ||
        !latest.trialExtensionSentAt ||
        !latest.trialEndsAt
      ) continue;

      const adminEmail = await billingRepository.getAdminEmailForCompany(sub.userCompanyId);
      if (!adminEmail) {
        console.warn(`[billing-cron] No admin email for company ${sub.userCompanyId}, skipping trial warning email`);
        continue;
      }

      await emailApiService.sendTrialWarningEmail({
        to: adminEmail.email,
        firstName: adminEmail.firstName || 'there',
        trialEndsAt: latest.trialEndsAt,
      });

      await billingRepository.updateByCompanyId(sub.userCompanyId, {
        trialWarningEmailSentAt: new Date(),
      });

      await billingRepository.logEvent({
        userCompanyId: sub.userCompanyId,
        eventType: 'trial.warning_sent',
        previousStatus: latest.status,
        previousPlanKey: latest.planKey,
        newStatus: 'trialing',
        newPlanKey: latest.planKey,
        payload: { trialEndsAt: latest.trialEndsAt },
      });

      console.log(`[billing-cron] Trial warning: sent to company ${sub.userCompanyId}, trial ends ${latest.trialEndsAt.toISOString()}`);
    } catch (err) {
      console.error(`[billing-cron] Trial warning failed for company ${sub.userCompanyId}:`, err);
    }
  }
}

export function initializeBillingCron(): void {
  cron.schedule('0 4 * * *', async () => {
    console.log('[billing-cron] Starting daily dunning checks (day 7 reminders + day 14 auto-cancel)...');
    await runDunningDay7ReminderJob();
    await runDunningCancellationJob();
  }, {
    timezone: 'Europe/London',
  });

  console.log('[billing-cron] Daily dunning checks scheduled at 04:00 London');

  cron.schedule('5 9 * * *', async () => {
    console.log('[billing-cron] Starting daily trial expiry check...');
    try {
      await runTrialExpiryJob();
    } catch (err) {
      console.error('[billing-cron] Trial expiry job failed:', err);
    }
  }, {
    timezone: 'Europe/London',
  });

  console.log('[billing-cron] Trial expiry job scheduled for 9:05 AM UK time daily');

  cron.schedule('15 9 * * *', async () => {
    const stripe = new Stripe(config.stripe.secretKey);
    console.log('[billing-cron] Starting daily free months check (warning + transition)...');
    try {
      const activeFreeMonthSubs = await db
        .select({
          subscription: subscriptions,
          company: userCompanies,
        })
        .from(subscriptions)
        .innerJoin(userCompanies, eq(subscriptions.userCompanyId, userCompanies.id))
        .where(
          and(
            gt(subscriptions.freeMonthsTotal, 0),
            isNull(subscriptions.communityDiscountCouponId)
          )
        );

      let warningCount = 0;
      let transitionCount = 0;

      for (const row of activeFreeMonthSubs) {
        const sub = row.subscription;
        const company = row.company;

        if (!sub.freeMonthsStartedAt) continue;

        const elapsed = computeFreeMonthsElapsed(sub.freeMonthsStartedAt);

        if (elapsed >= sub.freeMonthsTotal) {
          try {
            // Classify the transition path based on subscription state and campaign assignment.
            const hasStripeCustomer = !!sub.stripeCustomerId;
            const isFiveDNewMemberSub = sub.freeMonthsTotal === 6;

            // Path A: 5D New Member user with no Stripe customer AND status still trialing.
            // They never entered payment details during the free period. Terminal flip to canceled,
            // send cancellation email, let Item 15's 30-day preservation window take over.
            if (isFiveDNewMemberSub && !hasStripeCustomer && sub.status === 'trialing') {
              const adminEmail = await billingRepository.getAdminEmailForCompany(sub.userCompanyId);
              const endDate = new Date(sub.freeMonthsStartedAt);
              endDate.setMonth(endDate.getMonth() + sub.freeMonthsTotal);
              const restoreByDate = new Date();
              restoreByDate.setDate(restoreByDate.getDate() + 30);

              await billingService.expireFreePeriodTrial(sub.userCompanyId);

              if (adminEmail) {
                try {
                  await emailApiService.sendFreePeriodCancellationEmail({
                    to: adminEmail.email,
                    firstName: adminEmail.firstName || 'there',
                    endDate,
                    restoreByDate,
                  });
                } catch (emailErr) {
                  console.error(`[billing-cron] Failed to send 5D New Member cancellation email for company ${sub.userCompanyId}:`, emailErr);
                }
              } else {
                console.warn(`[billing-cron] No admin email for company ${sub.userCompanyId}, terminal flip completed but cancellation email skipped`);
              }

              // Stamp communityDiscountCouponId so this row is excluded from future cron passes.
              await billingRepository.updateByCompanyId(sub.userCompanyId, {
                communityDiscountCouponId: 'none',
              });

              transitionCount++;
              console.log(`[billing-cron] 5D New Member terminal flip for company ${sub.userCompanyId} (no payment details added)`);
              continue;
            }

            // Paths B and C: coupon swap paths (user has Stripe customer, needs post-free-period coupon).
            // Resolve couponId from users.assigned_promo_campaign_id → promoCodeCampaigns.postFreePeriodCouponId.
            let couponId: string | null = null;

            // Fallback resolver: users.assigned_promo_campaign_id -> promoCodeCampaigns.postFreePeriodCouponId.
            // This is the blocker fix for 5D New Member users who entered payment details mid-free-period.
            try {
              const [adminUser] = await db
                .select({ assignedPromoCampaignId: users.assignedPromoCampaignId })
                .from(users)
                .where(
                  and(
                    eq(users.userCompanyId, sub.userCompanyId),
                    eq(users.isCompanyAdmin, true),
                    eq(users.isActive, true)
                  )
                )
                .limit(1);

              if (adminUser?.assignedPromoCampaignId) {
                const [campaign] = await db
                  .select()
                  .from(promoCodeCampaigns)
                  .where(eq(promoCodeCampaigns.id, adminUser.assignedPromoCampaignId));
                if (campaign?.postFreePeriodCouponId) {
                  couponId = campaign.postFreePeriodCouponId;
                }
              }
            } catch (assignLookupErr) {
              console.error(`[billing-cron] Failed to resolve assigned-campaign coupon for company ${sub.userCompanyId}:`, assignLookupErr);
            }

            if (couponId && sub.stripeSubscriptionId) {
              try {
                await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                  discounts: [{ coupon: couponId }],
                });
                console.log(`[billing-cron] Applied post-free-period coupon ${couponId} to subscription ${sub.stripeSubscriptionId} for company ${sub.userCompanyId}`);
              } catch (stripeErr) {
                console.error(`[billing-cron] Failed to apply Stripe coupon for company ${sub.userCompanyId}:`, stripeErr);
              }
            } else if (couponId && !sub.stripeSubscriptionId) {
              console.warn(`[billing-cron] Company ${sub.userCompanyId} has couponId=${couponId} but no stripeSubscriptionId — coupon will apply at next subscription creation via resolveCheckoutCoupon`);
            }

            await billingRepository.updateByCompanyId(sub.userCompanyId, {
              communityDiscountCouponId: couponId || 'none',
            });

            try {
              const { track } = await import('../services/funnel.service');
              track(sub.userCompanyId, null, 'referral.free_period_ended', {
                freeMonthsTotal: sub.freeMonthsTotal,
                elapsed,
                referralSource: sub.referralSource,
                couponApplied: couponId,
              });
            } catch (err) {
              console.error('[billing-cron] Failed to track funnel event:', err);
            }

            transitionCount++;
            console.log(`[billing-cron] Transitioned company ${sub.userCompanyId} from free period: couponApplied=${couponId ?? 'none'}, hasStripeCustomer=${hasStripeCustomer}`);
          } catch (err) {
            console.error(`[billing-cron] Failed to transition company ${sub.userCompanyId}:`, err);
          }
        } else if (isFreePeriodEndingSoon(sub.freeMonthsStartedAt, sub.freeMonthsTotal) && !sub.freeMonthsWarningEmailSentAt) {
          try {
            // Classify: 5D New Member (6 month free period) vs legacy community (other free periods).
            // 5D New Member users need an "enter payment details" email. Legacy community users
            // get the existing "no action needed" email because their discount auto-applies.
            const isFiveDNewMemberSub = sub.freeMonthsTotal === 6;

            if (isFiveDNewMemberSub) {
              const adminEmail = await billingRepository.getAdminEmailForCompany(sub.userCompanyId);
              if (!adminEmail) {
                console.warn(`[billing-cron] No admin email for company ${sub.userCompanyId}, skipping 5D New Member free-period warning`);
                continue;
              }

              const endDate = new Date(sub.freeMonthsStartedAt);
              endDate.setMonth(endDate.getMonth() + sub.freeMonthsTotal);

              try {
                await emailApiService.sendFreePeriodPaymentRequiredEmail({
                  to: adminEmail.email,
                  firstName: adminEmail.firstName || 'there',
                  endDate,
                });
              } catch (emailErr) {
                console.error(`[billing-cron] Failed to send 5D New Member warning email for company ${sub.userCompanyId}:`, emailErr);
              }

              await billingRepository.updateByCompanyId(sub.userCompanyId, {
                freeMonthsWarningEmailSentAt: new Date(),
              });

              await billingRepository.logEvent({
                userCompanyId: sub.userCompanyId,
                eventType: 'referral.free_period_warning_sent',
                previousStatus: sub.status as any,
                previousPlanKey: sub.planKey as any,
                newStatus: sub.status as any,
                newPlanKey: sub.planKey as any,
                payload: {
                  variant: '5d_new_member',
                  freeMonthsTotal: sub.freeMonthsTotal,
                  elapsed,
                  endDate: endDate.toISOString(),
                },
              });

              warningCount++;
              console.log(`[billing-cron] Sent 5D New Member payment-required warning to company ${sub.userCompanyId}`);
            }
          } catch (err) {
            console.error(`[billing-cron] Failed to process warning for company ${sub.userCompanyId}:`, err);
          }
        }
      }

      console.log(`[billing-cron] Free months check complete: ${warningCount} warning(s) sent, ${transitionCount} transition(s) made`);
    } catch (err) {
      console.error('[billing-cron] Free months check job failed:', err);
    }
  }, {
    timezone: 'Europe/London',
  });

  console.log('[billing-cron] Free months warning/transition job scheduled for 9:15 AM UK time daily');

  cron.schedule('0 8 * * *', async () => {
    console.log('[billing-cron] Starting daily Stripe webhook failure check...');
    try {
      await runStripeWebhookFailureAlertJob();
    } catch (err) {
      console.error('[billing-cron] Stripe webhook failure check failed:', err);
    }
  }, { timezone: 'Europe/London' });
  console.log('[billing-cron] Stripe webhook failure alert scheduled for 08:00 London');

  cron.schedule('0 4 * * *', async () => {
    try {
      const sendDayRaw = await systemConfigService.getConfig('five_d_invoice_send_day');
      const sendDay = Math.min(28, Math.max(1, parseInt(sendDayRaw || '7', 10) || 7));
      if (new Date().getDate() !== sendDay) return; // only fire on the configured send-day
      console.log('[billing-cron] Starting monthly 5D partner invoice...');
      await runFiveDPartnerInvoiceJob();
    } catch (err) {
      console.error('[billing-cron] 5D partner invoice job failed:', err);
    }
  }, { timezone: 'Europe/London' });
  console.log('[billing-cron] 5D partner invoice scheduled daily at 04:00 London, fires on the configured send-day');

  cron.schedule('0 * * * *', async () => {
    console.log('[billing-cron] Starting hourly trial extension + warning check...');
    try { await runTrialExtensionJob(); } catch (err) { console.error('[billing-cron] Trial extension job failed:', err); }
    try { await runTrialWarningJob(); } catch (err) { console.error('[billing-cron] Trial warning job failed:', err); }
  }, { timezone: 'Europe/London' });
  console.log('[billing-cron] Trial extension + warning job scheduled hourly');
}

export async function runStripeWebhookFailureAlertJob(): Promise<void> {
  console.log('[billing-cron] Stripe webhook failure alert job started');

  const recipient = config.smtp.alertEmail;
  if (!recipient) {
    console.warn('[billing-cron] SMTP_ALERT_EMAIL not configured — skipping webhook failure alert');
    return;
  }

  const stripe = new Stripe(config.stripe.secretKey);
  const startUnix = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

  interface FailedEvent {
    id: string;
    type: string;
    created: number;
    pending_webhooks: number;
  }

  const failedEvents: FailedEvent[] = [];
  const PAGE_LIMIT = 5;
  let pageCursor: string | undefined = undefined;
  let pagesFetched = 0;
  let cappedEarly = false;

  while (true) {
    const listParams: Stripe.EventListParams = {
      delivery_success: false,
      limit: 100,
      created: { gte: startUnix },
    };
    if (pageCursor) listParams.starting_after = pageCursor;
    const page = await stripe.events.list(listParams);

    for (const evt of page.data) {
      failedEvents.push({
        id: evt.id,
        type: evt.type,
        created: evt.created,
        pending_webhooks: evt.pending_webhooks,
      });
    }

    pagesFetched++;

    if (!page.has_more) break;

    if (pagesFetched >= PAGE_LIMIT) {
      console.warn(`[billing-cron] Webhook failure pagination cap hit (${PAGE_LIMIT} pages / ${failedEvents.length} events) — results truncated`);
      cappedEarly = true;
      break;
    }

    pageCursor = page.data[page.data.length - 1].id;
  }

  const failureCount = failedEvents.length;

  if (failureCount === 0) {
    console.log('[billing-cron] No webhook failures in last 24h');
    return;
  }

  const eventLines = failedEvents
    .map(evt => `${evt.id}, ${evt.type}, ${new Date(evt.created * 1000).toISOString()}, pending_webhooks: ${evt.pending_webhooks}`)
    .join('\n');

  const cappedNote = cappedEarly
    ? `\nNote: results were capped at ${PAGE_LIMIT * 100} events — visit the Stripe dashboard for the full list.\n`
    : '';

  const subject = `[Valoxi] ${failureCount} Stripe webhook failure(s) in last 24h`;
  const body =
    `${failureCount} Stripe webhook failure(s) were recorded in the last 24 hours (window start: ${new Date(startUnix * 1000).toISOString()}).\n` +
    `${cappedNote}\n` +
    `${eventLines}\n\n` +
    `Investigate at: https://dashboard.stripe.com/webhooks`;

  try {
    const result = await emailApiService.sendCustomEmail(recipient, subject, body);
    if (result.success) {
      console.log(`[billing-cron] Sent webhook failure alert for ${failureCount} event(s) to ${recipient}`);
    } else {
      console.error(`[billing-cron] Failed to send webhook failure alert to ${recipient}: ${result.message}`);
    }
  } catch (err) {
    console.error('[billing-cron] Exception sending webhook failure alert:', err);
  }
}

export async function runFiveDPartnerInvoiceJob(): Promise<void> {
  const cutoff = config.fiveD.billingStart;             // 'YYYY-MM-DD' or '' (env, set once at go-live)
  const partnerEmail = ((await systemConfigService.getConfig('five_d_partner_invoice_email')) || '').trim(); // system_config, UI-editable

  if (!cutoff) {
    console.warn('[billing-cron] 5D invoice: FIVE_D_BILLING_START not set, skipping');
    return;
  }
  if (!partnerEmail) {
    console.warn('[billing-cron] 5D invoice: FIVE_D_PARTNER_INVOICE_EMAIL not set, skipping');
    return;
  }

  const now = new Date();
  const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorMonth = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, '0')}`;
  const cutoffYM = cutoff.slice(0, 7);

  if (priorMonth < cutoffYM) {
    console.log(`[billing-cron] 5D invoice: prior month ${priorMonth} precedes billing start ${cutoffYM}, skipping`);
    return;
  }

  const cutoffDate = new Date(cutoff);
  const { members } = await billingService.getBillableMembers(priorMonth, '5d_community');

  // Per-member cutoff guard, covers a mid-month billing start.
  const eligible = members.filter((m) => new Date(m.signedUpAt) >= cutoffDate);

  const toBill: typeof eligible = [];
  for (const m of eligible) {
    const existing = await billingRepository.getReferralInvoiceRecord(m.userCompanyId);
    if (existing && existing.status === 'sent') continue; // already invoiced, ever
    await billingRepository.upsertReferralInvoicePending({
      userCompanyId: m.userCompanyId,
      invoiceMonth: priorMonth,
      amountCents: Math.round(m.invoiceAmount * 100),
      memberEmail: m.email,
    });
    toBill.push(m);
  }

  if (toBill.length === 0) {
    console.log(`[billing-cron] 5D invoice: no new members to bill for ${priorMonth}`);
    return;
  }

  const totalCents = toBill.reduce((sum, m) => sum + Math.round(m.invoiceAmount * 100), 0);

  const result = await emailApiService.sendFiveDPartnerInvoice({
    to: partnerEmail,
    billingMonth: priorMonth,
    members: toBill.map((m) => ({
      companyName: m.companyName,
      email: m.email,
      freeMonths: m.freeMonths,
      amountCents: Math.round(m.invoiceAmount * 100),
    })),
    totalCents,
  });

  if (result.success) {
    await billingRepository.markReferralInvoicesSent(toBill.map((m) => m.userCompanyId), new Date());
    console.log(`[billing-cron] 5D invoice: sent ${priorMonth} digest, ${toBill.length} member(s), $${(totalCents / 100).toFixed(2)} to ${partnerEmail}`);
  } else {
    console.error(`[billing-cron] 5D invoice: ${priorMonth} digest send FAILED, ${toBill.length} member(s) left pending: ${result.message}`);
  }
}
