import { relations } from 'drizzle-orm';

// Core
import { userCompanies, users, userCompanyMemberships, userSessions, userInvitations, userRoles } from './core';

// Deals
import { targetCompanies, targetContacts, pipelineStages, stageHistory, activityTypes, activities, dealNotes, userDealAssignments, teamNotifications } from './deals';

// Documents
import { documentCategories, documents, documentAccessLog, fileUploadEvents, documentAnalysisResults, stage1AnalysisEvents, expertAnalysisResults } from './documents';

// Portal
import { portalAccessTokens, externalDocumentSubmissions, portalDocumentRequirements, portalActivityLog, chaseUpEmails, chaseUpSchedules, portalLinkCampaigns, portalLinkShares, portalEmailTemplates, portalCommunicationsLog, portalAnalytics, companyDocumentRequirements, documentStageProgression } from './portal';

// Financials
import { financialPeriods, incomeStatements, balanceSheets, staffData, agedDebtors, fixedAssetsRegister, loanFacilities, ebitdaAdjustments, valuations } from './financials';

// Deal Models
import { dealModels, dealModelAdjustments, dealModelFundingLines } from './deal-models';

// Dashboard
import { dashboardPreferences, dashboardAlerts } from './dashboard';

// Due Diligence
import { ddCategories, ddRequirements, ddRequirementStatus } from './due-diligence';

export const userCompaniesRelations = relations(userCompanies, ({ many }) => ({
  users: many(users),
  targetCompanies: many(targetCompanies),
  invitations: many(userInvitations),
  notifications: many(teamNotifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [users.userCompanyId],
    references: [userCompanies.id],
  }),
  targetCompanies: many(targetCompanies),
  sessions: many(userSessions),
  invitationsSent: many(userInvitations, { relationName: "inviter" }),
  dealAssignments: many(userDealAssignments, { relationName: "assignedUser" }),
  dealAssignmentsMade: many(userDealAssignments, { relationName: "assigner" }),
  notificationsReceived: many(teamNotifications, { relationName: "targetUser" }),
  notificationsSent: many(teamNotifications, { relationName: "fromUser" }),
  activities: many(activities),
  expertAnalysisResults: many(expertAnalysisResults),
}));

export const targetCompaniesRelations = relations(targetCompanies, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [targetCompanies.userCompanyId],
    references: [userCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [targetCompanies.createdBy],
    references: [users.id],
  }),
  stageUpdatedByUser: one(users, {
    fields: [targetCompanies.stageUpdatedBy],
    references: [users.id],
    relationName: "stageUpdater",
  }),
  contacts: many(targetContacts),
  dealAssignments: many(userDealAssignments),
  notifications: many(teamNotifications),
  stageHistory: many(stageHistory),
  activities: many(activities),
  documents: many(documents),
  stage1AnalysisEvents: many(stage1AnalysisEvents),
  expertAnalysisResults: many(expertAnalysisResults),
  dealModels: many(dealModels),
}));

export const targetContactsRelations = relations(targetContacts, ({ one, many }) => ({
  targetCompany: one(targetCompanies, {
    fields: [targetContacts.targetCompanyId],
    references: [targetCompanies.id],
  }),
  activities: many(activities),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [userInvitations.userCompanyId],
    references: [userCompanies.id],
  }),
  inviter: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
    relationName: "inviter",
  }),
}));

export const userDealAssignmentsRelations = relations(userDealAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userDealAssignments.userId],
    references: [users.id],
    relationName: "assignedUser",
  }),
  targetCompany: one(targetCompanies, {
    fields: [userDealAssignments.targetCompanyId],
    references: [targetCompanies.id],
  }),
  assignedBy: one(users, {
    fields: [userDealAssignments.assignedBy],
    references: [users.id],
    relationName: "assigner",
  }),
}));

export const teamNotificationsRelations = relations(teamNotifications, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [teamNotifications.userCompanyId],
    references: [userCompanies.id],
  }),
  targetUser: one(users, {
    fields: [teamNotifications.targetUserId],
    references: [users.id],
    relationName: "targetUser",
  }),
  fromUser: one(users, {
    fields: [teamNotifications.fromUserId],
    references: [users.id],
    relationName: "fromUser",
  }),
  targetCompany: one(targetCompanies, {
    fields: [teamNotifications.targetCompanyId],
    references: [targetCompanies.id],
  }),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ many }) => ({
  stageHistory: many(stageHistory),
}));

