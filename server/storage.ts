import {
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
  type InsertUser,
  type InsertUserCompany,
  type InsertTargetCompany,
  type InsertTargetContact,
  type InsertUserInvitation,
  type InsertUserDealAssignment,
  type InsertTeamNotification,
  type InsertActivity,
  type InsertDashboardPreference,
  type InsertDocument,
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
  type DocumentStageProgression,
  type UserCompanyMembership,
  type InsertUserCompanyMembership,
  type DealNote,
  type InsertDealNote,
} from "@shared/schema";

import { UserStore, userStore } from "./storage/user.store";
import { CompanyStore, companyStore } from "./storage/company.store";
import { ContactStore, contactStore } from "./storage/contact.store";
import { DealStore, dealStore } from "./storage/deal.store";
import { ActivityStore, activityStore } from "./storage/activity.store";
import { DocumentStore, documentStore } from "./storage/document.store";
import { PortalStore, portalStore } from "./storage/portal.store";
import { DashboardStore, dashboardStore } from "./storage/dashboard.store";

export type {
  SearchParams,
  TargetCompanyWithStats,
  FilterOptions,
  CompanyProfile
} from "./storage/company.store";

export type {
  UserWithRole,
  TeamMember,
  InvitationWithDetails
} from "./storage/user.store";

