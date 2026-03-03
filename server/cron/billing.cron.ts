import cron from 'node-cron';
import Stripe from 'stripe';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '@shared/schema/billing';
import { computeFreeMonthsElapsed, isFreePeriodEndingSoon } from '../services/promo-code.service';
import { emailService } from '../email';
import { userCompanies } from '@shared/schema/core';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export function initializeBillingCron(): void {
  cron.schedule('5 9 * * *', async () => {
    console.log('[billing-cron] Starting daily trial expiry check...');
    try {
      const expiring = await billingRepository.getSubscriptionsExpiringBefore(new Date());
      const trialing = expiring.filter((s) => s.status === 'trialing');
      let count = 0;

      for (const sub of trialing) {
        try {
          await billingService.expireTrial(sub.userCompanyId);
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
            let couponId = 'community_discount';

            if (sub.stripeCustomerId) {
              try {
                await stripe.customers.update(sub.stripeCustomerId, {
                  coupon: couponId,
                } as any);
              } catch (stripeErr) {
                console.error(`[billing-cron] Failed to apply Stripe coupon for company ${sub.userCompanyId}:`, stripeErr);
              }
            }

            await billingRepository.updateByCompanyId(sub.userCompanyId, {
              communityDiscountCouponId: couponId,
            });

            try {
              const { track } = await import('../services/funnel.service');
              track(sub.userCompanyId, null, 'referral.free_period_ended', {
                freeMonthsTotal: sub.freeMonthsTotal,
                elapsed,
                referralSource: sub.referralSource,
              });
            } catch (err) {
              console.error('[billing-cron] Failed to track funnel event:', err);
            }

            try {
              await (emailService as any).sendEmail({
                to: company.email,
                subject: 'Your free period has ended — community discount now active',
                html: `
                  <h2>Your free period has ended</h2>
                  <p>Hi ${company.companyName || 'there'},</p>
                  <p>Your ${sub.freeMonthsTotal}-month free period has now ended. Your ongoing community discount has been applied automatically — no action needed on your part.</p>
                  <p>Thank you for being part of the community!</p>
                `,
              });
            } catch (emailErr) {
              console.error(`[billing-cron] Failed to send transition email for company ${sub.userCompanyId}:`, emailErr);
            }

            transitionCount++;
            console.log(`[billing-cron] Transitioned company ${sub.userCompanyId} from free period to community discount`);
          } catch (err) {
            console.error(`[billing-cron] Failed to transition company ${sub.userCompanyId}:`, err);
          }
        } else if (isFreePeriodEndingSoon(sub.freeMonthsStartedAt, sub.freeMonthsTotal) && !sub.freeMonthsWarningEmailSentAt) {
          try {
            try {
              await (emailService as any).sendEmail({
                to: company.email,
                subject: 'Your free period is ending soon',
                html: `
                  <h2>Your free period is ending soon</h2>
                  <p>Hi ${company.companyName || 'there'},</p>
                  <p>Your ${sub.freeMonthsTotal}-month free period will end next month. After that, your ongoing community discount will be applied automatically.</p>
                  <p>No action is needed — we just wanted to give you a heads up!</p>
                `,
              });
            } catch (emailErr) {
              console.error(`[billing-cron] Failed to send warning email for company ${sub.userCompanyId}:`, emailErr);
            }

            await billingRepository.updateByCompanyId(sub.userCompanyId, {
              freeMonthsWarningEmailSentAt: new Date(),
            });

            warningCount++;
            console.log(`[billing-cron] Sent free period warning email to company ${sub.userCompanyId}`);
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
