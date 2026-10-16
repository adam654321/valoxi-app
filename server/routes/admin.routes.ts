import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql, count, desc, gte, isNotNull, isNull } from 'drizzle-orm';
import Stripe from 'stripe';
import { db } from '../db';
import { config } from '../config';
import { subscriptions, promoCodeCampaigns } from '@shared/schema/billing';
import { userCompanies, users } from '@shared/schema/core';
import { funnelEvents, betaFeedback } from '@shared/schema/dashboard';
import type { PlanKey, SubscriptionStatus } from '@shared/schema/billing';
import { adminService } from '../services/admin.service';
import { billingService } from '../services/billing.service';
import { setSubscriptionSuspension } from '../services/subscription-suspension.service';
import { systemConfigService } from '../services/system-config.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { promoCodeService } from '../services/promo-code.service';
import { emailApiService } from '../services/email.service';
import { clerkClient } from '@clerk/express';
import { sendFiveDWelcome } from './admin-five-d-welcome';

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

const planOverrideSchema = z.object({
  planOverride: z.enum(['core', 'professional', 'expert']).nullable(),
});

router.post('/companies/:id/plan-override', asyncHandler(async (req: Request, res: Response) => {
  const companyId = Number(req.params.id);
  const { planOverride } = planOverrideSchema.parse(req.body);

  const [updated] = await db
    .update(userCompanies)
    .set({ betaPlanOverride: planOverride })
    .where(eq(userCompanies.id, companyId))
    .returning({ id: userCompanies.id, betaPlanOverride: userCompanies.betaPlanOverride });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Company not found', code: 'NOT_FOUND' });
  }

  sendSuccess(res, updated);
}));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getAllUsers();
  sendSuccess(res, data);
}));

router.get('/webhook-events', asyncHandler(async (req: Request, res: Response) => {
  const { status, source, error, page = '1', limit = '50' } = req.query;
  const data = await adminService.getWebhookEvents({
    status: status as string | undefined,
    source: source as string | undefined,
    error: error as string | undefined,
    page: Math.max(1, parseInt(page as string, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50)),
  });
  sendSuccess(res, data);
}));

router.post('/users/:id/email', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  const { subject, body } = req.body;
  if (!subject?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }
  const [user] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return res.status(404).json({ error: 'User not found' });
  const paragraphs = body.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
  const blocks = paragraphs.map((p: string) => ({ type: 'paragraph' as const, text: p }));
  const result = await (emailApiService as any).sendCustomAdminEmail({
    to: user.email,
    subject: subject.trim(),
    heading: subject.trim(),
    blocks,
  });
  if (!result.success) {
    console.error(`[admin] Custom email delivery failed for user ${user.id} (${user.email})`);
    return res.status(500).json({ error: 'Email delivery failed' });
  }
  console.log(`[admin] Custom email sent to user ${user.id} (${user.email}) by admin ${req.session?.userId}`);
  sendSuccess(res, { success: true, message: `Email sent to ${user.email}` });
}));

router.post('/5d-member-welcome', asyncHandler(sendFiveDWelcome));

router.post('/users/:id/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID' });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      clerkUserId: users.clerkUserId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!user.isActive) {
    return res.status(400).json({ success: false, message: 'User is inactive' });
  }
  if (!user.clerkUserId) {
    return res.status(400).json({
      success: false,
      message: 'This user has not set up Clerk access yet. Ask them to sign up via the Clerk sign-up page first.',
    });
  }

  let signInToken;
  try {
    signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: user.clerkUserId,
      expiresInSeconds: 86400,
    });
  } catch (err: any) {
    console.error(`[admin] Clerk sign-in token creation failed for user ${user.id}:`, err);
    if (err?.status === 404 || err?.statusCode === 404) {
      return res.status(400).json({
        success: false,
        message: 'User not found in Clerk. Their Clerk account may have been deleted.',
      });
    }
    throw err;
  }

  const signInUrlWithRedirect = new URL(signInToken.url);
  signInUrlWithRedirect.searchParams.set('redirect_url', config.baseUrl);
  const emailResult = await emailApiService.sendAdminSignInLink({
    to: user.email,
    firstName: user.firstName || 'there',
    signInUrl: signInUrlWithRedirect.toString(),
  });

  if (!emailResult.success) {
    console.error(`[admin] Sign-in link email delivery failed for user ${user.id} (${user.email})`);
    return res.status(500).json({
      success: false,
      message: 'Sign-in token was created but email delivery failed. Please try again.',
    });
  }

  console.log(`[admin] Sign-in link sent to user ${user.id} (${user.email}) by admin ${req.session.userId}`);
  sendSuccess(res, { success: true, message: `Sign-in link sent to ${user.email}` });
}));

