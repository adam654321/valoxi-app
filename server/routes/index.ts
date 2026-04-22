import type { Express, Request, Response, NextFunction } from 'express';
import pipelineRoutes from './pipeline.routes';
import rolesRoutes from './roles.routes';
import contactsRoutes from './contacts.routes';
import activitiesRoutes from './activities.routes';
import notificationsRoutes from './notifications.routes';
import documentsRoutes from './documents.routes';
import targetCompaniesRoutes from './target-companies.routes';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import teamRoutes, { publicTeamRoutes } from './team.routes';
import assignmentsRoutes from './assignments.routes';
import reportsRoutes from './reports.routes';
import portalRoutes, { portalPublicRoutes } from './portal.routes';
import documentsFilesRoutes, { publicDocumentRoutes } from './documents-files.routes';
import portalSubmissionsRoutes from './portal-submissions.routes';
import documentAnalysisRoutes from './document-analysis.routes';
import portalRequirementsRoutes, { portalRequirementsPublicRoutes } from './portal-requirements.routes';
import emailRoutes from './email.routes';
import websiteAnalysisRoutes from './website-analysis.routes';
import financialDataRoutes from './financial-data.routes';
import chaseUpRoutes from './chase-up.routes';
import expertAnalysisRoutes from './expert-analysis.routes';
import userCompaniesRoutes from './user-companies.routes';
import dealModelRoutes from './deal-model.routes';
import dealDocumentRoutes, { publicDealDocumentRoutes } from './deal-document.routes';
import dueDiligenceRoutes from './due-diligence.routes';
import valueCreationRoutes from './value-creation.routes';
import adminRoutes from './admin.routes';
import adminWaitlistRoutes from './admin-waitlist.routes';
import billingRoutes, { billingWebhookRoutes } from './billing.routes';
import webhooksRoutes from './webhooks.routes';
import publicConfigRoutes from './public.routes';
import publicWaitlistRoutes from './public-waitlist.routes';
import billingAdminRoutes from './billing-admin.routes';
import issueReportsRoutes from './issue-reports.routes';
import onboardingRoutes from './onboarding.routes';
import explainRoutes from './explain.routes';
import betaFeedbackRoutes from './beta-feedback.routes';
import betaRoutes from './beta.routes';
import adminToolsRoutes from './admin-tools.routes';
import accountRoutes from './account.routes';
import { isAuthenticated, isSystemAdmin, requirePermission, blockWritesInViewAsMode, injectViewAsIdentity } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';
import { portalLimiter, analysisTriggerLimiter, waitlistLimiter } from '../middleware/rate-limit';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription';

