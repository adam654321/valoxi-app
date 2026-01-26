import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  userDealAssignments,
  users,
  type UserDealAssignment,
  type InsertUserDealAssignment,
} from '@shared/schema';

export interface DealAssignmentWithUser extends UserDealAssignment {
  userName: string;
  userEmail: string;
}

export class AssignmentsRepository {
  async createAssignment(assignment: InsertUserDealAssignment): Promise<UserDealAssignment> {
    const [newAssignment] = await db.insert(userDealAssignments).values(assignment)
      .onConflictDoUpdate({
        target: [userDealAssignments.userId, userDealAssignments.targetCompanyId],
        set: {
          assignmentRole: assignment.assignmentRole, assignedBy: assignment.assignedBy,
          assignmentDate: sql`NOW()`, isActive: true, canEditCompany: assignment.canEditCompany,
          canUploadDocuments: assignment.canUploadDocuments, canCreateActivities: assignment.canCreateActivities,
          canManageContacts: assignment.canManageContacts,
        },
      }).returning();
    return newAssignment;
  }

  async getByDeal(targetCompanyId: number): Promise<DealAssignmentWithUser[]> {
    return await db.select({
      id: userDealAssignments.id, userId: userDealAssignments.userId, targetCompanyId: userDealAssignments.targetCompanyId,
      assignmentRole: userDealAssignments.assignmentRole, canEditCompany: userDealAssignments.canEditCompany,
      canUploadDocuments: userDealAssignments.canUploadDocuments, canManageContacts: userDealAssignments.canManageContacts,
      canCreateActivities: userDealAssignments.canCreateActivities, isActive: userDealAssignments.isActive,
      assignmentDate: userDealAssignments.assignmentDate, createdAt: userDealAssignments.createdAt, assignedBy: userDealAssignments.assignedBy,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, userEmail: users.email,
    }).from(userDealAssignments)
      .innerJoin(users, eq(userDealAssignments.userId, users.id))
      .where(and(eq(userDealAssignments.targetCompanyId, targetCompanyId), eq(userDealAssignments.isActive, true)))
      .orderBy(userDealAssignments.assignmentDate);
  }

  async getByUser(userId: number): Promise<UserDealAssignment[]> {
    return await db.select().from(userDealAssignments)
      .where(and(eq(userDealAssignments.userId, userId), eq(userDealAssignments.isActive, true)))
      .orderBy(userDealAssignments.assignmentDate);
  }

  async remove(userId: number, targetCompanyId: number): Promise<boolean> {
    const [updated] = await db.update(userDealAssignments).set({ isActive: false })
      .where(and(eq(userDealAssignments.userId, userId), eq(userDealAssignments.targetCompanyId, targetCompanyId)))
      .returning();
    return !!updated;
  }

  async update(userId: number, targetCompanyId: number, assignment: Partial<InsertUserDealAssignment>): Promise<UserDealAssignment | undefined> {
    const [updated] = await db.update(userDealAssignments).set(assignment)
      .where(and(eq(userDealAssignments.userId, userId), eq(userDealAssignments.targetCompanyId, targetCompanyId)))
      .returning();
    return updated || undefined;
  }
}

export const assignmentsRepository = new AssignmentsRepository();
