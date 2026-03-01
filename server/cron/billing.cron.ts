import cron from 'node-cron';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '@shared/schema/billing';

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
}
