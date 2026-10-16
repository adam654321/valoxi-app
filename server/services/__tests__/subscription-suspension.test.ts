import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';

const stripeMocks = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));
vi.mock('stripe', () => ({
  default: vi.fn(function () {
    return { subscriptions: stripeMocks };
  }),
}));
vi.mock('../../config', () => ({ config: { stripe: { secretKey: 'test-only-mocked-key' } } }));

import { db } from '../../db';
import { userCompanies } from '@shared/schema/core';
import { subscriptions, subscriptionEvents } from '@shared/schema/billing';
import { setSubscriptionSuspension } from '../subscription-suspension.service';
import { requireUnsuspendedAccount } from '../../middleware/subscription-suspension';

describe('admin subscription suspension (Stripe mocked; isolated DEV fixtures)', () => {
  let companyId: number;
  let stripeId: string;
  let remote: Record<string, any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [company] = await db.insert(userCompanies).values({
      companyName: `Suspension test ${Date.now()}`,
    }).returning();
    companyId = company.id;
    stripeId = `sub_mock_suspension_${companyId}`;
    remote = { id: stripeId, status: 'active', pause_collection: null, metadata: {} };
    stripeMocks.retrieve.mockResolvedValue(remote);
    stripeMocks.update.mockResolvedValue(remote);
    await db.insert(subscriptions).values({
      userCompanyId: companyId, status: 'active', planKey: 'CORE',
      stripeSubscriptionId: stripeId,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(subscriptionEvents).where(eq(subscriptionEvents.userCompanyId, companyId));
    await db.delete(subscriptions).where(eq(subscriptions.userCompanyId, companyId));
    await db.delete(userCompanies).where(eq(userCompanies.id, companyId));
  });

  async function stored() {
    const [row] = await db.select().from(subscriptions)
      .where(eq(subscriptions.userCompanyId, companyId));
    return row;
  }

  it('pauses payment collection, suspends access and records the admin/reason without canceling', async () => {
    const result = await setSubscriptionSuspension(companyId, true, 123, 'Customer requested a break');
    expect(result.suspendedAt).toBeInstanceOf(Date);
    expect(result.status).toBe('active');
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(stripeMocks.update).toHaveBeenCalledWith(stripeId, {
      pause_collection: { behavior: 'void' },
      metadata: { valoxi_admin_suspended: 'true' },
    });
    const [event] = await db.select().from(subscriptionEvents)
      .where(eq(subscriptionEvents.userCompanyId, companyId));
    expect(event.eventType).toBe('subscription.suspended');
    expect(event.adminUserId).toBe(123);
    expect(event.payload).toMatchObject({ reason: 'Customer requested a break' });
  });

  it('resumes future billing and clears the access block', async () => {
    await db.update(subscriptions).set({ suspendedAt: new Date() })
      .where(eq(subscriptions.userCompanyId, companyId));
    remote.pause_collection = { behavior: 'void' };
    remote.metadata = { valoxi_admin_suspended: 'true' };
    const result = await setSubscriptionSuspension(companyId, false, 123);
    expect(result.suspendedAt).toBeNull();
    expect(stripeMocks.update).toHaveBeenCalledWith(stripeId, {
      pause_collection: '', metadata: { valoxi_admin_suspended: '' },
    });
  });

  it('does not save suspension when Stripe rejects the pause', async () => {
    stripeMocks.update.mockRejectedValueOnce(new Error('Stripe unavailable'));
    await expect(setSubscriptionSuspension(companyId, true, 123)).rejects.toThrow('Could not update');
    expect((await stored()).suspendedAt).toBeNull();
    expect(await db.select().from(subscriptionEvents)
      .where(eq(subscriptionEvents.userCompanyId, companyId))).toHaveLength(0);
  });

  it('restores Stripe payment collection if the DB transaction fails', async () => {
    const transaction = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementationOnce(callback =>
      transaction(async tx => {
        await callback(tx);
        throw new Error('forced transaction failure');
      }));
    await expect(setSubscriptionSuspension(companyId, true, 123)).rejects.toThrow('Could not update');
    expect(stripeMocks.update).toHaveBeenLastCalledWith(stripeId, {
      pause_collection: '', metadata: { valoxi_admin_suspended: '' },
    });
    expect((await stored()).suspendedAt).toBeNull();
  });

  it('keeps access blocked when restoring the Stripe pause fails after a failed resume', async () => {
    await db.update(subscriptions).set({ suspendedAt: new Date() })
      .where(eq(subscriptions.userCompanyId, companyId));
    remote.pause_collection = { behavior: 'void' };
    remote.metadata = { valoxi_admin_suspended: 'true' };
    stripeMocks.update.mockResolvedValueOnce(remote).mockRejectedValueOnce(new Error('restore failed'));
    const transaction = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementationOnce(callback =>
      transaction(async tx => {
        await callback(tx);
        throw new Error('forced rollback');
      }));
    await expect(setSubscriptionSuspension(companyId, false, 123))
      .rejects.toThrow('Stripe could not be restored');
    expect((await stored()).suspendedAt).not.toBeNull();
  });

  it('is idempotent and does not issue a second Stripe pause', async () => {
    await setSubscriptionSuspension(companyId, true, 123);
    await setSubscriptionSuspension(companyId, true, 123);
    expect(stripeMocks.update).toHaveBeenCalledTimes(1);
  });

  it('also suspends and resumes comped accounts without contacting Stripe', async () => {
    await db.update(subscriptions).set({ stripeSubscriptionId: null, status: 'admin_comped' })
      .where(eq(subscriptions.userCompanyId, companyId));
    expect((await setSubscriptionSuspension(companyId, true, 123)).suspendedAt).not.toBeNull();
    expect((await setSubscriptionSuspension(companyId, false, 123)).suspendedAt).toBeNull();
    expect(stripeMocks.retrieve).not.toHaveBeenCalled();
  });

  it('rejects canceled subscriptions and preserves existing manual Stripe pauses', async () => {
    remote.pause_collection = { behavior: 'keep_as_draft' };
    await expect(setSubscriptionSuspension(companyId, true, 123)).rejects.toThrow('already paused');
    remote.pause_collection = null;
    await db.update(subscriptions).set({ status: 'canceled' })
      .where(eq(subscriptions.userCompanyId, companyId));
    await expect(setSubscriptionSuspension(companyId, true, 123)).rejects.toThrow('Only active');
    expect(stripeMocks.update).not.toHaveBeenCalled();
  });

  it('retains suspension across underlying subscription-status updates', async () => {
    await setSubscriptionSuspension(companyId, true, 123);
    await db.update(subscriptions).set({ status: 'trialing' })
      .where(eq(subscriptions.userCompanyId, companyId));
    expect((await stored()).suspendedAt).not.toBeNull();
  });

  async function request(path: string, method = 'GET', admin = false) {
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await requireUnsuspendedAccount({
      originalUrl: path, method,
      session: { userCompanyId: companyId, isSystemAdmin: admin },
    } as Request, res as unknown as Response, next);
    return { res, next };
  }

  it('blocks existing sessions on company/team/data and billing-write routes', async () => {
    await setSubscriptionSuspension(companyId, true, 123);
    for (const [path, method] of [
      ['/api/v2/team', 'GET'], ['/api/v2/dashboard', 'GET'],
      ['/api/v2/billing/checkout', 'POST'], ['/api/v2/billing/portal', 'POST'],
    ]) {
      const { res, next } = await request(path, method);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'subscription_suspended' }));
    }
  });

  it('allows identity, suspension status and administrator recovery routes', async () => {
    await setSubscriptionSuspension(companyId, true, 123);
    for (const path of ['/api/v2/auth/me', '/api/v2/billing/subscription', '/api/v2/admin/subscriptions']) {
      expect((await request(path)).next).toHaveBeenCalled();
    }
    expect((await request('/api/v2/dashboard', 'GET', true)).next).toHaveBeenCalled();
  });

  it('allows normal account requests after resume', async () => {
    await setSubscriptionSuspension(companyId, true, 123);
    remote.pause_collection = { behavior: 'void' };
    remote.metadata = { valoxi_admin_suspended: 'true' };
    await setSubscriptionSuspension(companyId, false, 123);
    expect((await request('/api/v2/dashboard')).next).toHaveBeenCalled();
  });
});
