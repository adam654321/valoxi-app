import { eq } from 'drizzle-orm';
import { db } from '../db';
import { billingService } from '../services/billing.service';
import { subscriptions } from '@shared/schema/billing';

async function printState(label: string) {
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      pastDueSince: subscriptions.pastDueSince,
      dunningDay7EmailSentAt: subscriptions.dunningDay7EmailSentAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.id, 30));

  console.log(label, row);
}

async function main() {
  await billingService.updateSubscriptionStatus(30, { status: 'past_due' });
  await printState('after past_due');

  await billingService.updateSubscriptionStatus(30, { status: 'active' });
  await printState('after active');

  await billingService.updateSubscriptionStatus(30, { status: 'trialing' });
  await printState('after trialing reset');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});