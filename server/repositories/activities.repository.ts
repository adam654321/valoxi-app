import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  activities,
  activityTypes,
  targetCompanies,
  targetContacts,
  users,
  type Activity,
  type ActivityType,
  type InsertActivity,
} from '@shared/schema';

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

export class ActivitiesRepository {
  async getActivityTypes(): Promise<ActivityType[]> {
    return await db
      .select()
      .from(activityTypes)
      .where(eq(activityTypes.isActive, true))
      .orderBy(activityTypes.typeName);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db
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
    return await db
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

  async getActivity(activityId: number, userCompanyId: number): Promise<Activity | undefined> {
    const [existingActivity] = await db
      .select({ activity: activities })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(activities.id, activityId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    return existingActivity?.activity;
  }

  async updateActivity(activityId: number, activity: Partial<InsertActivity>, userCompanyId: number): Promise<Activity | undefined> {
    const existing = await this.getActivity(activityId, userCompanyId);
    if (!existing) {
      return undefined;
    }

    const updateData: any = { ...activity };
    if (activity.activityDate) {
      updateData.activityDate = new Date(activity.activityDate);
    }
    if (activity.followUpDate) {
      updateData.followUpDate = new Date(activity.followUpDate);
    }

    const [updatedActivity] = await db
      .update(activities)
      .set(updateData)
      .where(eq(activities.id, activityId))
      .returning();

    return updatedActivity;
  }

  async deleteActivity(activityId: number, userCompanyId: number): Promise<boolean> {
    const existing = await this.getActivity(activityId, userCompanyId);
    if (!existing) {
      return false;
    }

    await db.delete(activities).where(eq(activities.id, activityId));
    return true;
  }

  async getRecentActivities(userCompanyId: number, limit: number = 20): Promise<ActivityWithDetails[]> {
    return await db
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

  async targetCompanyBelongsToUser(targetCompanyId: number, userCompanyId: number): Promise<boolean> {
    const [company] = await db
      .select({ id: targetCompanies.id })
      .from(targetCompanies)
      .where(and(eq(targetCompanies.id, targetCompanyId), eq(targetCompanies.userCompanyId, userCompanyId)));
    return !!company;
  }

  async getUserCompanyId(userId: number): Promise<number | undefined> {
    const [user] = await db
      .select({ userCompanyId: users.userCompanyId })
      .from(users)
      .where(eq(users.id, userId));
    return user?.userCompanyId ?? undefined;
  }
}

export const activitiesRepository = new ActivitiesRepository();
