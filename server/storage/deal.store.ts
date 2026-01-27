import { db } from "../db";
import {
  users,
  targetCompanies,
  userDealAssignments,
  pipelineStages,
  stageHistory,
  dealNotes,
  type UserDealAssignment,
  type PipelineStage,
  type StageHistory,
  type TargetCompany,
  type DealNote,
  type InsertUserDealAssignment,
  type InsertDealNote,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

type DbInstance = typeof db;

export class DealStore {
  constructor(private db: DbInstance) {}

  async createDealAssignment(assignment: InsertUserDealAssignment): Promise<UserDealAssignment> {
    const [newAssignment] = await this.db
      .insert(userDealAssignments)
      .values(assignment)
      .onConflictDoUpdate({
        target: [userDealAssignments.userId, userDealAssignments.targetCompanyId],
        set: {
          assignmentRole: assignment.assignmentRole,
          assignedBy: assignment.assignedBy,
          assignmentDate: sql`NOW()`,
          isActive: true,
          canEditCompany: assignment.canEditCompany,
          canUploadDocuments: assignment.canUploadDocuments,
          canCreateActivities: assignment.canCreateActivities,
          canManageContacts: assignment.canManageContacts,
        },
      })
      .returning();
    return newAssignment;
  }

  async getDealAssignments(targetCompanyId: number): Promise<any[]> {
    return await this.db
      .select({
        id: userDealAssignments.id,
        userId: userDealAssignments.userId,
        targetCompanyId: userDealAssignments.targetCompanyId,
        assignmentRole: userDealAssignments.assignmentRole,
        canEditCompany: userDealAssignments.canEditCompany,
        canUploadDocuments: userDealAssignments.canUploadDocuments,
        canManageContacts: userDealAssignments.canManageContacts,
        canCreateActivities: userDealAssignments.canCreateActivities,
        isActive: userDealAssignments.isActive,
        assignmentDate: userDealAssignments.assignmentDate,
        createdAt: userDealAssignments.createdAt,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        userEmail: users.email,
      })
      .from(userDealAssignments)
      .innerJoin(users, eq(userDealAssignments.userId, users.id))
      .where(and(
        eq(userDealAssignments.targetCompanyId, targetCompanyId),
        eq(userDealAssignments.isActive, true)
      ))
      .orderBy(userDealAssignments.assignmentDate);
  }

  async getUserDealAssignments(userId: number): Promise<UserDealAssignment[]> {
    return await this.db
      .select()
      .from(userDealAssignments)
      .where(and(
        eq(userDealAssignments.userId, userId),
        eq(userDealAssignments.isActive, true)
      ))
      .orderBy(userDealAssignments.assignmentDate);
  }

  async removeDealAssignment(userId: number, targetCompanyId: number): Promise<boolean> {
    const [updatedAssignment] = await this.db
      .update(userDealAssignments)
      .set({ isActive: false })
      .where(and(
        eq(userDealAssignments.userId, userId),
        eq(userDealAssignments.targetCompanyId, targetCompanyId)
      ))
      .returning();
    return !!updatedAssignment;
  }

  async updateDealAssignment(
    userId: number,
    targetCompanyId: number,
    assignment: Partial<InsertUserDealAssignment>
  ): Promise<UserDealAssignment | undefined> {
    const [updatedAssignment] = await this.db
      .update(userDealAssignments)
      .set(assignment)
      .where(and(
        eq(userDealAssignments.userId, userId),
        eq(userDealAssignments.targetCompanyId, targetCompanyId)
      ))
      .returning();
    return updatedAssignment || undefined;
  }

  async getPipelineStages(): Promise<PipelineStage[]> {
    return await this.db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.isActive, true))
      .orderBy(pipelineStages.stageOrder);
  }

  async updateCompanyStage(
    companyId: number,
    newStage: string,
    userId: number,
    notes: string = ''
  ): Promise<{ success: boolean; message: string; oldStage?: string; newStage?: string }> {
    try {
      const [company] = await this.db
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

      await this.db.transaction(async (tx) => {
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

  async updateInitialDiscussion(
    companyId: number,
    completed: boolean,
    notes: string | null,
    userId: number
  ): Promise<TargetCompany | undefined> {
    const [updated] = await this.db
      .update(targetCompanies)
      .set({
        initialDiscussionCompleted: completed,
        initialDiscussionNotes: notes,
        initialDiscussionDate: completed ? new Date() : null,
        initialDiscussionBy: completed ? userId : null,
      })
      .where(eq(targetCompanies.id, companyId))
      .returning();
    return updated;
  }

  async getStageHistory(targetCompanyId: number): Promise<StageHistory[]> {
    return await this.db
      .select()
      .from(stageHistory)
      .where(eq(stageHistory.targetCompanyId, targetCompanyId))
      .orderBy(desc(stageHistory.changedAt));
  }

  async getPipelineOverview(userCompanyId: number, dateRange?: string) {
    const pipelineDistribution = await this.db
      .select({
        stage: targetCompanies.stage,
        count: sql<number>`count(*)::int`,
        percentage: sql<number>`round(count(*) * 100.0 / sum(count(*)) over (), 2)`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .groupBy(targetCompanies.stage);

    const [totalResult] = await this.db
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

  async getStageAnalysis(userCompanyId: number, dateRange?: string) {
    return await this.db
      .select({
        stage_name: targetCompanies.stage,
        deal_count: sql<number>`count(*)::int`,
        avg_days: sql<number>`avg(extract(days from (now() - ${targetCompanies.stageUpdatedAt})))`,
        risk_level: sql<string>`case 
          when avg(extract(days from (now() - ${targetCompanies.stageUpdatedAt}))) > 30 then 'high'
          when avg(extract(days from (now() - ${targetCompanies.stageUpdatedAt}))) > 14 then 'medium'
          else 'low'
        end`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .groupBy(targetCompanies.stage);
  }

  async getDealNotes(targetCompanyId: number): Promise<DealNote[]> {
    return await this.db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.targetCompanyId, targetCompanyId))
      .orderBy(desc(dealNotes.createdAt));
  }

  async createDealNote(note: InsertDealNote): Promise<DealNote> {
    const noteData = {
      ...note,
      reminderDate: note.reminderDate ? new Date(note.reminderDate) : null
    };
    const [result] = await this.db
      .insert(dealNotes)
      .values(noteData)
      .returning();
    return result;
  }

  async updateDealNote(noteId: number, note: Partial<InsertDealNote>): Promise<DealNote | undefined> {
    const updateData: Record<string, any> = { ...note, updatedAt: new Date() };
    if (note.reminderDate !== undefined) {
      updateData.reminderDate = note.reminderDate ? new Date(note.reminderDate) : null;
    }
    const [updated] = await this.db
      .update(dealNotes)
      .set(updateData)
      .where(eq(dealNotes.id, noteId))
      .returning();
    return updated || undefined;
  }

  async deleteDealNote(noteId: number): Promise<boolean> {
    const result = await this.db
      .delete(dealNotes)
      .where(eq(dealNotes.id, noteId))
      .returning();
    return result.length > 0;
  }

  async toggleInitialDiscussion(companyId: number, completed: boolean, userId: number): Promise<TargetCompany | undefined> {
    const [updated] = await this.db
      .update(targetCompanies)
      .set({
        initialDiscussionCompleted: completed,
        initialDiscussionDate: completed ? new Date() : null,
        initialDiscussionBy: completed ? userId : null,
      })
      .where(eq(targetCompanies.id, companyId))
      .returning();
    return updated;
  }
}

export const dealStore = new DealStore(db);
