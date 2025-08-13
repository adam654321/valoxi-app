import {
  users,
  userCompanies,
  targetCompanies,
  targetContacts,
  userSessions,
  userInvitations,
  userRoles,
  userDealAssignments,
  teamNotifications,
  pipelineStages,
  stageHistory,
  type User,
  type UserCompany,
  type TargetCompany,
  type TargetContact,
  type UserSession,
  type UserInvitation,
  type UserRole,
  type UserDealAssignment,
  type TeamNotification,
  type PipelineStage,
  type StageHistory,
  type InsertUser,
  type InsertUserCompany,
  type InsertTargetCompany,
  type InsertTargetContact,
  type InsertUserInvitation,
  type InsertUserRole,
  type InsertUserDealAssignment,
  type InsertTeamNotification,
  type InsertPipelineStage,
  type InsertStageHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, desc, asc, sql, or, ilike, gte, lte, isNull } from "drizzle-orm";

// Search and filter types
export interface SearchParams {
  q?: string;
  industry?: string;
  minRevenue?: number;
  maxRevenue?: number;
  minEmployees?: number;
  maxEmployees?: number;
  minYear?: number;
  maxYear?: number;
  sort?: string;
}

export interface TargetCompanyWithStats extends TargetCompany {
  contactCount: number;
  primaryContactName: string | null;
}

export interface FilterOptions {
  industries: string[];
  revenueRange: {
    min: number | null;
    max: number | null;
  };
  employeeRange: {
    min: number | null;
    max: number | null;
  };
  yearRange: {
    min: number | null;
    max: number | null;
  };
}

export interface CompanyProfile extends TargetCompany {
  createdByName: string;
  userCompanyName: string;
  totalContacts: number;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactTitle: string | null;
  yearsInBusiness: number | null;
  revenuePerEmployee: number | null;
  contacts: TargetContact[];
}

// Team management interfaces
export interface UserWithRole extends User {
  roleDescription?: string;
  assignedDealsCount?: number;
  permissions?: UserRole;
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

export interface NotificationWithDetails extends TeamNotification {
  fromUserName: string;
  targetCompanyName: string | null;
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // User company operations
  getUserCompany(id: number): Promise<UserCompany | undefined>;
  createUserCompany(company: InsertUserCompany): Promise<UserCompany>;
  
  // Target company operations
  getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompany[]>;
  searchTargetCompanies(userCompanyId: number, searchParams: SearchParams): Promise<TargetCompanyWithStats[]>;
  getFilterOptions(userCompanyId: number): Promise<FilterOptions>;
  getTargetCompanyCount(userCompanyId: number): Promise<number>;
  getTotalContactsCount(userCompanyId: number): Promise<number>;
  getTargetCompany(id: number, userCompanyId: number): Promise<TargetCompany | undefined>;
  getCompanyProfile(targetCompanyId: number, userCompanyId: number, userId: number): Promise<CompanyProfile | undefined>;
  createTargetCompany(company: InsertTargetCompany): Promise<TargetCompany>;
  updateTargetCompany(id: number, company: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined>;
  deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean>;
  
  // Target contact operations
  getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]>;
  createTargetContact(contact: InsertTargetContact): Promise<TargetContact>;
  updateTargetContact(id: number, contact: Partial<InsertTargetContact>, userCompanyId: number): Promise<TargetContact | undefined>;
  deleteTargetContact(id: number, userCompanyId: number): Promise<boolean>;
  
