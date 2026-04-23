import cron from 'node-cron';
import Stripe from 'stripe';
import { config } from '../config';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { eq, and, gt, isNull, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions, promoCodes, promoCodeCampaigns } from '@shared/schema/billing';
import { computeFreeMonthsElapsed, isFreePeriodEndingSoon } from '../services/promo-code.service';
import { emailService } from '../email';
import { emailApiService } from '../services/email.service';
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
    const stripe = new Stripe(config.stripe.secretKey);
    console.log('[billing-cron] Starting daily trial expiry check...');
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
    }
  }, {
    timezone: 'Europe/London',
  });

  console.log('[billing-cron] Trial expiry job scheduled for 9:05 AM UK time daily');

  cron.schedule('10 9 1 * *', async () => {
    console.log('[billing-cron] Starting monthly community free month decrement...');
    try {
      const allSubs = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.isCommunityMember, true),
            gt(subscriptions.communityFreeMonthsRemaining, 0)
          )
        );

      let count = 0;

      for (const sub of allSubs) {
        try {
          const newRemaining = sub.communityFreeMonthsRemaining - 1;
          await billingRepository.updateByCompanyId(sub.userCompanyId, {
            communityFreeMonthsRemaining: newRemaining,
          });
          count++;

          if (newRemaining === 0) {
            console.log(`[billing-cron] Community free months exhausted for company ${sub.userCompanyId} — normal billing should resume (manual step required)`);
          }
        } catch (err) {
          console.error(`[billing-cron] Failed to decrement community months for company ${sub.userCompanyId}:`, err);
        }
      }

      console.log(`[billing-cron] Decremented community free months for ${count} subscription(s)`);
    } catch (err) {
      console.error('[billing-cron] Community free month decrement job failed:', err);
    }
  }, {
    timezone: 'Europe/London',
  });

  console.log('[billing-cron] Community free month decrement scheduled for 1st of each month at 9:10 AM UK time');

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
            // Resolve couponId from either sub.promoCodeId (legacy typed-code claim) OR the company admin's
            // users.assigned_promo_campaign_id (6F2 invite-assignment). Invite-assignment wins when both
            // are present, because that reflects the current promotional truth.
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

            // Legacy path: if no assigned campaign resolved it, try sub.promoCodeId.
            if (!couponId && sub.promoCodeId) {
              try {
                const [promoCode] = await db
                  .select()
                  .from(promoCodes)
                  .where(eq(promoCodes.id, sub.promoCodeId));
                if (promoCode) {
                  const [campaign] = await db
                    .select()
                    .from(promoCodeCampaigns)
                    .where(eq(promoCodeCampaigns.id, promoCode.campaignId));
                  if (campaign?.postFreePeriodCouponId) {
                    couponId = campaign.postFreePeriodCouponId;
                  }
                }
              } catch (lookupErr) {
                console.error(`[billing-cron] Failed to look up typed-code campaign coupon for company ${sub.userCompanyId}:`, lookupErr);
              }
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
                campaignId: sub.promoCodeId,
                couponApplied: couponId,
              });
            } catch (err) {
              console.error('[billing-cron] Failed to track funnel event:', err);
            }

            // Only send the legacy "discount now active" email when we actually applied a coupon AND
            // the user has a Stripe customer. 5D New Member with Stripe customer gets this too
            // because the coupon IS now applied and this is factually accurate.
            if (couponId && sub.stripeCustomerId) {
              try {
                await (emailService as any).sendEmail({
                  to: company.email,
                  subject: 'Your free period has ended, community discount now active',
                  html: `
                    <h2>Your free period has ended</h2>
                    <p>Hi ${company.companyName || 'there'},</p>
                    <p>Your ${sub.freeMonthsTotal}-month free period has now ended. Your ongoing community discount has been applied automatically, no action needed on your part.</p>
                    <p>Thank you for being part of the community.</p>
                  `,
                });
              } catch (emailErr) {
                console.error(`[billing-cron] Failed to send transition email for company ${sub.userCompanyId}:`, emailErr);
              }
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
            } else {
              // Legacy community path: existing "no action needed" email.
              try {
                await (emailService as any).sendEmail({
                  to: company.email,
                  subject: 'Your free period is ending soon',
                  html: `
                    <h2>Your free period is ending soon</h2>
                    <p>Hi ${company.companyName || 'there'},</p>
                    <p>Your ${sub.freeMonthsTotal}-month free period will end next month. After that, your ongoing community discount will be applied automatically.</p>
                    <p>No action is needed, we just wanted to give you a heads up.</p>
                  `,
                });
              } catch (emailErr) {
                console.error(`[billing-cron] Failed to send legacy warning email for company ${sub.userCompanyId}:`, emailErr);
              }

              await billingRepository.updateByCompanyId(sub.userCompanyId, {
                freeMonthsWarningEmailSentAt: new Date(),
              });

              warningCount++;
              console.log(`[billing-cron] Sent legacy free period warning email to company ${sub.userCompanyId}`);
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
}
