import { db } from "../db";
import {
  activities,
  activityTypes,
  targetCompanies,
  targetContacts,
  users,
  teamNotifications,
  type Activity,
  type ActivityType,
  type TeamNotification,
  type InsertActivity,
  type InsertTeamNotification,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface ActivityWithDetails extends Activity {
  userName: string;
  contactName: string | null;
  contactTitle: string | null;
  typeDescription: string | null;
  companyName: string;
}

export interface ActivityTimeline {
  [date: string]: ActivityWithDetails[];
}

export interface NotificationWithDetails extends TeamNotification {
  fromUserName: string;
  targetCompanyName: string | null;
}

type DbInstance = typeof db;

export class ActivityStore {
  constructor(private db: DbInstance) {}

  async getActivityTypes(): Promise<ActivityType[]> {
    return await this.db
      .select()
      .from(activityTypes)
      .where(eq(activityTypes.isActive, true))
      .orderBy(activityTypes.typeName);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [targetCompany] = await this.db
      .select()
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.id, activity.targetCompanyId),
          eq(targetCompanies.userCompanyId, 
            (await this.db.select({ userCompanyId: users.userCompanyId })
              .from(users)
              .where(eq(users.id, activity.userId)))[0]?.userCompanyId || 0
          )
        )
      );

    if (!targetCompany) {
      throw new Error('Target company not found or access denied');
    }

    const [newActivity] = await this.db
      .insert(activities)
      .values({
        ...activity,
        activityDate: new Date(activity.activityDate),
        followUpDate: activity.followUpDate ? new Date(activity.followUpDate) : null,
      })
      .returning();

    return newActivity;
  }

  async getActivitiesForCompany(targetCompanyId: number, userCompanyId: number): Promise<ActivityWithDetails[]> {
    return await this.db
      .select({
        id: activities.id,
        targetCompanyId: activities.targetCompanyId,
        userId: activities.userId,
        activityType: activities.activityType,
        title: activities.title,
        description: activities.description,
        activityDate: activities.activityDate,
        activityTime: activities.activityTime,
        durationMinutes: activities.durationMinutes,
        contactId: activities.contactId,
        isCompleted: activities.isCompleted,
        followUpDate: activities.followUpDate,
        createdAt: activities.createdAt,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        contactName: sql<string | null>`CASE WHEN ${targetContacts.id} IS NOT NULL THEN ${targetContacts.firstName} || ' ' || ${targetContacts.lastName} ELSE NULL END`,
        contactTitle: targetContacts.title,
        typeDescription: activityTypes.description,
        companyName: targetCompanies.companyName,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .leftJoin(targetContacts, eq(activities.contactId, targetContacts.id))
      .leftJoin(activityTypes, eq(activities.activityType, activityTypes.typeName))
      .where(
        and(
          eq(activities.targetCompanyId, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .orderBy(desc(activities.activityDate), desc(activities.createdAt));
  }

  async getActivityTimeline(targetCompanyId: number, userCompanyId: number): Promise<ActivityTimeline> {
    const activitiesData = await this.getActivitiesForCompany(targetCompanyId, userCompanyId);
    
    const timeline: ActivityTimeline = {};
    activitiesData.forEach(activity => {
      const dateKey = activity.activityDate.toISOString().split('T')[0];
      if (!timeline[dateKey]) {
        timeline[dateKey] = [];
      }
      timeline[dateKey].push(activity);
    });

    return timeline;
  }

  async updateActivity(activityId: number, activity: Partial<InsertActivity>, userCompanyId: number): Promise<Activity | undefined> {
    const [existingActivity] = await this.db
      .select()
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(activities.id, activityId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!existingActivity) {
      return undefined;
    }

    const updateData: any = { ...activity };
    if (activity.activityDate) {
      updateData.activityDate = new Date(activity.activityDate);
    }
    if (activity.followUpDate) {
      updateData.followUpDate = new Date(activity.followUpDate);
    }

    const [updatedActivity] = await this.db
      .update(activities)
      .set(updateData)
      .where(eq(activities.id, activityId))
      .returning();

    return updatedActivity;
  }

  async deleteActivity(activityId: number, userCompanyId: number): Promise<boolean> {
    const [existingActivity] = await this.db
      .select()
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(activities.id, activityId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!existingActivity) {
      return false;
    }

    await this.db.delete(activities).where(eq(activities.id, activityId));
    return true;
  }

  async getRecentActivities(userCompanyId: number, limit: number = 20): Promise<ActivityWithDetails[]> {
    return await this.db
      .select({
        id: activities.id,
        targetCompanyId: activities.targetCompanyId,
        userId: activities.userId,
        activityType: activities.activityType,
        title: activities.title,
        description: activities.description,
        activityDate: activities.activityDate,
        activityTime: activities.activityTime,
        durationMinutes: activities.durationMinutes,
        contactId: activities.contactId,
        isCompleted: activities.isCompleted,
        followUpDate: activities.followUpDate,
        createdAt: activities.createdAt,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        contactName: sql<string | null>`CASE WHEN ${targetContacts.id} IS NOT NULL THEN ${targetContacts.firstName} || ' ' || ${targetContacts.lastName} ELSE NULL END`,
        contactTitle: targetContacts.title,
        typeDescription: activityTypes.description,
        companyName: targetCompanies.companyName,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .leftJoin(targetContacts, eq(activities.contactId, targetContacts.id))
      .leftJoin(activityTypes, eq(activities.activityType, activityTypes.typeName))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(activities.activityDate), desc(activities.createdAt))
      .limit(limit);
  }

  async getActivitySummary(userCompanyId: number, dateRange?: string) {
    const activityByType = await this.db
      .select({
        activity_type: activities.activityType,
        count: sql<number>`count(*)::int`,
        avg_duration: sql<number>`avg(${activities.durationMinutes})`,
        companies_contacted: sql<number>`count(distinct ${activities.targetCompanyId})::int`,
      })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .groupBy(activities.activityType);

    return {
      activityByType,
      activityByUser: [],
      activityTrends: []
    };
  }

  async getUserPerformance(userCompanyId: number, dateRange?: string) {
    return await this.db
      .select({
        user_name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        active_deals: sql<number>`count(distinct case when ${targetCompanies.stage} not in ('Completion', 'Not Qualified') then ${targetCompanies.id} end)::int`,
        total_activities: sql<number>`count(${activities.id})::int`,
        success_rate: sql<number>`round(count(case when ${targetCompanies.stage} = 'Completion' then 1 end) * 100.0 / nullif(count(case when ${targetCompanies.stage} in ('Completion', 'Not Qualified') then 1 end), 0), 2)`,
      })
      .from(users)
      .leftJoin(activities, eq(users.id, activities.userId))
      .leftJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(eq(users.userCompanyId, userCompanyId))
      .groupBy(users.id, users.firstName, users.lastName);
  }

  async exportReport(userCompanyId: number, reportType: string, format: string = 'csv'): Promise<string> {
    let data: any[] = [];
    let headers: string[] = [];

    switch (reportType) {
      case 'pipeline-overview':
        const stageStats = await this.db
          .select({
            stageName: targetCompanies.stage,
            companyCount: sql<number>`count(*)::int`,
          })
          .from(targetCompanies)
          .where(eq(targetCompanies.userCompanyId, userCompanyId))
          .groupBy(targetCompanies.stage);
        
        const totalCompanies = stageStats.reduce((sum, stat) => sum + stat.companyCount, 0);
        data = stageStats.map(stat => ({
          stage: stat.stageName,
          count: stat.companyCount,
          percentage: totalCompanies > 0 ? 
            Math.round((stat.companyCount / totalCompanies) * 100 * 100) / 100 : 0
        }));
        headers = ['stage', 'count', 'percentage'];
        break;
      case 'activity-summary':
        const activityData = await this.getActivitySummary(userCompanyId);
        data = activityData.activityByType;
        headers = ['activity_type', 'count', 'avg_duration', 'companies_contacted'];
        break;
      default:
        throw new Error('Invalid report type');
    }

    let csv = headers.join(',') + '\n';
    data.forEach((row: any) => {
      const values = headers.map(header => `"${row[header] || ''}"`);
      csv += values.join(',') + '\n';
    });

    return csv;
  }

  async createNotification(notification: InsertTeamNotification): Promise<TeamNotification> {
    const [newNotification] = await this.db
      .insert(teamNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: number): Promise<NotificationWithDetails[]> {
    return await this.db
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
    const [updatedNotification] = await this.db
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
    const updatedNotifications = await this.db
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

export const activityStore = new ActivityStore(db);