  // Session operations
  createSession(userId: number, sessionToken: string, expiresAt: Date): Promise<UserSession>;
  getSessionByToken(sessionToken: string): Promise<UserSession | undefined>;
  deleteSession(sessionToken: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  
  // Team invitation operations
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getUserInvitationByToken(token: string): Promise<InvitationWithDetails | undefined>;
  getInvitationsByUserCompany(userCompanyId: number): Promise<InvitationWithDetails[]>;
  updateUserInvitation(id: number, invitation: Partial<InsertUserInvitation>): Promise<UserInvitation | undefined>;
  acceptInvitation(token: string, userData: Partial<InsertUser>): Promise<User | undefined>;
  
  // User role operations
  getUserRoles(): Promise<UserRole[]>;
  getUserRole(roleName: string): Promise<UserRole | undefined>;
  getUserWithPermissions(userId: number): Promise<UserWithRole | undefined>;
  
  // Team management operations
  getTeamMembers(userCompanyId: number): Promise<TeamMember[]>;
  updateUserRole(userId: number, role: string, userCompanyId: number): Promise<User | undefined>;
  deactivateUser(userId: number, userCompanyId: number): Promise<boolean>;
  
  // Deal assignment operations
  createDealAssignment(assignment: InsertUserDealAssignment): Promise<UserDealAssignment>;
  getDealAssignments(targetCompanyId: number): Promise<UserDealAssignment[]>;
  getUserDealAssignments(userId: number): Promise<UserDealAssignment[]>;
  removeDealAssignment(userId: number, targetCompanyId: number): Promise<boolean>;
  updateDealAssignment(userId: number, targetCompanyId: number, assignment: Partial<InsertUserDealAssignment>): Promise<UserDealAssignment | undefined>;
  
  // Team notification operations
  createNotification(notification: InsertTeamNotification): Promise<TeamNotification>;
  getUserNotifications(userId: number): Promise<NotificationWithDetails[]>;
  markNotificationRead(notificationId: number, userId: number): Promise<boolean>;
  markAllNotificationsRead(userId: number): Promise<number>;
  
  // Pipeline stage operations
  getPipelineStages(): Promise<PipelineStage[]>;
  updateCompanyStage(companyId: number, newStage: string, userId: number, notes?: string): Promise<{ success: boolean; message: string; oldStage?: string; newStage?: string }>;
  getStageHistory(targetCompanyId: number): Promise<StageHistory[]>;
  getPipelineOverview(userCompanyId: number): Promise<{
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
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserCompany(id: number): Promise<UserCompany | undefined> {
    const [company] = await db.select().from(userCompanies).where(eq(userCompanies.id, id));
    return company || undefined;
  }

  async createUserCompany(insertCompany: InsertUserCompany): Promise<UserCompany> {
    const [company] = await db
      .insert(userCompanies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompany[]> {
    return await db
      .select()
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(targetCompanies.createdAt));
  }

  async searchTargetCompanies(userCompanyId: number, searchParams: SearchParams): Promise<TargetCompanyWithStats[]> {
    // Build the base query with contact count and primary contact info
    let query = db
      .select({
        id: targetCompanies.id,
        userCompanyId: targetCompanies.userCompanyId,
        companyName: targetCompanies.companyName,
        industry: targetCompanies.industry,
        website: targetCompanies.website,
        phone: targetCompanies.phone,
        email: targetCompanies.email,
        address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue,
        employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished,
        description: targetCompanies.description,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        stageUpdatedBy: targetCompanies.stageUpdatedBy,
        createdBy: targetCompanies.createdBy,
        createdAt: targetCompanies.createdAt,
        contactCount: sql<number>`COALESCE(${sql`(
          SELECT COUNT(*)::int 
          FROM ${targetContacts} 
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
        )`}, 0)`,
        primaryContactName: sql<string | null>`(
          SELECT ${targetContacts.firstName} || ' ' || ${targetContacts.lastName}
          FROM ${targetContacts}
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
            AND ${targetContacts.isPrimary} = true
          LIMIT 1
        )`
      })
      .from(targetCompanies);

    // Build WHERE conditions
    const conditions = [eq(targetCompanies.userCompanyId, userCompanyId)];

    // Add search conditions
    if (searchParams.q) {
      const searchTerm = `%${searchParams.q}%`;
      conditions.push(
        or(
          ilike(targetCompanies.companyName, searchTerm),
          ilike(targetCompanies.industry, searchTerm),
          ilike(targetCompanies.address, searchTerm)
        )!
      );
    }

    if (searchParams.industry && searchParams.industry !== 'all') {
      conditions.push(eq(targetCompanies.industry, searchParams.industry));
    }

    if (searchParams.minRevenue !== undefined) {
      conditions.push(gte(targetCompanies.annualRevenue, searchParams.minRevenue.toString()));
    }

    if (searchParams.maxRevenue !== undefined) {
      conditions.push(lte(targetCompanies.annualRevenue, searchParams.maxRevenue.toString()));
    }

    if (searchParams.minEmployees !== undefined) {
      conditions.push(gte(targetCompanies.employeeCount, searchParams.minEmployees));
    }

    if (searchParams.maxEmployees !== undefined) {
      conditions.push(lte(targetCompanies.employeeCount, searchParams.maxEmployees));
    }

    if (searchParams.minYear !== undefined) {
      conditions.push(gte(targetCompanies.yearEstablished, searchParams.minYear));
    }

    if (searchParams.maxYear !== undefined) {
      conditions.push(lte(targetCompanies.yearEstablished, searchParams.maxYear));
    }

    // Execute query with conditions
    const finalQuery = query.where(and(...conditions));

    // Add sorting
    const sortBy = searchParams.sort || 'date_newest';
    let sortedQuery;
    
    switch (sortBy) {
      case 'name_asc':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.companyName));
        break;
      case 'name_desc':
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.companyName));
        break;
      case 'date_oldest':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.createdAt));
        break;
      case 'revenue_high':
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.annualRevenue));
        break;
      case 'revenue_low':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.annualRevenue));
        break;
      case 'employees_high':
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.employeeCount));
        break;
      case 'employees_low':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.employeeCount));
        break;
      default: // 'date_newest'
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.createdAt));
        break;
    }

    const results = await sortedQuery.execute();
    return results as TargetCompanyWithStats[];
  }

  async getFilterOptions(userCompanyId: number): Promise<FilterOptions> {
    // Get unique industries
    const industries = await db
      .selectDistinct({ industry: targetCompanies.industry })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.industry} IS NOT NULL`
        )
      )
      .orderBy(targetCompanies.industry);

    // Get revenue range
    const revenueStats = await db
      .select({
        min: sql<number>`MIN(${targetCompanies.annualRevenue}::numeric)`,
        max: sql<number>`MAX(${targetCompanies.annualRevenue}::numeric)`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.annualRevenue} IS NOT NULL`
        )
      );

    // Get employee count range
    const employeeStats = await db
      .select({
        min: sql<number>`MIN(${targetCompanies.employeeCount})`,
        max: sql<number>`MAX(${targetCompanies.employeeCount})`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.employeeCount} IS NOT NULL`
        )
      );

    // Get year established range
    const yearStats = await db
      .select({
        min: sql<number>`MIN(${targetCompanies.yearEstablished})`,
        max: sql<number>`MAX(${targetCompanies.yearEstablished})`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.yearEstablished} IS NOT NULL`
        )
      );

    return {
      industries: industries.map(row => row.industry!).filter(Boolean),
      revenueRange: {
        min: revenueStats[0]?.min || null,
        max: revenueStats[0]?.max || null
      },
      employeeRange: {
        min: employeeStats[0]?.min || null,
        max: employeeStats[0]?.max || null
      },
      yearRange: {
        min: yearStats[0]?.min || null,
        max: yearStats[0]?.max || null
      }
    };
  }

  async getTargetCompanyCount(userCompanyId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    return result.count;
  }

  async getTotalContactsCount(userCompanyId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(targetContacts)
      .leftJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    return result.count;
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

  async getTargetCompany(id: number, userCompanyId: number): Promise<TargetCompany | undefined> {
    const [company] = await db
      .select()
      .from(targetCompanies)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));
    return company || undefined;
  }

  async getCompanyProfile(targetCompanyId: number, userCompanyId: number, userId: number): Promise<CompanyProfile | undefined> {
    // Get comprehensive company data with user and contact information
    const [profileData] = await db
      .select({
        // Company fields
        id: targetCompanies.id,
        userCompanyId: targetCompanies.userCompanyId,
        companyName: targetCompanies.companyName,
        industry: targetCompanies.industry,
        website: targetCompanies.website,
        phone: targetCompanies.phone,
        email: targetCompanies.email,
        address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue,
        employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished,
        description: targetCompanies.description,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        stageUpdatedBy: targetCompanies.stageUpdatedBy,
        createdBy: targetCompanies.createdBy,
        createdAt: targetCompanies.createdAt,
        // Enhanced profile data
        createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        userCompanyName: userCompanies.companyName,
        totalContacts: sql<number>`COALESCE((SELECT COUNT(*) FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}), 0)`,
        primaryContactName: sql<string | null>`(SELECT ${targetContacts.firstName} || ' ' || ${targetContacts.lastName} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
        primaryContactEmail: sql<string | null>`(SELECT ${targetContacts.email} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
        primaryContactPhone: sql<string | null>`(SELECT ${targetContacts.phone} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
        primaryContactTitle: sql<string | null>`(SELECT ${targetContacts.title} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
      })
      .from(targetCompanies)
      .leftJoin(users, eq(targetCompanies.createdBy, users.id))
      .leftJoin(userCompanies, eq(targetCompanies.userCompanyId, userCompanies.id))
      .where(
        and(
          eq(targetCompanies.id, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!profileData) {
      return undefined;
    }

    // Get all contacts for this company
    const contacts = await db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));

    // Calculate additional metrics
    const currentYear = new Date().getFullYear();
    const yearsInBusiness = profileData.yearEstablished ? currentYear - profileData.yearEstablished : null;
    
    const revenuePerEmployee = (profileData.annualRevenue && profileData.employeeCount) 
      ? parseFloat(profileData.annualRevenue) / profileData.employeeCount 
      : null;

    return {
      ...profileData,
      userCompanyName: profileData.userCompanyName || 'Unknown Organization',
      yearsInBusiness,
      revenuePerEmployee,
      contacts,
    };
  }

  async createTargetCompany(insertCompany: InsertTargetCompany): Promise<TargetCompany> {
    // Convert numeric fields to appropriate types
    const processedData = {
      ...insertCompany,
      annualRevenue: typeof insertCompany.annualRevenue === 'number' 
        ? insertCompany.annualRevenue.toString() 
        : insertCompany.annualRevenue
    };
    
    const [company] = await db
      .insert(targetCompanies)
      .values(processedData)
      .returning();
    return company;
  }

  async updateTargetCompany(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined> {
    // Convert numeric fields to appropriate types
    const processedData = {
      ...updateData,
      annualRevenue: typeof updateData.annualRevenue === 'number' 
        ? updateData.annualRevenue.toString() 
        : updateData.annualRevenue
    };
    
    const [company] = await db
      .update(targetCompanies)
      .set(processedData)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)))
      .returning();
    return company || undefined;
  }

  async deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean> {
    const result = await db
      .delete(targetCompanies)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Contact operations
  async getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]> {
    // Verify the target company belongs to the user's company first
    const targetCompany = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!targetCompany) {
      return [];
    }

    return await db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));
  }

  async createTargetContact(insertContact: InsertTargetContact): Promise<TargetContact> {
    // If this contact is marked as primary, unset other primary contacts for this company
    if (insertContact.isPrimary) {
      await db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, insertContact.targetCompanyId));
    }

    const [contact] = await db
      .insert(targetContacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateTargetContact(id: number, updateData: Partial<InsertTargetContact>, userCompanyId: number): Promise<TargetContact | undefined> {
    // First verify access by checking if the contact belongs to a target company owned by the user's company
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    // If setting as primary, unset other primary contacts for this company
    if (updateData.isPrimary) {
      await db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, existingContact.target_contacts.targetCompanyId));
    }

    const [contact] = await db
      .update(targetContacts)
      .set(updateData)
      .where(eq(targetContacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteTargetContact(id: number, userCompanyId: number): Promise<boolean> {
    // First verify access by checking if the contact belongs to a target company owned by the user's company
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return false;
    }

    const result = await db
      .delete(targetContacts)
      .where(eq(targetContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllContactsForUserCompany(userCompanyId: number) {
    const contacts = await db
      .select({
        id: targetContacts.id,
        targetCompanyId: targetContacts.targetCompanyId,
        firstName: targetContacts.firstName,
        lastName: targetContacts.lastName,
        title: targetContacts.title,
        email: targetContacts.email,
        phone: targetContacts.phone,
        isPrimary: targetContacts.isPrimary,
        notes: targetContacts.notes,
        createdAt: targetContacts.createdAt,
        company: {
          id: targetCompanies.id,
          companyName: targetCompanies.companyName,
          industry: targetCompanies.industry,
        },
      })
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(
        sql`${targetContacts.isPrimary} DESC`,
        targetCompanies.companyName,
        targetContacts.lastName
      );

    return contacts;
  }

  // Team invitation operations
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
    // Get invitation details
    const invitation = await this.getUserInvitationByToken(token);
    if (!invitation) {
      return undefined;
    }

    // Create user account
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        email: invitation.email,
        userCompanyId: invitation.userCompanyId,
        userRole: invitation.invitedRole,
        isActive: true,
      } as InsertUser)
      .returning();

    // Update invitation status
    await this.updateUserInvitation(invitation.id, {
      invitationStatus: "accepted",
      acceptedAt: new Date(),
    } as Partial<InsertUserInvitation>);

    return newUser;
  }

  // User role operations
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

  // Team management operations
  async getTeamMembers(userCompanyId: number): Promise<TeamMember[]> {
    const members = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        firstName: users.firstName,
        lastName: users.lastName,
        userCompanyId: users.userCompanyId,
        role: users.role,
        userRole: users.userRole,
        isCompanyAdmin: users.isCompanyAdmin,
        lastLogin: users.lastLogin,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
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

  // Deal assignment operations
  async createDealAssignment(assignment: InsertUserDealAssignment): Promise<UserDealAssignment> {
    const [newAssignment] = await db
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
    return await db
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
    return await db
      .select()
      .from(userDealAssignments)
      .where(and(
        eq(userDealAssignments.userId, userId),
        eq(userDealAssignments.isActive, true)
      ))
      .orderBy(userDealAssignments.assignmentDate);
  }

  async removeDealAssignment(userId: number, targetCompanyId: number): Promise<boolean> {
    const [updatedAssignment] = await db
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
    const [updatedAssignment] = await db
      .update(userDealAssignments)
      .set(assignment)
      .where(and(
        eq(userDealAssignments.userId, userId),
        eq(userDealAssignments.targetCompanyId, targetCompanyId)
      ))
      .returning();
    return updatedAssignment || undefined;
  }

  // Team notification operations
  async createNotification(notification: InsertTeamNotification): Promise<TeamNotification> {
    const [newNotification] = await db
      .insert(teamNotifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: number): Promise<NotificationWithDetails[]> {
    return await db
      .select({
        id: teamNotifications.id,
        userCompanyId: teamNotifications.userCompanyId,
        targetUserId: teamNotifications.targetUserId,
        fromUserId: teamNotifications.fromUserId,
        notificationType: teamNotifications.notificationType,
        notificationTitle: teamNotifications.notificationTitle,
        notificationMessage: teamNotifications.notificationMessage,
        targetCompanyId: teamNotifications.targetCompanyId,
        relatedObjectType: teamNotifications.relatedObjectType,
        relatedObjectId: teamNotifications.relatedObjectId,
        isRead: teamNotifications.isRead,
        readAt: teamNotifications.readAt,
        isEmailSent: teamNotifications.isEmailSent,
        emailSentAt: teamNotifications.emailSentAt,
        createdAt: teamNotifications.createdAt,
        fromUserName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        targetCompanyName: targetCompanies.companyName,
      })
      .from(teamNotifications)
      .innerJoin(users, eq(teamNotifications.fromUserId, users.id))
      .leftJoin(targetCompanies, eq(teamNotifications.targetCompanyId, targetCompanies.id))
      .where(eq(teamNotifications.targetUserId, userId))
      .orderBy(desc(teamNotifications.createdAt));
  }

  async markNotificationRead(notificationId: number, userId: number): Promise<boolean> {
    const [updatedNotification] = await db
      .update(teamNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(teamNotifications.id, notificationId),
        eq(teamNotifications.targetUserId, userId)
      ))
      .returning();
    return !!updatedNotification;
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    const updatedNotifications = await db
      .update(teamNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(teamNotifications.targetUserId, userId),
        eq(teamNotifications.isRead, false)
      ))
      .returning();
    return updatedNotifications.length;
  }

  // Pipeline stage operations
  async getPipelineStages(): Promise<PipelineStage[]> {
    return await db
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
      // Get current company stage
      const [company] = await db
        .select({ stage: targetCompanies.stage })
        .from(targetCompanies)
        .where(eq(targetCompanies.id, companyId));

      if (!company) {
        return { success: false, message: 'Company not found' };
      }

      const oldStage = company.stage || 'New Target';

      // Don't update if stage is the same
      if (oldStage === newStage) {
        return { success: true, message: 'Stage unchanged' };
      }

      // Start transaction
      await db.transaction(async (tx) => {
        // Update company stage
        await tx
          .update(targetCompanies)
          .set({
            stage: newStage,
            stageUpdatedAt: new Date(),
            stageUpdatedBy: userId,
          })
          .where(eq(targetCompanies.id, companyId));

        // Record stage history
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

  async getStageHistory(targetCompanyId: number): Promise<StageHistory[]> {
    return await db
      .select()
      .from(stageHistory)
      .where(eq(stageHistory.targetCompanyId, targetCompanyId))
      .orderBy(desc(stageHistory.changedAt));
  }

  async getPipelineOverview(userCompanyId: number): Promise<{
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
  }> {
    // Get stage statistics
    const stageStats = await db
      .select({
        stageName: pipelineStages.stageName,
        stageOrder: pipelineStages.stageOrder,
        companyCount: sql<number>`COALESCE(COUNT(${targetCompanies.id}), 0)::int`,
        avgDaysInStage: sql<number | null>`AVG(EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})))`,
      })
      .from(pipelineStages)
      .leftJoin(targetCompanies, 
        and(
          eq(pipelineStages.stageName, targetCompanies.stage),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .where(eq(pipelineStages.isActive, true))
      .groupBy(pipelineStages.stageName, pipelineStages.stageOrder)
      .orderBy(pipelineStages.stageOrder);

    // Get recent stage changes
    const recentChanges = await db
      .select({
        id: stageHistory.id,
        targetCompanyId: stageHistory.targetCompanyId,
        fromStage: stageHistory.fromStage,
        toStage: stageHistory.toStage,
        changedBy: stageHistory.changedBy,
        changedAt: stageHistory.changedAt,
        notes: stageHistory.notes,
        createdAt: stageHistory.createdAt,
        companyName: targetCompanies.companyName,
        changedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(stageHistory)
      .innerJoin(targetCompanies, eq(stageHistory.targetCompanyId, targetCompanies.id))
      .innerJoin(users, eq(stageHistory.changedBy, users.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(stageHistory.changedAt))
      .limit(10);

    // Calculate total companies
    const totalCompanies = stageStats.reduce((sum, stage) => sum + stage.companyCount, 0);

    return {
      stageStats,
      recentChanges,
      totalCompanies,
    };
  }
}

export const storage = new DatabaseStorage();
