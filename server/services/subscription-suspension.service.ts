import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { config } from '../config';
import { subscriptions, subscriptionEvents } from '@shared/schema/billing';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '../utils/errors';

const ELIGIBLE_STATUSES = new Set(['active', 'trialing', 'admin_comped']);
const MARKER = 'valoxi_admin_suspended';

/** Stripe status and billing dates remain authoritative; suspension is an access overlay. */
export async function setSubscriptionSuspension(
  userCompanyId: number,
  suspended: boolean,
  actorUserId: number,
  reason?: string,
) {
  let undoStripe: (() => Promise<unknown>) | undefined;
  try {
    return await db.transaction(async tx => {
      const [subscription] = await tx.select().from(subscriptions)
        .where(eq(subscriptions.userCompanyId, userCompanyId)).for('update');
      if (!subscription) throw new NotFoundError('Subscription not found');
      if (!ELIGIBLE_STATUSES.has(subscription.status)) {
        throw new ConflictError('Only active, trial or comped subscriptions can be suspended or resumed.');
      }
      if (Boolean(subscription.suspendedAt) === suspended) return subscription;

      if (subscription.stripeSubscriptionId) {
        if (!config.stripe.secretKey) throw new AppError(503, 'Stripe is not configured');
        const stripe = new Stripe(config.stripe.secretKey);
        const remote = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        if (!['active', 'trialing'].includes(remote.status)) {
          throw new ConflictError('The Stripe subscription is no longer active or trialing. Refresh its billing status before continuing.');
        }
        if (suspended && remote.pause_collection && remote.metadata[MARKER] !== 'true') {
          throw new ConflictError('Payment collection is already paused in Stripe. Review that pause before suspending here.');
        }
        if (!suspended && remote.pause_collection &&
            (remote.metadata[MARKER] !== 'true' || remote.pause_collection.behavior !== 'void' ||
             remote.pause_collection.resumes_at)) {
          throw new ConflictError('This payment pause was changed outside Valoxi. Review it in Stripe before resuming.');
        }
        const oldPause = remote.pause_collection;
        const oldMarker = remote.metadata[MARKER] ?? '';
        await stripe.subscriptions.update(remote.id, {
          pause_collection: suspended ? { behavior: 'void' } : '',
          metadata: { [MARKER]: suspended ? 'true' : '' },
        });
        // If the DB write/commit fails, restore the previous payment collection state.
        undoStripe = () => stripe.subscriptions.update(remote.id, {
          pause_collection: oldPause ? {
            behavior: oldPause.behavior,
            ...(oldPause.resumes_at ? { resumes_at: oldPause.resumes_at } : {}),
          } : '',
          metadata: { [MARKER]: oldMarker },
        });
      }

      const [updated] = await tx.update(subscriptions).set({
        suspendedAt: suspended ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(subscriptions.id, subscription.id)).returning();
      await tx.insert(subscriptionEvents).values({
        userCompanyId,
        eventType: suspended ? 'subscription.suspended' : 'subscription.resumed',
        previousStatus: subscription.status,
        newStatus: subscription.status,
        previousPlanKey: subscription.planKey,
        newPlanKey: subscription.planKey,
        adminUserId: actorUserId,
        payload: { actorUserId, reason: reason ?? null, paymentCollection: suspended ? 'void' : 'resumed' },
      });
      return updated;
    });
  } catch (error) {
    if (undoStripe) {
      try {
        await undoStripe();
      } catch {
        throw new AppError(502, 'Subscription update failed and Stripe could not be restored. Review payment collection in Stripe before retrying.');
      }
    }
    if (error instanceof AppError) throw error;
    throw new BadRequestError('Could not update the subscription. No access change was saved. Check Stripe and retry.');
  }
}
