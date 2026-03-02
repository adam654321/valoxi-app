import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql, count, desc, gte } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '@shared/schema/billing';
import { userCompanies, users } from '@shared/schema/core';
import { issueReports, funnelEvents } from '@shared/schema/dashboard';
import type { PlanKey, SubscriptionStatus } from '@shared/schema/billing';
import { adminService } from '../services/admin.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { passwordResetService } from '../services/password-reset.service';

const router = Router();

router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getPlatformOverview();
  sendSuccess(res, data);
}));

router.get('/token-usage', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, dealId, service, from, to, page = '1', limit = '50' } = req.query;
  const data = await adminService.getTokenUsage({
    companyId: companyId ? Number(companyId) : undefined,
    dealId: dealId ? Number(dealId) : undefined,
    service: service as string | undefined,
    from: from as string | undefined,
    to: to as string | undefined,
    page: Math.max(1, parseInt(page as string, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50)),
  });
  sendSuccess(res, data);
}));

router.get('/token-usage/by-company', asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const data = await adminService.getTokenUsageByCompany(from as string | undefined, to as string | undefined);
  sendSuccess(res, data);
}));

router.get('/token-usage/by-deal', asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const data = await adminService.getTokenUsageByDeal(from as string | undefined, to as string | undefined);
  sendSuccess(res, data);
}));

router.get('/token-usage/by-service', asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const data = await adminService.getTokenUsageByService(from as string | undefined, to as string | undefined);
  sendSuccess(res, data);
}));

router.get('/costs', asyncHandler(async (req: Request, res: Response) => {
  const { costType, from, to } = req.query;
  const data = await adminService.getPlatformCosts({
    costType: costType as string | undefined,
    from: from as string | undefined,
    to: to as string | undefined,
  });
  sendSuccess(res, data);
}));

const createPlatformCostSchema = z.object({
  costType: z.string().min(1),
  provider: z.string().min(1),
  description: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  amountUsd: z.string().or(z.number()).transform(v => String(v)),
  notes: z.string().nullable().optional(),
});

router.post('/costs', asyncHandler(async (req: Request, res: Response) => {
  const validated = createPlatformCostSchema.parse(req.body);
  const data = await adminService.createPlatformCost({
    ...validated,
    createdBy: req.session.userId!,
  });
  sendSuccess(res, data, 201);
}));

router.get('/companies', asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getAllCompanies();
  sendSuccess(res, data);
}));

router.get('/companies/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getCompanyById(Number(req.params.id));
  if (!data) {
    return res.status(404).json({ success: false, message: 'Company not found', code: 'NOT_FOUND' });
  }
  sendSuccess(res, data);
}));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getAllUsers();
  sendSuccess(res, data);
}));

router.get('/webhook-events', asyncHandler(async (req: Request, res: Response) => {
  const { status, source, page = '1', limit = '50' } = req.query;
  const data = await adminService.getWebhookEvents({
    status: status as string | undefined,
    source: source as string | undefined,
    page: Math.max(1, parseInt(page as string, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50)),
  });
  sendSuccess(res, data);
}));

const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/users/:id/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { newPassword } = adminResetPasswordSchema.parse(req.body);
  await passwordResetService.adminResetPassword(userId, newPassword);
  sendSuccess(res, { message: 'Password has been reset successfully.' });
}));

router.get('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const conditions = [];
  if (req.query.status) {
    conditions.push(eq(subscriptions.status, req.query.status as SubscriptionStatus));
  }
  if (req.query.planKey) {
    conditions.push(eq(subscriptions.planKey, req.query.planKey as PlanKey));
  }

  const rows = await db
    .select({
      subscription: subscriptions,
      companyName: userCompanies.companyName,
    })
    .from(subscriptions)
    .innerJoin(userCompanies, eq(subscriptions.userCompanyId, userCompanies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  sendSuccess(res, rows);
}));