export type {
  ActivityWithDetails,
  ActivityTimeline,
  NotificationWithDetails
} from "./storage/activity.store";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCompany(id: number): Promise<UserCompany | undefined>;
  createUserCompany(company: InsertUserCompany): Promise<UserCompany>;
  getUserCompanies(userId: number): Promise<UserCompanyMembership[]>;
  createUserCompanyMembership(membership: InsertUserCompanyMembership): Promise<UserCompanyMembership>;
  updateUserCompanyMembership(id: number, membership: Partial<InsertUserCompanyMembership>): Promise<UserCompanyMembership | undefined>;
  deleteUserCompanyMembership(id: number): Promise<boolean>;
  switchUserActiveCompany(userId: number, companyId: number): Promise<boolean>;
  getTargetCompaniesByUserCompany(userCompanyId: number): Promise<any[]>;
  searchTargetCompanies(userCompanyId: number, searchParams: any): Promise<any[]>;
  getFilterOptions(userCompanyId: number): Promise<any>;
  getTargetCompanyCount(userCompanyId: number): Promise<number>;
  getTotalContactsCount(userCompanyId: number): Promise<number>;
  getDashboardMetrics(userCompanyId: number): Promise<{ activeDeals: number; totalDealValue: string }>;
  getTargetCompany(id: number, userCompanyId: number): Promise<TargetCompany | undefined>;
  getCompanyProfile(targetCompanyId: number, userCompanyId: number, userId: number): Promise<any>;
  createTargetCompany(company: InsertTargetCompany): Promise<TargetCompany>;
  updateTargetCompany(id: number, company: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined>;
  updateTargetCompanyWebsiteAnalysis(targetCompanyId: number, analysis: string): Promise<boolean>;
  deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean>;
  getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]>;
  getTargetContact(contactId: number, userCompanyId: number): Promise<TargetContact | undefined>;
  createTargetContact(contact: InsertTargetContact): Promise<TargetContact>;
  updateTargetContact(id: number, contact: Partial<InsertTargetContact>, userCompanyId: number): Promise<TargetContact | undefined>;
  deleteTargetContact(id: number, userCompanyId: number): Promise<boolean>;
  getAllContactsForUserCompany(userCompanyId: number): Promise<any>;
  getContactsByCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]>;
  createSession(userId: number, sessionToken: string, expiresAt: Date): Promise<UserSession>;
  getSessionByToken(sessionToken: string): Promise<UserSession | undefined>;
  deleteSession(sessionToken: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getUserInvitationByToken(token: string): Promise<any>;
  getInvitationsByUserCompany(userCompanyId: number): Promise<any[]>;
  updateUserInvitation(id: number, invitation: Partial<InsertUserInvitation>): Promise<UserInvitation | undefined>;
  acceptInvitation(token: string, userData: Partial<InsertUser>): Promise<User | undefined>;
  getUserRoles(): Promise<UserRole[]>;
  getUserRole(roleName: string): Promise<UserRole | undefined>;
  getUserWithPermissions(userId: number): Promise<any>;
  getTeamMembers(userCompanyId: number): Promise<any[]>;
  updateUserRole(userId: number, role: string, userCompanyId: number): Promise<User | undefined>;
  deactivateUser(userId: number, userCompanyId: number): Promise<boolean>;
  createDealAssignment(assignment: InsertUserDealAssignment): Promise<UserDealAssignment>;
  getDealAssignments(targetCompanyId: number): Promise<any[]>;
  getUserDealAssignments(userId: number): Promise<UserDealAssignment[]>;
  removeDealAssignment(userId: number, targetCompanyId: number): Promise<boolean>;
  updateDealAssignment(userId: number, targetCompanyId: number, assignment: Partial<InsertUserDealAssignment>): Promise<UserDealAssignment | undefined>;
  createNotification(notification: InsertTeamNotification): Promise<TeamNotification>;
  getUserNotifications(userId: number): Promise<any[]>;
  markNotificationRead(notificationId: number, userId: number): Promise<boolean>;
  markAllNotificationsRead(userId: number): Promise<number>;
  getPipelineStages(): Promise<PipelineStage[]>;
  updateCompanyStage(companyId: number, newStage: string, userId: number, notes?: string): Promise<any>;
  updateInitialDiscussion(companyId: number, completed: boolean, notes: string | null, userId: number): Promise<TargetCompany | undefined>;
  getStageHistory(targetCompanyId: number): Promise<StageHistory[]>;
  getPipelineOverview(userCompanyId: number, dateRange?: string): Promise<any>;
  getStageAnalysis(userCompanyId: number, dateRange?: string): Promise<any>;
  getActivityTypes(): Promise<ActivityType[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivitiesForCompany(targetCompanyId: number, userCompanyId: number): Promise<any[]>;
  getActivityTimeline(targetCompanyId: number, userCompanyId: number): Promise<any>;
  updateActivity(activityId: number, activity: Partial<InsertActivity>, userCompanyId: number): Promise<Activity | undefined>;
  deleteActivity(activityId: number, userCompanyId: number): Promise<boolean>;
  getRecentActivities(userCompanyId: number, limit?: number): Promise<any[]>;
  getActivitySummary(userCompanyId: number, dateRange?: string): Promise<any>;
  getUserPerformance(userCompanyId: number, dateRange?: string): Promise<any>;
  exportReport(userCompanyId: number, reportType: string, format?: string): Promise<string>;
  getPipelineOverviewWidget(userCompanyId: number): Promise<any>;
  getRecentActivitiesWidget(userCompanyId: number): Promise<any>;
  getHotDealsWidget(userCompanyId: number): Promise<any>;
  getQuickStatsWidget(userCompanyId: number): Promise<any>;
  getUpcomingRemindersWidget(userId: number): Promise<any>;
  getTeamActivityWidget(userCompanyId: number): Promise<any>;
  getStageAlertsWidget(userCompanyId: number): Promise<any>;
  getDashboardPreferences(userId: number): Promise<DashboardPreference[]>;
  updateDashboardPreferences(userId: number, preferences: any): Promise<void>;
  getDashboardAlerts(userCompanyId: number): Promise<DashboardAlert[]>;
  dismissAlert(alertId: number, userCompanyId: number): Promise<boolean>;
  getDocumentCategories(): Promise<DocumentCategory[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  getCompanyDocuments(targetCompanyId: number, userCompanyId: number): Promise<any[]>;
  getDocument(documentId: number, userCompanyId: number): Promise<Document | undefined>;
  getDocumentByIdPublic(documentId: number): Promise<Document | undefined>;
  updateDocument(documentId: number, document: Partial<InsertDocument>, userCompanyId: number): Promise<Document | undefined>;
  deleteDocument(documentId: number, userCompanyId: number): Promise<boolean>;
  getExternalSubmission(submissionId: number, userCompanyId: number): Promise<any>;
  deleteExternalSubmission(submissionId: number, userCompanyId: number): Promise<boolean>;
  getStage1DocumentFiles(targetCompanyId: number): Promise<any[]>;
  clearAllCompanyDocuments(userCompanyId: number): Promise<any>;
  logDocumentAccess(documentId: number, userId: number, accessType: string, ipAddress?: string): Promise<void>;
  createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent>;
  getFileUploadEventsWithDetails(userCompanyId: number): Promise<any[]>;
  updateFileUploadEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date): Promise<FileUploadEvent | undefined>;
  getFileUploadEvent(eventId: number): Promise<FileUploadEvent | undefined>;
  createDocumentAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult>;
  getDocumentAnalysisResults(documentId: number): Promise<DocumentAnalysisResult[]>;
  getDocumentAnalysisResultsByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]>;
  getDocumentAnalysisResultsByTypeForCompany(documentType: string, targetCompanyId: number): Promise<DocumentAnalysisResult[]>;
  getDocumentCountByCategory(targetCompanyId: number, categoryName: string): Promise<number>;
  getLatestStage1AnalysisEvent(targetCompanyId: number): Promise<Stage1AnalysisEvent | null>;
  getLatestDocumentUploadTime(targetCompanyId: number): Promise<Date | null>;
  getPortalAnalysisCompletionStatus(targetCompanyId: number): Promise<any>;
  getAnalysisCompletionStatus(targetCompanyId: number, userCompanyId: number): Promise<any>;
  createStage1AnalysisEvent(event: InsertStage1AnalysisEvent): Promise<Stage1AnalysisEvent>;
  getStage1AnalysisEvent(eventId: number): Promise<Stage1AnalysisEvent | undefined>;
  getStage1AnalysisEventsByCompany(targetCompanyId: number, userCompanyId: number): Promise<Stage1AnalysisEvent[]>;
  updateStage1AnalysisEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number, usageMetadata?: any): Promise<Stage1AnalysisEvent | undefined>;
  updateStage1AnalysisEventDetailedData(eventId: number, detailedData: any): Promise<Stage1AnalysisEvent | undefined>;
  updateDetailedAnalysisStatus(eventId: number, status: string, markdown?: string, processingTime?: number, usageMetadata?: any, triggeredBy?: number): Promise<Stage1AnalysisEvent | undefined>;
  createPortalAccessToken(token: InsertPortalAccessToken): Promise<PortalAccessToken>;
  getPortalAccessToken(accessToken: string): Promise<PortalAccessToken | undefined>;
  validatePortalToken(accessToken: string): Promise<PortalAccessToken | undefined>;
  updatePortalTokenAccess(tokenId: number, ipAddress?: string, userAgent?: string): Promise<void>;
  deactivatePortalToken(tokenId: number): Promise<boolean>;
  deletePortalToken(tokenId: number): Promise<boolean>;
  getActivePortalTokensForTargetCompany(targetCompanyId: number): Promise<PortalAccessToken[]>;
  getPortalTokensForCompany(userCompanyId: number): Promise<any[]>;
  getPortalTokenByCompany(targetCompanyId: number): Promise<any>;
  createExternalDocumentSubmission(submission: InsertExternalDocumentSubmission): Promise<ExternalDocumentSubmission>;
  getPortalSubmissions(portalTokenId: number): Promise<ExternalDocumentSubmission[]>;
  reviewDocumentSubmission(submissionId: number, reviewedBy: number, status: string, notes?: string): Promise<boolean>;
  createPortalDocumentRequirement(requirement: InsertPortalDocumentRequirement): Promise<PortalDocumentRequirement>;
  getPortalDocumentRequirements(portalTokenId: number): Promise<PortalDocumentRequirement[]>;
  updatePortalDocumentRequirement(requirementId: number, requirement: Partial<InsertPortalDocumentRequirement>): Promise<PortalDocumentRequirement | undefined>;
  logPortalActivity(activity: InsertPortalActivityLog): Promise<void>;
  getPortalActivityLog(portalTokenId: number): Promise<PortalActivityLog[]>;
  getDealTeamEmails(targetCompanyId: number): Promise<string[]>;
  createPortalLinkCampaign(campaign: InsertPortalLinkCampaign): Promise<PortalLinkCampaign>;
  getPortalLinkCampaigns(userCompanyId: number): Promise<PortalLinkCampaign[]>;
  getPortalLinkCampaign(campaignId: number, userCompanyId: number): Promise<PortalLinkCampaign | undefined>;
  updatePortalLinkCampaign(campaignId: number, userCompanyId: number, updates: Partial<InsertPortalLinkCampaign>): Promise<PortalLinkCampaign | undefined>;
  deletePortalLinkCampaign(campaignId: number, userCompanyId: number): Promise<boolean>;
  createPortalEmailTemplate(template: InsertPortalEmailTemplate): Promise<PortalEmailTemplate>;
  getPortalEmailTemplates(userCompanyId: number): Promise<PortalEmailTemplate[]>;
  getPortalEmailTemplate(templateId: number, userCompanyId: number): Promise<PortalEmailTemplate | undefined>;
  updatePortalEmailTemplate(templateId: number, userCompanyId: number, updates: Partial<InsertPortalEmailTemplate>): Promise<PortalEmailTemplate | undefined>;
  deletePortalEmailTemplate(templateId: number, userCompanyId: number): Promise<boolean>;
  getDefaultPortalEmailTemplate(userCompanyId: number, templateCategory: string): Promise<PortalEmailTemplate | undefined>;
  createPortalCommunicationsLog(log: InsertPortalCommunicationsLog): Promise<PortalCommunicationsLog>;
  getPortalCommunicationsLog(portalTokenId: number): Promise<PortalCommunicationsLog[]>;
  createPortalAnalytics(analytics: InsertPortalAnalytics): Promise<PortalAnalytics>;
  getPortalAnalytics(portalTokenId: number): Promise<PortalAnalytics[] | PortalAnalytics | undefined>;
  incrementPortalAnalytics(portalTokenId: number, field: string): Promise<void>;
  createPortalLinkShare(share: InsertPortalLinkShare): Promise<PortalLinkShare>;
  getPortalLinkShares(portalTokenId: number): Promise<PortalLinkShare[]>;
  updatePortalLinkShareUsage(shareId: number): Promise<void>;
  deactivatePortalLinkShare(shareId: number): Promise<boolean>;
  initializeStandardRequirements(targetCompanyId: number, userId: number): Promise<any>;
  getCompanyDocumentRequirements(targetCompanyId: number, userCompanyId: number, stage?: number | null): Promise<CompanyDocumentRequirement[]>;
  getDocumentStageProgression(targetCompanyId: number, userCompanyId: number): Promise<DocumentStageProgression | undefined>;
  updateCompanyRequirement(requirementId: number, updates: any, userId: number): Promise<CompanyDocumentRequirement>;
  getValidPortalToken(token: string): Promise<any>;
  getSimplePortalData(portalTokenId: number): Promise<any>;
  getSimplePortalProgress(portalTokenId: number): Promise<any>;
  getDealNotes(targetCompanyId: number): Promise<DealNote[]>;
  createDealNote(note: InsertDealNote): Promise<DealNote>;
  updateDealNote(noteId: number, note: Partial<InsertDealNote>): Promise<DealNote | undefined>;
  deleteDealNote(noteId: number): Promise<boolean>;
  toggleInitialDiscussion(companyId: number, completed: boolean, userId: number): Promise<TargetCompany | undefined>;
}

