/**
 * Guards that keep the local subscription status in step with Stripe.
 *
 * Background: a Stripe subscription that is `canceled` is terminal. Late `invoice.paid` or
 * `invoice.payment_failed` events for it must never move our row back to active or past_due,
 * and the dunning job must not keep asking Stripe to cancel something already cancelled.
 * Pure functions here so they can be unit tested without a database.
 */
import type { SubscriptionStatus } from '@shared/schema/billing';

/** Stripe subscription status -> our status. Mirrors the map used by the webhook handler. */
const STRIPE_TO_DB_STATUS: Record<string, SubscriptionStatus> = {
  active: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  trialing: 'trialing',
};

export function stripeStatusToDbStatus(stripeStatus: string): SubscriptionStatus | null {
  return STRIPE_TO_DB_STATUS[stripeStatus] ?? null;
}

/**
 * True when an invoice event must NOT change the local status because the subscription is
 * already cancelled. A genuine re-subscribe arrives as checkout.session.completed with a new
 * Stripe subscription id, so it is never matched here.
 */
export function shouldIgnoreInvoiceEvent(currentStatus: string | null | undefined): boolean {
  return currentStatus === 'canceled';
}

export interface StatusDrift {
  dbStatus: string;
  stripeStatus: string;
}

/**
 * Returns the drift when our status disagrees with Stripe's, otherwise null.
 * `admin_comped` is ours alone (no Stripe truth to compare); unknown Stripe statuses are reported.
 */
export function classifyStatusDrift(dbStatus: string, stripeStatus: string): StatusDrift | null {
  if (dbStatus === 'admin_comped') return null;
  const expected = stripeStatusToDbStatus(stripeStatus);
  if (expected === dbStatus) return null;
  return { dbStatus, stripeStatus };
}

/** Stripe error shapes that mean "this subscription is already cancelled / gone". */
export function isAlreadyCanceledStripeError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  // resource_missing is NOT proof of cancelled (e.g. wrong Stripe account/mode): never auto-flip on it.
  if (e.code === 'resource_missing') return false;
  const msg = (e.message ?? '').toLowerCase();
  return msg.includes('already canceled') || msg.includes('already been canceled');
}

export interface DunningCancelDeps {
  retrieveStatus(stripeSubscriptionId: string): Promise<string>;
  cancel(stripeSubscriptionId: string): Promise<void>;
  markLocalCanceled(userCompanyId: number): Promise<void>;
  logCancelRequested(userCompanyId: number): Promise<void>;
  logReconciled(userCompanyId: number, stripeStatus: string): Promise<void>;
}

export type DunningCancelOutcome = 'reconciled_already_canceled' | 'cancel_requested';

/**
 * Day-14 dunning cancel for one subscription.
 *  - Stripe already says canceled: fix the local row, send no email, write no "requested" audit row.
 *  - Otherwise write the audit row (the deleted-webhook handler uses it to decide to email) then cancel.
 *  - If the cancel call itself reports "already cancelled" (race), reconcile the same way.
 * Any other Stripe error is thrown to the caller, which logs it and moves on.
 */
export async function cancelOrReconcileForDunning(
  deps: DunningCancelDeps,
  sub: { userCompanyId: number; stripeSubscriptionId: string }
): Promise<DunningCancelOutcome> {
  const stripeStatus = await deps.retrieveStatus(sub.stripeSubscriptionId);

  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
    await deps.markLocalCanceled(sub.userCompanyId);
    await deps.logReconciled(sub.userCompanyId, stripeStatus);
    return 'reconciled_already_canceled';
  }

  await deps.logCancelRequested(sub.userCompanyId);
  try {
    await deps.cancel(sub.stripeSubscriptionId);
  } catch (err) {
    if (isAlreadyCanceledStripeError(err)) {
      await deps.markLocalCanceled(sub.userCompanyId);
      await deps.logReconciled(sub.userCompanyId, 'canceled');
      return 'reconciled_already_canceled';
    }
    throw err;
  }
  return 'cancel_requested';
}