const suspensionRequest = z.object({ reason: z.string().trim().max(1000).optional() }).strict();
for (const action of ['suspend', 'resume'] as const) {
  router.post(`/subscriptions/:userCompanyId/${action}`, asyncHandler(async (req: Request, res: Response) => {
    const userCompanyId = z.coerce.number().int().positive().parse(req.params.userCompanyId);
    const { reason } = suspensionRequest.parse(req.body ?? {});
    const subscription = await setSubscriptionSuspension(
      userCompanyId, action === 'suspend', req.session.userId!, reason,
    );
    sendSuccess(res, subscription);
  }));
}

router.get('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const conditions = [];
  if (req.query.status === 'suspended') {
    conditions.push(isNotNull(subscriptions.suspendedAt));
  } else if (req.query.status) {
    conditions.push(eq(subscriptions.status, req.query.status as SubscriptionStatus));
    conditions.push(isNull(subscriptions.suspendedAt));
  }
  if (req.query.planKey) {
    conditions.push(eq(subscriptions.planKey, req.query.planKey as PlanKey));
  }

  const rows = await db
    .select({
      subscription: subscriptions,
      companyName: userCompanies.companyName,
      ownerUserId: sql<number>`(SELECT u.id FROM users u WHERE u.user_company_id = ${subscriptions.userCompanyId} ORDER BY u.id LIMIT 1)`.as('ownerUserId'),
      ownerEmail: sql<string>`(SELECT u.email FROM users u WHERE u.user_company_id = ${subscriptions.userCompanyId} ORDER BY u.id LIMIT 1)`.as('ownerEmail'),
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

  const effectiveStatus = sql<string>`CASE WHEN ${subscriptions.suspendedAt} IS NOT NULL THEN 'suspended' ELSE ${subscriptions.status}::text END`;
  const statusRows = await db
    .select({
      status: effectiveStatus,
      count: count(),
    })
    .from(subscriptions)
    .groupBy(effectiveStatus);

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
        isNull(subscriptions.suspendedAt),
        sql`${subscriptions.trialEnd} <= ${sevenDaysFromNow}`
      )
    );

  const [pastDueRow] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'past_due'), isNull(subscriptions.suspendedAt)));

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


router.get('/stripe-coupons', asyncHandler(async (req: Request, res: Response) => {
  if (!config.stripe.secretKey) {
    return res.status(500).json({ success: false, message: 'Stripe not configured' });
  }
  const stripe = new Stripe(config.stripe.secretKey);
  const coupons = await stripe.coupons.list({ limit: 50 });
  const mapped = coupons.data.map((c) => ({
    id: c.id,
    name: c.name,
    percentOff: c.percent_off,
    amountOff: c.amount_off,
    duration: c.duration,
    durationInMonths: c.duration_in_months,
    valid: c.valid,
  }));
  sendSuccess(res, mapped);
}));

const createPromoCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens only'),
  stripeCouponId: z.string().min(1).max(50),
  referralSource: z.string().min(1).max(50),
  freeMonthsTotal: z.number().int().min(0).default(0),
  maxTotalClaims: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().nullable().optional(),
});

router.post('/promo-campaigns', asyncHandler(async (req: Request, res: Response) => {
  const validated = createPromoCampaignSchema.parse(req.body);

  const [campaign] = await db.insert(promoCodeCampaigns).values({
    name: validated.name,
    slug: validated.slug,
    stripeCouponId: validated.stripeCouponId,
    referralSource: validated.referralSource,
    freeMonthsTotal: validated.freeMonthsTotal,
    maxTotalClaims: validated.maxTotalClaims ?? null,
    isActive: validated.isActive,
    expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
    createdByUserId: req.session.userId!,
  }).returning();

  sendSuccess(res, { campaign }, 201);
}));

router.get('/promo-campaigns', asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await db.select().from(promoCodeCampaigns).orderBy(desc(promoCodeCampaigns.createdAt));

  const result = await Promise.all(campaigns.map(async (campaign) => {
    const [claimed] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.assignedPromoCampaignId, campaign.id));

    return {
      ...campaign,
      totalClaimedByUsers: claimed?.count ?? 0,
    };
  }));

  sendSuccess(res, result);
}));