export class DatabaseStorage implements IStorage {
  private userStore: UserStore;
  private companyStore: CompanyStore;
  private contactStore: ContactStore;
  private dealStore: DealStore;
  private activityStore: ActivityStore;
  private documentStore: DocumentStore;
  private portalStore: PortalStore;
  private dashboardStore: DashboardStore;

  constructor() {
    this.userStore = userStore;
    this.companyStore = companyStore;
    this.contactStore = contactStore;
    this.dealStore = dealStore;
    this.activityStore = activityStore;
    this.documentStore = documentStore;
    this.portalStore = portalStore;
    this.dashboardStore = dashboardStore;
  }

  // User operations - delegated to UserStore
  getUser = (id: number) => this.userStore.getUser(id);
  getUserByEmail = (email: string) => this.userStore.getUserByEmail(email);
  createUser = (user: InsertUser) => this.userStore.createUser(user);
  getUserCompany = (id: number) => this.userStore.getUserCompany(id);
  createUserCompany = (company: InsertUserCompany) => this.userStore.createUserCompany(company);
  getUserCompanies = (userId: number) => this.userStore.getUserCompanies(userId);
  createUserCompanyMembership = (membership: InsertUserCompanyMembership) => this.userStore.createUserCompanyMembership(membership);
  updateUserCompanyMembership = (id: number, membership: Partial<InsertUserCompanyMembership>) => this.userStore.updateUserCompanyMembership(id, membership);
  deleteUserCompanyMembership = (id: number) => this.userStore.deleteUserCompanyMembership(id);
  switchUserActiveCompany = (userId: number, companyId: number) => this.userStore.switchUserActiveCompany(userId, companyId);
  createSession = (userId: number, sessionToken: string, expiresAt: Date) => this.userStore.createSession(userId, sessionToken, expiresAt);
  getSessionByToken = (sessionToken: string) => this.userStore.getSessionByToken(sessionToken);
  deleteSession = (sessionToken: string) => this.userStore.deleteSession(sessionToken);
  deleteExpiredSessions = () => this.userStore.deleteExpiredSessions();
  createUserInvitation = (invitation: InsertUserInvitation) => this.userStore.createUserInvitation(invitation);
  getUserInvitationByToken = (token: string) => this.userStore.getUserInvitationByToken(token);
  getInvitationsByUserCompany = (userCompanyId: number) => this.userStore.getInvitationsByUserCompany(userCompanyId);
  updateUserInvitation = (id: number, invitation: Partial<InsertUserInvitation>) => this.userStore.updateUserInvitation(id, invitation);
  acceptInvitation = (token: string, userData: Partial<InsertUser>) => this.userStore.acceptInvitation(token, userData);
  getUserRoles = () => this.userStore.getUserRoles();
  getUserRole = (roleName: string) => this.userStore.getUserRole(roleName);
  getUserWithPermissions = (userId: number) => this.userStore.getUserWithPermissions(userId);
  getTeamMembers = (userCompanyId: number) => this.userStore.getTeamMembers(userCompanyId);
  updateUserRole = (userId: number, role: string, userCompanyId: number) => this.userStore.updateUserRole(userId, role, userCompanyId);
  deactivateUser = (userId: number, userCompanyId: number) => this.userStore.deactivateUser(userId, userCompanyId);

