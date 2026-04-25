import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userCompanies,
  userCompanyMemberships,
  userSessions,
  userInvitations,
  userRoles,
  userDealAssignments,
  type User,
  type InsertUser,
  type UserCompany,
  type InsertUserCompany,
  type UserCompanyMembership,
  type InsertUserCompanyMembership,
  type UserSession,
  type UserInvitation,
  type UserRole,
  type InsertUserInvitation,
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

export interface InvitationWithDetails extends UserInvitation {
  inviterName: string;
  companyName: string;
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

  async createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation> {
    const [newInvitation] = await db
      .insert(userInvitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }

  async getUserInvitationByToken(token: string): Promise<InvitationWithDetails | undefined> {
    const [invitation] = await db
      .select({
        id: userInvitations.id,
        userCompanyId: userInvitations.userCompanyId,
        email: userInvitations.email,
        invitedBy: userInvitations.invitedBy,
        invitationToken: userInvitations.invitationToken,
        invitedRole: userInvitations.invitedRole,
        invitationMessage: userInvitations.invitationMessage,
        firstName: userInvitations.firstName,
        lastName: userInvitations.lastName,
        jobTitle: userInvitations.jobTitle,
        invitationStatus: userInvitations.invitationStatus,
        sentAt: userInvitations.sentAt,
        expiresAt: userInvitations.expiresAt,
        acceptedAt: userInvitations.acceptedAt,
        ipAddressSent: userInvitations.ipAddressSent,
        ipAddressAccepted: userInvitations.ipAddressAccepted,
        createdAt: userInvitations.createdAt,
        inviterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        companyName: userCompanies.companyName,
      })
      .from(userInvitations)
      .innerJoin(users, eq(userInvitations.invitedBy, users.id))
      .innerJoin(userCompanies, eq(userInvitations.userCompanyId, userCompanies.id))
      .where(
        and(
          eq(userInvitations.invitationToken, token),
          eq(userInvitations.invitationStatus, "pending"),
          sql`${userInvitations.expiresAt} > NOW()`
        )
      );
    
    return invitation || undefined;
  }

  async getInvitationsByUserCompany(userCompanyId: number): Promise<InvitationWithDetails[]> {
    return await db
      .select({
        id: userInvitations.id,
        userCompanyId: userInvitations.userCompanyId,
        email: userInvitations.email,
        invitedBy: userInvitations.invitedBy,
        invitationToken: userInvitations.invitationToken,
        invitedRole: userInvitations.invitedRole,
        invitationMessage: userInvitations.invitationMessage,
        firstName: userInvitations.firstName,
        lastName: userInvitations.lastName,
        jobTitle: userInvitations.jobTitle,
        invitationStatus: userInvitations.invitationStatus,
        sentAt: userInvitations.sentAt,
        expiresAt: userInvitations.expiresAt,
        acceptedAt: userInvitations.acceptedAt,
        ipAddressSent: userInvitations.ipAddressSent,
        ipAddressAccepted: userInvitations.ipAddressAccepted,
        createdAt: userInvitations.createdAt,
        inviterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        companyName: userCompanies.companyName,
      })
      .from(userInvitations)
      .innerJoin(users, eq(userInvitations.invitedBy, users.id))
      .innerJoin(userCompanies, eq(userInvitations.userCompanyId, userCompanies.id))
      .where(eq(userInvitations.userCompanyId, userCompanyId))
      .orderBy(desc(userInvitations.createdAt));
  }

  async updateUserInvitation(id: number, invitation: Partial<InsertUserInvitation>): Promise<UserInvitation | undefined> {
    const [updatedInvitation] = await db
      .update(userInvitations)
      .set(invitation)
      .where(eq(userInvitations.id, id))
      .returning();
    return updatedInvitation || undefined;
  }

  async acceptInvitation(token: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    return await db.transaction(async (tx) => {
      const invitation = await tx
        .select({
          id: userInvitations.id,
          userCompanyId: userInvitations.userCompanyId,
          email: userInvitations.email,
          invitedBy: userInvitations.invitedBy,
          invitationToken: userInvitations.invitationToken,
          invitedRole: userInvitations.invitedRole,
          invitationMessage: userInvitations.invitationMessage,
          invitationStatus: userInvitations.invitationStatus,
          sentAt: userInvitations.sentAt,
          expiresAt: userInvitations.expiresAt,
          acceptedAt: userInvitations.acceptedAt,
          ipAddressSent: userInvitations.ipAddressSent,
          ipAddressAccepted: userInvitations.ipAddressAccepted,
          createdAt: userInvitations.createdAt,
          inviterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          companyName: userCompanies.companyName,
        })
        .from(userInvitations)
        .innerJoin(users, eq(userInvitations.invitedBy, users.id))
        .innerJoin(userCompanies, eq(userInvitations.userCompanyId, userCompanies.id))
        .where(and(
          eq(userInvitations.invitationToken, token),
          eq(userInvitations.invitationStatus, 'pending')
        ))
        .limit(1);
      
      if (!invitation.length) {
        return undefined;
      }
      
      const invitationData = invitation[0];

      const existingUsers = await tx
        .select()
        .from(users)
        .where(eq(users.email, invitationData.email));

      let user: User;

      if (existingUsers.length > 0) {
        [user] = await tx
          .update(users)
          .set({
            userCompanyId: invitationData.userCompanyId,
            userRole: invitationData.invitedRole,
            isActive: true,
            emailVerified: true,
            ...userData,
          })
          .where(eq(users.id, existingUsers[0].id))
          .returning();
      } else {
        [user] = await tx
          .insert(users)
          .values({
            ...userData,
            email: invitationData.email,
            userCompanyId: invitationData.userCompanyId,
            userRole: invitationData.invitedRole,
            isActive: true,
          } as InsertUser)
          .returning();
      }

      await tx
        .update(userInvitations)
        .set({
          invitationStatus: "accepted",
          acceptedAt: new Date(),
        })
        .where(eq(userInvitations.invitationToken, token));

      return user;
    });
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
      .where(and(eq(users.userCompanyId, userCompanyId), eq(users.isActive, true)))
      .orderBy(users.createdAt);

    return members.map((member) => ({
      ...member,
      lastLoginFormatted: member.lastLogin 
        ? new Date(member.lastLogin).toLocaleDateString()
        : null,
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
