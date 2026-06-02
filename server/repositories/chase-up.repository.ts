import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { db } from '../db';
import {
  chaseUpEmails, chaseUpSchedules, portalAccessTokens, targetCompanies, targetContacts,
  type ChaseUpEmail, type InsertChaseUpEmail, type ChaseUpSchedule, type InsertChaseUpSchedule,
} from '@shared/schema';

export class ChaseUpRepository {
  async createSchedule(schedule: InsertChaseUpSchedule): Promise<ChaseUpSchedule> {
    const [newSchedule] = await db.insert(chaseUpSchedules).values(schedule).returning();
    return newSchedule;
  }

  async getScheduleById(id: number): Promise<ChaseUpSchedule | undefined> {
    const [schedule] = await db.select().from(chaseUpSchedules).where(eq(chaseUpSchedules.id, id));
    return schedule || undefined;
  }

  async getScheduleByTokenId(portalTokenId: number): Promise<ChaseUpSchedule | undefined> {
    const [schedule] = await db.select().from(chaseUpSchedules)
      .where(eq(chaseUpSchedules.portalTokenId, portalTokenId));
    return schedule || undefined;
  }

  async getActiveSchedules(): Promise<ChaseUpSchedule[]> {
    return await db.select().from(chaseUpSchedules)
      .where(and(eq(chaseUpSchedules.isActive, true), eq(chaseUpSchedules.isCompleted, false)));
  }

  async getOverdueSchedules(): Promise<ChaseUpSchedule[]> {
    return await db.select().from(chaseUpSchedules)
      .where(and(
        eq(chaseUpSchedules.isActive, true),
        eq(chaseUpSchedules.isCompleted, false),
        lte(chaseUpSchedules.submissionDeadline, sql`CURRENT_DATE`)
      ));
  }