router.get('/subscriptions/summary', asyncHandler(async (req: Request, res: Response) => {
  const [totalRow] = await db
    .select({ total: count() })
    .from(subscriptions);

  const statusRows = await db
    .select({
      status: subscriptions.status,
      count: count(),
    })
    .from(subscriptions)
    .groupBy(subscriptions.status);

  const planRows = await db
    .select({
      planKey: subscriptions.planKey,
      count: count(),
    })
    .from(subscriptions)
    .groupBy(subscriptions.planKey);

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [trialsExpiring] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'trialing'),
        sql`${subscriptions.trialEnd} <= ${sevenDaysFromNow}`
      )
    );

  const [pastDueRow] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'past_due'));

  const byStatus: Record<string, number> = {};
  for (const r of statusRows) {
    byStatus[r.status] = r.count;
  }

  const byPlan: Record<string, number> = {};
  for (const r of planRows) {
    byPlan[r.planKey] = r.count;
  }

  sendSuccess(res, {
    total: totalRow.total,
    byStatus,
    byPlan,
    trialsExpiringSoon: trialsExpiring.count,
    pastDue: pastDueRow.count,
  });
}));

router.get('/issue-reports', asyncHandler(async (req: Request, res: Response) => {
  const conditions = [];
  if (req.query.status) {
    conditions.push(eq(issueReports.status, req.query.status as string));
  }

  const rows = await db
    .select({
      id: issueReports.id,
      userId: issueReports.userId,
      userEmail: users.email,
      companyName: userCompanies.companyName,
      pageUrl: issueReports.pageUrl,
      title: issueReports.title,
      description: issueReports.description,
      severity: issueReports.severity,
      status: issueReports.status,
      adminNotes: issueReports.adminNotes,
      createdAt: issueReports.createdAt,
    })
    .from(issueReports)
    .leftJoin(users, eq(issueReports.userId, users.id))
    .leftJoin(userCompanies, eq(issueReports.userCompanyId, userCompanies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(issueReports.createdAt))
    .limit(100);

  sendSuccess(res, rows);
}));

router.patch('/issue-reports/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updateSchema = z.object({
    status: z.enum(['open', 'in_progress', 'resolved']),
    adminNotes: z.string().optional(),
  });
  const validated = updateSchema.parse(req.body);

  const [updated] = await db
    .update(issueReports)
    .set(validated)
    .where(eq(issueReports.id, id))
    .returning({ id: issueReports.id, status: issueReports.status });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Report not found' });
  }

  sendSuccess(res, updated);
}));

router.get('/funnel', asyncHandler(async (req: Request, res: Response) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const eventNames = [
    'user.registered',
    'trial.started',
    'target.created',
    'document.uploaded',
    'analysis.completed',
    'deal_model.saved',
    'document.generated',
    'subscription.activated',
    'onboarding.completed',
  ] as const;

  const counts: Record<string, number> = {};
  for (const eventName of eventNames) {
    const [result] = await db
      .select({ count: count() })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.event, eventName),
          gte(funnelEvents.createdAt, thirtyDaysAgo)
        )
      );
    counts[eventName] = result?.count ?? 0;
  }

  const pct = (numerator: number, denominator: number): string => {
    if (denominator === 0) return '0%';
    return Math.round((numerator / denominator) * 100) + '%';
  };

  const last30Days = {
    registered: counts['user.registered'],
    trialStarted: counts['trial.started'],
    targetCreated: counts['target.created'],
    documentUploaded: counts['document.uploaded'],
    analysisCompleted: counts['analysis.completed'],
    dealModelSaved: counts['deal_model.saved'],
    documentGenerated: counts['document.generated'],
    subscriptionActivated: counts['subscription.activated'],
    onboardingCompleted: counts['onboarding.completed'],
  };

  const conversionRates = {
    registeredToTrial: pct(last30Days.trialStarted, last30Days.registered),
    trialToTargetCreated: pct(last30Days.targetCreated, last30Days.trialStarted),
    targetToAnalysis: pct(last30Days.analysisCompleted, last30Days.targetCreated),
    analysisToModelSaved: pct(last30Days.dealModelSaved, last30Days.analysisCompleted),
    modelToDocumentGenerated: pct(last30Days.documentGenerated, last30Days.dealModelSaved),
  };

  sendSuccess(res, { last30Days, conversionRates });
}));

export default router;
