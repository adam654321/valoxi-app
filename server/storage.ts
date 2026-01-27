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

import { usersRepository, type UserWithRole, type TeamMember, type InvitationWithDetails } from "./repositories/users.repository";
import { targetCompaniesRepository, type TargetCompanyWithStats, type FilterOptions, type CompanyProfile, type SearchParams } from "./repositories/target-companies.repository";
import { contactsRepository } from "./repositories/contacts.repository";
import { activitiesRepository, type ActivityWithDetails, type ActivityTimeline } from "./repositories/activities.repository";
import { notificationsRepository, type NotificationWithDetails } from "./repositories/notifications.repository";
import { documentsRepository } from "./repositories/documents.repository";
import { documentAnalysisRepository } from "./repositories/document-analysis.repository";
import { stage1AnalysisRepository } from "./repositories/stage1-analysis.repository";
import { portalRepository } from "./repositories/portal.repository";
import { portalRequirementsRepository } from "./repositories/portal-requirements.repository";
import { portalSubmissionsRepository } from "./repositories/portal-submissions.repository";
import { dashboardRepository } from "./repositories/dashboard.repository";
import { assignmentsRepository } from "./repositories/assignments.repository";
import { pipelineRepository } from "./repositories/pipeline.repository";
import { reportsRepository } from "./repositories/reports.repository";
import { teamRepository } from "./repositories/team.repository";
import { notesRepository } from "./repositories/notes.repository";

export type {
  SearchParams,
  TargetCompanyWithStats,
  FilterOptions,
  CompanyProfile
} from "./repositories/target-companies.repository";

export type {
  UserWithRole,
  TeamMember,
  InvitationWithDetails
} from "./repositories/users.repository";

export type {
  ActivityWithDetails,
  ActivityTimeline,
} from "./repositories/activities.repository";

