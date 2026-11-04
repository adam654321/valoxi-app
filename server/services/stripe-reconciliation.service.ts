/**
 * Daily check that our subscription statuses agree with Stripe. REPORT ONLY: it never edits a row.
 * (Same idea as scripts/migration/check-stripe-subs.mjs, run on a schedule with an alert.)
 */
import { classifyStatusDrift } from './billing-guards';

export interface ReconcileCandidate {
  subscriptionId: number;
  userCompanyId: number;
  stripeSubscriptionId: string;
  status: string;
}

export interface ReconcileProblem {
  subscriptionId: number;
  userCompanyId: number;
  stripeSubscriptionId: string;
  kind: 'status_drift' | 'stripe_error';
  dbStatus: string;
  detail: string; // Stripe status for drift, error text for stripe_error
}

export interface ReconcileDeps {
  loadCandidates(): Promise<ReconcileCandidate[]>;
  retrieveStripeStatus(stripeSubscriptionId: string): Promise<string>;
}

export interface ReconcileResult {
  checked: number;
  problems: ReconcileProblem[];
}

export async function findSubscriptionDrift(deps: ReconcileDeps): Promise<ReconcileResult> {
  const candidates = await deps.loadCandidates();
  const problems: ReconcileProblem[] = [];

  for (const c of candidates) {
    try {
      const stripeStatus = await deps.retrieveStripeStatus(c.stripeSubscriptionId);
      const drift = classifyStatusDrift(c.status, stripeStatus);
      if (drift) {
        problems.push({
          subscriptionId: c.subscriptionId,
          userCompanyId: c.userCompanyId,
          stripeSubscriptionId: c.stripeSubscriptionId,
          kind: 'status_drift',
          dbStatus: drift.dbStatus,
          detail: drift.stripeStatus,
        });
      }
    } catch (err) {
      // An error is itself worth reporting: it can mean the wrong Stripe account or mode.
      problems.push({
        subscriptionId: c.subscriptionId,
        userCompanyId: c.userCompanyId,
        stripeSubscriptionId: c.stripeSubscriptionId,
        kind: 'stripe_error',
        dbStatus: c.status,
        detail: ((err as { code?: string; message?: string })?.code ?? (err as Error)?.message ?? 'unknown').toString().slice(0, 120),
      });
    }
  }

  return { checked: candidates.length, problems };
}

export function formatReconcileAlert(result: ReconcileResult): { subject: string; body: string } | null {
  if (result.problems.length === 0) return null;
  const drift = result.problems.filter((p) => p.kind === 'status_drift').length;
  const errors = result.problems.length - drift;
  const lines = result.problems.map((p) =>
    p.kind === 'status_drift'
      ? `subscription ${p.subscriptionId} (company ${p.userCompanyId}): app says ${p.dbStatus}, Stripe says ${p.detail}  [${p.stripeSubscriptionId}]`
      : `subscription ${p.subscriptionId} (company ${p.userCompanyId}): Stripe lookup failed (${p.detail})  [${p.stripeSubscriptionId}]`
  );
  const subject = `[Valoxi] ${result.problems.length} subscription(s) out of step with Stripe`;
  const body =
    `Checked ${result.checked} subscription(s) against Stripe: ${drift} status mismatch(es), ${errors} lookup error(s).\n` +
    `This is a report only; nothing was changed.\n\n` +
    `${lines.join('\n')}\n\n` +
    `Investigate in the Stripe dashboard, then correct the app status or the Stripe subscription.`;
  return { subject, body };
}
