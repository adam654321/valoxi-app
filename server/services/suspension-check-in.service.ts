import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '@shared/schema/billing';
import { userCompanies, users } from '@shared/schema/core';
import { teamNotifications } from '@shared/schema/deals';
import { emailApiService } from './email.service';

/** Calendar months, clamping month-end dates rather than overflowing into the next month. */
export function suspensionCheckInDueAt(suspendedAt: Date, months: 3 | 5): Date {
  const due = new Date(suspendedAt);
  const day = due.getUTCDate();
  due.setUTCDate(1);
  due.setUTCMonth(due.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
  due.setUTCDate(Math.min(day, lastDay));
  return due;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/**
 * Daily internal check-ins. The subscription row lock serializes duplicate workers
 * and resume/suspend actions. Existing notification delivery flags provide retry state.
 */
export async function runSuspensionCheckInJob(now = new Date()): Promise<void> {
  const admins = await db.select({
    id: users.id, userCompanyId: users.userCompanyId, email: users.email,
  }).from(users)
    .where(and(eq(users.isSystemAdmin, true), eq(users.isActive, true)));
  if (admins.length === 0) return;
  const candidates = await db.select({ id: subscriptions.id }).from(subscriptions)
    .where(isNotNull(subscriptions.suspendedAt));

  for (const candidate of candidates) {
    await processSuspensionCheckIns(candidate.id, admins, now);
  }
}

type ReminderAdmin = { id: number; userCompanyId: number | null; email: string };

export async function processSuspensionCheckIns(
  subscriptionId: number,
  admins: ReminderAdmin[],
  now = new Date(),
): Promise<void> {
    for (const months of [3, 5] as const) {
      for (const admin of admins) {
        if (!admin.userCompanyId) continue;
        try {
          await db.transaction(async tx => {
            const [subscription] = await tx.select().from(subscriptions)
              .where(eq(subscriptions.id, subscriptionId)).for('update');
            if (!subscription?.suspendedAt || subscription.status === 'canceled' ||
                suspensionCheckInDueAt(subscription.suspendedAt, months) > now) return;
            const [company] = await tx.select().from(userCompanies)
              .where(eq(userCompanies.id, subscription.userCompanyId));
            if (!company) return;

            const type = `suspension_checkin_${months}m`;
            const title = `${months}-month suspension check-in`;
            const message = `Check in with ${company.companyName}: their subscription has been suspended for ${months} months. Review it in Admin → Subscriptions.`;
            let [notification] = await tx.select().from(teamNotifications).where(and(
              eq(teamNotifications.targetUserId, admin.id),
              eq(teamNotifications.relatedObjectType, type),
              eq(teamNotifications.relatedObjectId, subscription.id),
              gte(teamNotifications.createdAt, subscription.suspendedAt),
            ));
            if (!notification) {
              [notification] = await tx.insert(teamNotifications).values({
                userCompanyId: admin.userCompanyId!,
                targetUserId: admin.id,
                fromUserId: admin.id,
                notificationType: 'suspension_check_in',
                notificationTitle: title,
                notificationMessage: message,
                relatedObjectType: type,
                relatedObjectId: subscription.id,
                createdAt: now,
              }).returning();
            }
            if (notification.isEmailSent) return;
            // A failed email must not roll back the in-app reminder; retry it on the next run.
            try {
              const result = await emailApiService.sendCustomEmail(
                admin.email,
                `[Valoxi] ${title}: ${company.companyName}`,
                `<p>${escapeHtml(message)}</p><p>Suspended since: ${subscription.suspendedAt.toISOString().slice(0, 10)}. Billing and member access remain paused. This reminder does not resume the subscription.</p>`,
              );
              if (!result.success) {
                console.error(`[suspension-check-in] Email delivery failed for subscription ${subscription.id}, ${months}-month reminder`);
                return;
              }
              await tx.update(teamNotifications).set({ isEmailSent: true, emailSentAt: now })
                .where(eq(teamNotifications.id, notification.id));
            } catch {
              console.error(`[suspension-check-in] Email delivery failed for subscription ${subscription.id}, ${months}-month reminder; will retry`);
            }
          });
        } catch (error) {
          console.error(`[suspension-check-in] Could not process subscription ${subscriptionId}, ${months}-month reminder`, error);
        }
      }
    }
}