export const stageHistoryRelations = relations(stageHistory, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [stageHistory.targetCompanyId],
    references: [targetCompanies.id],
  }),
  changedByUser: one(users, {
    fields: [stageHistory.changedBy],
    references: [users.id],
  }),
  pipelineStage: one(pipelineStages, {
    fields: [stageHistory.toStage],
    references: [pipelineStages.stageName],
  }),
}));

export const activityTypesRelations = relations(activityTypes, ({ many }) => ({
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [activities.targetCompanyId],
    references: [targetCompanies.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  contact: one(targetContacts, {
    fields: [activities.contactId],
    references: [targetContacts.id],
  }),
  activityType: one(activityTypes, {
    fields: [activities.activityType],
    references: [activityTypes.typeName],
  }),
}));

export const documentCategoriesRelations = relations(documentCategories, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  targetCompany: one(targetCompanies, {
    fields: [documents.targetCompanyId],
    references: [targetCompanies.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  category: one(documentCategories, {
    fields: [documents.documentCategory],
    references: [documentCategories.categoryName],
  }),
  accessLog: many(documentAccessLog),
  uploadEvents: many(fileUploadEvents),
}));

export const fileUploadEventsRelations = relations(fileUploadEvents, ({ one, many }) => ({
  document: one(documents, {
    fields: [fileUploadEvents.documentId],
    references: [documents.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [fileUploadEvents.targetCompanyId],
    references: [targetCompanies.id],
  }),
  uploadedByUser: one(users, {
    fields: [fileUploadEvents.uploadedBy],
    references: [users.id],
  }),
  analysisResults: many(documentAnalysisResults),
}));

export const documentAnalysisResultsRelations = relations(documentAnalysisResults, ({ one }) => ({
  document: one(documents, {
    fields: [documentAnalysisResults.documentId],
    references: [documents.id],
  }),
  fileUploadEvent: one(fileUploadEvents, {
    fields: [documentAnalysisResults.fileUploadEventId],
    references: [fileUploadEvents.id],
  }),
}));

export const stage1AnalysisEventsRelations = relations(stage1AnalysisEvents, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [stage1AnalysisEvents.targetCompanyId],
    references: [targetCompanies.id],
  }),
  triggeredByUser: one(users, {
    fields: [stage1AnalysisEvents.triggeredBy],
    references: [users.id],
  }),
}));

export const expertAnalysisResultsRelations = relations(expertAnalysisResults, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [expertAnalysisResults.targetCompanyId],
    references: [targetCompanies.id],
  }),
  triggeredByUser: one(users, {
    fields: [expertAnalysisResults.triggeredBy],
    references: [users.id],
  }),
  stage1Event: one(stage1AnalysisEvents, {
    fields: [expertAnalysisResults.stage1EventId],
    references: [stage1AnalysisEvents.id],
  }),
}));

export const dealNotesRelations = relations(dealNotes, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [dealNotes.targetCompanyId],
    references: [targetCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [dealNotes.createdBy],
    references: [users.id],
  }),
}));

export const documentAccessLogRelations = relations(documentAccessLog, ({ one }) => ({
  document: one(documents, {
    fields: [documentAccessLog.documentId],
    references: [documents.id],
  }),
  accessedByUser: one(users, {
    fields: [documentAccessLog.accessedBy],
    references: [users.id],
  }),
}));

export const dashboardPreferencesRelations = relations(dashboardPreferences, ({ one }) => ({
  user: one(users, {
    fields: [dashboardPreferences.userId],
    references: [users.id],
  }),
}));

export const dashboardAlertsRelations = relations(dashboardAlerts, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [dashboardAlerts.userCompanyId],
    references: [userCompanies.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [dashboardAlerts.targetCompanyId],
    references: [targetCompanies.id],
  }),
}));

export const companyDocumentRequirementsRelations = relations(companyDocumentRequirements, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [companyDocumentRequirements.targetCompanyId],
    references: [targetCompanies.id],
  }),
  submittedDocument: one(externalDocumentSubmissions, {
    fields: [companyDocumentRequirements.submittedDocumentId],
    references: [externalDocumentSubmissions.id],
  }),
  submittedByContact: one(targetContacts, {
    fields: [companyDocumentRequirements.submittedByContactId],
    references: [targetContacts.id],
  }),
  reviewedByUser: one(users, {
    fields: [companyDocumentRequirements.reviewedBy],
    references: [users.id],
  }),
}));

export const documentStageProgressionRelations = relations(documentStageProgression, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [documentStageProgression.targetCompanyId],
    references: [targetCompanies.id],
  }),
  stage1CompletedByUser: one(users, {
    fields: [documentStageProgression.stage1CompletedBy],
    references: [users.id],
  }),
  stage2CompletedByUser: one(users, {
    fields: [documentStageProgression.stage2CompletedBy],
    references: [users.id],
  }),
}));

