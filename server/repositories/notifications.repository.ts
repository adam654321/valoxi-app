import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  teamNotifications,
  targetCompanies,
  users,
  type TeamNotification,
  type InsertTeamNotification,
} from '@shared/schema';

export interface NotificationWithDetails extends TeamNotification {
  fromUserName: string;
  targetCompanyName: string | null;
}

export class NotificationsRepository {
  async createNotification(notification: InsertTeamNotification): Promise<TeamNotification> {
    const [newNotification] = await db
      .insert(teamNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: number): Promise<NotificationWithDetails[]> {
    return await db
      .select({
        id: teamNotifications.id,
        userCompanyId: teamNotifications.userCompanyId,
        targetUserId: teamNotifications.targetUserId,
        fromUserId: teamNotifications.fromUserId,
        notificationType: teamNotifications.notificationType,
        notificationTitle: teamNotifications.notificationTitle,
        notificationMessage: teamNotifications.notificationMessage,
        targetCompanyId: teamNotifications.targetCompanyId,
        relatedObjectType: teamNotifications.relatedObjectType,
        relatedObjectId: teamNotifications.relatedObjectId,
        isRead: teamNotifications.isRead,
        readAt: teamNotifications.readAt,
        isEmailSent: teamNotifications.isEmailSent,
        emailSentAt: teamNotifications.emailSentAt,
        createdAt: teamNotifications.createdAt,
        fromUserName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        targetCompanyName: targetCompanies.companyName,
      })
      .from(teamNotifications)
      .innerJoin(users, eq(teamNotifications.fromUserId, users.id))
      .leftJoin(targetCompanies, eq(teamNotifications.targetCompanyId, targetCompanies.id))
      .where(eq(teamNotifications.targetUserId, userId))
      .orderBy(desc(teamNotifications.createdAt));
  }

  async markNotificationRead(notificationId: number, userId: number): Promise<boolean> {
    const [updatedNotification] = await db
      .update(teamNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(teamNotifications.id, notificationId),
        eq(teamNotifications.targetUserId, userId)
      ))
      .returning();
    return !!updatedNotification;
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    const updatedNotifications = await db
      .update(teamNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(teamNotifications.targetUserId, userId),
        eq(teamNotifications.isRead, false)
      ))
      .returning();
    return updatedNotifications.length;
  }
}

export const notificationsRepository = new NotificationsRepository();
