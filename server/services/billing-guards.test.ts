import { describe, it, expect, vi } from 'vitest';
import {
  shouldIgnoreInvoiceEvent,
  classifyStatusDrift,
  stripeStatusToDbStatus,
  isAlreadyCanceledStripeError,
  cancelOrReconcileForDunning,
  type DunningCancelDeps,
} from './billing-guards';

describe('shouldIgnoreInvoiceEvent', () => {
  it('ignores invoice events for a cancelled subscription (the Dentiva case)', () => {
    expect(shouldIgnoreInvoiceEvent('canceled')).toBe(true);
  });
  it.each(['active', 'past_due', 'trialing', 'incomplete', 'admin_comped', null, undefined])(
    'lets invoice events through for %s',
    (s) => {
      expect(shouldIgnoreInvoiceEvent(s as any)).toBe(false);
    }
  );
});

describe('stripeStatusToDbStatus', () => {
  it('maps like the webhook handler does', () => {
    expect(stripeStatusToDbStatus('unpaid')).toBe('past_due');
    expect(stripeStatusToDbStatus('incomplete_expired')).toBe('canceled');
    expect(stripeStatusToDbStatus('active')).toBe('active');
  });
  it('returns null for unknown statuses', () => {
    expect(stripeStatusToDbStatus('paused')).toBeNull();
  });
});

describe('classifyStatusDrift', () => {
  it('returns null when aligned', () => {
    expect(classifyStatusDrift('active', 'active')).toBeNull();
    expect(classifyStatusDrift('past_due', 'unpaid')).toBeNull();
    expect(classifyStatusDrift('canceled', 'incomplete_expired')).toBeNull();
  });
  it('flags the real-world drift shapes', () => {
    expect(classifyStatusDrift('active', 'canceled')).toEqual({ dbStatus: 'active', stripeStatus: 'canceled' });
    expect(classifyStatusDrift('past_due', 'canceled')).not.toBeNull();
  });
  it('never flags admin_comped (no Stripe truth)', () => {
    expect(classifyStatusDrift('admin_comped', 'canceled')).toBeNull();
  });
  it('flags a status we do not know how to map', () => {
    expect(classifyStatusDrift('active', 'paused')).not.toBeNull();
  });
});

describe('isAlreadyCanceledStripeError', () => {
  it('recognises the already-cancelled message', () => {
    expect(isAlreadyCanceledStripeError({ message: 'A canceled subscription can only update its cancellation_details. This subscription is already canceled.' })).toBe(true);
  });
  it('does NOT treat resource_missing as cancelled (could be the wrong account or mode)', () => {
    expect(isAlreadyCanceledStripeError({ code: 'resource_missing', message: 'No such subscription already canceled' })).toBe(false);
  });
  it('rejects other errors and null', () => {
    expect(isAlreadyCanceledStripeError({ message: 'rate limit' })).toBe(false);
    expect(isAlreadyCanceledStripeError(null)).toBe(false);
  });
});

function makeDeps(over: Partial<DunningCancelDeps> = {}) {
  const deps = {
    retrieveStatus: vi.fn().mockResolvedValue('past_due'),
    cancel: vi.fn().mockResolvedValue(undefined),
    markLocalCanceled: vi.fn().mockResolvedValue(undefined),
    logCancelRequested: vi.fn().mockResolvedValue(undefined),
    logReconciled: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  return deps as typeof deps & DunningCancelDeps;
}
const sub = { userCompanyId: 7, stripeSubscriptionId: 'sub_X' };

describe('cancelOrReconcileForDunning', () => {
  it('Stripe already cancelled: fixes the row, writes no "requested" audit row, never calls cancel', async () => {
    const d = makeDeps({ retrieveStatus: vi.fn().mockResolvedValue('canceled') });
    await expect(cancelOrReconcileForDunning(d, sub)).resolves.toBe('reconciled_already_canceled');
    expect(d.markLocalCanceled).toHaveBeenCalledWith(7);
    expect(d.logReconciled).toHaveBeenCalledWith(7, 'canceled');
    expect(d.logCancelRequested).not.toHaveBeenCalled();
    expect(d.cancel).not.toHaveBeenCalled();
  });

  it('treats incomplete_expired as already cancelled', async () => {
    const d = makeDeps({ retrieveStatus: vi.fn().mockResolvedValue('incomplete_expired') });
    await expect(cancelOrReconcileForDunning(d, sub)).resolves.toBe('reconciled_already_canceled');
  });

  it('live past_due subscription: audit row first, then cancel, local status left to the webhook', async () => {
    const order: string[] = [];
    const d = makeDeps({
      logCancelRequested: vi.fn().mockImplementation(async () => { order.push('audit'); }),
      cancel: vi.fn().mockImplementation(async () => { order.push('cancel'); }),
    });
    await expect(cancelOrReconcileForDunning(d, sub)).resolves.toBe('cancel_requested');
    expect(order).toEqual(['audit', 'cancel']);
    expect(d.markLocalCanceled).not.toHaveBeenCalled();
  });

  it('race: cancel call says already cancelled -> reconciles instead of looping', async () => {
    const d = makeDeps({ cancel: vi.fn().mockRejectedValue(new Error('This subscription is already canceled.')) });
    await expect(cancelOrReconcileForDunning(d, sub)).resolves.toBe('reconciled_already_canceled');
    expect(d.markLocalCanceled).toHaveBeenCalledWith(7);
  });

  it('other Stripe errors are rethrown and the row is NOT changed', async () => {
    const d = makeDeps({ cancel: vi.fn().mockRejectedValue(new Error('rate limit')) });
    await expect(cancelOrReconcileForDunning(d, sub)).rejects.toThrow('rate limit');
    expect(d.markLocalCanceled).not.toHaveBeenCalled();
  });

  it('a failed lookup (e.g. resource_missing) does not cancel or change anything', async () => {
    const err = Object.assign(new Error('No such subscription'), { code: 'resource_missing' });
    const d = makeDeps({ retrieveStatus: vi.fn().mockRejectedValue(err) });
    await expect(cancelOrReconcileForDunning(d, sub)).rejects.toThrow();
    expect(d.cancel).not.toHaveBeenCalled();
    expect(d.markLocalCanceled).not.toHaveBeenCalled();
    expect(d.logCancelRequested).not.toHaveBeenCalled();
  });
});