export const financialPeriodsRelations = relations(financialPeriods, ({ one, many }) => ({
  targetCompany: one(targetCompanies, {
    fields: [financialPeriods.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [financialPeriods.sourceDocumentId],
    references: [documents.id],
  }),
  incomeStatements: many(incomeStatements),
  balanceSheets: many(balanceSheets),
  staffData: many(staffData),
}));

export const incomeStatementsRelations = relations(incomeStatements, ({ one }) => ({
  financialPeriod: one(financialPeriods, {
    fields: [incomeStatements.financialPeriodId],
    references: [financialPeriods.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [incomeStatements.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [incomeStatements.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const balanceSheetsRelations = relations(balanceSheets, ({ one }) => ({
  financialPeriod: one(financialPeriods, {
    fields: [balanceSheets.financialPeriodId],
    references: [financialPeriods.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [balanceSheets.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [balanceSheets.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const staffDataRelations = relations(staffData, ({ one }) => ({
  financialPeriod: one(financialPeriods, {
    fields: [staffData.financialPeriodId],
    references: [financialPeriods.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [staffData.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [staffData.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const agedDebtorsRelations = relations(agedDebtors, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [agedDebtors.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [agedDebtors.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const fixedAssetsRegisterRelations = relations(fixedAssetsRegister, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [fixedAssetsRegister.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [fixedAssetsRegister.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const loanFacilitiesRelations = relations(loanFacilities, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [loanFacilities.targetCompanyId],
    references: [targetCompanies.id],
  }),
  sourceDocument: one(documents, {
    fields: [loanFacilities.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const ebitdaAdjustmentsRelations = relations(ebitdaAdjustments, ({ one }) => ({
  financialPeriod: one(financialPeriods, {
    fields: [ebitdaAdjustments.financialPeriodId],
    references: [financialPeriods.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [ebitdaAdjustments.targetCompanyId],
    references: [targetCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [ebitdaAdjustments.createdBy],
    references: [users.id],
  }),
}));

export const dealModelsRelations = relations(dealModels, ({ one, many }) => ({
  targetCompany: one(targetCompanies, {
    fields: [dealModels.targetCompanyId],
    references: [targetCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [dealModels.createdBy],
    references: [users.id],
  }),
  parentModel: one(dealModels, {
    fields: [dealModels.parentModelId],
    references: [dealModels.id],
    relationName: "parentChild",
  }),
  adjustments: many(dealModelAdjustments),
  fundingLines: many(dealModelFundingLines),
}));

export const dealModelAdjustmentsRelations = relations(dealModelAdjustments, ({ one }) => ({
  dealModel: one(dealModels, {
    fields: [dealModelAdjustments.dealModelId],
    references: [dealModels.id],
  }),
  sourceExpertResult: one(expertAnalysisResults, {
    fields: [dealModelAdjustments.sourceExpertResultId],
    references: [expertAnalysisResults.id],
  }),
}));

export const dealModelFundingLinesRelations = relations(dealModelFundingLines, ({ one }) => ({
  dealModel: one(dealModels, {
    fields: [dealModelFundingLines.dealModelId],
    references: [dealModels.id],
  }),
}));

export const valuationsRelations = relations(valuations, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [valuations.targetCompanyId],
    references: [targetCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [valuations.createdBy],
    references: [users.id],
  }),
}));

export const ddCategoriesRelations = relations(ddCategories, ({ many }) => ({
  requirements: many(ddRequirements),
}));

export const ddRequirementsRelations = relations(ddRequirements, ({ one, many }) => ({
  category: one(ddCategories, {
    fields: [ddRequirements.categoryId],
    references: [ddCategories.id],
  }),
  statuses: many(ddRequirementStatus),
}));

export const ddRequirementStatusRelations = relations(ddRequirementStatus, ({ one }) => ({
  requirement: one(ddRequirements, {
    fields: [ddRequirementStatus.requirementId],
    references: [ddRequirements.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [ddRequirementStatus.targetCompanyId],
    references: [targetCompanies.id],
  }),
  document: one(documents, {
    fields: [ddRequirementStatus.documentId],
    references: [documents.id],
  }),
  externalSubmission: one(externalDocumentSubmissions, {
    fields: [ddRequirementStatus.externalSubmissionId],
    references: [externalDocumentSubmissions.id],
  }),
  reviewedByUser: one(users, {
    fields: [ddRequirementStatus.reviewedBy],
    references: [users.id],
    relationName: "ddReviewedBy",
  }),
}));