  // Company operations - delegated to CompanyStore
  getTargetCompaniesByUserCompany = (userCompanyId: number) => this.companyStore.getTargetCompaniesByUserCompany(userCompanyId);
  searchTargetCompanies = (userCompanyId: number, searchParams: any) => this.companyStore.searchTargetCompanies(userCompanyId, searchParams);
  getFilterOptions = (userCompanyId: number) => this.companyStore.getFilterOptions(userCompanyId);
  getTargetCompanyCount = (userCompanyId: number) => this.companyStore.getTargetCompanyCount(userCompanyId);
  getTotalContactsCount = (userCompanyId: number) => this.companyStore.getTotalContactsCount(userCompanyId);
  getDashboardMetrics = (userCompanyId: number) => this.companyStore.getDashboardMetrics(userCompanyId);
  getTargetCompany = (id: number, userCompanyId: number) => this.companyStore.getTargetCompany(id, userCompanyId);
  getCompanyProfile = (targetCompanyId: number, userCompanyId: number, userId: number) => this.companyStore.getCompanyProfile(targetCompanyId, userCompanyId, userId);
  createTargetCompany = (company: InsertTargetCompany) => this.companyStore.createTargetCompany(company);
  updateTargetCompany = (id: number, company: Partial<InsertTargetCompany>, userCompanyId: number) => this.companyStore.updateTargetCompany(id, company, userCompanyId);
  updateTargetCompanyWebsiteAnalysis = (targetCompanyId: number, analysis: string) => this.companyStore.updateTargetCompanyWebsiteAnalysis(targetCompanyId, analysis);
  deleteTargetCompany = (id: number, userCompanyId: number) => this.companyStore.deleteTargetCompany(id, userCompanyId);

