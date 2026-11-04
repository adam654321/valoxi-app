import { describe, it, expect, vi } from 'vitest';
import { findSubscriptionDrift, formatReconcileAlert, type ReconcileCandidate } from './stripe-reconciliation.service';

const c = (id: number, status: string): ReconcileCandidate => ({
  subscriptionId: id,
  userCompanyId: id + 100,
  stripeSubscriptionId: `sub_${id}`,
  status,
});

describe('findSubscriptionDrift', () => {
  it('reports nothing when every subscription agrees with Stripe', async () => {
    const r = await findSubscriptionDrift({
      loadCandidates: async () => [c(1, 'active'), c(2, 'past_due'), c(3, 'trialing')],
      retrieveStripeStatus: async (id) => ({ sub_1: 'active', sub_2: 'unpaid', sub_3: 'trialing' } as Record<string, string>)[id],
    });
    expect(r).toEqual({ checked: 3, problems: [] });
    expect(formatReconcileAlert(r)).toBeNull();
  });

  it('reports the 2026 drift shapes: db active/past_due but Stripe canceled', async () => {
    const r = await findSubscriptionDrift({
      loadCandidates: async () => [c(44, 'active'), c(68, 'past_due'), c(9, 'active')],
      retrieveStripeStatus: async (id) => (id === 'sub_9' ? 'active' : 'canceled'),
    });
    expect(r.checked).toBe(3);
    expect(r.problems.map((p) => [p.subscriptionId, p.kind, p.dbStatus, p.detail])).toEqual([
      [44, 'status_drift', 'active', 'canceled'],
      [68, 'status_drift', 'past_due', 'canceled'],
    ]);
  });

  it('reports a Stripe lookup error as a problem and carries on with the rest', async () => {
    const retrieve = vi.fn().mockImplementation(async (id: string) => {
      if (id === 'sub_1') throw Object.assign(new Error('nope'), { code: 'resource_missing' });
      return 'canceled';
    });
    const r = await findSubscriptionDrift({ loadCandidates: async () => [c(1, 'active'), c(2, 'active')], retrieveStripeStatus: retrieve });
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(r.problems.map((p) => [p.subscriptionId, p.kind, p.detail])).toEqual([
      [1, 'stripe_error', 'resource_missing'],
      [2, 'status_drift', 'canceled'],
    ]);
  });

  it('never edits anything: only the two dependencies are used', async () => {
    const deps = {
      loadCandidates: vi.fn().mockResolvedValue([c(1, 'active')]),
      retrieveStripeStatus: vi.fn().mockResolvedValue('canceled'),
    };
    await findSubscriptionDrift(deps);
    expect(Object.keys(deps).sort()).toEqual(['loadCandidates', 'retrieveStripeStatus']);
  });
});

describe('formatReconcileAlert', () => {
  it('builds a readable subject and says nothing was changed', async () => {
    const r = await findSubscriptionDrift({
      loadCandidates: async () => [c(44, 'active')],
      retrieveStripeStatus: async () => 'canceled',
    });
    const a = formatReconcileAlert(r)!;
    expect(a.subject).toBe('[Valoxi] 1 subscription(s) out of step with Stripe');
    expect(a.body).toContain('subscription 44 (company 144): app says active, Stripe says canceled');
    expect(a.body).toContain('nothing was changed');
  });
});
