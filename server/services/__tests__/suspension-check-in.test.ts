import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
const email = vi.hoisted(() => vi.fn());
vi.mock('../email.service', () => ({ emailApiService: { sendCustomEmail: email } }));
import { db } from '../../db';
import { userCompanies, users } from '@shared/schema/core';
import { subscriptions } from '@shared/schema/billing';
import { teamNotifications } from '@shared/schema/deals';
import { processSuspensionCheckIns, suspensionCheckInDueAt } from '../suspension-check-in.service';

describe('suspension check-ins (isolated DEV fixtures, email mocked)', () => {
  let adminCompanyId: number;
  let customerCompanyId: number;
  let subscriptionId: number;
  let admin: { id: number; userCompanyId: number | null; email: string };
  const suspendedAt = new Date('2026-01-31T12:00:00Z');
  const threeMonths = new Date('2026-04-30T12:00:00Z');
  const fiveMonths = new Date('2026-06-30T12:00:00Z');

  beforeEach(async () => {
    email.mockReset().mockResolvedValue({ success: true });
    const companies = await db.insert(userCompanies).values([
      { companyName: 'Check-in test admin' },
      { companyName: 'Check-in test suspended company' },
    ]).returning();
    adminCompanyId = companies[0].id;
    customerCompanyId = companies[1].id;
    [admin] = await db.insert(users).values({
      userCompanyId: adminCompanyId, firstName: 'Reminder', lastName: 'Admin',
      email: `suspension-check-in-${adminCompanyId}@example.test`,
      isSystemAdmin: true, isActive: true,
    }).returning();
    const [subscription] = await db.insert(subscriptions).values({
      userCompanyId: customerCompanyId, status: 'active', suspendedAt,
    }).returning();
    subscriptionId = subscription.id;
  });

  afterEach(async () => {
    await db.delete(teamNotifications).where(eq(teamNotifications.userCompanyId, adminCompanyId));
    await db.delete(subscriptions).where(eq(subscriptions.id, subscriptionId));
    await db.delete(users).where(eq(users.userCompanyId, adminCompanyId));
    await db.delete(userCompanies).where(inArray(userCompanies.id, [adminCompanyId, customerCompanyId]));
  });

  const process = (now: Date) => processSuspensionCheckIns(subscriptionId, [admin], now);
  const reminders = () => db.select().from(teamNotifications)
    .where(eq(teamNotifications.targetUserId, admin.id));

  it('uses calendar months, clamping month ends and handling leap years', () => {
    expect(suspensionCheckInDueAt(suspendedAt, 3)).toEqual(threeMonths);
    expect(suspensionCheckInDueAt(suspendedAt, 5)).toEqual(fiveMonths);
    expect(suspensionCheckInDueAt(new Date('2023-09-30T09:00:00Z'), 5))
      .toEqual(new Date('2024-02-29T09:00:00Z'));
  });

  it('does not remind before three months', async () => {
    await process(new Date(threeMonths.getTime() - 1));
    expect(await reminders()).toHaveLength(0);
    expect(email).not.toHaveBeenCalled();
  });

  it('sends an internal notification and email at three months', async () => {
    await process(threeMonths);
    const rows = await reminders();
    expect(rows).toHaveLength(1);
    expect(rows[0].notificationTitle).toBe('3-month suspension check-in');
    expect(rows[0].isEmailSent).toBe(true);
    expect(email).toHaveBeenCalledWith(admin.email,
      expect.stringContaining('3-month'), expect.stringContaining('Check-in test suspended company'));
  });

  it('sends the second reminder at five months, only once per milestone', async () => {
    await process(threeMonths);
    await process(new Date(fiveMonths.getTime() - 1));
    expect(await reminders()).toHaveLength(1);
    await process(fiveMonths);
    await process(new Date('2026-07-01T12:00:00Z'));
    expect(await reminders()).toHaveLength(2);
    expect(email).toHaveBeenCalledTimes(2);
  });

  it('catches up missed reminders after downtime', async () => {
    await process(new Date('2026-08-01T12:00:00Z'));
    expect(await reminders()).toHaveLength(2);
    expect(email).toHaveBeenCalledTimes(2);
  });

  it('stops when resumed or canceled without changing billing itself', async () => {
    await db.update(subscriptions).set({ suspendedAt: null }).where(eq(subscriptions.id, subscriptionId));
    await process(fiveMonths);
    await db.update(subscriptions).set({ suspendedAt, status: 'canceled' }).where(eq(subscriptions.id, subscriptionId));
    await process(fiveMonths);
    expect(await reminders()).toHaveLength(0);
    expect(email).not.toHaveBeenCalled();
  });

  it('starts a new reminder schedule on a new suspension', async () => {
    await process(threeMonths);
    await db.update(subscriptions).set({ suspendedAt: new Date('2026-05-01T12:00:00Z') })
      .where(eq(subscriptions.id, subscriptionId));
    await process(new Date('2026-08-01T12:00:00Z'));
    expect(await reminders()).toHaveLength(2);
    expect(email).toHaveBeenCalledTimes(2);
  });

  it('retains the in-app reminder and retries a failed email without duplicating it', async () => {
    email.mockResolvedValueOnce({ success: false });
    await process(threeMonths);
    expect((await reminders())[0].isEmailSent).toBe(false);
    await process(new Date('2026-05-01T12:00:00Z'));
    const rows = await reminders();
    expect(rows).toHaveLength(1);
    expect(rows[0].isEmailSent).toBe(true);
    expect(email).toHaveBeenCalledTimes(2);
  });

  it('retains the in-app reminder when the email provider throws', async () => {
    email.mockRejectedValueOnce(new Error('provider unavailable'));
    await process(threeMonths);
    expect(await reminders()).toHaveLength(1);
    expect((await reminders())[0].isEmailSent).toBe(false);
  });

  it('serializes simultaneous workers to avoid duplicate reminders', async () => {
    await Promise.all([process(threeMonths), process(threeMonths)]);
    expect(await reminders()).toHaveLength(1);
    expect(email).toHaveBeenCalledTimes(1);
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    expect(subscription.suspendedAt).toEqual(suspendedAt);
    expect(subscription.status).toBe('active');
  });
});