  // Contact operations - delegated to ContactStore
  getContactsForTargetCompany = (targetCompanyId: number, userCompanyId: number) => this.contactStore.getContactsForTargetCompany(targetCompanyId, userCompanyId);
  getTargetContact = (contactId: number, userCompanyId: number) => this.contactStore.getTargetContact(contactId, userCompanyId);
  createTargetContact = (contact: InsertTargetContact) => this.contactStore.createTargetContact(contact);
  updateTargetContact = (id: number, contact: Partial<InsertTargetContact>, userCompanyId: number) => this.contactStore.updateTargetContact(id, contact, userCompanyId);
  deleteTargetContact = (id: number, userCompanyId: number) => this.contactStore.deleteTargetContact(id, userCompanyId);
  getAllContactsForUserCompany = (userCompanyId: number) => this.contactStore.getAllContactsForUserCompany(userCompanyId);
  getContactsByCompany = (targetCompanyId: number, userCompanyId: number) => this.contactStore.getContactsByCompany(targetCompanyId, userCompanyId);

  // Deal operations - delegated to DealStore
  createDealAssignment = (assignment: InsertUserDealAssignment) => this.dealStore.createDealAssignment(assignment);
  getDealAssignments = (targetCompanyId: number) => this.dealStore.getDealAssignments(targetCompanyId);
  getUserDealAssignments = (userId: number) => this.dealStore.getUserDealAssignments(userId);
  removeDealAssignment = (userId: number, targetCompanyId: number) => this.dealStore.removeDealAssignment(userId, targetCompanyId);
  updateDealAssignment = (userId: number, targetCompanyId: number, assignment: Partial<InsertUserDealAssignment>) => this.dealStore.updateDealAssignment(userId, targetCompanyId, assignment);
  getPipelineStages = () => this.dealStore.getPipelineStages();
  updateCompanyStage = (companyId: number, newStage: string, userId: number, notes?: string) => this.dealStore.updateCompanyStage(companyId, newStage, userId, notes);
  updateInitialDiscussion = (companyId: number, completed: boolean, notes: string | null, userId: number) => this.dealStore.updateInitialDiscussion(companyId, completed, notes, userId);
  getStageHistory = (targetCompanyId: number) => this.dealStore.getStageHistory(targetCompanyId);
  getPipelineOverview = (userCompanyId: number, dateRange?: string) => this.dealStore.getPipelineOverview(userCompanyId, dateRange);
  getStageAnalysis = (userCompanyId: number, dateRange?: string) => this.dealStore.getStageAnalysis(userCompanyId, dateRange);
  getDealNotes = (targetCompanyId: number) => this.dealStore.getDealNotes(targetCompanyId);
  createDealNote = (note: InsertDealNote) => this.dealStore.createDealNote(note);
  updateDealNote = (noteId: number, note: Partial<InsertDealNote>) => this.dealStore.updateDealNote(noteId, note);
  deleteDealNote = (noteId: number) => this.dealStore.deleteDealNote(noteId);
  toggleInitialDiscussion = (companyId: number, completed: boolean, userId: number) => this.dealStore.toggleInitialDiscussion(companyId, completed, userId);

