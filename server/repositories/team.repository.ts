import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userInvitations,
  userCompanies,
  userRoles,
  userDealAssignments,
  type User,
  type InsertUser,
  type UserInvitation,
  type InsertUserInvitation,
  type UserRole,
} from '@shared/schema';

export interface InvitationWithDetails extends UserInvitation {
  inviterName: string;
  companyName: string;
}

export interface TeamMember extends User {
  roleDescription: string;
  assignedDealsCount: number;
  currentCompanyId: number | null;
  lastLoginFormatted: string | null;
}

export class TeamRepository {
  async createInvitation(invitation: InsertUserInvitation): Promise<UserInvitation> {
    const [newInvitation] = await db.insert(userInvitations).values(invitation).returning();
    return newInvitation;
  }

  async getInvitationByToken(token: string): Promise<InvitationWithDetails | undefined> {
    const [invitation] = await db.select({
      id: userInvitations.id, userCompanyId: userInvitations.userCompanyId, email: userInvitations.email,
      invitedBy: userInvitations.invitedBy, invitationToken: userInvitations.invitationToken,
      invitedRole: userInvitations.invitedRole, invitationMessage: userInvitations.invitationMessage,
      invitationStatus: userInvitations.invitationStatus, sentAt: userInvitations.sentAt,
      expiresAt: userInvitations.expiresAt, acceptedAt: userInvitations.acceptedAt,
      ipAddressSent: userInvitations.ipAddressSent, ipAddressAccepted: userInvitations.ipAddressAccepted,
      createdAt: userInvitations.createdAt,
      inviterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      companyName: userCompanies.companyName,
    }).from(userInvitations)
      .innerJoin(users, eq(userInvitations.invitedBy, users.id))
      .innerJoin(userCompanies, eq(userInvitations.userCompanyId, userCompanies.id))
      .where(and(eq(userInvitations.invitationToken, token), eq(userInvitations.invitationStatus, 'pending'), sql`${userInvitations.expiresAt} > NOW()`));
    return invitation || undefined;
  }

  async getInvitationsByCompany(userCompanyId: number): Promise<InvitationWithDetails[]> {
    return await db.select({
      id: userInvitations.id, userCompanyId: userInvitations.userCompanyId, email: userInvitations.email,
      invitedBy: userInvitations.invitedBy, invitationToken: userInvitations.invitationToken,
      invitedRole: userInvitations.invitedRole, invitationMessage: userInvitations.invitationMessage,
      invitationStatus: userInvitations.invitationStatus, sentAt: userInvitations.sentAt,
      expiresAt: userInvitations.expiresAt, acceptedAt: userInvitations.acceptedAt,
      ipAddressSent: userInvitations.ipAddressSent, ipAddressAccepted: userInvitations.ipAddressAccepted,
      createdAt: userInvitations.createdAt,
      inviterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      companyName: userCompanies.companyName,
    }).from(userInvitations)
      .innerJoin(users, eq(userInvitations.invitedBy, users.id))
      .innerJoin(userCompanies, eq(userInvitations.userCompanyId, userCompanies.id))
      .where(eq(userInvitations.userCompanyId, userCompanyId))
      .orderBy(desc(userInvitations.createdAt));
  }

  async updateInvitation(id: number, invitation: Partial<InsertUserInvitation>): Promise<UserInvitation | undefined> {
    const [updated] = await db.update(userInvitations).set(invitation).where(eq(userInvitations.id, id)).returning();
    return updated || undefined;
  }

  async getTeamMembers(userCompanyId: number): Promise<TeamMember[]> {
    const members = await db.select({
      id: users.id, email: users.email, passwordHash: users.passwordHash, firstName: users.firstName, lastName: users.lastName,
      userCompanyId: users.userCompanyId, role: users.role, userRole: users.userRole, isCompanyAdmin: users.isCompanyAdmin,
      lastLogin: users.lastLogin, isActive: users.isActive, emailVerified: users.emailVerified, createdAt: users.createdAt,
      currentCompanyId: users.currentCompanyId,
      roleDescription: sql<string>`COALESCE(${userRoles.roleDescription}, 'No role assigned')`,
      assignedDealsCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${userDealAssignments} WHERE ${userDealAssignments.userId} = ${users.id} AND ${userDealAssignments.isActive} = true), 0)`,
    }).from(users)
      .leftJoin(userRoles, eq(users.userRole, userRoles.roleName))
      .where(and(eq(users.userCompanyId, userCompanyId), eq(users.isActive, true)))
      .orderBy(users.createdAt);
    return members.map((m) => ({ ...m, lastLoginFormatted: m.lastLogin ? new Date(m.lastLogin).toLocaleDateString() : null }));
  }

  async updateUserRole(userId: number, role: string, userCompanyId: number): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ userRole: role }).where(and(eq(users.id, userId), eq(users.userCompanyId, userCompanyId))).returning();
    return updated || undefined;
  }

  async deactivateUser(userId: number, userCompanyId: number): Promise<boolean> {
    const [updated] = await db.update(users).set({ isActive: false }).where(and(eq(users.id, userId), eq(users.userCompanyId, userCompanyId))).returning();
    return !!updated;
  }

  async getRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles).orderBy(userRoles.roleName);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserCompany(id: number): Promise<{ id: number; companyName: string } | undefined> {
    const [company] = await db.select({ id: userCompanies.id, companyName: userCompanies.companyName }).from(userCompanies).where(eq(userCompanies.id, id));
    return company || undefined;
  }

  async acceptInvitation(token: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    return await db.transaction(async (tx) => {
      const invitation = await tx.select({
        id: userInvitations.id, userCompanyId: userInvitations.userCompanyId, email: userInvitations.email,
        invitedRole: userInvitations.invitedRole, invitationStatus: userInvitations.invitationStatus,
      }).from(userInvitations).where(and(eq(userInvitations.invitationToken, token), eq(userInvitations.invitationStatus, 'pending'))).limit(1);
      if (!invitation.length) return undefined;
      const invData = invitation[0];
      const existing = await tx.select().from(users).where(eq(users.email, invData.email));
      let user: User;
      if (existing.length > 0) {
        [user] = await tx.update(users).set({ userCompanyId: invData.userCompanyId, userRole: invData.invitedRole, isActive: true, emailVerified: true, ...userData }).where(eq(users.id, existing[0].id)).returning();
      } else {
        [user] = await tx.insert(users).values({ ...userData, email: invData.email, userCompanyId: invData.userCompanyId, userRole: invData.invitedRole, isActive: true } as InsertUser).returning();
      }
      await tx.update(userInvitations).set({ invitationStatus: 'accepted', acceptedAt: new Date() }).where(eq(userInvitations.id, invData.id));
      return user;
    });
  }
}

export const teamRepository = new TeamRepository();
