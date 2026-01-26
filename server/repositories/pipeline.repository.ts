import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  pipelineStages,
  stageHistory,
  targetCompanies,
  type PipelineStage,
  type StageHistory,
} from '@shared/schema';

export interface PipelineOverviewResult {
  stageStats: Array<{
    stageName: string;
    stageOrder: number;
    companyCount: number;
    avgDaysInStage: number | null;
  }>;
  recentChanges: Array<StageHistory & {
    companyName: string;
    changedByName: string;
  }>;
  totalCompanies: number;
}

export interface StageUpdateResult {
  success: boolean;
  message: string;
  oldStage?: string;
  newStage?: string;
}

export class PipelineRepository {
  async getPipelineStages(): Promise<PipelineStage[]> {
    return await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.isActive, true))
      .orderBy(pipelineStages.stageOrder);
  }

  async getStageHistory(targetCompanyId: number): Promise<StageHistory[]> {
    return await db
      .select()
      .from(stageHistory)
      .where(eq(stageHistory.targetCompanyId, targetCompanyId))
      .orderBy(desc(stageHistory.changedAt));
  }

  async getCompanyCurrentStage(companyId: number): Promise<string | null> {
    const [company] = await db
      .select({ stage: targetCompanies.stage })
      .from(targetCompanies)
      .where(eq(targetCompanies.id, companyId));

    return company?.stage || null;
  }

  async updateCompanyStage(
    companyId: number,
    newStage: string,
    userId: number,
    notes: string = ''
  ): Promise<StageUpdateResult> {
    try {
      const [company] = await db
        .select({ stage: targetCompanies.stage })
        .from(targetCompanies)
        .where(eq(targetCompanies.id, companyId));

      if (!company) {
        return { success: false, message: 'Company not found' };
      }

      const oldStage = company.stage || 'New Target';

      if (oldStage === newStage) {
        return { success: true, message: 'Stage unchanged' };
      }

      await db.transaction(async (tx) => {
        await tx
          .update(targetCompanies)
          .set({
            stage: newStage,
            stageUpdatedAt: new Date(),
            stageUpdatedBy: userId,
          })
          .where(eq(targetCompanies.id, companyId));

        await tx
          .insert(stageHistory)
          .values({
            targetCompanyId: companyId,
            fromStage: oldStage,
            toStage: newStage,
            changedBy: userId,
            notes: notes,
          });
      });

      return {
        success: true,
        message: `Stage updated from "${oldStage}" to "${newStage}"`,
        oldStage,
        newStage,
      };
    } catch (error) {
      console.error('Error updating company stage:', error);
      return { success: false, message: 'Failed to update stage' };
    }
  }

  async getPipelineOverview(userCompanyId: number): Promise<PipelineOverviewResult> {
    const pipelineDistribution = await db
      .select({
        stage: targetCompanies.stage,
        count: sql<number>`count(*)::int`,
        percentage: sql<number>`round(count(*) * 100.0 / sum(count(*)) over (), 2)`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .groupBy(targetCompanies.stage);

    const [totalResult] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId));

    const stageStats = pipelineDistribution.map(item => ({
      stageName: item.stage || 'Unknown',
      stageOrder: 1,
      companyCount: item.count,
      avgDaysInStage: null as number | null
    }));

    return {
      stageStats,
      recentChanges: [],
      totalCompanies: totalResult?.total || 0
    };
  }
}

export const pipelineRepository = new PipelineRepository();