router.get('/referral-invoice', asyncHandler(async (req: Request, res: Response) => {
  const { month, source } = req.query;
  const result = await billingService.getBillableMembers(
    typeof month === 'string' ? month : undefined,
    typeof source === 'string' ? source : undefined
  );
  sendSuccess(res, result);
}));

router.get('/referral-invoice-records', asyncHandler(async (_req: Request, res: Response) => {
  const records = await billingService.listReferralInvoiceRecords();
  sendSuccess(res, { records });
}));

router.post('/referral-invoice-records/:userCompanyId/resend', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = parseInt(req.params.userCompanyId, 10);
  const result = await billingService.resendFiveDInvoice(userCompanyId);
  sendSuccess(res, result);
}));

router.post('/referral-invoice-records/resend', asyncHandler(async (req: Request, res: Response) => {
  const { userCompanyIds } = z.object({ userCompanyIds: z.array(z.number()).min(1) }).parse(req.body);
  const result = await billingService.resendFiveDInvoices(userCompanyIds);
  sendSuccess(res, result);
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

router.get('/system-config', asyncHandler(async (req: Request, res: Response) => {
  const configs = await systemConfigService.getAllConfig();
  sendSuccess(res, configs);
}));

const setConfigSchema = z.object({
  key: z.enum(['registration_mode', 'issue_reporting_enabled', 'beta_tier_switch_enabled', 'open_access_enabled', 'five_d_invoice_send_day', 'five_d_partner_invoice_email']),
  value: z.string(), // allow empty (blank five_d_partner_invoice_email = pause sending)
});

router.post('/system-config', asyncHandler(async (req: Request, res: Response) => {
  const { key, value } = setConfigSchema.parse(req.body);
  await systemConfigService.setConfig(key, value, req.session.userId!);
  sendSuccess(res, { success: true });
}));

router.get('/feedback', asyncHandler(async (req: Request, res: Response) => {
  const conditions = [];
  if (req.query.status && req.query.status !== 'all') {
    conditions.push(eq(betaFeedback.status, req.query.status as string));
  }
  if (req.query.type && req.query.type !== 'all') {
    conditions.push(eq(betaFeedback.type, req.query.type as string));
  }
  if (req.query.severity && req.query.severity !== 'all') {
    conditions.push(eq(betaFeedback.severity, req.query.severity as string));
  }

  const rows = await db
    .select({
      id: betaFeedback.id,
      userId: betaFeedback.userId,
      userCompanyId: betaFeedback.userCompanyId,
      reporterEmail: betaFeedback.reporterEmail,
      reporterName: betaFeedback.reporterName,
      type: betaFeedback.type,
      severity: betaFeedback.severity,
      title: betaFeedback.title,
      description: betaFeedback.description,
      pageUrl: betaFeedback.pageUrl,
      pageTitle: betaFeedback.pageTitle,
      status: betaFeedback.status,
      adminNotes: betaFeedback.adminNotes,
      screenshotUrl: betaFeedback.screenshotUrl,
      createdAt: betaFeedback.createdAt,
      updatedAt: betaFeedback.updatedAt,
      companyName: userCompanies.companyName,
    })
    .from(betaFeedback)
    .leftJoin(userCompanies, eq(betaFeedback.userCompanyId, userCompanies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(betaFeedback.createdAt))
    .limit(500);

  sendSuccess(res, rows);
}));

const updateFeedbackSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'resolved_test', 'resolved_live', 'resolved_both', 'wont_fix']).optional(),
  adminNotes: z.string().optional(),
});

router.patch('/feedback/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const validated = updateFeedbackSchema.parse(req.body);

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (validated.status !== undefined) updateData.status = validated.status;
  if (validated.adminNotes !== undefined) updateData.adminNotes = validated.adminNotes;

  const [updated] = await db
    .update(betaFeedback)
    .set(updateData)
    .where(eq(betaFeedback.id, id))
    .returning({ id: betaFeedback.id, status: betaFeedback.status });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Feedback not found' });
  }

  sendSuccess(res, updated);
}));