  async updateSchedule(id: number, data: Partial<ChaseUpSchedule>): Promise<ChaseUpSchedule | undefined> {
    const [updated] = await db.update(chaseUpSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chaseUpSchedules.id, id))
      .returning();
    return updated || undefined;
  }

  async completeSchedule(id: number, reason: string): Promise<ChaseUpSchedule | undefined> {
    const [updated] = await db.update(chaseUpSchedules)
      .set({ isCompleted: true, completionReason: reason, updatedAt: new Date() })
      .where(eq(chaseUpSchedules.id, id))
      .returning();
    return updated || undefined;
  }

  async deactivateSchedule(id: number): Promise<ChaseUpSchedule | undefined> {
    const [updated] = await db.update(chaseUpSchedules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(chaseUpSchedules.id, id))
      .returning();
    return updated || undefined;
  }

  async createChaseUpEmail(email: InsertChaseUpEmail): Promise<ChaseUpEmail> {
    const [newEmail] = await db.insert(chaseUpEmails).values(email).returning();
    return newEmail;
  }

  async getEmailsByTokenId(portalTokenId: number): Promise<ChaseUpEmail[]> {
    return await db.select().from(chaseUpEmails)
      .where(eq(chaseUpEmails.portalTokenId, portalTokenId))
      .orderBy(desc(chaseUpEmails.createdAt));
  }

  async getEmailBySequence(portalTokenId: number, sequenceNumber: number): Promise<ChaseUpEmail | undefined> {
    const [email] = await db.select().from(chaseUpEmails)
      .where(and(
        eq(chaseUpEmails.portalTokenId, portalTokenId),
        eq(chaseUpEmails.emailSequenceNumber, sequenceNumber)
      ));
    return email || undefined;
  }

  async updateEmail(id: number, data: Partial<ChaseUpEmail>): Promise<ChaseUpEmail | undefined> {
    const [updated] = await db.update(chaseUpEmails)
      .set(data)
      .where(eq(chaseUpEmails.id, id))
      .returning();
    return updated || undefined;
  }

  async updateTokenChaseUpStatus(tokenId: number, status: string, escalationLevel: string): Promise<void> {
    await db.update(portalAccessTokens).set({
      chaseUpStatus: status,
      escalationLevel: escalationLevel,
      lastChaseEmailSent: new Date(),
      chaseEmailCount: sql`${portalAccessTokens.chaseEmailCount} + 1`,
    }).where(eq(portalAccessTokens.id, tokenId));
  }

  // Use this method (not updateTokenChaseUpStatus) when terminating a schedule
  // without sending an email. It sets status and escalation level only, and
  // deliberately does not write lastChaseEmailSent or increment chaseEmailCount.
  async clearTokenChaseStatus(tokenId: number, status: string, escalationLevel: string): Promise<void> {
    await db.update(portalAccessTokens).set({
      chaseUpStatus: status,
      escalationLevel: escalationLevel,
    }).where(eq(portalAccessTokens.id, tokenId));
  }

  async updateTokenDeadline(tokenId: number, deadline: string, finalDeadlineDate?: string, expiresAt?: Date): Promise<void> {
    await db.update(portalAccessTokens).set({
      submissionDeadline: deadline,
      manualDeadlineSet: new Date(),
      ...(finalDeadlineDate !== undefined ? { finalDeadlineDate } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    }).where(eq(portalAccessTokens.id, tokenId));
  }

  async getTokenFinalDeadline(tokenId: number): Promise<string | null> {
    const [row] = await db.select({ finalDeadlineDate: portalAccessTokens.finalDeadlineDate })
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.id, tokenId));
    return row?.finalDeadlineDate ?? null;
  }

  async getChaseUpDashboard(userCompanyId: number): Promise<any[]> {
    return await db.select({
      scheduleId: chaseUpSchedules.id,
      portalTokenId: chaseUpSchedules.portalTokenId,
      targetCompanyId: chaseUpSchedules.targetCompanyId,
      companyName: targetCompanies.companyName,
      contactName: sql<string>`${targetContacts.firstName} || ' ' || ${targetContacts.lastName}`,
      contactEmail: targetContacts.email,
      timeframeDays: chaseUpSchedules.timeframeDays,
      submissionDeadline: chaseUpSchedules.submissionDeadline,
      isActive: chaseUpSchedules.isActive,
      isCompleted: chaseUpSchedules.isCompleted,
      completionReason: chaseUpSchedules.completionReason,
      chaseUpStatus: portalAccessTokens.chaseUpStatus,
      escalationLevel: portalAccessTokens.escalationLevel,
      chaseEmailCount: portalAccessTokens.chaseEmailCount,
      daysOverdue: sql<number>`GREATEST(0, CURRENT_DATE - ${chaseUpSchedules.submissionDeadline})`,
      daysRemaining: sql<number>`GREATEST(0, ${chaseUpSchedules.submissionDeadline} - CURRENT_DATE)`,
    }).from(chaseUpSchedules)
      .innerJoin(portalAccessTokens, eq(chaseUpSchedules.portalTokenId, portalAccessTokens.id))
      .innerJoin(targetCompanies, eq(chaseUpSchedules.targetCompanyId, targetCompanies.id))
      .innerJoin(targetContacts, eq(portalAccessTokens.targetContactId, targetContacts.id))
      .where(eq(portalAccessTokens.userCompanyId, userCompanyId))
      .orderBy(desc(sql`CURRENT_DATE - ${chaseUpSchedules.submissionDeadline}`));
  }

  async getHighPriorityAlerts(userCompanyId: number): Promise<any[]> {
    return await db.select({
      scheduleId: chaseUpSchedules.id,
      portalTokenId: chaseUpSchedules.portalTokenId,
      targetCompanyId: chaseUpSchedules.targetCompanyId,
      companyName: targetCompanies.companyName,
      contactName: sql<string>`${targetContacts.firstName} || ' ' || ${targetContacts.lastName}`,
      submissionDeadline: chaseUpSchedules.submissionDeadline,
      chaseUpStatus: portalAccessTokens.chaseUpStatus,
      escalationLevel: portalAccessTokens.escalationLevel,
      chaseEmailCount: portalAccessTokens.chaseEmailCount,
      daysOverdue: sql<number>`GREATEST(0, CURRENT_DATE - ${chaseUpSchedules.submissionDeadline})`,
    }).from(chaseUpSchedules)
      .innerJoin(portalAccessTokens, eq(chaseUpSchedules.portalTokenId, portalAccessTokens.id))
      .innerJoin(targetCompanies, eq(chaseUpSchedules.targetCompanyId, targetCompanies.id))
      .innerJoin(targetContacts, eq(portalAccessTokens.targetContactId, targetContacts.id))
      .where(and(
        eq(portalAccessTokens.userCompanyId, userCompanyId),
        eq(chaseUpSchedules.isActive, true),
        eq(chaseUpSchedules.isCompleted, false),
        sql`(${portalAccessTokens.escalationLevel} IN ('urgent', 'final', 'manual') OR CURRENT_DATE - ${chaseUpSchedules.submissionDeadline} >= 5)`
      ))
      .orderBy(desc(sql`CURRENT_DATE - ${chaseUpSchedules.submissionDeadline}`));
  }

  async getScheduleWithDetails(scheduleId: number): Promise<any | undefined> {
    const [result] = await db.select({
      schedule: chaseUpSchedules,
      token: portalAccessTokens,
      company: targetCompanies,
      contact: targetContacts,
    }).from(chaseUpSchedules)
      .innerJoin(portalAccessTokens, eq(chaseUpSchedules.portalTokenId, portalAccessTokens.id))
      .innerJoin(targetCompanies, eq(chaseUpSchedules.targetCompanyId, targetCompanies.id))
      .innerJoin(targetContacts, eq(portalAccessTokens.targetContactId, targetContacts.id))
      .where(eq(chaseUpSchedules.id, scheduleId));
    return result;
  }

  async getActiveScheduleForTarget(
    userCompanyId: number,
    targetCompanyId: number,
  ): Promise<{ portalTokenId: number } | null> {
    const [row] = await db
      .select({ portalTokenId: chaseUpSchedules.portalTokenId })
      .from(chaseUpSchedules)
      .innerJoin(portalAccessTokens, eq(chaseUpSchedules.portalTokenId, portalAccessTokens.id))
      .where(
        and(
          eq(portalAccessTokens.userCompanyId, userCompanyId),
          eq(chaseUpSchedules.targetCompanyId, targetCompanyId),
          eq(chaseUpSchedules.isActive, true),
          eq(chaseUpSchedules.isCompleted, false),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}

export const chaseUpRepository = new ChaseUpRepository();