export function registerModularRoutes(app: Express) {
  // Write-block: applies to ALL /api/v2/* routes.
  // Only the view-as exit endpoint is explicitly exempted so admin can end the session.
  app.use('/api/v2', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/admin/view-as/exit') return next();
    blockWritesInViewAsMode(req, res, next);
  });

  // Identity injection: swap session identity to the viewed user for the duration of
  // each non-admin request. Admin routes must always resolve the real admin identity.
  app.use('/api/v2', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/admin')) return next();
    injectViewAsIdentity(req, res, next);
  });

  app.use('/api/v2/pipeline', isAuthenticated, validateCsrfToken, requireActiveSubscription, pipelineRoutes);
  app.use('/api/v2/roles', isAuthenticated, validateCsrfToken, requirePermission('canManageUsers'), rolesRoutes);
  app.use('/api/v2/contacts', isAuthenticated, validateCsrfToken, requireActiveSubscription, contactsRoutes);
  app.use('/api/v2/activities', isAuthenticated, validateCsrfToken, requireActiveSubscription, activitiesRoutes);
  app.use('/api/v2/notifications', isAuthenticated, validateCsrfToken, notificationsRoutes);
  app.use('/api/v2/documents', isAuthenticated, validateCsrfToken, requireActiveSubscription, documentsRoutes);
  app.use('/api/v2/target-companies', isAuthenticated, validateCsrfToken, requireActiveSubscription, targetCompaniesRoutes);
  app.use('/api/v2/auth', authRoutes);
  app.use('/api/v2/dashboard', isAuthenticated, validateCsrfToken, requireActiveSubscription, dashboardRoutes);
  app.use('/api/v2/team', publicTeamRoutes);
  app.use('/api/v2/team', isAuthenticated, validateCsrfToken, requirePermission('canManageUsers'), teamRoutes);
  app.use('/api/v2/deals', isAuthenticated, validateCsrfToken, requireActiveSubscription, assignmentsRoutes);
  app.use('/api/v2/reports', isAuthenticated, validateCsrfToken, requireActiveSubscription, requirePermission('canAccessAnalytics'), reportsRoutes);
  app.use('/api/v2/portal', portalLimiter, portalPublicRoutes);
  app.use('/api/v2/portal', isAuthenticated, validateCsrfToken, requireActiveSubscription, portalRoutes);
  app.use('/api/v2/files', isAuthenticated, validateCsrfToken, requireActiveSubscription, documentsFilesRoutes);
  app.use('/api/v2/public/documents', portalLimiter, publicDocumentRoutes);
  app.use('/api/v2/portal-submit', portalLimiter, portalSubmissionsRoutes);
  app.use('/api/v2/document-analysis', isAuthenticated, validateCsrfToken, requireActiveSubscription, documentAnalysisRoutes);
  app.use('/api/v2/requirements', isAuthenticated, validateCsrfToken, portalRequirementsRoutes);
  app.use('/api/v2/public/portal', portalLimiter, portalRequirementsPublicRoutes);
  app.use('/api/v2/email', isAuthenticated, validateCsrfToken, requireActiveSubscription, emailRoutes);
  app.use('/api/v2/website-analysis', isAuthenticated, validateCsrfToken, requireActiveSubscription, analysisTriggerLimiter, websiteAnalysisRoutes);
  app.use('/api/v2/financial-data', isAuthenticated, validateCsrfToken, requireActiveSubscription, requirePermission('canViewFinancials'), financialDataRoutes);
  app.use('/api/v2/chase-up', isAuthenticated, validateCsrfToken, requireActiveSubscription, requirePermission('canCreateDeals'), chaseUpRoutes);
  app.use('/api/v2/expert-analysis', isAuthenticated, validateCsrfToken, requireActiveSubscription, requirePermission('canViewFinancials'), analysisTriggerLimiter, expertAnalysisRoutes);
  app.use('/api/v2/user/companies', isAuthenticated, validateCsrfToken, requireActiveSubscription, userCompaniesRoutes);
  app.use('/api/v2/deal-models', isAuthenticated, validateCsrfToken, requireActiveSubscription, dealModelRoutes);
  app.use('/api/v2/deal-documents', isAuthenticated, validateCsrfToken, requireActiveSubscription, dealDocumentRoutes);
  app.use('/api/v2/public/deal-documents', portalLimiter, publicDealDocumentRoutes);
  app.use('/api/v2/due-diligence', isAuthenticated, validateCsrfToken, requireActiveSubscription, dueDiligenceRoutes);
  app.use('/api/v2/value-creation', isAuthenticated, validateCsrfToken, requireFeature('valueCreationModule'), valueCreationRoutes);
  app.use('/api/v2/admin/waitlist', isAuthenticated, validateCsrfToken, isSystemAdmin, adminWaitlistRoutes);
  app.use('/api/v2/admin', isAuthenticated, validateCsrfToken, isSystemAdmin, adminRoutes);
  app.use('/api/v2/issue-reports', isAuthenticated, validateCsrfToken, requireActiveSubscription, issueReportsRoutes);
  app.use('/api/v2/webhooks', webhooksRoutes);
  app.use('/api/v2/public/waitlist', waitlistLimiter, publicWaitlistRoutes);
  app.use('/api/v2/public', publicConfigRoutes);
  app.use('/api/v2/billing', billingWebhookRoutes);
  app.use('/api/v2/billing', isAuthenticated, validateCsrfToken, billingRoutes);
  app.use('/api/v2/billing', isAuthenticated, validateCsrfToken, billingAdminRoutes);
  app.use('/api/v2/onboarding', isAuthenticated, validateCsrfToken, onboardingRoutes);
  app.use('/api/v2/explain', isAuthenticated, validateCsrfToken, requireActiveSubscription, explainRoutes);
  app.use('/api/v2/beta-feedback', isAuthenticated, validateCsrfToken, betaFeedbackRoutes);
  app.use('/api/v2/beta', isAuthenticated, validateCsrfToken, betaRoutes);
  app.use('/api/v2/admin-tools', isAuthenticated, validateCsrfToken, isSystemAdmin, adminToolsRoutes);
  app.use('/api/v2/account', isAuthenticated, validateCsrfToken, accountRoutes);
}
