import { describe, it, expect, vi, beforeEach } from 'vitest';

// Everything the route imports that would touch a real database or service is mocked.
const state = vi.hoisted(() => ({ event: null as any, sub: null as any }));

vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent: () => state.event };
  },
}));
vi.mock('../config', () => ({ config: { stripe: { secretKey: 'sk_test_x', webhookSecret: 'whsec_x' } } }));
vi.mock('../db', () => ({ db: { insert: () => ({ values: async () => undefined }) } }));
vi.mock('../repositories/billing.repository', () => ({
  billingRepository: {
    getEventByStripeId: vi.fn().mockResolvedValue(null),
    getByStripeSubscriptionId: vi.fn(async () => state.sub),
    getAdminEmailForCompany: vi.fn().mockResolvedValue(null),
    logEvent: vi.fn().mockResolvedValue(null),
    hasRecentEvent: vi.fn().mockResolvedValue(false),
  },
}));
vi.mock('../services/billing.service', () => ({
  billingService: {
    updateSubscriptionStatus: vi.fn().mockResolvedValue(null),
    confirmFirstPayment: vi.fn().mockResolvedValue({ wasFirstPayment: false }),
  },
}));
vi.mock('../services/email.service', () => ({ emailApiService: {} }));
vi.mock('../services/promo-code.service', () => ({
  promoCodeService: {},
  computeFreeMonthsElapsed: vi.fn(),
  getFreePeriodState: vi.fn(),
}));
vi.mock('../middleware/auth', () => ({ isAuthenticated: vi.fn(), isSystemAdmin: vi.fn(), requirePermission: () => vi.fn() }));
vi.mock('../middleware/csrf', () => ({ validateCsrfToken: vi.fn() }));

import { billingWebhookRoutes } from './billing.routes';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';

function handler() {
  const layer = (billingWebhookRoutes as any).stack.find((l: any) => l.route?.path === '/webhook/stripe');
  return layer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
}

async function deliver(type: string, subStatus: string | null) {
  state.event = {
    id: `evt_${type}_${subStatus}`,
    type,
    data: { object: { id: 'in_1', subscription: 'sub_X', amount_paid: 100, currency: 'gbp' } },
  };
  state.sub = subStatus === null ? null : { userCompanyId: 7, planKey: 'PROFESSIONAL', status: subStatus, id: 44 };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  await handler()({ headers: { 'stripe-signature': 'sig' }, body: Buffer.from('{}') }, res);
  return res;
}

describe('Stripe webhook: cancelled subscriptions are terminal for invoice events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoice.paid on a CANCELLED subscription does not reactivate it', async () => {
    await deliver('invoice.paid', 'canceled');
    expect(billingService.updateSubscriptionStatus).not.toHaveBeenCalled();
    expect(billingService.confirmFirstPayment).not.toHaveBeenCalled();
    expect(billingRepository.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'invoice.ignored_after_cancel', userCompanyId: 7 })
    );
  });

  it('invoice.payment_failed on a CANCELLED subscription does not set past_due', async () => {
    await deliver('invoice.payment_failed', 'canceled');
    expect(billingService.updateSubscriptionStatus).not.toHaveBeenCalled();
    expect(billingRepository.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'invoice.ignored_after_cancel' })
    );
  });

  it('invoice.paid on a past_due subscription still recovers it to active (normal path unchanged)', async () => {
    await deliver('invoice.paid', 'past_due');
    expect(billingService.updateSubscriptionStatus).toHaveBeenCalledWith(7, { status: 'active' }, expect.any(String));
  });

  it('invoice.payment_failed on an active subscription still sets past_due (normal path unchanged)', async () => {
    await deliver('invoice.payment_failed', 'active');
    expect(billingService.updateSubscriptionStatus).toHaveBeenCalledWith(7, { status: 'past_due' }, expect.any(String));
  });

  it('an invoice event for an unknown subscription changes nothing', async () => {
    await deliver('invoice.paid', null);
    expect(billingService.updateSubscriptionStatus).not.toHaveBeenCalled();
  });
});
