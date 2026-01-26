import { eq, sql, count } from 'drizzle-orm';
import { db } from '../db';
import { targetCompanies, activities, users } from '@shared/schema';

export class ReportsRepository {
  async getPipelineOverview(userCompanyId: number, dateRange?: string) {
    const pipelineDistribution = await db.select({
      stage: targetCompanies.stage,
      count: sql<number>`count(*)::int`,
      percentage: sql<number>`round(count(*) * 100.0 / sum(count(*)) over (), 2)`,
    }).from(targetCompanies).where(eq(targetCompanies.userCompanyId, userCompanyId)).groupBy(targetCompanies.stage);
    const [totalResult] = await db.select({ total: sql<number>`count(*)::int` }).from(targetCompanies).where(eq(targetCompanies.userCompanyId, userCompanyId));
    const stageStats = pipelineDistribution.map(item => ({ stageName: item.stage || 'Unknown', stageOrder: 1, companyCount: item.count, avgDaysInStage: null as number | null }));
    return { stageStats, recentChanges: [], totalCompanies: totalResult?.total || 0 };
  }

  async getActivitySummary(userCompanyId: number, dateRange?: string) {
    const activityByType = await db.select({
      activity_type: activities.activityType, count: sql<number>`count(*)::int`,
      avg_duration: sql<number>`avg(${activities.durationMinutes})`,
      companies_contacted: sql<number>`count(distinct ${activities.targetCompanyId})::int`,
    }).from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId)).groupBy(activities.activityType);
    return { activityByType, activityByUser: [], activityTrends: [] };
  }

  async getPerformanceMetrics(userCompanyId: number, dateRange?: string) {
    const [metrics] = await db.select({
      total_deals: sql<number>`count(*)::int`,
      active_deals: sql<number>`count(case when ${targetCompanies.stage} not in ('Completion', 'Not Qualified') then 1 end)::int`,
      completed_deals: sql<number>`count(case when ${targetCompanies.stage} = 'Completion' then 1 end)::int`,
      success_rate: sql<number>`round(count(case when ${targetCompanies.stage} = 'Completion' then 1 end) * 100.0 / nullif(count(case when ${targetCompanies.stage} in ('Completion', 'Not Qualified') then 1 end), 0), 2)`,
    }).from(targetCompanies).where(eq(targetCompanies.userCompanyId, userCompanyId));
    return metrics || { total_deals: 0, active_deals: 0, completed_deals: 0, success_rate: 0 };
  }

  async getStageAnalysis(userCompanyId: number, dateRange?: string) {
    return await db.select({
      stage_name: targetCompanies.stage, deal_count: sql<number>`count(*)::int`,
      avg_days: sql<number>`avg(extract(days from (now() - ${targetCompanies.stageUpdatedAt})))`,
      risk_level: sql<string>`case when avg(extract(days from (now() - ${targetCompanies.stageUpdatedAt}))) > 30 then 'high' when avg(extract(days from (now() - ${targetCompanies.stageUpdatedAt}))) > 14 then 'medium' else 'low' end`,
    }).from(targetCompanies).where(eq(targetCompanies.userCompanyId, userCompanyId)).groupBy(targetCompanies.stage);
  }

  async getUserPerformance(userCompanyId: number, dateRange?: string) {
    return await db.select({
      user_name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      active_deals: sql<number>`count(distinct case when ${targetCompanies.stage} not in ('Completion', 'Not Qualified') then ${targetCompanies.id} end)::int`,
      total_activities: sql<number>`count(${activities.id})::int`,
      success_rate: sql<number>`round(count(case when ${targetCompanies.stage} = 'Completion' then 1 end) * 100.0 / nullif(count(case when ${targetCompanies.stage} in ('Completion', 'Not Qualified') then 1 end), 0), 2)`,
    }).from(users).leftJoin(activities, eq(users.id, activities.userId))
      .leftJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(eq(users.userCompanyId, userCompanyId)).groupBy(users.id, users.firstName, users.lastName);
  }
}

export const reportsRepository = new ReportsRepository();