  // Activity operations - delegated to ActivityStore
  getActivityTypes = () => this.activityStore.getActivityTypes();
  createActivity = (activity: InsertActivity) => this.activityStore.createActivity(activity);
  getActivitiesForCompany = (targetCompanyId: number, userCompanyId: number) => this.activityStore.getActivitiesForCompany(targetCompanyId, userCompanyId);
  getActivityTimeline = (targetCompanyId: number, userCompanyId: number) => this.activityStore.getActivityTimeline(targetCompanyId, userCompanyId);
  updateActivity = (activityId: number, activity: Partial<InsertActivity>, userCompanyId: number) => this.activityStore.updateActivity(activityId, activity, userCompanyId);
  deleteActivity = (activityId: number, userCompanyId: number) => this.activityStore.deleteActivity(activityId, userCompanyId);
  getRecentActivities = (userCompanyId: number, limit?: number) => this.activityStore.getRecentActivities(userCompanyId, limit);
  getActivitySummary = (userCompanyId: number, dateRange?: string) => this.activityStore.getActivitySummary(userCompanyId, dateRange);
  getUserPerformance = (userCompanyId: number, dateRange?: string) => this.activityStore.getUserPerformance(userCompanyId, dateRange);
  exportReport = (userCompanyId: number, reportType: string, format?: string) => this.activityStore.exportReport(userCompanyId, reportType, format);
  createNotification = (notification: InsertTeamNotification) => this.activityStore.createNotification(notification);
  getUserNotifications = (userId: number) => this.activityStore.getUserNotifications(userId);
  markNotificationRead = (notificationId: number, userId: number) => this.activityStore.markNotificationRead(notificationId, userId);
  markAllNotificationsRead = (userId: number) => this.activityStore.markAllNotificationsRead(userId);

  // Document operations - delegated to DocumentStore
  getDocumentCategories = () => this.documentStore.getDocumentCategories();
  createDocument = (document: InsertDocument) => this.documentStore.createDocument(document);
  getCompanyDocuments = (targetCompanyId: number, userCompanyId: number) => this.documentStore.getCompanyDocuments(targetCompanyId, userCompanyId);
  getDocument = (documentId: number, userCompanyId: number) => this.documentStore.getDocument(documentId, userCompanyId);
  getDocumentByIdPublic = (documentId: number) => this.documentStore.getDocumentByIdPublic(documentId);
  updateDocument = (documentId: number, document: Partial<InsertDocument>, userCompanyId: number) => this.documentStore.updateDocument(documentId, document, userCompanyId);
  deleteDocument = (documentId: number, userCompanyId: number) => this.documentStore.deleteDocument(documentId, userCompanyId);
  getExternalSubmission = (submissionId: number, userCompanyId: number) => this.documentStore.getExternalSubmission(submissionId, userCompanyId);
  deleteExternalSubmission = (submissionId: number, userCompanyId: number) => this.documentStore.deleteExternalSubmission(submissionId, userCompanyId);
  getStage1DocumentFiles = (targetCompanyId: number) => this.documentStore.getStage1DocumentFiles(targetCompanyId);
  clearAllCompanyDocuments = (userCompanyId: number) => this.documentStore.clearAllCompanyDocuments(userCompanyId);
  logDocumentAccess = (documentId: number, userId: number, accessType: string, ipAddress?: string) => this.documentStore.logDocumentAccess(documentId, userId, accessType, ipAddress);
  createFileUploadEvent = (event: InsertFileUploadEvent) => this.documentStore.createFileUploadEvent(event);
  getFileUploadEventsWithDetails = (userCompanyId: number) => this.documentStore.getFileUploadEventsWithDetails(userCompanyId);
  updateFileUploadEventWebhookStatus = (eventId: number, status: string, response?: string, sentAt?: Date) => this.documentStore.updateFileUploadEventWebhookStatus(eventId, status, response, sentAt);
  getFileUploadEvent = (eventId: number) => this.documentStore.getFileUploadEvent(eventId);
  createDocumentAnalysisResult = (result: InsertDocumentAnalysisResult) => this.documentStore.createDocumentAnalysisResult(result);
  getDocumentAnalysisResults = (documentId: number) => this.documentStore.getDocumentAnalysisResults(documentId);
  getDocumentAnalysisResultsByType = (documentType: string, userCompanyId: number) => this.documentStore.getDocumentAnalysisResultsByType(documentType, userCompanyId);
  getDocumentAnalysisResultsByTypeForCompany = (documentType: string, targetCompanyId: number) => this.documentStore.getDocumentAnalysisResultsByTypeForCompany(documentType, targetCompanyId);
  getDocumentCountByCategory = (targetCompanyId: number, categoryName: string) => this.documentStore.getDocumentCountByCategory(targetCompanyId, categoryName);
  getLatestStage1AnalysisEvent = (targetCompanyId: number) => this.documentStore.getLatestStage1AnalysisEvent(targetCompanyId);
  getLatestDocumentUploadTime = (targetCompanyId: number) => this.documentStore.getLatestDocumentUploadTime(targetCompanyId);
  getPortalAnalysisCompletionStatus = (targetCompanyId: number) => this.documentStore.getPortalAnalysisCompletionStatus(targetCompanyId);
  getAnalysisCompletionStatus = (targetCompanyId: number, userCompanyId: number) => this.documentStore.getAnalysisCompletionStatus(targetCompanyId, userCompanyId);
  createStage1AnalysisEvent = (event: InsertStage1AnalysisEvent) => this.documentStore.createStage1AnalysisEvent(event);
  getStage1AnalysisEvent = (eventId: number) => this.documentStore.getStage1AnalysisEvent(eventId);
  getStage1AnalysisEventsByCompany = (targetCompanyId: number, userCompanyId: number) => this.documentStore.getStage1AnalysisEventsByCompany(targetCompanyId, userCompanyId);
  updateStage1AnalysisEventWebhookStatus = (eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number, usageMetadata?: any) => this.documentStore.updateStage1AnalysisEventWebhookStatus(eventId, status, response, sentAt, processingTime, usageMetadata);
  updateStage1AnalysisEventDetailedData = (eventId: number, detailedData: any) => this.documentStore.updateStage1AnalysisEventDetailedData(eventId, detailedData);
  updateDetailedAnalysisStatus = (eventId: number, status: string, markdown?: string, processingTime?: number, usageMetadata?: any, triggeredBy?: number) => this.documentStore.updateDetailedAnalysisStatus(eventId, status, markdown, processingTime, usageMetadata, triggeredBy);