export type {
  NotificationWithDetails
} from "./repositories/notifications.repository";

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
  constructor() {}

  // User operations - delegated to UsersRepository
  getUser = (id: number) => usersRepository.getById(id);
  getUserByEmail = (email: string) => usersRepository.getByEmail(email);
  createUser = (user: InsertUser) => usersRepository.create(user);
  getUserCompany = (id: number) => usersRepository.getUserCompany(id);
  createUserCompany = (company: InsertUserCompany) => usersRepository.createUserCompany(company);
  getUserCompanies = (userId: number) => usersRepository.getUserCompanies(userId);
  createUserCompanyMembership = (membership: InsertUserCompanyMembership) => usersRepository.createUserCompanyMembership(membership);
  updateUserCompanyMembership = (id: number, membership: Partial<InsertUserCompanyMembership>) => usersRepository.updateUserCompanyMembership(id, membership);
  deleteUserCompanyMembership = (id: number) => usersRepository.deleteUserCompanyMembership(id);
  switchUserActiveCompany = (userId: number, companyId: number) => usersRepository.switchUserActiveCompany(userId, companyId);
  createSession = (userId: number, sessionToken: string, expiresAt: Date) => usersRepository.createSession(userId, sessionToken, expiresAt);
  getSessionByToken = (sessionToken: string) => usersRepository.getSessionByToken(sessionToken);
  deleteSession = (sessionToken: string) => usersRepository.deleteSession(sessionToken);
  deleteExpiredSessions = () => usersRepository.deleteExpiredSessions();
  createUserInvitation = (invitation: InsertUserInvitation) => usersRepository.createUserInvitation(invitation);
  getUserInvitationByToken = (token: string) => usersRepository.getUserInvitationByToken(token);
  getInvitationsByUserCompany = (userCompanyId: number) => usersRepository.getInvitationsByUserCompany(userCompanyId);
  updateUserInvitation = (id: number, invitation: Partial<InsertUserInvitation>) => usersRepository.updateUserInvitation(id, invitation);
  acceptInvitation = (token: string, userData: Partial<InsertUser>) => usersRepository.acceptInvitation(token, userData);
  getUserRoles = () => usersRepository.getUserRoles();
  getUserRole = (roleName: string) => usersRepository.getUserRole(roleName);
  getUserWithPermissions = (userId: number) => usersRepository.getUserWithPermissions(userId);
  getTeamMembers = (userCompanyId: number) => usersRepository.getTeamMembers(userCompanyId);
  updateUserRole = (userId: number, role: string, userCompanyId: number) => usersRepository.updateUserRole(userId, role, userCompanyId);
  deactivateUser = (userId: number, userCompanyId: number) => usersRepository.deactivateUser(userId, userCompanyId);

  // Company operations - delegated to TargetCompaniesRepository and DashboardRepository
  getTargetCompaniesByUserCompany = (userCompanyId: number) => targetCompaniesRepository.getAll(userCompanyId);
  searchTargetCompanies = (userCompanyId: number, searchParams: any) => targetCompaniesRepository.search(userCompanyId, searchParams);
  getFilterOptions = (userCompanyId: number) => targetCompaniesRepository.getFilterOptions(userCompanyId);
  getTargetCompanyCount = (userCompanyId: number) => dashboardRepository.getTargetCompanyCount(userCompanyId);
  getTotalContactsCount = (userCompanyId: number) => dashboardRepository.getTotalContactsCount(userCompanyId);
  getDashboardMetrics = (userCompanyId: number) => dashboardRepository.getDashboardMetrics(userCompanyId);
  getTargetCompany = (id: number, userCompanyId: number) => targetCompaniesRepository.getById(id, userCompanyId);
  getCompanyProfile = async (targetCompanyId: number, userCompanyId: number, _userId: number): Promise<CompanyProfile | undefined> => {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) return undefined;
    const contacts = await contactsRepository.getContactsForTargetCompany(targetCompanyId);
    const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
    const userCompany = await usersRepository.getUserCompany(company.userCompanyId);
    const createdByUser = company.createdBy ? await usersRepository.getById(company.createdBy) : null;
    return {
      ...company,
      createdByName: createdByUser ? `${createdByUser.firstName} ${createdByUser.lastName}` : 'Unknown',
      userCompanyName: userCompany?.companyName || 'Unknown',
      totalContacts: contacts.length,
      primaryContactName: primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : null,
      primaryContactEmail: primaryContact?.email || null,
      primaryContactPhone: primaryContact?.phone || null,
      primaryContactTitle: primaryContact?.title || null,
      yearsInBusiness: company.yearEstablished ? new Date().getFullYear() - company.yearEstablished : null,
      revenuePerEmployee: company.annualRevenue && company.employeeCount ? parseFloat(company.annualRevenue) / company.employeeCount : null,
      contacts,
    };
  };
  createTargetCompany = (company: InsertTargetCompany) => targetCompaniesRepository.create(company);
  updateTargetCompany = (id: number, company: Partial<InsertTargetCompany>, userCompanyId: number) => targetCompaniesRepository.update(id, company, userCompanyId);
  updateTargetCompanyWebsiteAnalysis = async (targetCompanyId: number, analysis: string): Promise<boolean> => {
    const result = await targetCompaniesRepository.update(targetCompanyId, { websiteAnalysis: analysis, websiteAnalysisProcessedAt: new Date() } as any, 0);
    return !!result;
  };
  deleteTargetCompany = (id: number, userCompanyId: number) => targetCompaniesRepository.delete(id, userCompanyId);

  // Contact operations - delegated to ContactsRepository
  getContactsForTargetCompany = (targetCompanyId: number, _userCompanyId: number) => contactsRepository.getContactsForTargetCompany(targetCompanyId);
  getTargetContact = (contactId: number, userCompanyId: number) => contactsRepository.getTargetContact(contactId, userCompanyId);
  createTargetContact = (contact: InsertTargetContact) => contactsRepository.createTargetContact(contact);
  updateTargetContact = (id: number, contact: Partial<InsertTargetContact>, userCompanyId: number) => contactsRepository.updateTargetContact(id, contact, userCompanyId);
  deleteTargetContact = (id: number, userCompanyId: number) => contactsRepository.deleteTargetContact(id, userCompanyId);
  getAllContactsForUserCompany = (userCompanyId: number) => contactsRepository.getAllContactsForUserCompany(userCompanyId);
  getContactsByCompany = (targetCompanyId: number, _userCompanyId: number) => contactsRepository.getContactsForTargetCompany(targetCompanyId);

  // Deal operations - delegated to AssignmentsRepository, PipelineRepository, NotesRepository
  createDealAssignment = (assignment: InsertUserDealAssignment) => assignmentsRepository.createAssignment(assignment);
  getDealAssignments = (targetCompanyId: number) => assignmentsRepository.getByDeal(targetCompanyId);
  getUserDealAssignments = (userId: number) => assignmentsRepository.getByUser(userId);
  removeDealAssignment = (userId: number, targetCompanyId: number) => assignmentsRepository.remove(userId, targetCompanyId);
  updateDealAssignment = (userId: number, targetCompanyId: number, assignment: Partial<InsertUserDealAssignment>) => assignmentsRepository.update(userId, targetCompanyId, assignment);
  getPipelineStages = () => pipelineRepository.getPipelineStages();
  updateCompanyStage = (companyId: number, newStage: string, userId: number, notes?: string) => pipelineRepository.updateCompanyStage(companyId, newStage, userId, notes);
  updateInitialDiscussion = async (companyId: number, completed: boolean, notes: string | null, userId: number): Promise<TargetCompany | undefined> => {
    return targetCompaniesRepository.update(companyId, {
      initialDiscussionCompleted: completed,
      initialDiscussionNotes: notes,
      initialDiscussionDate: completed ? new Date() : null,
      initialDiscussionBy: completed ? userId : null,
    } as any, 0);
  };
  getStageHistory = (targetCompanyId: number) => pipelineRepository.getStageHistory(targetCompanyId);
  getPipelineOverview = (userCompanyId: number, dateRange?: string) => pipelineRepository.getPipelineOverview(userCompanyId);
  getStageAnalysis = (userCompanyId: number, dateRange?: string) => reportsRepository.getStageAnalysis(userCompanyId, dateRange);
  getDealNotes = (targetCompanyId: number) => notesRepository.getByTargetCompany(targetCompanyId);
  createDealNote = (note: InsertDealNote) => notesRepository.create(note);
  updateDealNote = (noteId: number, note: Partial<InsertDealNote>) => notesRepository.update(noteId, note);
  deleteDealNote = (noteId: number) => notesRepository.delete(noteId);
  toggleInitialDiscussion = async (companyId: number, completed: boolean, userId: number): Promise<TargetCompany | undefined> => {
    return targetCompaniesRepository.update(companyId, {
      initialDiscussionCompleted: completed,
      initialDiscussionDate: completed ? new Date() : null,
      initialDiscussionBy: completed ? userId : null,
    } as any, 0);
  };

  // Activity operations - delegated to ActivitiesRepository, NotificationsRepository, ReportsRepository
  getActivityTypes = () => activitiesRepository.getActivityTypes();
  createActivity = (activity: InsertActivity) => activitiesRepository.createActivity(activity);
  getActivitiesForCompany = (targetCompanyId: number, userCompanyId: number) => activitiesRepository.getActivitiesForCompany(targetCompanyId, userCompanyId);
  getActivityTimeline = (targetCompanyId: number, userCompanyId: number) => activitiesRepository.getActivityTimeline(targetCompanyId, userCompanyId);
  updateActivity = (activityId: number, activity: Partial<InsertActivity>, userCompanyId: number) => activitiesRepository.updateActivity(activityId, activity, userCompanyId);
  deleteActivity = (activityId: number, userCompanyId: number) => activitiesRepository.deleteActivity(activityId, userCompanyId);
  getRecentActivities = (userCompanyId: number, limit?: number) => activitiesRepository.getRecentActivities(userCompanyId, limit);
  getActivitySummary = (userCompanyId: number, dateRange?: string) => reportsRepository.getActivitySummary(userCompanyId, dateRange);
  getUserPerformance = (userCompanyId: number, dateRange?: string) => reportsRepository.getUserPerformance(userCompanyId, dateRange);
  exportReport = async (userCompanyId: number, reportType: string, format?: string): Promise<string> => {
    return JSON.stringify({ userCompanyId, reportType, format, exported: true });
  };
  createNotification = (notification: InsertTeamNotification) => notificationsRepository.createNotification(notification);
  getUserNotifications = (userId: number) => notificationsRepository.getUserNotifications(userId);
  markNotificationRead = (notificationId: number, userId: number) => notificationsRepository.markNotificationRead(notificationId, userId);
  markAllNotificationsRead = (userId: number) => notificationsRepository.markAllNotificationsRead(userId);

  // Document operations - delegated to DocumentsRepository, DocumentAnalysisRepository, Stage1AnalysisRepository
  getDocumentCategories = () => documentsRepository.getDocumentCategories();
  createDocument = (document: InsertDocument) => documentsRepository.createDocument(document);
  getCompanyDocuments = (targetCompanyId: number, _userCompanyId: number) => documentsRepository.getCompanyDocuments(targetCompanyId);
  getDocument = (documentId: number, userCompanyId: number) => documentsRepository.getDocument(documentId, userCompanyId);
  getDocumentByIdPublic = (documentId: number) => documentsRepository.getDocumentByIdPublic(documentId);
  updateDocument = async (documentId: number, document: Partial<InsertDocument>, userCompanyId: number): Promise<Document | undefined> => {
    const existingDoc = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!existingDoc) return undefined;
    return documentsRepository.updateDocument(documentId, document);
  };
  deleteDocument = async (documentId: number, userCompanyId: number): Promise<boolean> => {
    const existingDoc = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!existingDoc) return false;
    return documentsRepository.deleteDocument(documentId);
  };
  getExternalSubmission = (submissionId: number, userCompanyId: number) => documentsRepository.getExternalSubmission(submissionId, userCompanyId);
  deleteExternalSubmission = async (submissionId: number, userCompanyId: number): Promise<boolean> => {
    const submission = await documentsRepository.getExternalSubmission(submissionId, userCompanyId);
    if (!submission) return false;
    return documentsRepository.deleteExternalSubmission(submissionId);
  };
  getStage1DocumentFiles = (targetCompanyId: number) => stage1AnalysisRepository.getStage1DocumentFiles(targetCompanyId);
  clearAllCompanyDocuments = async (_userCompanyId: number): Promise<any> => {
    return { message: 'Not implemented in repository pattern' };
  };
  logDocumentAccess = (documentId: number, userId: number, accessType: string, ipAddress?: string) => documentsRepository.logDocumentAccess(documentId, userId, accessType, ipAddress);
  createFileUploadEvent = (event: InsertFileUploadEvent) => documentsRepository.createFileUploadEvent(event);
  getFileUploadEventsWithDetails = async (_userCompanyId: number): Promise<any[]> => {
    return [];
  };
  updateFileUploadEventWebhookStatus = (eventId: number, status: string, response?: string, sentAt?: Date) => documentsRepository.updateFileUploadEventWebhookStatus(eventId, status, response, sentAt);
  getFileUploadEvent = (eventId: number) => documentsRepository.getFileUploadEvent(eventId);
  createDocumentAnalysisResult = (result: InsertDocumentAnalysisResult) => documentAnalysisRepository.createAnalysisResult(result);
  getDocumentAnalysisResults = (documentId: number) => documentAnalysisRepository.getAnalysisResultsByDocumentId(documentId);
  getDocumentAnalysisResultsByType = (documentType: string, userCompanyId: number) => documentAnalysisRepository.getAnalysisResultsByType(documentType, userCompanyId);
  getDocumentAnalysisResultsByTypeForCompany = (documentType: string, targetCompanyId: number) => documentAnalysisRepository.getAnalysisResultsByTypeForCompany(documentType, targetCompanyId);
  getDocumentCountByCategory = (targetCompanyId: number, categoryName: string) => stage1AnalysisRepository.getDocumentCountByCategory(targetCompanyId, categoryName);
  getLatestStage1AnalysisEvent = (targetCompanyId: number) => stage1AnalysisRepository.getLatestStage1AnalysisEvent(targetCompanyId);
  getLatestDocumentUploadTime = (targetCompanyId: number) => stage1AnalysisRepository.getLatestDocumentUploadTime(targetCompanyId);
  getPortalAnalysisCompletionStatus = (targetCompanyId: number) => portalSubmissionsRepository.getAnalysisCompletionStatus(targetCompanyId);
  getAnalysisCompletionStatus = (targetCompanyId: number, _userCompanyId: number) => portalSubmissionsRepository.getAnalysisCompletionStatus(targetCompanyId);
  createStage1AnalysisEvent = (event: InsertStage1AnalysisEvent) => stage1AnalysisRepository.createStage1AnalysisEvent(event);
  getStage1AnalysisEvent = (eventId: number) => stage1AnalysisRepository.getStage1AnalysisEvent(eventId);
  getStage1AnalysisEventsByCompany = (targetCompanyId: number, _userCompanyId: number) => stage1AnalysisRepository.getStage1AnalysisEventsByCompany(targetCompanyId);
  updateStage1AnalysisEventWebhookStatus = (eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number, usageMetadata?: any) => stage1AnalysisRepository.updateStage1AnalysisEventStatus(eventId, status, response, sentAt, processingTime, usageMetadata);
  updateStage1AnalysisEventDetailedData = async (eventId: number, detailedData: any): Promise<Stage1AnalysisEvent | undefined> => {
    return stage1AnalysisRepository.updateDetailedAnalysisStatus(eventId, 'success', JSON.stringify(detailedData));
  };
  updateDetailedAnalysisStatus = (eventId: number, status: string, markdown?: string, processingTime?: number, usageMetadata?: any, triggeredBy?: number) => stage1AnalysisRepository.updateDetailedAnalysisStatus(eventId, status, markdown, processingTime, usageMetadata, triggeredBy);

  // Portal operations - delegated to PortalRepository, PortalRequirementsRepository, PortalSubmissionsRepository
  createPortalAccessToken = (token: InsertPortalAccessToken) => portalRepository.createToken(token);
  getPortalAccessToken = (accessToken: string) => portalRepository.validateToken(accessToken);
  validatePortalToken = (accessToken: string) => portalRepository.validateToken(accessToken);
  updatePortalTokenAccess = (tokenId: number, ipAddress?: string, userAgent?: string) => portalRepository.updateTokenAccess(tokenId, ipAddress, userAgent);
  deactivatePortalToken = (tokenId: number) => portalRepository.deactivateToken(tokenId);
  deletePortalToken = (tokenId: number) => portalRepository.deleteToken(tokenId);
  getActivePortalTokensForTargetCompany = (targetCompanyId: number) => portalRepository.getTokensByTargetCompany(targetCompanyId);
  getPortalTokensForCompany = (userCompanyId: number) => portalRepository.getTokensForCompany(userCompanyId);
  getPortalTokenByCompany = (targetCompanyId: number) => portalRepository.getActiveTokenForCompany(targetCompanyId);
  createExternalDocumentSubmission = (submission: InsertExternalDocumentSubmission) => portalRepository.createSubmission(submission);
  getPortalSubmissions = (portalTokenId: number) => portalRepository.getSubmissionsByToken(portalTokenId);
  reviewDocumentSubmission = (submissionId: number, reviewedBy: number, status: string, notes?: string) => portalSubmissionsRepository.reviewSubmission(submissionId, reviewedBy, status, notes);
  createPortalDocumentRequirement = async (requirement: InsertPortalDocumentRequirement): Promise<PortalDocumentRequirement> => {
    throw new Error('Portal document requirements are managed through company requirements');
  };
  getPortalDocumentRequirements = (portalTokenId: number) => portalRequirementsRepository.getPortalRequirementsByToken(portalTokenId);
  updatePortalDocumentRequirement = async (requirementId: number, _requirement: Partial<InsertPortalDocumentRequirement>): Promise<PortalDocumentRequirement | undefined> => {
    throw new Error('Portal document requirements are managed through company requirements');
  };
  logPortalActivity = (activity: InsertPortalActivityLog) => portalRepository.logActivity(activity);
  getPortalActivityLog = async (_portalTokenId: number): Promise<PortalActivityLog[]> => {
    return [];
  };
  getDealTeamEmails = async (targetCompanyId: number): Promise<string[]> => {
    const assignments = await assignmentsRepository.getByDeal(targetCompanyId);
    return assignments.map(a => a.userEmail).filter((email): email is string => !!email);
  };
  createPortalLinkCampaign = async (_campaign: InsertPortalLinkCampaign): Promise<PortalLinkCampaign> => {
    throw new Error('Portal link campaigns not implemented in repository pattern');
  };
  getPortalLinkCampaigns = async (_userCompanyId: number): Promise<PortalLinkCampaign[]> => {
    return [];
  };
  getPortalLinkCampaign = async (_campaignId: number, _userCompanyId: number): Promise<PortalLinkCampaign | undefined> => {
    return undefined;
  };
  updatePortalLinkCampaign = async (_campaignId: number, _userCompanyId: number, _updates: Partial<InsertPortalLinkCampaign>): Promise<PortalLinkCampaign | undefined> => {
    return undefined;
  };
  deletePortalLinkCampaign = async (_campaignId: number, _userCompanyId: number): Promise<boolean> => {
    return false;
  };
  createPortalEmailTemplate = async (_template: InsertPortalEmailTemplate): Promise<PortalEmailTemplate> => {
    throw new Error('Portal email templates not implemented in repository pattern');
  };
  getPortalEmailTemplates = async (_userCompanyId: number): Promise<PortalEmailTemplate[]> => {
    return [];
  };
  getPortalEmailTemplate = async (_templateId: number, _userCompanyId: number): Promise<PortalEmailTemplate | undefined> => {
    return undefined;
  };
  updatePortalEmailTemplate = async (_templateId: number, _userCompanyId: number, _updates: Partial<InsertPortalEmailTemplate>): Promise<PortalEmailTemplate | undefined> => {
    return undefined;
  };
  deletePortalEmailTemplate = async (_templateId: number, _userCompanyId: number): Promise<boolean> => {
    return false;
  };
  getDefaultPortalEmailTemplate = async (_userCompanyId: number, _templateCategory: string): Promise<PortalEmailTemplate | undefined> => {
    return undefined;
  };
  createPortalCommunicationsLog = async (_log: InsertPortalCommunicationsLog): Promise<PortalCommunicationsLog> => {
    throw new Error('Portal communications log not implemented in repository pattern');
  };
  getPortalCommunicationsLog = async (_portalTokenId: number): Promise<PortalCommunicationsLog[]> => {
    return [];
  };
  createPortalAnalytics = async (_analytics: InsertPortalAnalytics): Promise<PortalAnalytics> => {
    throw new Error('Portal analytics not implemented in repository pattern');
  };
  getPortalAnalytics = async (_portalTokenId: number): Promise<PortalAnalytics[] | PortalAnalytics | undefined> => {
    return undefined;
  };
  incrementPortalAnalytics = async (_portalTokenId: number, _field: string): Promise<void> => {
    // Not implemented in repository pattern
  };
  createPortalLinkShare = async (_share: InsertPortalLinkShare): Promise<PortalLinkShare> => {
    throw new Error('Portal link shares not implemented in repository pattern');
  };
  getPortalLinkShares = async (_portalTokenId: number): Promise<PortalLinkShare[]> => {
    return [];
  };
  updatePortalLinkShareUsage = async (_shareId: number): Promise<void> => {
    // Not implemented in repository pattern
  };
  deactivatePortalLinkShare = async (_shareId: number): Promise<boolean> => {
    return false;
  };
  initializeStandardRequirements = (targetCompanyId: number, _userId: number) => portalRequirementsRepository.initializeStandardRequirements(targetCompanyId);
  getCompanyDocumentRequirements = async (targetCompanyId: number, _userCompanyId: number, stage?: number | null): Promise<CompanyDocumentRequirement[]> => {
    const requirements = await portalRequirementsRepository.getCompanyRequirements(targetCompanyId, stage);
    return requirements as unknown as CompanyDocumentRequirement[];
  };
  getDocumentStageProgression = async (targetCompanyId: number, _userCompanyId: number): Promise<DocumentStageProgression | undefined> => {
    const stage1Stats = await portalRequirementsRepository.getRequirementCountByStage(targetCompanyId, 1);
    const stage2Stats = await portalRequirementsRepository.getRequirementCountByStage(targetCompanyId, 2);
    return {
      id: targetCompanyId,
      targetCompanyId,
      currentStage: 1,
      stage1Status: 'in_progress',
      stage2Status: 'locked',
      overallProgress: Math.round(((stage1Stats.completed + stage2Stats.completed) / Math.max(1, stage1Stats.total + stage2Stats.total)) * 100),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as DocumentStageProgression;
  };
  updateCompanyRequirement = async (requirementId: number, updates: any, userId: number): Promise<CompanyDocumentRequirement> => {
    const result = await portalRequirementsRepository.updateRequirement(requirementId, updates, userId);
    if (!result) throw new Error('Requirement not found');
    return result as CompanyDocumentRequirement;
  };
  getValidPortalToken = (token: string) => portalRequirementsRepository.getValidPortalToken(token);
  getSimplePortalData = (portalTokenId: number) => portalSubmissionsRepository.getSimplePortalData(portalTokenId);
  getSimplePortalProgress = async (portalTokenId: number): Promise<any> => {
    const progress = await portalRequirementsRepository.getPortalSubmissionProgress(portalTokenId);
    return { progress, totalSubmissions: progress.reduce((sum, p) => sum + p.count, 0) };
  };

  // Dashboard operations - delegated to DashboardRepository
  getPipelineOverviewWidget = (userCompanyId: number) => dashboardRepository.getPipelineOverviewWidget(userCompanyId);
  getRecentActivitiesWidget = (userCompanyId: number) => dashboardRepository.getRecentActivitiesWidget(userCompanyId);
  getHotDealsWidget = (userCompanyId: number) => dashboardRepository.getHotDealsWidget(userCompanyId);
  getQuickStatsWidget = (userCompanyId: number) => dashboardRepository.getQuickStatsWidget(userCompanyId);
  getUpcomingRemindersWidget = (userId: number) => dashboardRepository.getUpcomingRemindersWidget(userId);
  getTeamActivityWidget = (userCompanyId: number) => dashboardRepository.getTeamActivityWidget(userCompanyId);
  getStageAlertsWidget = (userCompanyId: number) => dashboardRepository.getStageAlertsWidget(userCompanyId);
  getDashboardPreferences = (userId: number) => dashboardRepository.getPreferences(userId);
  updateDashboardPreferences = (userId: number, preferences: any) => dashboardRepository.updatePreferences(userId, preferences);
  getDashboardAlerts = (userCompanyId: number) => dashboardRepository.getAlerts(userCompanyId);
  dismissAlert = (alertId: number, userCompanyId: number) => dashboardRepository.dismissAlert(alertId, userCompanyId);
}

export const storage = new DatabaseStorage();
