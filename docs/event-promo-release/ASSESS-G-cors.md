# ASSESS G — Development CORS configuration

```text
rg -n "cors|Access-Control|origin" server/index.ts | head -40
26:  const originalResJson = res.json;
29:    return originalResJson.apply(res, [bodyJson, ...args]);

rg -l "cors" server --glob "*.ts" | sort
server/routes/index.ts

rg -n "cors\(|allowedOrigins|ALLOWED_ORIGINS|credentials: true" server --glob "*.ts" | head -30
server/middleware/public-cors.ts:11:const allowedOrigins: string[] = [
server/middleware/public-cors.ts:22:    if (allowedOrigins.includes(requestOrigin)) {

rg -n "cors" server/routes/index.ts
50:import { publicCors } from '../middleware/public-cors';

sed -n '1,60p' server/middleware/public-cors.ts
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * CORS for the public endpoints the marketing site calls cross-origin.
 * Allowlist: the marketing site origin (prod) plus localhost in non-production.
 * An Origin that is present but not on the allowlist is rejected with 403.
 * A request with no Origin header (same-origin / server-to-server) passes through.
 * Applied per-router (checkout + config), NOT on the shared /api/v2/public prefix.
 */
const allowedOrigins: string[] = [
  config.marketing.siteUrl,
  ...(config.server.isProduction
    ? []
    : ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:3008']),
];

export function publicCors(req: Request, res: Response, next: NextFunction) {
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    if (allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    } else {
      return res.status(403).json({
        success: false,
        message: 'Origin not allowed',
        code: 'CORS_ORIGIN_REJECTED',
      });
    }
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

sed -n '1,60p' server/routes/index.ts
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
import marketingWebhooksRoutes from './marketing-webhooks.routes';
import publicConfigRoutes from './public.routes';
import publicWaitlistRoutes from './public-waitlist.routes';
import publicMarketingConsentRoutes from './public-marketing-consent.routes';
import publicCheckoutRoutes from './public-checkout.routes';
import billingAdminRoutes from './billing-admin.routes';
import onboardingRoutes from './onboarding.routes';
import complianceRoutes from './compliance.routes';
import explainRoutes from './explain.routes';
import betaFeedbackRoutes from './beta-feedback.routes';
import betaRoutes from './beta.routes';
import adminToolsRoutes from './admin-tools.routes';
import adminBroadcastsRoutes from './admin-broadcasts.routes';
import accountRoutes from './account.routes';
import nylasRoutes, { nylasCallbackRouter } from './nylas.routes';
import { isAuthenticated, isSystemAdmin, requirePermission, blockWritesInViewAsMode, injectViewAsIdentity } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';
import { publicCors } from '../middleware/public-cors';
import { portalLimiter, analysisTriggerLimiter, waitlistLimiter } from '../middleware/rate-limit';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription';

export function registerModularRoutes(app: Express) {
  // Write-block: applies to ALL /api/v2/* routes.
  // Only the view-as exit endpoint is explicitly exempted so admin can end the session.
  app.use('/api/v2', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/admin/view-as/exit') return next();
    blockWritesInViewAsMode(req, res, next);
  });

rg -n "public-checkout|public.routes|/api/v2/public" server/index.ts server/routes/index.ts 2>/dev/null | head -20
server/routes/index.ts:34:import publicConfigRoutes from './public.routes';
server/routes/index.ts:37:import publicCheckoutRoutes from './public-checkout.routes';
server/routes/index.ts:85:  app.use('/api/v2/public/documents', portalLimiter, publicDocumentRoutes);
server/routes/index.ts:89:  app.use('/api/v2/public/portal', portalLimiter, portalRequirementsPublicRoutes);
server/routes/index.ts:98:  app.use('/api/v2/public/deal-documents', portalLimiter, publicDealDocumentRoutes);
server/routes/index.ts:106:  app.use('/api/v2/public/waitlist', waitlistLimiter, publicWaitlistRoutes);
server/routes/index.ts:107:  app.use('/api/v2/public/marketing-consent', waitlistLimiter, publicMarketingConsentRoutes);
server/routes/index.ts:108:  app.use('/api/v2/public', publicCors, publicConfigRoutes);
server/routes/index.ts:109:  app.use('/api/v2/public', publicCors, waitlistLimiter, publicCheckoutRoutes);

sed -n '75,114p' server/routes/index.ts
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
  app.use('/api/v2/admin/broadcasts', isAuthenticated, validateCsrfToken, isSystemAdmin, adminBroadcastsRoutes);
  app.use('/api/v2/admin', isAuthenticated, validateCsrfToken, isSystemAdmin, adminRoutes);
  app.use('/api/v2/webhooks', webhooksRoutes);
  app.use('/api/v2/webhooks', marketingWebhooksRoutes);
  app.use('/api/v2/public/waitlist', waitlistLimiter, publicWaitlistRoutes);
  app.use('/api/v2/public/marketing-consent', waitlistLimiter, publicMarketingConsentRoutes);
  app.use('/api/v2/public', publicCors, publicConfigRoutes);
  app.use('/api/v2/public', publicCors, waitlistLimiter, publicCheckoutRoutes);
  app.use('/api/v2/billing', billingWebhookRoutes);
  app.use('/api/v2/billing', isAuthenticated, validateCsrfToken, billingRoutes);
  app.use('/api/v2/billing', isAuthenticated, validateCsrfToken, billingAdminRoutes);
  app.use('/api/v2/onboarding', isAuthenticated, validateCsrfToken, onboardingRoutes);
  app.use('/api/v2/compliance', isAuthenticated, validateCsrfToken, complianceRoutes);

curl -s -i -X OPTIONS http://localhost:5000/api/v2/public/checkout -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" | head -30
HTTP/1.1 403 Forbidden
X-Powered-By: Express
x-clerk-auth-reason: dev-browser-missing
x-clerk-auth-status: signed-out
Content-Type: application/json; charset=utf-8
Content-Length: 78
ETag: W/"4e-VWlV1846DUB5HYUG6ogdCmczGGI"
Set-Cookie: sid=s%3Ap5qoabHQ-teUPELU-XxmyNvFrrggfq_l.mHlO0pTqv8vYg35N9OnpPy46sC7q8QPN8GLWrXXLO0o; Path=/; Expires=Mon, 21 Sep 2026 11:46:34 GMT; HttpOnly; SameSite=Lax
Date: Mon, 14 Sep 2026 11:46:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"success":false,"message":"Origin not allowed","code":"CORS_ORIGIN_REJECTED"}

curl -s -i http://localhost:5000/api/v2/public/config -H "Origin: http://localhost:3000" | head -20
HTTP/1.1 403 Forbidden
X-Powered-By: Express
x-clerk-auth-reason: dev-browser-missing
x-clerk-auth-status: signed-out
Content-Type: application/json; charset=utf-8
Content-Length: 78
ETag: W/"4e-VWlV1846DUB5HYUG6ogdCmczGGI"
Set-Cookie: sid=s%3ADgss3Ki4dsnvGJtzt2CTLLo7qK8lp_rD.w1HTtofxXNPowyUpV78zuiqtAVnfUeeDw8jOx1koPU0; Path=/; Expires=Mon, 21 Sep 2026 11:46:34 GMT; HttpOnly; SameSite=Lax
Date: Mon, 14 Sep 2026 11:46:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"success":false,"message":"Origin not allowed","code":"CORS_ORIGIN_REJECTED"}

rg -n "NODE_ENV|isProduction|isDev" server/config.ts server/index.ts 2>/dev/null | head -20
server/config.ts:18:    nodeEnv: process.env.NODE_ENV || 'development',
server/config.ts:19:    isDevelopment: process.env.NODE_ENV !== 'production',
server/config.ts:20:    isProduction: process.env.NODE_ENV === 'production',
```

Public configuration and checkout routes run after `publicCors` in their respective `app.use` middleware chains. There is no global CORS middleware shown in `server/index.ts`.

OPTIONS `Access-Control-Allow-Origin`: NOT PRESENT.

GET `Access-Control-Allow-Origin`: NOT PRESENT.

Development versus production is distinguished by exact comparison of `process.env.NODE_ENV` with `'production'`: non-production means development, while equality means production. The current CORS allowlist uses `config.server.isProduction` to add localhost origins only outside production.