router.get('/feedback/export', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: betaFeedback.id,
      type: betaFeedback.type,
      severity: betaFeedback.severity,
      title: betaFeedback.title,
      description: betaFeedback.description,
      reporterName: betaFeedback.reporterName,
      reporterEmail: betaFeedback.reporterEmail,
      companyName: userCompanies.companyName,
      pageTitle: betaFeedback.pageTitle,
      pageUrl: betaFeedback.pageUrl,
      status: betaFeedback.status,
      adminNotes: betaFeedback.adminNotes,
      createdAt: betaFeedback.createdAt,
      updatedAt: betaFeedback.updatedAt,
    })
    .from(betaFeedback)
    .leftJoin(userCompanies, eq(betaFeedback.userCompanyId, userCompanies.id))
    .orderBy(desc(betaFeedback.createdAt));

  const escape = (val: any): string => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (/^[=+\-@\t]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = ['ID', 'Type', 'Severity', 'Title', 'Description', 'Reporter Name', 'Reporter Email', 'Company', 'Page Title', 'Page URL', 'Status', 'Admin Notes', 'Submitted', 'Updated'];
  const csvRows = rows.map(r => [
    r.id,
    r.type,
    r.severity,
    r.title,
    r.description,
    r.reporterName,
    r.reporterEmail,
    r.companyName,
    r.pageTitle,
    r.pageUrl,
    r.status,
    r.adminNotes,
    r.createdAt ? new Date(r.createdAt).toISOString() : '',
    r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
  ].map(escape).join(','));

  const csv = [headers.join(','), ...csvRows].join('\n');
  const filename = `beta-feedback-${new Date().toISOString().split('T')[0]}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

router.post('/backfill-company-accounts', asyncHandler(async (_req: Request, res: Response) => {
  const { backfillCompanyAccountsRows } = await import('../scripts/backfill-company-accounts');
  const result = await backfillCompanyAccountsRows();
  return res.status(200).json({ success: true, ...result });
}));

router.post('/seed-activity-types', asyncHandler(async (_req: Request, res: Response) => {
  const { seedActivityTypes } = await import('../scripts/seed-activity-types');
  const result = await seedActivityTypes();
  sendSuccess(res, result);
}));

router.post('/seed-pipeline-stages', asyncHandler(async (_req: Request, res: Response) => {
  const { seedDefaultPipelineStages } = await import('../scripts/seed-pipeline-stages');
  await seedDefaultPipelineStages();
  sendSuccess(res, { seeded: true });
}));

router.post('/seed-dd-requirements', asyncHandler(async (_req: Request, res: Response) => {
  const { seedDdRequirements } = await import('../scripts/seed-dd-requirements');
  await seedDdRequirements();
  sendSuccess(res, { seeded: true });
}));

router.post('/seed-deal-document-templates', asyncHandler(async (_req: Request, res: Response) => {
  const { seedTemplates } = await import('../scripts/seed-deal-document-templates');
  await seedTemplates();
  sendSuccess(res, { seeded: true });
}));

router.post('/seed-user-roles', asyncHandler(async (_req: Request, res: Response) => {
  const { seedUserRoles } = await import('../scripts/seed-user-roles');
  await seedUserRoles();
  sendSuccess(res, { seeded: true });
}));

router.post('/users/:id/view-as', asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = parseInt(req.params.id, 10);
  if (isNaN(targetUserId)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID' });
  }

  const [targetUser] = await db
    .select({ id: users.id, isActive: users.isActive, userCompanyId: users.userCompanyId, isSystemAdmin: users.isSystemAdmin })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!targetUser || !targetUser.isActive) {
    return res.status(404).json({ success: false, message: 'User not found or inactive' });
  }
  if (targetUser.isSystemAdmin) {
    return res.status(400).json({ success: false, message: 'Cannot view as another admin' });
  }
  if (!targetUser.userCompanyId) {
    return res.status(400).json({ success: false, message: 'Target user has no company' });
  }

  req.session.adminViewingAsUserId = targetUser.id;
  req.session.adminViewingAsCompanyId = targetUser.userCompanyId;

  console.log(`[admin] view-as activated: admin ${req.session.userId} viewing as user ${targetUser.id}`);
  return res.status(200).json({ success: true });
}));

router.post('/view-as/exit', asyncHandler(async (req: Request, res: Response) => {
  if (!req.session.adminViewingAsUserId) {
    return res.status(400).json({ success: false, message: 'Not in view-as mode' });
  }

  const viewedUserId = req.session.adminViewingAsUserId;
  delete req.session.adminViewingAsUserId;
  delete req.session.adminViewingAsCompanyId;

  console.log(`[admin] view-as exited: admin ${req.session.userId} was viewing user ${viewedUserId}`);
  return res.status(200).json({ success: true });
}));

export default router;
