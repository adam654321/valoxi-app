import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userCompanies,
  userCompanyMemberships,
  userSessions,
  userRoles,
  userDealAssignments,
  type User,
  type InsertUser,
  type UserCompany,
  type InsertUserCompany,
  type UserCompanyMembership,
  type InsertUserCompanyMembership,
  type UserSession,
  type UserRole,
} from '@shared/schema';

export interface UserWithRole extends User {
  roleDescription?: string;
  assignedDealsCount?: number;
  permissions?: UserRole;
  userCompanies?: UserCompanyMembership[];
}

export interface TeamMember extends User {
  roleDescription: string;
  assignedDealsCount: number;
  lastLoginFormatted: string | null;
}


export class UsersRepository {
  async getById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async create(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async update(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUserCompany(id: number): Promise<UserCompany | undefined> {
    const [company] = await db.select().from(userCompanies).where(eq(userCompanies.id, id));
    return company || undefined;
  }

  async createUserCompany(insertCompany: InsertUserCompany): Promise<UserCompany> {
    const [company] = await db.insert(userCompanies).values(insertCompany).returning();
    return company;
  }

  async getUserCompanies(userId: number): Promise<UserCompanyMembership[]> {
    return await db
      .select()
      .from(userCompanyMemberships)
      .where(and(eq(userCompanyMemberships.userId, userId), eq(userCompanyMemberships.isActive, true)))
      .orderBy(desc(userCompanyMemberships.joinedAt));
  }

  async createUserCompanyMembership(membership: InsertUserCompanyMembership): Promise<UserCompanyMembership> {
    const [newMembership] = await db.insert(userCompanyMemberships).values(membership).returning();
    return newMembership;
  }

  async updateUserCompanyMembership(id: number, membership: Partial<InsertUserCompanyMembership>): Promise<UserCompanyMembership | undefined> {
    const [updated] = await db
      .update(userCompanyMemberships)
      .set(membership)
      .where(eq(userCompanyMemberships.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUserCompanyMembership(id: number): Promise<boolean> {
    const result = await db
      .update(userCompanyMemberships)
      .set({ isActive: false })
      .where(eq(userCompanyMemberships.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async switchUserActiveCompany(userId: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ currentCompanyId: companyId })
      .where(eq(users.id, userId));
    return (result.rowCount ?? 0) > 0;
  }

  async createSession(userId: number, sessionToken: string, expiresAt: Date): Promise<UserSession> {
    const [session] = await db
      .insert(userSessions)
      .values({ userId, sessionToken, expiresAt })
      .returning();
    return session;
  }

  async getSessionByToken(sessionToken: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionToken, sessionToken));
    return session || undefined;
  }

  async deleteSession(sessionToken: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.sessionToken, sessionToken));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(userSessions).where(
      eq(userSessions.expiresAt, new Date())
    );
  }

  async getUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles).orderBy(userRoles.roleName);
  }

  async getUserRole(roleName: string): Promise<UserRole | undefined> {
    const [role] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.roleName, roleName));
    return role || undefined;
  }

  async getUserWithPermissions(userId: number): Promise<UserWithRole | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        firstName: users.firstName,
        lastName: users.lastName,
        userCompanyId: users.userCompanyId,
        currentCompanyId: users.currentCompanyId,
        role: users.role,
        userRole: users.userRole,
        isCompanyAdmin: users.isCompanyAdmin,
        lastLogin: users.lastLogin,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        roleDescription: userRoles.roleDescription ?? undefined,
        assignedDealsCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${userDealAssignments} 
          WHERE ${userDealAssignments.userId} = ${users.id} 
          AND ${userDealAssignments.isActive} = true
        ), 0)`,
        permissions: {
          id: userRoles.id,
          roleName: userRoles.roleName,
          roleDescription: userRoles.roleDescription,
          canManageUsers: userRoles.canManageUsers,
          canManageCompany: userRoles.canManageCompany,
          canCreateDeals: userRoles.canCreateDeals,
          canEditAllDeals: userRoles.canEditAllDeals,
          canDeleteDeals: userRoles.canDeleteDeals,
          canUploadDocuments: userRoles.canUploadDocuments,
          canCreateOffers: userRoles.canCreateOffers,
          canViewFinancials: userRoles.canViewFinancials,
          canAccessAnalytics: userRoles.canAccessAnalytics,
          canExportData: userRoles.canExportData,
          createdAt: userRoles.createdAt,
        },
      })
      .from(users)
      .leftJoin(userRoles, eq(users.userRole, userRoles.roleName))
      .where(and(eq(users.id, userId), eq(users.isActive, true)));

    return user ? {
      ...user,
      roleDescription: user.roleDescription ?? undefined,
      permissions: user.permissions ?? undefined,
    } as UserWithRole : undefined;
  }

  async getTeamMembers(userCompanyId: number): Promise<TeamMember[]> {
    const members = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        firstName: users.firstName,
        lastName: users.lastName,
        userCompanyId: users.userCompanyId,
        currentCompanyId: users.currentCompanyId,
        role: users.role,
        userRole: users.userRole,
        isCompanyAdmin: users.isCompanyAdmin,
        lastLogin: users.lastLogin,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        isSystemAdmin: users.isSystemAdmin,
        onboardingCompleted: users.onboardingCompleted,
        onboardingStep: users.onboardingStep,
        onboardingCompletedAt: users.onboardingCompletedAt,
        hearAboutUs: users.hearAboutUs,
        jobTitle: users.jobTitle,
        clerkUserId: users.clerkUserId,
        welcomeEmailSentAt: users.welcomeEmailSentAt,
        checklistCompleted: users.checklistCompleted,
        assignedPromoCampaignId: users.assignedPromoCampaignId,
        assignedByAdminId: users.assignedByAdminId,
        assignedAt: users.assignedAt,
        marketingConsent: users.marketingConsent,
        marketingConsentAt: users.marketingConsentAt,
        roleDescription: sql<string>`COALESCE(${userRoles.roleDescription}, 'No role assigned')`,
        assignedDealsCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${userDealAssignments} 
          WHERE ${userDealAssignments.userId} = ${users.id} 
          AND ${userDealAssignments.isActive} = true
        ), 0)`,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.userRole, userRoles.roleName))
      .where(and(
        eq(users.userCompanyId, userCompanyId),
        eq(users.isActive, true),
        sql`(${users.clerkUserId} IS NOT NULL OR ${users.passwordHash} IS NOT NULL)`
      ))
      .orderBy(users.createdAt);

    return members.map((member) => ({
      ...member,
      lastLoginFormatted: member.lastLogin 
        ? new Date(member.lastLogin).toLocaleDateString()
        : null,
      permissions: null,
    }));
  }

  async updateUserRole(userId: number, role: string, userCompanyId: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ userRole: role })
      .where(and(eq(users.id, userId), eq(users.userCompanyId, userCompanyId)))
      .returning();
    return updatedUser || undefined;
  }

  async deactivateUser(userId: number, userCompanyId: number): Promise<boolean> {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive: false })
      .where(and(eq(users.id, userId), eq(users.userCompanyId, userCompanyId)))
      .returning();
    return !!updatedUser;
  }
}

export const usersRepository = new UsersRepository();