  // Portal operations - delegated to PortalStore
  createPortalAccessToken = (token: InsertPortalAccessToken) => this.portalStore.createPortalAccessToken(token);
  getPortalAccessToken = (accessToken: string) => this.portalStore.getPortalAccessToken(accessToken);
  validatePortalToken = (accessToken: string) => this.portalStore.validatePortalToken(accessToken);
  updatePortalTokenAccess = (tokenId: number, ipAddress?: string, userAgent?: string) => this.portalStore.updatePortalTokenAccess(tokenId, ipAddress, userAgent);
  deactivatePortalToken = (tokenId: number) => this.portalStore.deactivatePortalToken(tokenId);
  deletePortalToken = (tokenId: number) => this.portalStore.deletePortalToken(tokenId);
  getActivePortalTokensForTargetCompany = (targetCompanyId: number) => this.portalStore.getActivePortalTokensForTargetCompany(targetCompanyId);
  getPortalTokensForCompany = (userCompanyId: number) => this.portalStore.getPortalTokensForCompany(userCompanyId);
  getPortalTokenByCompany = (targetCompanyId: number) => this.portalStore.getPortalTokenByCompany(targetCompanyId);
  createExternalDocumentSubmission = (submission: InsertExternalDocumentSubmission) => this.portalStore.createExternalDocumentSubmission(submission);
  getPortalSubmissions = (portalTokenId: number) => this.portalStore.getPortalSubmissions(portalTokenId);
  reviewDocumentSubmission = (submissionId: number, reviewedBy: number, status: string, notes?: string) => this.portalStore.reviewDocumentSubmission(submissionId, reviewedBy, status, notes);
  createPortalDocumentRequirement = (requirement: InsertPortalDocumentRequirement) => this.portalStore.createPortalDocumentRequirement(requirement);
  getPortalDocumentRequirements = (portalTokenId: number) => this.portalStore.getPortalDocumentRequirements(portalTokenId);
  updatePortalDocumentRequirement = (requirementId: number, requirement: Partial<InsertPortalDocumentRequirement>) => this.portalStore.updatePortalDocumentRequirement(requirementId, requirement);
  logPortalActivity = (activity: InsertPortalActivityLog) => this.portalStore.logPortalActivity(activity);
  getPortalActivityLog = (portalTokenId: number) => this.portalStore.getPortalActivityLog(portalTokenId);
  getDealTeamEmails = (targetCompanyId: number) => this.portalStore.getDealTeamEmails(targetCompanyId);
  createPortalLinkCampaign = (campaign: InsertPortalLinkCampaign) => this.portalStore.createPortalLinkCampaign(campaign);
  getPortalLinkCampaigns = (userCompanyId: number) => this.portalStore.getPortalLinkCampaigns(userCompanyId);
  getPortalLinkCampaign = (campaignId: number, userCompanyId: number) => this.portalStore.getPortalLinkCampaign(campaignId, userCompanyId);
  updatePortalLinkCampaign = (campaignId: number, userCompanyId: number, updates: Partial<InsertPortalLinkCampaign>) => this.portalStore.updatePortalLinkCampaign(campaignId, userCompanyId, updates);
  deletePortalLinkCampaign = (campaignId: number, userCompanyId: number) => this.portalStore.deletePortalLinkCampaign(campaignId, userCompanyId);
  createPortalEmailTemplate = (template: InsertPortalEmailTemplate) => this.portalStore.createPortalEmailTemplate(template);
  getPortalEmailTemplates = (userCompanyId: number) => this.portalStore.getPortalEmailTemplates(userCompanyId);
  getPortalEmailTemplate = (templateId: number, userCompanyId: number) => this.portalStore.getPortalEmailTemplate(templateId, userCompanyId);
  updatePortalEmailTemplate = (templateId: number, userCompanyId: number, updates: Partial<InsertPortalEmailTemplate>) => this.portalStore.updatePortalEmailTemplate(templateId, userCompanyId, updates);
  deletePortalEmailTemplate = (templateId: number, userCompanyId: number) => this.portalStore.deletePortalEmailTemplate(templateId, userCompanyId);
  getDefaultPortalEmailTemplate = (userCompanyId: number, templateCategory: string) => this.portalStore.getDefaultPortalEmailTemplate(userCompanyId, templateCategory);
  createPortalCommunicationsLog = (log: InsertPortalCommunicationsLog) => this.portalStore.createPortalCommunicationsLog(log);
  getPortalCommunicationsLog = (portalTokenId: number) => this.portalStore.getPortalCommunicationsLog(portalTokenId);
  createPortalAnalytics = (analytics: InsertPortalAnalytics) => this.portalStore.createPortalAnalytics(analytics);
  getPortalAnalytics = (portalTokenId: number) => this.portalStore.getPortalAnalytics(portalTokenId);
  incrementPortalAnalytics = (portalTokenId: number, field: string) => this.portalStore.incrementPortalAnalytics(portalTokenId, field);
  createPortalLinkShare = (share: InsertPortalLinkShare) => this.portalStore.createPortalLinkShare(share);
  getPortalLinkShares = (portalTokenId: number) => this.portalStore.getPortalLinkShares(portalTokenId);
  updatePortalLinkShareUsage = (shareId: number) => this.portalStore.updatePortalLinkShareUsage(shareId);
  deactivatePortalLinkShare = (shareId: number) => this.portalStore.deactivatePortalLinkShare(shareId);
  initializeStandardRequirements = (targetCompanyId: number, userId: number) => this.portalStore.initializeStandardRequirements(targetCompanyId, userId);
  getCompanyDocumentRequirements = (targetCompanyId: number, userCompanyId: number, stage?: number | null) => this.portalStore.getCompanyDocumentRequirements(targetCompanyId, userCompanyId, stage);
  getDocumentStageProgression = (targetCompanyId: number, userCompanyId: number) => this.portalStore.getDocumentStageProgression(targetCompanyId, userCompanyId);
  updateCompanyRequirement = (requirementId: number, updates: any, userId: number) => this.portalStore.updateCompanyRequirement(requirementId, updates, userId);
  getValidPortalToken = (token: string) => this.portalStore.getValidPortalToken(token);
  getSimplePortalData = (portalTokenId: number) => this.portalStore.getSimplePortalData(portalTokenId);
  getSimplePortalProgress = (portalTokenId: number) => this.portalStore.getSimplePortalProgress(portalTokenId);

