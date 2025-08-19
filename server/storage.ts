import {
  users,
  userCompanies,
  userCompanyMemberships,
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
  documentCategories,
  documents,
  documentAccessLog,
  fileUploadEvents,
  documentAnalysisResults,
  stage1AnalysisEvents,
  portalAccessTokens,
  externalDocumentSubmissions,
  portalDocumentRequirements,
  portalActivityLog,
  portalLinkCampaigns,
  portalEmailTemplates,
  portalCommunicationsLog,
  portalAnalytics,
  portalLinkShares,
  companyDocumentRequirements,
  documentStageProgression,
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
  type DocumentCategory,
  type Document,
  type DocumentAccessLog,
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
  type InsertDocumentCategory,
  type InsertDocument,
  type InsertDocumentAccessLog,
  type FileUploadEvent,
  type InsertFileUploadEvent,
  type DocumentAnalysisResult,
  type InsertDocumentAnalysisResult,
  type Stage1AnalysisEvent,
  type InsertStage1AnalysisEvent,
  type PortalAccessToken,
  type InsertPortalAccessToken,
  type ExternalDocumentSubmission,
  type InsertExternalDocumentSubmission,
  type PortalDocumentRequirement,
  type InsertPortalDocumentRequirement,
  type PortalActivityLog,
  type InsertPortalActivityLog,
  type PortalLinkCampaign,
  type InsertPortalLinkCampaign,
  type PortalEmailTemplate,
  type InsertPortalEmailTemplate,
  type PortalCommunicationsLog,
  type InsertPortalCommunicationsLog,
  type PortalAnalytics,
  type InsertPortalAnalytics,
  type PortalLinkShare,
  type InsertPortalLinkShare,
  type CompanyDocumentRequirement,
  type InsertCompanyDocumentRequirement,
  type DocumentStageProgression,
  type InsertDocumentStageProgression,
  type UserCompanyMembership,
  type InsertUserCompanyMembership,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, desc, asc, sql, or, ilike, gte, lte, isNull, gt, exists } from "drizzle-orm";

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
  userCompanies?: UserCompanyMembership[]; // For multiple company support
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
  
  // User company membership operations (for multiple companies)
  getUserCompanies(userId: number): Promise<UserCompanyMembership[]>;
  createUserCompanyMembership(membership: InsertUserCompanyMembership): Promise<UserCompanyMembership>;
  updateUserCompanyMembership(id: number, membership: Partial<InsertUserCompanyMembership>): Promise<UserCompanyMembership | undefined>;
  deleteUserCompanyMembership(id: number): Promise<boolean>;
  switchUserActiveCompany(userId: number, companyId: number): Promise<boolean>;
  
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
  updateTargetCompanyWebsiteAnalysis(targetCompanyId: number, analysis: string): Promise<boolean>;
  deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean>;
  
  // Target contact operations
  getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]>;
  getTargetContact(contactId: number, userCompanyId: number): Promise<TargetContact | undefined>;
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

  // Dashboard widget methods
  getPipelineOverviewWidget(userCompanyId: number): Promise<any>;
  getRecentActivitiesWidget(userCompanyId: number): Promise<any>;
  getHotDealsWidget(userCompanyId: number): Promise<any>;
  getQuickStatsWidget(userCompanyId: number): Promise<any>;
  getUpcomingRemindersWidget(userId: number): Promise<any>;
  getTeamActivityWidget(userCompanyId: number): Promise<any>;
  getStageAlertsWidget(userCompanyId: number): Promise<any>;

  // Dashboard preferences and alerts
  getDashboardPreferences(userId: number): Promise<DashboardPreference[]>;
  updateDashboardPreferences(userId: number, preferences: any): Promise<void>;
  getDashboardAlerts(userCompanyId: number): Promise<DashboardAlert[]>;
  dismissAlert(alertId: number, userCompanyId: number): Promise<boolean>;

  // Document operations
  getDocumentCategories(): Promise<DocumentCategory[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  getCompanyDocuments(targetCompanyId: number, userCompanyId: number): Promise<(Document & { uploadedByName: string; categoryDescription?: string })[]>;
  getDocument(documentId: number, userCompanyId: number): Promise<Document | undefined>;
  updateDocument(documentId: number, document: Partial<InsertDocument>, userCompanyId: number): Promise<Document | undefined>;
  deleteDocument(documentId: number, userCompanyId: number): Promise<boolean>;
  logDocumentAccess(documentId: number, userId: number, accessType: string, ipAddress?: string): Promise<void>;

  // External Document Portal operations
  createPortalAccessToken(token: InsertPortalAccessToken): Promise<PortalAccessToken>;
  getPortalAccessToken(accessToken: string): Promise<PortalAccessToken | undefined>;
  validatePortalToken(accessToken: string): Promise<PortalAccessToken | undefined>;
  updatePortalTokenAccess(tokenId: number, ipAddress?: string, userAgent?: string): Promise<void>;
  deactivatePortalToken(tokenId: number): Promise<boolean>;
  
  createExternalDocumentSubmission(submission: InsertExternalDocumentSubmission): Promise<ExternalDocumentSubmission>;
  getPortalSubmissions(portalTokenId: number): Promise<ExternalDocumentSubmission[]>;
  reviewDocumentSubmission(submissionId: number, reviewedBy: number, status: string, notes?: string): Promise<boolean>;
  
  createPortalDocumentRequirement(requirement: InsertPortalDocumentRequirement): Promise<PortalDocumentRequirement>;
  getPortalDocumentRequirements(portalTokenId: number): Promise<PortalDocumentRequirement[]>;
  updatePortalDocumentRequirement(requirementId: number, requirement: Partial<InsertPortalDocumentRequirement>): Promise<PortalDocumentRequirement | undefined>;
  
  logPortalActivity(activity: InsertPortalActivityLog): Promise<void>;
  getPortalActivityLog(portalTokenId: number): Promise<PortalActivityLog[]>;
  
  // Helper methods for email functionality
  getDealTeamEmails(targetCompanyId: number): Promise<string[]>;
  
  // Standardized Document Requirements System methods
  initializeStandardRequirements(targetCompanyId: number, userId: number): Promise<{ stage1Requirements: number; stage2Requirements: number; totalRequirements: number; message: string }>;
  getCompanyDocumentRequirements(targetCompanyId: number, userCompanyId: number, stage?: number | null): Promise<CompanyDocumentRequirement[]>;
  getDocumentStageProgression(targetCompanyId: number, userCompanyId: number): Promise<DocumentStageProgression | undefined>;
  updateCompanyRequirement(requirementId: number, updates: any, userId: number): Promise<CompanyDocumentRequirement>;
  getContactsByCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]>;
  
  // Document Analysis Results methods
  createDocumentAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult>;
  getDocumentAnalysisResults(documentId: number): Promise<DocumentAnalysisResult[]>;
  getDocumentAnalysisResultsByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]>;
  getDocumentAnalysisResultsByTypeForCompany(documentType: string, targetCompanyId: number): Promise<DocumentAnalysisResult[]>;

  // File Upload Events methods
  createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent>;
  getFileUploadEvent(eventId: number): Promise<FileUploadEvent | undefined>;
  updateFileUploadEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date): Promise<FileUploadEvent | undefined>;
  getAnalysisCompletionStatus(targetCompanyId: number, userCompanyId: number): Promise<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
  }>;

  // Stage 1 Analysis Events methods
  createStage1AnalysisEvent(event: InsertStage1AnalysisEvent): Promise<Stage1AnalysisEvent>;
  getStage1AnalysisEvent(eventId: number): Promise<Stage1AnalysisEvent | undefined>;
  getStage1AnalysisEventsByCompany(targetCompanyId: number, userCompanyId: number): Promise<Stage1AnalysisEvent[]>;
  updateStage1AnalysisEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number): Promise<Stage1AnalysisEvent | undefined>;
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

  // User company membership operations (for multiple companies)
  async getUserCompanies(userId: number): Promise<UserCompanyMembership[]> {
    return await db
      .select()
      .from(userCompanyMemberships)
      .where(and(eq(userCompanyMemberships.userId, userId), eq(userCompanyMemberships.isActive, true)))
      .orderBy(desc(userCompanyMemberships.joinedAt));
  }

  async createUserCompanyMembership(membership: InsertUserCompanyMembership): Promise<UserCompanyMembership> {
    const [newMembership] = await db
      .insert(userCompanyMemberships)
      .values(membership)
      .returning();
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
    return result.rowCount !== null && result.rowCount > 0;
  }

  async switchUserActiveCompany(userId: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ currentCompanyId: companyId })
      .where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
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
        websiteAnalysis: targetCompanies.websiteAnalysis,
        websiteAnalysisProcessedAt: targetCompanies.websiteAnalysisProcessedAt,
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
        websiteAnalysis: targetCompanies.websiteAnalysis,
        websiteAnalysisProcessedAt: targetCompanies.websiteAnalysisProcessedAt,
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
      .where(
        userCompanyId === 0 
          ? eq(targetCompanies.id, id) // Internal call - don't check userCompanyId
          : and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId))
      );
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
        websiteAnalysis: targetCompanies.websiteAnalysis,
        websiteAnalysisProcessedAt: targetCompanies.websiteAnalysisProcessedAt,
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
        : insertCompany.annualRevenue,
      employeeCount: typeof insertCompany.employeeCount === 'string' 
        ? parseInt(insertCompany.employeeCount) || null
        : insertCompany.employeeCount,
      yearEstablished: typeof insertCompany.yearEstablished === 'string' 
        ? parseInt(insertCompany.yearEstablished) || null
        : insertCompany.yearEstablished
    };
    
    const [company] = await db
      .insert(targetCompanies)
      .values([processedData])
      .returning();
    return company;
  }

  async updateTargetCompany(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined> {
    // Convert numeric fields to appropriate types
    const processedData = {
      ...updateData,
      annualRevenue: typeof updateData.annualRevenue === 'number' 
        ? updateData.annualRevenue.toString() 
        : updateData.annualRevenue,
      employeeCount: typeof updateData.employeeCount === 'string' 
        ? parseInt(updateData.employeeCount) || null
        : updateData.employeeCount,
      yearEstablished: typeof updateData.yearEstablished === 'string' 
        ? parseInt(updateData.yearEstablished) || null
        : updateData.yearEstablished
    };
    
    const [company] = await db
      .update(targetCompanies)
      .set(processedData)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)))
      .returning();
    return company || undefined;
  }

  async updateTargetCompanyWebsiteAnalysis(targetCompanyId: number, analysis: string): Promise<boolean> {
    try {
      const [updatedCompany] = await db
        .update(targetCompanies)
        .set({
          websiteAnalysis: analysis,
          websiteAnalysisProcessedAt: new Date()
        })
        .where(eq(targetCompanies.id, targetCompanyId))
        .returning();
      
      return !!updatedCompany;
    } catch (error) {
      console.error('Error updating website analysis:', error);
      return false;
    }
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

  async getTargetContact(contactId: number, userCompanyId: number): Promise<TargetContact | undefined> {
    // First verify the target company belongs to the user's company
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, contactId), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    return existingContact.target_contacts;
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

  async getContactsByCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]> {
    const contacts = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(targetContacts.targetCompanyId, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .orderBy(sql`${targetContacts.isPrimary} DESC`, targetContacts.lastName);

    return contacts.map(row => row.target_contacts);
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
    return await db.transaction(async (tx) => {
      // Get invitation details using transaction
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

      // Check if user already exists
      const existingUsers = await tx
        .select()
        .from(users)
        .where(eq(users.email, invitationData.email));

      let user: User;

      if (existingUsers.length > 0) {
        // User exists, update their details and add them to the company
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
        // Create new user
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

      // Update invitation status
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
      currentCompanyId: member.userCompanyId, // Add missing field for backwards compatibility
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

    // Get total companies count
    const [totalResult] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId));

    // Convert pipeline distribution to stageStats format
    const stageStats = pipelineDistribution.map(item => ({
      stageName: item.stage || 'Unknown',
      stageOrder: 1, // Default order
      companyCount: item.count,
      avgDaysInStage: null as number | null
    }));

    return {
      stageStats,
      recentChanges: [],
      totalCompanies: totalResult?.total || 0
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
        data = pipelineData.stageStats.map(stat => ({
          stage: stat.stageName,
          count: stat.companyCount,
          percentage: pipelineData.totalCompanies > 0 ? 
            Math.round((stat.companyCount / pipelineData.totalCompanies) * 100 * 100) / 100 : 0
        }));
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
    // Using a direct query to avoid Drizzle ORM GROUP BY issues
    const hotDealsData = await db
      .select({
        id: targetCompanies.id,
        companyName: targetCompanies.companyName,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        daysInStage: sql<number>`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt}))::int`,
      })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified')`,
        or(
          sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 14`,
          sql`${targetCompanies.stage} IN ('Offer Stage', 'Negotiation', 'Due Diligence')`
        )
      ))
      .orderBy(
        sql`CASE 
          WHEN ${targetCompanies.stage} IN ('Offer Stage', 'Negotiation') THEN 1
          WHEN EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 30 THEN 2
          ELSE 3
        END`,
        targetCompanies.stageUpdatedAt
      )
      .limit(5);

    // Get recent activity count for each deal
    const dealsWithActivity = await Promise.all(
      hotDealsData.map(async (deal) => {
        const [activityCount] = await db
          .select({ count: count() })
          .from(activities)
          .where(and(
            eq(activities.targetCompanyId, deal.id),
            sql`${activities.activityDate} >= CURRENT_DATE - INTERVAL '7 days'`
          ));
        
        return {
          ...deal,
          recentActivityCount: activityCount.count,
        };
      })
    );

    return {
      deals: dealsWithActivity,
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

  // Dashboard preferences methods (first implementation)
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

  // Additional dashboard widgets
  async getUpcomingRemindersWidget(userId: number): Promise<any> {
    // Get upcoming activities and tasks for the user
    const upcomingData = await db
      .select({
        id: activities.id,
        title: activities.title,
        activityType: activities.activityType,
        activityDate: activities.activityDate,
        companyName: targetCompanies.companyName,
        description: activities.description,
      })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(activities.userId, userId),
        sql`${activities.activityDate} >= CURRENT_DATE`,
        sql`${activities.activityDate} <= CURRENT_DATE + INTERVAL '7 days'`
      ))
      .orderBy(activities.activityDate)
      .limit(10);

    return {
      reminders: upcomingData,
      lastUpdated: new Date(),
    };
  }

  async getTeamActivityWidget(userCompanyId: number): Promise<any> {
    const teamActivityData = await db
      .select({
        id: activities.id,
        title: activities.title,
        activityType: activities.activityType,
        activityDate: activities.activityDate,
        createdAt: activities.createdAt,
        companyName: targetCompanies.companyName,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(activities)
      .innerJoin(targetCompanies, eq(activities.targetCompanyId, targetCompanies.id))
      .innerJoin(users, eq(activities.userId, users.id))
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${activities.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`
      ))
      .orderBy(desc(activities.createdAt))
      .limit(15);

    // Group by user for team activity insights
    const activityByUser = teamActivityData.reduce((acc: any, activity) => {
      const userName = activity.userName;
      if (!acc[userName]) {
        acc[userName] = { userName, activities: [], count: 0 };
      }
      acc[userName].activities.push(activity);
      acc[userName].count++;
      return acc;
    }, {});

    return {
      teamActivity: Object.values(activityByUser),
      recentActivities: teamActivityData.slice(0, 10),
      lastUpdated: new Date(),
    };
  }

  async getStageAlertsWidget(userCompanyId: number): Promise<any> {
    // Get deals that have been stuck in stages too long
    const stageAlertsData = await db
      .select({
        id: targetCompanies.id,
        companyName: targetCompanies.companyName,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        daysInStage: sql<number>`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt}))::int`,
      })
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.userCompanyId, userCompanyId),
        sql`${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified')`,
        sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) > 21`
      ))
      .orderBy(sql`EXTRACT(days FROM (NOW() - ${targetCompanies.stageUpdatedAt})) DESC`)
      .limit(10);

    return {
      stageAlerts: stageAlertsData.map((alert) => ({
        ...alert,
        alertType: alert.daysInStage > 45 ? 'critical' : alert.daysInStage > 30 ? 'warning' : 'info',
        message: `Deal has been in ${alert.stage} for ${alert.daysInStage} days`,
      })),
      lastUpdated: new Date(),
    };
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

  // Document operations
  async getDocumentCategories(): Promise<DocumentCategory[]> {
    // Return the 5 standardized document categories aligned with the portal
    return [
      { id: 1, categoryName: 'Company Accounts', description: 'Company annual accounts and financial statements (up to 5 files)', isRequired: true, sortOrder: 1, createdAt: new Date() },
      { id: 2, categoryName: 'Profit & Loss', description: 'Profit and loss statements', isRequired: true, sortOrder: 2, createdAt: new Date() },
      { id: 3, categoryName: 'Balance Sheet', description: 'Balance sheet documents', isRequired: true, sortOrder: 3, createdAt: new Date() },
      { id: 4, categoryName: 'Sales Ledger', description: 'Sales ledger and transaction records', isRequired: true, sortOrder: 4, createdAt: new Date() },
      { id: 5, categoryName: 'Asset Register', description: 'Asset register and fixed asset records', isRequired: true, sortOrder: 5, createdAt: new Date() },
      { id: 6, categoryName: 'Staff Matrix', description: 'Staff matrix and employee information', isRequired: true, sortOrder: 6, createdAt: new Date() }
    ];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [createdDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return createdDocument;
  }

  async getCompanyDocuments(targetCompanyId: number, userCompanyId: number): Promise<(Document & { uploadedByName: string; categoryDescription?: string })[]> {
    // First verify the user has access to this company
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      return [];
    }

    // Get regular documents
    const regularDocuments = await db
      .select({
        id: documents.id,
        targetCompanyId: documents.targetCompanyId,
        uploadedBy: documents.uploadedBy,
        documentName: documents.documentName,
        originalFilename: documents.originalFilename,
        filePath: documents.filePath,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        documentCategory: documents.documentCategory,
        description: documents.description,
        isConfidential: documents.isConfidential,
        uploadDate: documents.uploadDate,
        lastAccessed: documents.lastAccessed,
        accessCount: documents.accessCount,
        createdAt: documents.createdAt,
        uploadedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        categoryDescription: sql<string | undefined>`${documentCategories.description}`,
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .leftJoin(documentCategories, eq(documents.documentCategory, documentCategories.categoryName))
      .where(eq(documents.targetCompanyId, targetCompanyId))
      .orderBy(documents.documentCategory, desc(documents.uploadDate));

    // Get external document submissions from portals
    const externalDocuments = await db
      .select({
        id: externalDocumentSubmissions.id,
        targetCompanyId: externalDocumentSubmissions.targetCompanyId,
        uploadedBy: sql<number>`-1`, // Use -1 for portal submissions to indicate external upload
        documentName: externalDocumentSubmissions.originalFilename,
        originalFilename: externalDocumentSubmissions.originalFilename,
        filePath: externalDocumentSubmissions.filePath,
        fileSize: externalDocumentSubmissions.fileSize,
        fileType: sql<string>`COALESCE(${externalDocumentSubmissions.fileType}, 'application/octet-stream')`,
        documentCategory: sql<string>`COALESCE(${externalDocumentSubmissions.documentCategory}, 'general')`,
        description: sql<string>`COALESCE(${externalDocumentSubmissions.submissionNotes}, 'Portal submission')`,
        isConfidential: sql<boolean>`true`, // Portal submissions are confidential by default
        uploadDate: externalDocumentSubmissions.submittedAt,
        lastAccessed: sql<Date | null>`NULL`,
        accessCount: sql<number>`0`,
        createdAt: externalDocumentSubmissions.createdAt,
        uploadedByName: sql<string>`COALESCE(${targetContacts.firstName} || ' ' || ${targetContacts.lastName}, 'Portal User')`,
        categoryDescription: sql<string | undefined>`${documentCategories.description}`,
      })
      .from(externalDocumentSubmissions)
      .leftJoin(targetContacts, eq(externalDocumentSubmissions.targetContactId, targetContacts.id))
      .leftJoin(documentCategories, eq(externalDocumentSubmissions.documentCategory, documentCategories.categoryName))
      .where(eq(externalDocumentSubmissions.targetCompanyId, targetCompanyId))
      .orderBy(desc(externalDocumentSubmissions.submittedAt));

    // Combine and sort both types of documents
    const allDocuments = [...regularDocuments, ...externalDocuments];
    return allDocuments.sort((a, b) => {
      // Sort by category first, then by upload date (newest first)
      if (a.documentCategory !== b.documentCategory) {
        return (a.documentCategory || '').localeCompare(b.documentCategory || '');
      }
      const aDate = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
      const bDate = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
      return bDate - aDate;
    });
  }

  async getDocument(documentId: number, userCompanyId: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .leftJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(documents.id, documentId),
        eq(targetCompanies.userCompanyId, userCompanyId)
      ));
    return document?.documents;
  }

  async getDocumentByIdPublic(documentId: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    return document || undefined;
  }

  async updateDocument(documentId: number, document: Partial<InsertDocument>, userCompanyId: number): Promise<Document | undefined> {
    // First verify the user has access to this document
    const existingDocument = await this.getDocument(documentId, userCompanyId);
    if (!existingDocument) {
      return undefined;
    }

    const [updatedDocument] = await db
      .update(documents)
      .set(document)
      .where(eq(documents.id, documentId))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(documentId: number, userCompanyId: number): Promise<boolean> {
    // First verify the user has access to this document
    const existingDocument = await this.getDocument(documentId, userCompanyId);
    if (!existingDocument) {
      return false;
    }

    // Delete in correct order to avoid foreign key constraints:
    // 1. First delete document analysis results (which reference file upload events)
    await db
      .delete(documentAnalysisResults)
      .where(eq(documentAnalysisResults.documentId, documentId));

    // 2. Then delete file upload events (which reference documents)
    await db
      .delete(fileUploadEvents)
      .where(eq(fileUploadEvents.documentId, documentId));

    // 3. Finally delete the document itself
    const [deletedDocument] = await db
      .delete(documents)
      .where(eq(documents.id, documentId))
      .returning();
    return !!deletedDocument;
  }

  async logDocumentAccess(documentId: number, userId: number, accessType: string, ipAddress?: string): Promise<void> {
    await db
      .insert(documentAccessLog)
      .values({
        documentId,
        accessedBy: userId,
        accessType,
        ipAddress: ipAddress || null,
      });

    // Update document access count and last accessed timestamp
    await db
      .update(documents)
      .set({
        accessCount: sql`${documents.accessCount} + 1`,
        lastAccessed: new Date(),
      })
      .where(eq(documents.id, documentId));
  }

  // ========================================
  // External Document Portal Methods
  // ========================================

  async createPortalAccessToken(token: InsertPortalAccessToken): Promise<PortalAccessToken> {
    const [createdToken] = await db
      .insert(portalAccessTokens)
      .values(token)
      .returning();
    return createdToken;
  }

  async getPortalAccessToken(accessToken: string): Promise<PortalAccessToken | undefined> {
    const [token] = await db
      .select()
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.accessToken, accessToken));
    return token || undefined;
  }

  async validatePortalToken(accessToken: string): Promise<PortalAccessToken | undefined> {
    const [token] = await db
      .select()
      .from(portalAccessTokens)
      .where(and(
        eq(portalAccessTokens.accessToken, accessToken),
        eq(portalAccessTokens.isActive, true),
        sql`${portalAccessTokens.expiresAt} > NOW()`
      ));
    return token || undefined;
  }

  async updatePortalTokenAccess(tokenId: number, ipAddress?: string, userAgent?: string): Promise<void> {
    const updates: any = {
      lastAccessed: new Date(),
      accessCount: sql`${portalAccessTokens.accessCount} + 1`
    };

    if (ipAddress) {
      // Add IP address to the array if not already present
      updates.ipAddressesUsed = sql`array_append(COALESCE(${portalAccessTokens.ipAddressesUsed}, '{}'), ${ipAddress})`;
    }

    if (userAgent) {
      // Add user agent to the array if not already present
      updates.userAgentStrings = sql`array_append(COALESCE(${portalAccessTokens.userAgentStrings}, '{}'), ${userAgent})`;
    }

    await db
      .update(portalAccessTokens)
      .set(updates)
      .where(eq(portalAccessTokens.id, tokenId));
  }

  async deactivatePortalToken(tokenId: number): Promise<boolean> {
    const [updatedToken] = await db
      .update(portalAccessTokens)
      .set({ isActive: false })
      .where(eq(portalAccessTokens.id, tokenId))
      .returning();
    return !!updatedToken;
  }

  async deletePortalToken(tokenId: number): Promise<boolean> {
    // First delete any related document submissions
    await db
      .delete(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, tokenId));
    
    // Then delete the portal token itself
    const [deletedToken] = await db
      .delete(portalAccessTokens)
      .where(eq(portalAccessTokens.id, tokenId))
      .returning();
    return !!deletedToken;
  }

  async getPortalTokensForCompany(userCompanyId: number): Promise<any[]> {
    return await db
      .select({
        id: portalAccessTokens.id,
        accessToken: portalAccessTokens.accessToken,
        targetCompanyId: portalAccessTokens.targetCompanyId,
        contactId: portalAccessTokens.targetContactId,
        isActive: portalAccessTokens.isActive,
        expiresAt: portalAccessTokens.expiresAt,
        createdAt: portalAccessTokens.createdAt,
        lastAccessed: portalAccessTokens.lastAccessed,
        companyName: targetCompanies.companyName,
        contactName: sql<string>`${targetContacts.firstName} || ' ' || ${targetContacts.lastName}`,
        contactEmail: targetContacts.email,
        documentSubmissions: sql<number>`(
          SELECT COUNT(*)::int 
          FROM ${externalDocumentSubmissions} 
          WHERE ${externalDocumentSubmissions.portalTokenId} = ${portalAccessTokens.id}
        )`,
      })
      .from(portalAccessTokens)
      .innerJoin(targetCompanies, eq(portalAccessTokens.targetCompanyId, targetCompanies.id))
      .innerJoin(targetContacts, eq(portalAccessTokens.targetContactId, targetContacts.id))
      .where(eq(portalAccessTokens.userCompanyId, userCompanyId))
      .orderBy(desc(portalAccessTokens.createdAt));
  }

  async getPortalTokenByCompany(targetCompanyId: number): Promise<any | null> {
    const result = await db
      .select({
        id: portalAccessTokens.id,
        accessToken: portalAccessTokens.accessToken,
        targetCompanyId: portalAccessTokens.targetCompanyId,
        targetContactId: portalAccessTokens.targetContactId,
        isActive: portalAccessTokens.isActive,
        expiresAt: portalAccessTokens.expiresAt,
        createdAt: portalAccessTokens.createdAt,
      })
      .from(portalAccessTokens)
      .where(
        and(
          eq(portalAccessTokens.targetCompanyId, targetCompanyId),
          eq(portalAccessTokens.isActive, true)
        )
      )
      .limit(1);
    
    return result[0] || null;
  }

  async createExternalDocumentSubmission(submission: InsertExternalDocumentSubmission): Promise<ExternalDocumentSubmission> {
    const [createdSubmission] = await db
      .insert(externalDocumentSubmissions)
      .values(submission)
      .returning();
    return createdSubmission;
  }

  async getPortalSubmissions(portalTokenId: number): Promise<ExternalDocumentSubmission[]> {
    return await db
      .select()
      .from(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId))
      .orderBy(desc(externalDocumentSubmissions.submittedAt));
  }

  async reviewDocumentSubmission(submissionId: number, reviewedBy: number, status: string, notes?: string): Promise<boolean> {
    const [updatedSubmission] = await db
      .update(externalDocumentSubmissions)
      .set({
        processingStatus: status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      })
      .where(eq(externalDocumentSubmissions.id, submissionId))
      .returning();
    return !!updatedSubmission;
  }

  async createPortalDocumentRequirement(requirement: InsertPortalDocumentRequirement): Promise<PortalDocumentRequirement> {
    const [createdRequirement] = await db
      .insert(portalDocumentRequirements)
      .values(requirement)
      .returning();
    return createdRequirement;
  }

  async getPortalDocumentRequirements(portalTokenId: number): Promise<PortalDocumentRequirement[]> {
    return await db
      .select()
      .from(portalDocumentRequirements)
      .where(eq(portalDocumentRequirements.portalTokenId, portalTokenId))
      .orderBy(portalDocumentRequirements.collectionStage, portalDocumentRequirements.priorityLevel);
  }

  async updatePortalDocumentRequirement(requirementId: number, requirement: Partial<InsertPortalDocumentRequirement>): Promise<PortalDocumentRequirement | undefined> {
    const [updatedRequirement] = await db
      .update(portalDocumentRequirements)
      .set({ ...requirement, updatedAt: new Date() })
      .where(eq(portalDocumentRequirements.id, requirementId))
      .returning();
    return updatedRequirement || undefined;
  }

  async logPortalActivity(activity: InsertPortalActivityLog): Promise<void> {
    await db
      .insert(portalActivityLog)
      .values(activity);
  }

  async getPortalActivityLog(portalTokenId: number): Promise<PortalActivityLog[]> {
    return await db
      .select()
      .from(portalActivityLog)
      .where(eq(portalActivityLog.portalTokenId, portalTokenId))
      .orderBy(desc(portalActivityLog.activityTimestamp))
      .limit(100);
  }

  async getDealTeamEmails(targetCompanyId: number): Promise<string[]> {
    // Get all users assigned to deals for this target company
    const dealAssignments = await db
      .select({
        email: users.email
      })
      .from(userDealAssignments)
      .innerJoin(users, eq(userDealAssignments.userId, users.id))
      .where(eq(userDealAssignments.targetCompanyId, targetCompanyId));
    
    return dealAssignments.map(assignment => assignment.email);
  }

  // ========================================
  // Portal Link Campaigns
  // ========================================

  async createPortalLinkCampaign(campaign: InsertPortalLinkCampaign): Promise<PortalLinkCampaign> {
    const [createdCampaign] = await db
      .insert(portalLinkCampaigns)
      .values(campaign)
      .returning();
    return createdCampaign;
  }

  async getPortalLinkCampaigns(userCompanyId: number): Promise<PortalLinkCampaign[]> {
    return await db
      .select()
      .from(portalLinkCampaigns)
      .where(eq(portalLinkCampaigns.userCompanyId, userCompanyId))
      .orderBy(desc(portalLinkCampaigns.createdAt));
  }

  async getPortalLinkCampaign(campaignId: number, userCompanyId: number): Promise<PortalLinkCampaign | undefined> {
    const [campaign] = await db
      .select()
      .from(portalLinkCampaigns)
      .where(and(
        eq(portalLinkCampaigns.id, campaignId),
        eq(portalLinkCampaigns.userCompanyId, userCompanyId)
      ));
    return campaign || undefined;
  }

  async updatePortalLinkCampaign(campaignId: number, userCompanyId: number, updates: Partial<InsertPortalLinkCampaign>): Promise<PortalLinkCampaign | undefined> {
    const [updatedCampaign] = await db
      .update(portalLinkCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(portalLinkCampaigns.id, campaignId),
        eq(portalLinkCampaigns.userCompanyId, userCompanyId)
      ))
      .returning();
    return updatedCampaign || undefined;
  }

  async deletePortalLinkCampaign(campaignId: number, userCompanyId: number): Promise<boolean> {
    const [deletedCampaign] = await db
      .delete(portalLinkCampaigns)
      .where(and(
        eq(portalLinkCampaigns.id, campaignId),
        eq(portalLinkCampaigns.userCompanyId, userCompanyId)
      ))
      .returning();
    return !!deletedCampaign;
  }

  // ========================================
  // Portal Email Templates
  // ========================================

  async createPortalEmailTemplate(template: InsertPortalEmailTemplate): Promise<PortalEmailTemplate> {
    const [createdTemplate] = await db
      .insert(portalEmailTemplates)
      .values(template)
      .returning();
    return createdTemplate;
  }

  async getPortalEmailTemplates(userCompanyId: number): Promise<PortalEmailTemplate[]> {
    return await db
      .select()
      .from(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.userCompanyId, userCompanyId),
        eq(portalEmailTemplates.isActive, true)
      ))
      .orderBy(desc(portalEmailTemplates.createdAt));
  }

  async getPortalEmailTemplate(templateId: number, userCompanyId: number): Promise<PortalEmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.id, templateId),
        eq(portalEmailTemplates.userCompanyId, userCompanyId)
      ));
    return template || undefined;
  }

  async updatePortalEmailTemplate(templateId: number, userCompanyId: number, updates: Partial<InsertPortalEmailTemplate>): Promise<PortalEmailTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(portalEmailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(portalEmailTemplates.id, templateId),
        eq(portalEmailTemplates.userCompanyId, userCompanyId)
      ))
      .returning();
    return updatedTemplate || undefined;
  }

  async deletePortalEmailTemplate(templateId: number, userCompanyId: number): Promise<boolean> {
    const [deletedTemplate] = await db
      .delete(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.id, templateId),
        eq(portalEmailTemplates.userCompanyId, userCompanyId)
      ))
      .returning();
    return !!deletedTemplate;
  }

  async incrementTemplateUsage(templateId: number): Promise<void> {
    await db
      .update(portalEmailTemplates)
      .set({ 
        usageCount: sql`${portalEmailTemplates.usageCount} + 1`,
        lastUsed: new Date()
      })
      .where(eq(portalEmailTemplates.id, templateId));
  }

  // ========================================
  // Portal Communications Log
  // ========================================

  async logPortalCommunication(communication: InsertPortalCommunicationsLog): Promise<PortalCommunicationsLog> {
    const [loggedCommunication] = await db
      .insert(portalCommunicationsLog)
      .values(communication)
      .returning();
    return loggedCommunication;
  }

  async getPortalCommunications(userCompanyId: number, filters?: {
    campaignId?: number;
    targetContactId?: number;
    communicationType?: string;
  }): Promise<PortalCommunicationsLog[]> {
    const conditions = [eq(targetCompanies.userCompanyId, userCompanyId)];
    
    if (filters?.campaignId) {
      conditions.push(eq(portalCommunicationsLog.campaignId, filters.campaignId));
    }
    if (filters?.targetContactId) {
      conditions.push(eq(portalCommunicationsLog.targetContactId, filters.targetContactId));
    }
    if (filters?.communicationType) {
      conditions.push(eq(portalCommunicationsLog.communicationType, filters.communicationType));
    }

    const results = await db
      .select()
      .from(portalCommunicationsLog)
      .innerJoin(targetContacts, eq(portalCommunicationsLog.targetContactId, targetContacts.id))
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(...conditions))
      .orderBy(desc(portalCommunicationsLog.createdAt));
      
    return results.map(result => result.portal_communications_log);
  }

  async updateCommunicationStatus(communicationId: number, updates: {
    emailStatus?: string;
    deliveredAt?: Date;
    openedAt?: Date;
    clickedAt?: Date;
  }): Promise<void> {
    await db
      .update(portalCommunicationsLog)
      .set(updates)
      .where(eq(portalCommunicationsLog.id, communicationId));
  }

  // ========================================
  // Portal Analytics
  // ========================================

  async createOrUpdatePortalAnalytics(analytics: InsertPortalAnalytics): Promise<PortalAnalytics> {
    const [existingAnalytics] = await db
      .select()
      .from(portalAnalytics)
      .where(and(
        eq(portalAnalytics.userCompanyId, analytics.userCompanyId),
        eq(portalAnalytics.analyticsDate, analytics.analyticsDate || sql`CURRENT_DATE`),
        analytics.targetCompanyId ? eq(portalAnalytics.targetCompanyId, analytics.targetCompanyId) : isNull(portalAnalytics.targetCompanyId),
        analytics.portalTokenId ? eq(portalAnalytics.portalTokenId, analytics.portalTokenId) : isNull(portalAnalytics.portalTokenId)
      ));

    if (existingAnalytics) {
      const [updatedAnalytics] = await db
        .update(portalAnalytics)
        .set({ ...analytics, updatedAt: new Date() })
        .where(eq(portalAnalytics.id, existingAnalytics.id))
        .returning();
      return updatedAnalytics;
    } else {
      const [createdAnalytics] = await db
        .insert(portalAnalytics)
        .values(analytics)
        .returning();
      return createdAnalytics;
    }
  }

  async getPortalAnalytics(userCompanyId: number, filters?: {
    startDate?: string;
    endDate?: string;
    targetCompanyId?: number;
    portalTokenId?: number;
  }): Promise<PortalAnalytics[]> {
    const conditions = [eq(portalAnalytics.userCompanyId, userCompanyId)];

    if (filters?.startDate) {
      conditions.push(gte(portalAnalytics.analyticsDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(portalAnalytics.analyticsDate, filters.endDate));
    }
    if (filters?.targetCompanyId) {
      conditions.push(eq(portalAnalytics.targetCompanyId, filters.targetCompanyId));
    }
    if (filters?.portalTokenId) {
      conditions.push(eq(portalAnalytics.portalTokenId, filters.portalTokenId));
    }

    return await db
      .select()
      .from(portalAnalytics)
      .where(and(...conditions))
      .orderBy(desc(portalAnalytics.analyticsDate));
  }

  // ========================================
  // Portal Link Shares
  // ========================================

  async createPortalLinkShare(share: InsertPortalLinkShare): Promise<PortalLinkShare> {
    const [createdShare] = await db
      .insert(portalLinkShares)
      .values(share)
      .returning();
    return createdShare;
  }

  async getPortalLinkShares(portalTokenId: number): Promise<PortalLinkShare[]> {
    return await db
      .select()
      .from(portalLinkShares)
      .where(eq(portalLinkShares.portalTokenId, portalTokenId))
      .orderBy(desc(portalLinkShares.createdAt));
  }

  async updatePortalLinkShareUsage(shareId: number): Promise<void> {
    await db
      .update(portalLinkShares)
      .set({ 
        currentUses: sql`${portalLinkShares.currentUses} + 1`,
        lastAccessed: new Date()
      })
      .where(eq(portalLinkShares.id, shareId));
  }

  async deactivatePortalLinkShare(shareId: number): Promise<boolean> {
    const [updatedShare] = await db
      .update(portalLinkShares)
      .set({ isActive: false })
      .where(eq(portalLinkShares.id, shareId))
      .returning();
    return !!updatedShare;
  }

  // ========================================
  // Standardized Document Requirements System
  // ========================================

  async initializeStandardRequirements(targetCompanyId: number, userId: number): Promise<{ stage1Requirements: number; stage2Requirements: number; totalRequirements: number; message: string }> {
    // Verify permissions
    const user = await this.getUserWithPermissions(userId);
    if (!user || (!user.permissions?.canCreateDeals && !user.permissions?.canManageCompany)) {
      throw new Error('Insufficient permissions to initialize document requirements');
    }

    // Call the database function to create standard requirements
    await db.execute(sql`SELECT initialize_standard_requirements(${targetCompanyId})`);

    // Log activity - assuming we have an activity logger
    try {
      // Create an activity log entry
      await this.createActivity({
        targetCompanyId,
        userId,
        activityType: 'system_action',
        title: 'Document Requirements Initialized',
        description: 'Initialized 29 standard document requirements (6 Stage 1 + 23 Stage 2)',
        activityDate: new Date().toISOString(),
        isCompleted: true,
      });
    } catch (error) {
      // Don't fail the whole operation if activity logging fails
      console.error('Failed to log requirements initialization activity:', error);
    }

    return {
      stage1Requirements: 6,
      stage2Requirements: 23,
      totalRequirements: 29,
      message: 'Standard document requirements initialized successfully'
    };
  }

  async getCompanyDocumentRequirements(targetCompanyId: number, userCompanyId: number, stage?: number | null): Promise<CompanyDocumentRequirement[]> {
    // First verify access to the company
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      return [];
    }

    const whereClause = stage !== null && stage !== undefined 
      ? and(
          eq(companyDocumentRequirements.targetCompanyId, targetCompanyId),
          eq(companyDocumentRequirements.collectionStage, stage)
        )
      : eq(companyDocumentRequirements.targetCompanyId, targetCompanyId);

    const query = db
      .select({
        id: companyDocumentRequirements.id,
        targetCompanyId: companyDocumentRequirements.targetCompanyId,
        requirementName: companyDocumentRequirements.requirementName,
        requirementDescription: companyDocumentRequirements.requirementDescription,
        documentCategory: companyDocumentRequirements.documentCategory,
        collectionStage: companyDocumentRequirements.collectionStage,
        priorityLevel: companyDocumentRequirements.priorityLevel,
        isMandatory: companyDocumentRequirements.isMandatory,
        requirementStatus: companyDocumentRequirements.requirementStatus,
        submissionStatus: companyDocumentRequirements.submissionStatus,
        submittedDocumentId: companyDocumentRequirements.submittedDocumentId,
        submittedAt: companyDocumentRequirements.submittedAt,
        submittedByContactId: companyDocumentRequirements.submittedByContactId,
        reviewedBy: companyDocumentRequirements.reviewedBy,
        reviewedAt: companyDocumentRequirements.reviewedAt,
        reviewStatus: companyDocumentRequirements.reviewStatus,
        reviewNotes: companyDocumentRequirements.reviewNotes,
        reviewScore: companyDocumentRequirements.reviewScore,
        dueDate: companyDocumentRequirements.dueDate,
        reminderSentCount: companyDocumentRequirements.reminderSentCount,
        lastReminderSent: companyDocumentRequirements.lastReminderSent,
        nextReminderDue: companyDocumentRequirements.nextReminderDue,
        createdAt: companyDocumentRequirements.createdAt,
        updatedAt: companyDocumentRequirements.updatedAt,
        displayStatus: sql<string>`
          CASE 
            WHEN ${companyDocumentRequirements.dueDate} < NOW() THEN 'overdue'
            WHEN ${companyDocumentRequirements.requirementStatus} = 'submitted' THEN 'submitted'
            WHEN ${companyDocumentRequirements.requirementStatus} = 'approved' THEN 'approved'
            ELSE 'outstanding'
          END
        `
      })
      .from(companyDocumentRequirements)
      .where(whereClause)

      .orderBy(
        asc(companyDocumentRequirements.collectionStage), 
        desc(companyDocumentRequirements.priorityLevel), 
        asc(companyDocumentRequirements.requirementName)
      );

    const results = await query;

    return results;
  }

  async getDocumentStageProgression(targetCompanyId: number, userCompanyId: number): Promise<DocumentStageProgression | undefined> {
    // First verify access to the company
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      return undefined;
    }

    const [progression] = await db
      .select()
      .from(documentStageProgression)
      .where(eq(documentStageProgression.targetCompanyId, targetCompanyId));

    return progression;
  }



  async updateCompanyRequirement(requirementId: number, updates: any, userId: number): Promise<CompanyDocumentRequirement> {
    const [requirement] = await db
      .update(companyDocumentRequirements)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(companyDocumentRequirements.id, requirementId))
      .returning();
    return requirement;
  }

  // Document tracking methods for enhanced portal functionality

  async getValidPortalToken(token: string): Promise<any> {
    const results = await db
      .select()
      .from(portalAccessTokens)
      .innerJoin(targetCompanies, eq(portalAccessTokens.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(portalAccessTokens.accessToken, token),
        eq(portalAccessTokens.isActive, true),
        gt(portalAccessTokens.expiresAt, new Date())
      ))
      .limit(1);
    
    if (results.length === 0) return null;
    
    const result = results[0];
    return {
      id: result.portal_access_tokens.id,
      accessToken: result.portal_access_tokens.accessToken,
      targetCompanyId: result.portal_access_tokens.targetCompanyId,
      target_company_id: result.portal_access_tokens.targetCompanyId,
      targetContactId: result.portal_access_tokens.targetContactId,
      expiresAt: result.portal_access_tokens.expiresAt,
      expires_at: result.portal_access_tokens.expiresAt,
      isActive: result.portal_access_tokens.isActive,
      company_name: result.target_companies.companyName,
      user_company_id: result.target_companies.userCompanyId
    };
  }

  async getSimplePortalData(portalTokenId: number): Promise<any> {
    try {
      // Get portal token for this company
      const [tokenInfo] = await db
        .select()
        .from(portalAccessTokens)
        .where(eq(portalAccessTokens.id, portalTokenId))
        .limit(1);
      
      if (!tokenInfo) {
        throw new Error('No active portal token found');
      }

      // Get ALL submitted documents for this COMPANY (not just this portal token)
      // This way all portals for the same company show the same data
      const submissions = await db
        .select({
          id: externalDocumentSubmissions.id,
          documentType: externalDocumentSubmissions.submissionNotes,
          filename: externalDocumentSubmissions.originalFilename,
          submittedAt: externalDocumentSubmissions.createdAt,
          status: externalDocumentSubmissions.processingStatus
        })
        .from(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId))
        .orderBy(sql`${externalDocumentSubmissions.createdAt} DESC`);

      // Get target company name
      const [company] = await db
        .select({
          companyName: targetCompanies.companyName
        })
        .from(targetCompanies)
        .where(eq(targetCompanies.id, tokenInfo.targetCompanyId))
        .limit(1);

      // Count company accounts submissions
      const companyAccountsSubmissions = submissions.filter(s => 
        s.documentType?.startsWith('company_accounts_')
      );

      // Define the condensed document requirements
      const documentRequirements = [
        {
          type: 'company_accounts',
          label: 'Company Accounts',
          required: 5,
          submitted: companyAccountsSubmissions.length,
          isGroup: true,
          submissions: companyAccountsSubmissions
        },
        { type: 'p_and_l', label: 'P&L Statement', required: 1, isGroup: false },
        { type: 'balance_sheet', label: 'Balance Sheet', required: 1, isGroup: false },
        { type: 'sales_ledger', label: 'Sales Ledger', required: 1, isGroup: false },
        { type: 'asset_register', label: 'Asset Register', required: 1, isGroup: false },
        { type: 'staff_matrix', label: 'Staff Matrix', required: 1, isGroup: false }
      ];

      // Create submission status for each document requirement
      const documentStatus = documentRequirements.map(req => {
        if (req.isGroup) {
          return {
            type: req.type,
            label: req.label,
            required: req.required,
            submitted: req.submitted,
            isGroup: true,
            isComplete: req.submitted >= req.required,
            submissions: req.submissions
          };
        } else {
          const submission = submissions.find(s => s.documentType === req.type);
          return {
            type: req.type,
            label: req.label,
            required: req.required,
            submitted: submission ? 1 : 0,
            isGroup: false,
            isComplete: !!submission,
            submission: submission ? {
              id: submission.id,
              filename: submission.filename,
              submittedAt: submission.submittedAt,
              status: submission.status
            } : null
          };
        }
      });

      const totalDocuments = submissions.length;
      const progressPercentage = Math.min(Math.round((totalDocuments / 10) * 100), 100);

      return {
        company_name: company?.companyName || 'Unknown Company',
        total_documents_required: 10,
        total_submitted: totalDocuments,
        progress_percentage: progressPercentage,
        document_status: documentStatus,
        portal_expires_at: tokenInfo.expiresAt
      };
    } catch (error) {
      console.error('Error in getSimplePortalData:', error);
      throw error;
    }
  }

  async submitSimplePortalDocument(tokenData: any, uploadedFile: any, documentType: string, submissionNotes?: string): Promise<any> {
    try {
      // Check if this document type has already been submitted for this portal
      const existingSubmissions = await db
        .select({ count: sql<number>`count(*)` })
        .from(externalDocumentSubmissions)
        .where(and(
          eq(externalDocumentSubmissions.portalTokenId, tokenData.id),
          eq(externalDocumentSubmissions.submissionNotes, documentType)
        ));
      
      const existingCount = existingSubmissions[0]?.count || 0;
      
      // For company accounts, allow up to 5 submissions
      if (documentType.startsWith('company_accounts_') && existingCount >= 1) {
        throw new Error('This company accounts file has already been submitted');
      }
      
      // For other document types, allow only 1 submission
      if (!documentType.startsWith('company_accounts_') && existingCount >= 1) {
        throw new Error('This document type has already been submitted');
      }
      
      // Check total submissions for this portal (max 10)
      const totalSubmissions = await db
        .select({ count: sql<number>`count(*)` })
        .from(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.portalTokenId, tokenData.id));
      
      if ((totalSubmissions[0]?.count || 0) >= 10) {
        throw new Error('Maximum of 10 documents already submitted');
      }
      
      // Create external document submission record
      const [document] = await db
        .insert(externalDocumentSubmissions)
        .values({
          portalTokenId: tokenData.id,
          targetCompanyId: tokenData.targetCompanyId, // Fix: use correct field name
          targetContactId: tokenData.targetContactId, // Fix: use correct field name
          originalFilename: uploadedFile.originalname,
          storedFilename: uploadedFile.filename, // Add the stored filename
          filePath: uploadedFile.path,
          fileSize: uploadedFile.size,
          fileType: uploadedFile.mimetype,
          submissionNotes: documentType, // Store document type in submissionNotes field
          processingStatus: 'uploaded'
        })
        .returning();
      
      console.log(`[PORTAL] Document submitted: ${documentType} - ${uploadedFile.originalname}`);
      
      return {
        success: true,
        document_id: document.id,
        document_type: documentType,
        filename: uploadedFile.originalname
      };
    } catch (error) {
      console.error('Error in submitSimplePortalDocument:', error);
      throw error;
    }
  }

  async getSimplePortalProgress(portalTokenId: number): Promise<{ submittedTypes: string[], totalSubmissions: number }> {
    try {
      const submissions = await db
        .select({
          submissionNotes: externalDocumentSubmissions.submissionNotes
        })
        .from(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId));
      
      const submittedTypes = submissions.map(s => s.submissionNotes).filter(Boolean);
      
      return {
        submittedTypes,
        totalSubmissions: submittedTypes.length
      };
    } catch (error) {
      console.error('Error getting simple portal progress:', error);
      return { submittedTypes: [], totalSubmissions: 0 };
    }
  }

  // File upload event operations
  async createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent> {
    const [createdEvent] = await db
      .insert(fileUploadEvents)
      .values(event)
      .returning();
    return createdEvent;
  }

  async getFileUploadEventsWithDetails(userCompanyId: number): Promise<any[]> {
    return await db
      .select({
        id: fileUploadEvents.id,
        documentId: fileUploadEvents.documentId,
        targetCompanyId: fileUploadEvents.targetCompanyId,
        uploadedBy: fileUploadEvents.uploadedBy,
        fileName: fileUploadEvents.fileName,
        fileUrl: fileUploadEvents.fileUrl,
        webhookSent: fileUploadEvents.webhookSent,
        webhookResponse: fileUploadEvents.webhookResponse,
        webhookStatus: fileUploadEvents.webhookStatus,
        webhookSentAt: fileUploadEvents.webhookSentAt,
        uploadedAt: fileUploadEvents.uploadedAt,
        createdAt: fileUploadEvents.createdAt,
        targetCompanyName: targetCompanies.companyName,
        uploadedByName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Unknown User')`,
      })
      .from(fileUploadEvents)
      .leftJoin(targetCompanies, eq(fileUploadEvents.targetCompanyId, targetCompanies.id))
      .leftJoin(users, eq(fileUploadEvents.uploadedBy, users.id))
      .where(
        // Filter by user company through target companies
        eq(targetCompanies.userCompanyId, userCompanyId)
      )
      .orderBy(desc(fileUploadEvents.createdAt));
  }

  async updateFileUploadEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date): Promise<FileUploadEvent | undefined> {
    const [updatedEvent] = await db
      .update(fileUploadEvents)
      .set({
        webhookSent: true,
        webhookStatus: status,
        webhookResponse: response,
        webhookSentAt: sentAt || new Date(),
      })
      .where(eq(fileUploadEvents.id, eventId))
      .returning();
    return updatedEvent || undefined;
  }

  async getFileUploadEvent(eventId: number): Promise<FileUploadEvent | undefined> {
    const [event] = await db
      .select()
      .from(fileUploadEvents)
      .where(eq(fileUploadEvents.id, eventId));
    return event || undefined;
  }

  // Document Analysis Results methods
  async createDocumentAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult> {
    const [newResult] = await db
      .insert(documentAnalysisResults)
      .values(result)
      .returning();
    return newResult;
  }

  async getDocumentAnalysisResults(documentId: number): Promise<DocumentAnalysisResult[]> {
    return await db
      .select()
      .from(documentAnalysisResults)
      .where(eq(documentAnalysisResults.documentId, documentId))
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getDocumentAnalysisResultsByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    return await db
      .select()
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .leftJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(documentAnalysisResults.documentType, documentType),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getDocumentAnalysisResultsByTypeForCompany(documentType: string, targetCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const results = await db
      .select({
        id: documentAnalysisResults.id,
        documentId: documentAnalysisResults.documentId,
        fileUploadEventId: documentAnalysisResults.fileUploadEventId,
        documentType: documentAnalysisResults.documentType,
        analysisData: documentAnalysisResults.analysisData,
        processingTime: documentAnalysisResults.processingTime,
        createdAt: documentAnalysisResults.createdAt,
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(
        and(
          eq(documentAnalysisResults.documentType, documentType),
          eq(documents.targetCompanyId, targetCompanyId)
        )
      )
      .orderBy(desc(documentAnalysisResults.createdAt));
    
    return results;
  }

  async getAnalysisCompletionStatus(targetCompanyId: number, userCompanyId: number): Promise<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
  }> {
    // First verify access to the company
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      throw new Error('Company not found or access denied');
    }

    // Define the 5 required analysis types
    const requiredTypes = ['asset_register', 'sales_ledger', 'staff_matrix', 'profit_and_loss', 'balance_sheet'];

    // Get distinct analysis types for this company
    const analysisTypes = await db
      .selectDistinct({
        documentType: documentAnalysisResults.documentType
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(eq(documents.targetCompanyId, targetCompanyId));

    const completedTypes = analysisTypes.map(a => a.documentType).filter(type => requiredTypes.includes(type));
    const missingTypes = requiredTypes.filter(type => !completedTypes.includes(type));

    return {
      completedTypes,
      missingTypes,
      isComplete: completedTypes.length === requiredTypes.length,
      completionPercentage: Math.round((completedTypes.length / requiredTypes.length) * 100)
    };
  }

  // File Upload Events methods implementation
  async createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent> {
    const [result] = await db
      .insert(fileUploadEvents)
      .values(event)
      .returning();
    return result;
  }

  async getFileUploadEvent(eventId: number): Promise<FileUploadEvent | undefined> {
    const [event] = await db
      .select()
      .from(fileUploadEvents)
      .where(eq(fileUploadEvents.id, eventId));
    return event || undefined;
  }

  async updateFileUploadEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date): Promise<FileUploadEvent | undefined> {
    const [updated] = await db
      .update(fileUploadEvents)
      .set({
        webhookStatus: status,
        webhookResponse: response,
        webhookSentAt: sentAt,
        webhookSent: status === 'success'
      })
      .where(eq(fileUploadEvents.id, eventId))
      .returning();
    return updated || undefined;
  }

  // Stage 1 Analysis Events methods implementation
  async createStage1AnalysisEvent(event: InsertStage1AnalysisEvent): Promise<Stage1AnalysisEvent> {
    const [result] = await db
      .insert(stage1AnalysisEvents)
      .values(event)
      .returning();
    return result;
  }

  async getStage1AnalysisEvent(eventId: number): Promise<Stage1AnalysisEvent | undefined> {
    const [event] = await db
      .select()
      .from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.id, eventId));
    return event || undefined;
  }

  async getStage1AnalysisEventsByCompany(targetCompanyId: number, userCompanyId: number): Promise<Stage1AnalysisEvent[]> {
    // First verify access to the company
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      throw new Error('Company not found or access denied');
    }

    return await db
      .select()
      .from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId))
      .orderBy(desc(stage1AnalysisEvents.createdAt));
  }

  async updateStage1AnalysisEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number): Promise<Stage1AnalysisEvent | undefined> {
    const [updated] = await db
      .update(stage1AnalysisEvents)
      .set({
        webhookStatus: status,
        webhookResponse: response,
        webhookSentAt: sentAt,
        webhookSent: status === 'success',
        processingTime: processingTime
      })
      .where(eq(stage1AnalysisEvents.id, eventId))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
