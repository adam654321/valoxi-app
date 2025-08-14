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
  activityTypes,
  activities,
  dashboardPreferences,
  dashboardAlerts,
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
  type ActivityType,
  type Activity,
  type DashboardPreference,
  type DashboardAlert,
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
  type InsertActivityType,
  type InsertActivity,
  type InsertDashboardPreference,
  type InsertDashboardAlert,
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

// Activity management interfaces
export interface ActivityWithDetails extends Activity {
  userName: string;
  contactName: string | null;
  contactTitle: string | null;
  typeDescription: string | null;
  companyName: string;
}

export interface ActivityTimeline {
  [date: string]: ActivityWithDetails[];
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
  getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompanyWithStats[]>;
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

  // Activity operations
  getActivityTypes(): Promise<ActivityType[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivitiesForCompany(targetCompanyId: number, userCompanyId: number): Promise<ActivityWithDetails[]>;
  getActivityTimeline(targetCompanyId: number, userCompanyId: number): Promise<ActivityTimeline>;
  updateActivity(activityId: number, activity: Partial<InsertActivity>, userCompanyId: number): Promise<Activity | undefined>;
  deleteActivity(activityId: number, userCompanyId: number): Promise<boolean>;
  getRecentActivities(userCompanyId: number, limit?: number): Promise<ActivityWithDetails[]>;
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

  async getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompanyWithStats[]> {
    return await db
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
        totalContacts: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${targetContacts} 
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
        ), 0)`,
        contactCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${targetContacts} 
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
        ), 0)`,
        primaryContactName: sql<string | null>`(
          SELECT ${targetContacts.firstName} || ' ' || ${targetContacts.lastName}
          FROM ${targetContacts}
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
            AND ${targetContacts.isPrimary} = true
          LIMIT 1
        )`
      })
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



  // Activity management methods
  async getActivityTypes(): Promise<ActivityType[]> {
    return await db
      .select()
      .from(activityTypes)
      .where(eq(activityTypes.isActive, true))
      .orderBy(activityTypes.typeName);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    // Verify user has access to target company
    const [targetCompany] = await db
      .select()
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.id, activity.targetCompanyId),
          eq(targetCompanies.userCompanyId, 
            (await db.select({ userCompanyId: users.userCompanyId })
              .from(users)
              .where(eq(users.id, activity.userId)))[0]?.userCompanyId || 0
          )
        )
      );

    if (!targetCompany) {
      throw new Error('Target company not found or access denied');
    }

    const [newActivity] = await db
      .insert(activities)
      .values({
        ...activity,
        activityDate: new Date(activity.activityDate),
        followUpDate: activity.followUpDate ? new Date(activity.followUpDate) : null,
      })
      .returning();

    return newActivity;
  }

  async getActivitiesForCompany(targetCompanyId: number, userCompanyId: number): Promise<ActivityWithDetails[]> {
    return await db
      .select({
        id: activities.id,
        targetCompanyId: activities.targetCompanyId,
        userId: activities.userId,
        activityType: activities.activityType,
        title: activities.title,
        description: activities.description,
        activityDate: activities.activityDate,
        activityTime: activities.activityTime,
        durationMinutes: activities.durationMinutes,
        contactId: activities.contactId,
        isCompleted: activities.isCompleted,
        followUpDate: activities.followUpDate,
        createdAt: activities.createdAt,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        contactName: sql<string | null>`CASE WHEN ${targetContacts.id} IS NOT NULL THEN ${targetContacts.firstName} || ' ' || ${targetContacts.lastName} ELSE NULL END`,
        contactTitle: targetContacts.title,
        typeDescription: activityTypes.description,
        companyName: targetCompanies.companyName,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .leftJoin(targetContacts, eq(activities.contactId, targetContacts.id))
      .leftJoin(activityTypes, eq(activities.activityType, activityTypes.typeName))
      .where(
        and(
          eq(activities.targetCompanyId, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .orderBy(desc(activities.activityDate), desc(activities.createdAt));
  }

  async getActivityTimeline(targetCompanyId: number, userCompanyId: number): Promise<ActivityTimeline> {
    const activitiesData = await this.getActivitiesForCompany(targetCompanyId, userCompanyId);
    
    const timeline: ActivityTimeline = {};
    activitiesData.forEach(activity => {
      const dateKey = activity.activityDate.toISOString().split('T')[0];
      if (!timeline[dateKey]) {
        timeline[dateKey] = [];
      }
      timeline[dateKey].push(activity);
    });

    return timeline;
  }

  async updateActivity(activityId: number, activity: Partial<InsertActivity>, userCompanyId: number): Promise<Activity | undefined> {
    // Verify user has access to this activity
    const [existingActivity] = await db
      .select()
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(activities.id, activityId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!existingActivity) {
      return undefined;
    }

    const updateData: any = { ...activity };
    if (activity.activityDate) {
      updateData.activityDate = new Date(activity.activityDate);
    }
    if (activity.followUpDate) {
      updateData.followUpDate = new Date(activity.followUpDate);
    }

    const [updatedActivity] = await db
      .update(activities)
      .set(updateData)
      .where(eq(activities.id, activityId))
      .returning();

    return updatedActivity;
  }

  async deleteActivity(activityId: number, userCompanyId: number): Promise<boolean> {
    // Verify user has access to this activity
    const [existingActivity] = await db
      .select()
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(activities.id, activityId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!existingActivity) {
      return false;
    }

    await db.delete(activities).where(eq(activities.id, activityId));
    return true;
  }

  async getRecentActivities(userCompanyId: number, limit: number = 20): Promise<ActivityWithDetails[]> {
    return await db
      .select({
        id: activities.id,
        targetCompanyId: activities.targetCompanyId,
        userId: activities.userId,
        activityType: activities.activityType,
        title: activities.title,
        description: activities.description,
        activityDate: activities.activityDate,
        activityTime: activities.activityTime,
        durationMinutes: activities.durationMinutes,
        contactId: activities.contactId,
        isCompleted: activities.isCompleted,
        followUpDate: activities.followUpDate,
        createdAt: activities.createdAt,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        contactName: sql<string | null>`CASE WHEN ${targetContacts.id} IS NOT NULL THEN ${targetContacts.firstName} || ' ' || ${targetContacts.lastName} ELSE NULL END`,
        contactTitle: targetContacts.title,
        typeDescription: activityTypes.description,
        companyName: targetCompanies.companyName,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .leftJoin(targetContacts, eq(activities.contactId, targetContacts.id))
      .leftJoin(activityTypes, eq(activities.activityType, activityTypes.typeName))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(activities.activityDate), desc(activities.createdAt))
      .limit(limit);
  }

  // ========================
  // Simple Reporting Methods
  // ========================

  async getPipelineOverview(userCompanyId: number, dateRange?: string) {
    // Get basic pipeline distribution
    const pipelineDistribution = await db
      .select({
        stage: targetCompanies.stage,
        count: sql<number>`count(*)::int`,
        percentage: sql<number>`round(count(*) * 100.0 / sum(count(*)) over (), 2)`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .groupBy(targetCompanies.stage);

    return {
      pipelineDistribution,
      stageVelocity: [],
      conversionRates: []
    };
  }

  async getActivitySummary(userCompanyId: number, dateRange?: string) {
    // Get activity by type
    const activityByType = await db
      .select({
        activity_type: activities.activityType,
        count: sql<number>`count(*)::int`,
        avg_duration: sql<number>`avg(${activities.durationMinutes})`,
        companies_contacted: sql<number>`count(distinct ${activities.targetCompanyId})::int`,
      })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .groupBy(activities.activityType);

    return {
      activityByType,
      activityByUser: [],
      activityTrends: []
    };
  }

  async getPerformanceMetrics(userCompanyId: number, dateRange?: string) {
    const metrics = await db
      .select({
        total_deals: sql<number>`count(*)::int`,
        active_deals: sql<number>`count(case when ${targetCompanies.stage} not in ('Completion', 'Not Qualified') then 1 end)::int`,
        completed_deals: sql<number>`count(case when ${targetCompanies.stage} = 'Completion' then 1 end)::int`,
        success_rate: sql<number>`round(count(case when ${targetCompanies.stage} = 'Completion' then 1 end) * 100.0 / nullif(count(case when ${targetCompanies.stage} in ('Completion', 'Not Qualified') then 1 end), 0), 2)`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId));

    return metrics[0] || {
      total_deals: 0,
      active_deals: 0,
      completed_deals: 0,
      success_rate: 0
    };
  }

  async getStageAnalysis(userCompanyId: number, dateRange?: string) {
    return await db
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

  async getUserPerformance(userCompanyId: number, dateRange?: string) {
    return await db
      .select({
        user_name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        active_deals: sql<number>`count(distinct case when ${targetCompanies.stage} not in ('Completion', 'Not Qualified') then ${targetCompanies.id} end)::int`,
        total_activities: sql<number>`count(${activities.id})::int`,
        success_rate: sql<number>`round(count(case when ${targetCompanies.stage} = 'Completion' then 1 end) * 100.0 / nullif(count(case when ${targetCompanies.stage} in ('Completion', 'Not Qualified') then 1 end), 0), 2)`,
      })
      .from(users)
      .leftJoin(activities, eq(users.id, activities.userId))
      .leftJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(eq(users.userCompanyId, userCompanyId))
      .groupBy(users.id, users.firstName, users.lastName);
  }

  async exportReport(userCompanyId: number, reportType: string, format: string = 'csv'): Promise<string> {
    let data: any[] = [];
    let headers: string[] = [];

    switch (reportType) {
      case 'pipeline-overview':
        const pipelineData = await this.getPipelineOverview(userCompanyId);
        data = pipelineData.pipelineDistribution;
        headers = ['stage', 'count', 'percentage'];
        break;
      case 'activity-summary':
        const activityData = await this.getActivitySummary(userCompanyId);
        data = activityData.activityByType;
        headers = ['activity_type', 'count', 'avg_duration', 'companies_contacted'];
        break;
      default:
        throw new Error('Invalid report type');
    }

    // Convert to CSV format
    let csv = headers.join(',') + '\n';
    data.forEach((row: any) => {
      const values = headers.map(header => `"${row[header] || ''}"`);
      csv += values.join(',') + '\n';
    });

    return csv;
  }

  // Dashboard widget methods
  async getPipelineOverviewWidget(userCompanyId: number): Promise<any> {
    const stagesData = await db
      .select({
        stage: targetCompanies.stage,
        count: count(),
        avgDays: sql<number>`AVG(EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})))::int`,
      })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified')`
      ))
      .groupBy(targetCompanies.stage);

    const totalActive = stagesData.reduce((sum, stage) => sum + stage.count, 0);
    
    return {
      stages: stagesData.map(stage => ({
        stage: stage.stage,
        count: stage.count,
        avg_days: stage.avgDays || 0,
      })),
      totalActive,
      lastUpdated: new Date(),
    };
  }

  async getRecentActivitiesWidget(userCompanyId: number): Promise<any> {
    const activitiesData = await db
      .select({
        id: activities.id,
        title: activities.title,
        activityType: activities.activityType,
        activityDate: activities.activityDate,
        createdAt: activities.createdAt,
        companyName: targetCompanies.companyName,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        contactName: sql<string>`COALESCE(${targetContacts.firstName} || ' ' || ${targetContacts.lastName}, '')`,
      })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .innerJoin(users, eq(activities.userId, users.id))
      .leftJoin(targetContacts, eq(activities.contactId, targetContacts.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(activities.createdAt))
      .limit(10);

    return {
      activities: activitiesData,
      lastUpdated: new Date(),
    };
  }

  async getHotDealsWidget(userCompanyId: number): Promise<any> {
    const hotDealsData = await db
      .select({
        id: targetCompanies.id,
        companyName: targetCompanies.companyName,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        daysInStage: sql<number>`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt}))::int`,
        recentActivityCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${activities} 
          WHERE ${activities.targetCompanyId} = ${targetCompanies.id} 
          AND ${activities.activityDate} >= CURRENT_DATE - INTERVAL '7 days'
        ), 0)`,
        lastActivityDate: sql<Date | null>`(
          SELECT MAX(${activities.activityDate}) 
          FROM ${activities} 
          WHERE ${activities.targetCompanyId} = ${targetCompanies.id}
        )`,
      })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified')`
      ))
      .having(
        or(
          sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 14`,
          sql`COALESCE((
            SELECT COUNT(*)::int 
            FROM ${activities} 
            WHERE ${activities.targetCompanyId} = ${targetCompanies.id} 
            AND ${activities.activityDate} >= CURRENT_DATE - INTERVAL '7 days'
          ), 0) = 0`,
          sql`${targetCompanies.stage} IN ('Offer Stage', 'Negotiation', 'Due Diligence')`
        )
      )
      .orderBy(
        sql`CASE 
          WHEN ${targetCompanies.stage} IN ('Offer Stage', 'Negotiation') THEN 1
          WHEN EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 30 THEN 2
          ELSE 3
        END`,
        targetCompanies.stageUpdatedAt
      )
      .limit(5);

    return {
      deals: hotDealsData,
      lastUpdated: new Date(),
    };
  }

  async getQuickStatsWidget(userCompanyId: number): Promise<any> {
    const thirtyDaysAgo = sql`CURRENT_DATE - INTERVAL '30 days'`;
    
    const [newDeals] = await db
      .select({ count: count() })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${targetCompanies.createdAt} >= ${thirtyDaysAgo}`
      ));

    const [completedDeals] = await db
      .select({ count: count() })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        eq(targetCompanies.stage, 'Completion'),
        sql`${targetCompanies.stageUpdatedAt} >= ${thirtyDaysAgo}`
      ));

    const [totalActivities] = await db
      .select({ count: count() })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${activities.activityDate} >= ${thirtyDaysAgo}`
      ));

    const [avgDealTime] = await db
      .select({
        avgDays: sql<number>`COALESCE(AVG(EXTRACT(days FROM (${targetCompanies.stageUpdatedAt} - ${targetCompanies.createdAt}))), 0)::int`,
      })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        eq(targetCompanies.stage, 'Completion')
      ));

    return {
      newDeals: newDeals.count,
      completedDeals: completedDeals.count,
      totalActivities: totalActivities.count,
      avgDealTime: avgDealTime.avgDays || 0,
      lastUpdated: new Date(),
    };
  }

  // Dashboard preferences methods
  async getDashboardPreferences(userId: number): Promise<DashboardPreference[]> {
    return await db
      .select()
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.userId, userId))
      .orderBy(dashboardPreferences.widgetPosition);
  }

  async updateDashboardPreferences(userId: number, preferences: InsertDashboardPreference[]): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete existing preferences
      await tx
        .delete(dashboardPreferences)
        .where(eq(dashboardPreferences.userId, userId));

      // Insert new preferences
      if (preferences.length > 0) {
        await tx
          .insert(dashboardPreferences)
          .values(preferences.map(pref => ({ ...pref, userId })));
      }
    });
  }

  // Dashboard alerts methods
  async getDashboardAlerts(userCompanyId: number): Promise<DashboardAlert[]> {
    return await db
      .select()
      .from(dashboardAlerts)
      .where(and(
        eq(dashboardAlerts.userCompanyId, userCompanyId),
        eq(dashboardAlerts.isDismissed, false)
      ))
      .orderBy(desc(dashboardAlerts.createdAt));
  }

  async dismissAlert(alertId: number, userCompanyId: number): Promise<boolean> {
    const [updatedAlert] = await db
      .update(dashboardAlerts)
      .set({ isDismissed: true, dismissedAt: new Date() })
      .where(and(
        eq(dashboardAlerts.id, alertId),
        eq(dashboardAlerts.userCompanyId, userCompanyId)
      ))
      .returning();
    return !!updatedAlert;
  }
}

export const storage = new DatabaseStorage();
