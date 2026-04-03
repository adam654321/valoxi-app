import { eq, and, count, desc, sql, or } from 'drizzle-orm';
import { db } from '../db';
import {
  targetCompanies,
  targetContacts,
  activities,
  users,
  dashboardPreferences,
  dashboardAlerts,
  dealDocuments,
  type DashboardPreference,
  type InsertDashboardPreference,
  type DashboardAlert,
} from '@shared/schema';

export class DashboardRepository {
  async getTargetCompanyCount(userCompanyId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false)));
    return result.count;
  }

  async getTotalContactsCount(userCompanyId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(targetContacts).leftJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id)).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false)));
    return result.count;
  }

  async getTotalDealsCount(userCompanyId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(targetCompanies).where(eq(targetCompanies.userCompanyId, userCompanyId));
    return result.count;
  }

  async getOffersSentCount(userCompanyId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(dealDocuments).where(and(eq(dealDocuments.userCompanyId, userCompanyId), eq(dealDocuments.documentType, 'offer_letter'), sql`${dealDocuments.sentAt} IS NOT NULL`));
    return result.count;
  }

  async getDashboardMetrics(userCompanyId: number): Promise<{ activeDeals: number; totalDealValue: string }> {
    const [activeResult] = await db.select({ count: count() }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`(${targetCompanies.stage} IS NULL OR ${targetCompanies.stage} = '' OR ${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified'))`));
    const [valueResult] = await db.select({ total: sql<string>`COALESCE(SUM(${targetCompanies.annualRevenue}), 0)::text` }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`(${targetCompanies.stage} IS NULL OR ${targetCompanies.stage} = '' OR ${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified'))`, sql`${targetCompanies.annualRevenue} IS NOT NULL`));
    const totalValue = parseFloat(valueResult?.total || '0');
    const formattedValue = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(totalValue);
    return { activeDeals: activeResult.count, totalDealValue: formattedValue };
  }

  async getPreferences(userId: number): Promise<DashboardPreference[]> {
    return await db.select().from(dashboardPreferences).where(eq(dashboardPreferences.userId, userId)).orderBy(dashboardPreferences.widgetPosition);
  }

  async updatePreferences(userId: number, preferences: InsertDashboardPreference[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(dashboardPreferences).where(eq(dashboardPreferences.userId, userId));
      if (preferences.length > 0) await tx.insert(dashboardPreferences).values(preferences.map(pref => ({ ...pref, userId })));
    });
  }

  async getAlerts(userCompanyId: number): Promise<DashboardAlert[]> {
    return await db.select().from(dashboardAlerts).where(and(eq(dashboardAlerts.userCompanyId, userCompanyId), eq(dashboardAlerts.isDismissed, false))).orderBy(desc(dashboardAlerts.createdAt));
  }

  async dismissAlert(alertId: number, userCompanyId: number): Promise<boolean> {
    const [updatedAlert] = await db.update(dashboardAlerts).set({ isDismissed: true, dismissedAt: new Date() }).where(and(eq(dashboardAlerts.id, alertId), eq(dashboardAlerts.userCompanyId, userCompanyId))).returning();
    return !!updatedAlert;
  }

  async getPipelineOverviewWidget(userCompanyId: number): Promise<any> {
    const stagesData = await db.select({ stage: targetCompanies.stage, count: count(), avgDays: sql<number>`AVG(EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})))::int` }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`(${targetCompanies.stage} IS NULL OR ${targetCompanies.stage} = '' OR ${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified'))`)).groupBy(targetCompanies.stage);
    const totalActive = stagesData.reduce((sum, stage) => sum + stage.count, 0);
    const stageMap = new Map<string, { count: number; avgDays: number }>();
    stagesData.forEach(stage => {
      const stageName = stage.stage && stage.stage.trim() !== '' ? stage.stage : 'New Target';
      const existing = stageMap.get(stageName);
      if (existing) {
        const totalCount = existing.count + stage.count;
        const weightedAvg = ((existing.avgDays * existing.count) + ((stage.avgDays || 0) * stage.count)) / totalCount;
        stageMap.set(stageName, { count: totalCount, avgDays: Math.round(weightedAvg) });
      } else {
        stageMap.set(stageName, { count: stage.count, avgDays: stage.avgDays || 0 });
      }
    });
    return { stages: Array.from(stageMap.entries()).map(([stageName, data]) => ({ stage: stageName, count: data.count, avg_days: data.avgDays })), totalActive, lastUpdated: new Date() };
  }

  async getRecentActivitiesWidget(userCompanyId: number): Promise<any> {
    const activitiesData = await db.select({ id: activities.id, title: activities.title, activityType: activities.activityType, activityDate: activities.activityDate, createdAt: activities.createdAt, companyName: targetCompanies.companyName, userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, contactName: sql<string>`COALESCE(${targetContacts.firstName} || ' ' || ${targetContacts.lastName}, '')` }).from(activities).innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id)).innerJoin(users, eq(activities.userId, users.id)).leftJoin(targetContacts, eq(activities.contactId, targetContacts.id)).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false))).orderBy(desc(activities.createdAt)).limit(10);
    return { activities: activitiesData, lastUpdated: new Date() };
  }

  async getHotDealsWidget(userCompanyId: number): Promise<any> {
    const hotDealsData = await db.select({ id: targetCompanies.id, companyName: targetCompanies.companyName, stage: targetCompanies.stage, stageUpdatedAt: targetCompanies.stageUpdatedAt, daysInStage: sql<number>`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt}))::int` }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified')`, or(sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 14`, sql`${targetCompanies.stage} IN ('Offer Stage', 'Heads of Terms', 'Due Diligence')`))).orderBy(sql`CASE WHEN ${targetCompanies.stage} IN ('Offer Stage', 'Heads of Terms') THEN 1 WHEN EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 30 THEN 2 ELSE 3 END`, targetCompanies.stageUpdatedAt).limit(5);
    const dealsWithActivity = await Promise.all(hotDealsData.map(async (deal) => {
      const [activityCount] = await db.select({ count: count() }).from(activities).where(and(eq(activities.targetCompanyId, deal.id), sql`${activities.activityDate} >= CURRENT_DATE - INTERVAL '7 days'`));
      return { ...deal, recentActivityCount: activityCount.count };
    }));
    return { deals: dealsWithActivity, lastUpdated: new Date() };
  }

  async getQuickStatsWidget(userCompanyId: number): Promise<any> {
    const [newDeals] = await db.select({ count: count() }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`${targetCompanies.createdAt} >= CURRENT_DATE - INTERVAL '30 days'`));
    const [closedDeals] = await db.select({ count: count() }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`${targetCompanies.stage} = 'Completion'`, sql`${targetCompanies.stageUpdatedAt} >= CURRENT_DATE - INTERVAL '30 days'`));
    const [activitiesCount] = await db.select({ count: count() }).from(activities).innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id)).where(and(eq(targetCompanies.userCompanyId, userCompanyId), sql`${activities.createdAt} >= CURRENT_DATE - INTERVAL '30 days'`));
    return { newDealsThisMonth: newDeals.count, closedDealsThisMonth: closedDeals.count, activitiesThisMonth: activitiesCount.count, lastUpdated: new Date() };
  }

  async getUpcomingRemindersWidget(userId: number): Promise<any> {
    const upcomingData = await db.select({ id: activities.id, title: activities.title, activityType: activities.activityType, activityDate: activities.activityDate, companyName: targetCompanies.companyName, description: activities.description }).from(activities).innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id)).where(and(eq(activities.userId, userId), sql`${activities.activityDate} >= CURRENT_DATE`, sql`${activities.activityDate} <= CURRENT_DATE + INTERVAL '7 days'`)).orderBy(activities.activityDate).limit(10);
    return { reminders: upcomingData, lastUpdated: new Date() };
  }

  async getTeamActivityWidget(userCompanyId: number): Promise<any> {
    const teamActivityData = await db.select({ id: activities.id, title: activities.title, activityType: activities.activityType, activityDate: activities.activityDate, createdAt: activities.createdAt, companyName: targetCompanies.companyName, userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(activities).innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id)).innerJoin(users, eq(activities.userId, users.id)).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`${activities.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`)).orderBy(desc(activities.createdAt)).limit(15);
    const activityByUser = teamActivityData.reduce((acc: any, activity) => {
      const userName = activity.userName;
      if (!acc[userName]) acc[userName] = { userName, activities: [], count: 0 };
      acc[userName].activities.push(activity);
      acc[userName].count++;
      return acc;
    }, {});
    return { teamActivity: Object.values(activityByUser), recentActivities: teamActivityData.slice(0, 10), lastUpdated: new Date() };
  }

  async getStageAlertsWidget(userCompanyId: number): Promise<any> {
    const stageAlertsData = await db.select({ id: targetCompanies.id, companyName: targetCompanies.companyName, stage: targetCompanies.stage, stageUpdatedAt: targetCompanies.stageUpdatedAt, daysInStage: sql<number>`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt}))::int` }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false), sql`${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified')`, sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 21`)).orderBy(sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) DESC`).limit(10);
    return { stageAlerts: stageAlertsData.map((alert) => ({ ...alert, alertType: alert.daysInStage > 45 ? 'critical' : alert.daysInStage > 30 ? 'warning' : 'info', message: `Deal has been in ${alert.stage} for ${alert.daysInStage} days` })), lastUpdated: new Date() };
  }
}

export const dashboardRepository = new DashboardRepository();
