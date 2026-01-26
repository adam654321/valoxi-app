import { notificationsRepository, type NotificationWithDetails } from '../repositories/notifications.repository';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { TeamNotification, InsertTeamNotification } from '@shared/schema';

export class NotificationsService {
  async createNotification(notification: InsertTeamNotification): Promise<TeamNotification> {
    return await notificationsRepository.createNotification(notification);
  }

  async getUserNotifications(userId: number): Promise<NotificationWithDetails[]> {
    if (!userId || isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    return await notificationsRepository.getUserNotifications(userId);
  }

  async markNotificationRead(notificationId: number, userId: number): Promise<boolean> {
    if (!notificationId || isNaN(notificationId)) {
      throw new BadRequestError('Invalid notification ID');
    }

    const marked = await notificationsRepository.markNotificationRead(notificationId, userId);
    if (!marked) {
      throw new NotFoundError('Notification not found');
    }

    return true;
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    if (!userId || isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    return await notificationsRepository.markAllNotificationsRead(userId);
  }
}

export const notificationsService = new NotificationsService();