  // Dashboard operations - delegated to DashboardStore
  getPipelineOverviewWidget = (userCompanyId: number) => this.dashboardStore.getPipelineOverviewWidget(userCompanyId);
  getRecentActivitiesWidget = (userCompanyId: number) => this.dashboardStore.getRecentActivitiesWidget(userCompanyId);
  getHotDealsWidget = (userCompanyId: number) => this.dashboardStore.getHotDealsWidget(userCompanyId);
  getQuickStatsWidget = (userCompanyId: number) => this.dashboardStore.getQuickStatsWidget(userCompanyId);
  getUpcomingRemindersWidget = (userId: number) => this.dashboardStore.getUpcomingRemindersWidget(userId);
  getTeamActivityWidget = (userCompanyId: number) => this.dashboardStore.getTeamActivityWidget(userCompanyId);
  getStageAlertsWidget = (userCompanyId: number) => this.dashboardStore.getStageAlertsWidget(userCompanyId);
  getDashboardPreferences = (userId: number) => this.dashboardStore.getDashboardPreferences(userId);
  updateDashboardPreferences = (userId: number, preferences: any) => this.dashboardStore.updateDashboardPreferences(userId, preferences);
  getDashboardAlerts = (userCompanyId: number) => this.dashboardStore.getDashboardAlerts(userCompanyId);
  dismissAlert = (alertId: number, userCompanyId: number) => this.dashboardStore.dismissAlert(alertId, userCompanyId);
}

export const storage = new DatabaseStorage();
