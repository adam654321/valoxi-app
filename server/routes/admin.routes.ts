import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql, count, desc, gte, isNull, isNotNull } from 'drizzle-orm';
import Stripe from 'stripe';
import { db } from '../db';
import { config } from '../config';
import { subscriptions, promoCodeCampaigns, promoCodes } from '@shared/schema/billing';
import { userCompanies, users } from '@shared/schema/core';
import { issueReports, funnelEvents } from '@shared/schema/dashboard';
import type { PlanKey, SubscriptionStatus } from '@shared/schema/billing';
import { adminService } from '../services/admin.service';
import { systemConfigService } from '../services/system-config.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { passwordResetService } from '../services/password-reset.service';
import { promoCodeService, computeFreeMonthsElapsed } from '../services/promo-code.service';

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
  name: z.string().min(1),
  stripeCouponId: z.string().min(1),
  referralSource: z.string().min(1),
  freeMonthsTotal: z.number().int().min(0).default(0),
  codePrefix: z.string().max(10).default(''),
  codeCount: z.number().int().min(1).max(1000),
  maxUsesPerCode: z.number().int().min(1).default(1),
  expiresAt: z.string().nullable().optional(),
});

router.post('/promo-campaigns', asyncHandler(async (req: Request, res: Response) => {
  const validated = createPromoCampaignSchema.parse(req.body);

  const [campaign] = await db.insert(promoCodeCampaigns).values({
    name: validated.name,
    stripeCouponId: validated.stripeCouponId,
    referralSource: validated.referralSource,
    freeMonthsTotal: validated.freeMonthsTotal,
    codePrefix: validated.codePrefix,
    maxUsesPerCode: validated.maxUsesPerCode,
    expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
    createdByUserId: req.session.userId!,
  }).returning();

  const codes = await promoCodeService.generateCodes(campaign.id, validated.codeCount);

  sendSuccess(res, { campaign, codesGenerated: codes.length }, 201);
}));

router.get('/promo-campaigns', asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await db.select().from(promoCodeCampaigns).orderBy(desc(promoCodeCampaigns.createdAt));

  const result = await Promise.all(campaigns.map(async (campaign) => {
    const [generated] = await db
      .select({ count: count() })
      .from(promoCodes)
      .where(eq(promoCodes.campaignId, campaign.id));

    const [claimed] = await db
      .select({ count: count() })
      .from(promoCodes)
      .where(and(eq(promoCodes.campaignId, campaign.id), isNotNull(promoCodes.claimedAt)));

    return {
      ...campaign,
      generatedCount: generated?.count ?? 0,
      claimedCount: claimed?.count ?? 0,
      remainingCount: (generated?.count ?? 0) - (claimed?.count ?? 0),
    };
  }));

  sendSuccess(res, result);
}));

router.get('/promo-codes', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, status } = req.query;
  const conditions = [];

  if (campaignId) {
    conditions.push(eq(promoCodes.campaignId, Number(campaignId)));
  }

  if (status === 'claimed') {
    conditions.push(isNotNull(promoCodes.claimedAt));
  } else if (status === 'unclaimed') {
    conditions.push(isNull(promoCodes.claimedAt));
  } else if (status === 'expired') {
    conditions.push(sql`${promoCodes.expiresAt} IS NOT NULL AND ${promoCodes.expiresAt} < NOW()`);
  }

  const rows = await db
    .select({
      id: promoCodes.id,
      campaignId: promoCodes.campaignId,
      code: promoCodes.code,
      usesCount: promoCodes.usesCount,
      maxUses: promoCodes.maxUses,
      claimedByUserCompanyId: promoCodes.claimedByUserCompanyId,
      claimedAt: promoCodes.claimedAt,
      expiresAt: promoCodes.expiresAt,
      createdAt: promoCodes.createdAt,
      companyName: userCompanies.companyName,
    })
    .from(promoCodes)
    .leftJoin(userCompanies, eq(promoCodes.claimedByUserCompanyId, userCompanies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(promoCodes.createdAt))
    .limit(500);

  sendSuccess(res, rows);
}));

router.get('/promo-codes/export', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, status } = req.query;
  const conditions = [];

  if (campaignId) {
    conditions.push(eq(promoCodes.campaignId, Number(campaignId)));
  }

  if (status === 'claimed') {
    conditions.push(isNotNull(promoCodes.claimedAt));
  } else if (status === 'unclaimed') {
    conditions.push(isNull(promoCodes.claimedAt));
  } else if (status === 'expired') {
    conditions.push(sql`${promoCodes.expiresAt} IS NOT NULL AND ${promoCodes.expiresAt} < NOW()`);
  }

  const rows = await db
    .select({
      code: promoCodes.code,
      usesCount: promoCodes.usesCount,
      maxUses: promoCodes.maxUses,
      claimedAt: promoCodes.claimedAt,
      expiresAt: promoCodes.expiresAt,
      companyName: userCompanies.companyName,
    })
    .from(promoCodes)
    .leftJoin(userCompanies, eq(promoCodes.claimedByUserCompanyId, userCompanies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(promoCodes.createdAt));

  const csvHeader = 'Code,Uses,Max Uses,Claimed At,Expires At,Company Name\n';
  const csvRows = rows.map((r) =>
    `${r.code},${r.usesCount},${r.maxUses},${r.claimedAt ? r.claimedAt.toISOString() : ''},${r.expiresAt ? r.expiresAt.toISOString() : ''},${r.companyName || ''}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="promo-codes.csv"');
  res.send(csvHeader + csvRows);
}));

router.get('/referral-invoice', asyncHandler(async (req: Request, res: Response) => {
  const { month, source } = req.query;
  const referralSource = (source as string) || '5d_community';

  let targetMonth: Date;
  if (month && typeof month === 'string') {
    targetMonth = new Date(month + '-01');
  } else {
    targetMonth = new Date();
    targetMonth.setDate(1);
  }
  targetMonth.setHours(0, 0, 0, 0);

  const subs = await db
    .select({
      subscription: subscriptions,
      companyName: userCompanies.companyName,
      email: users.email,
    })
    .from(subscriptions)
    .innerJoin(userCompanies, eq(subscriptions.userCompanyId, userCompanies.id))
    .leftJoin(users, eq(userCompanies.id, users.userCompanyId))
    .where(
      and(
        eq(subscriptions.referralSource, referralSource),
        sql`${subscriptions.freeMonthsTotal} > 0`,
        isNotNull(subscriptions.freeMonthsStartedAt)
      )
    );

  const INVOICE_RATE = 50.25;

  const firstDayOfMonth = targetMonth;
  const lastDayOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  const members = subs
    .filter((s) => s.subscription.freeMonthsStartedAt !== null)
    .map((s) => {
      const startedAt = s.subscription.freeMonthsStartedAt!;
      const elapsed = computeFreeMonthsElapsed(startedAt);
      const total = s.subscription.freeMonthsTotal;
      const remaining = Math.max(0, total - elapsed);
      const isInFreePeriod = elapsed < total;

      const endDate = new Date(startedAt);
      endDate.setMonth(endDate.getMonth() + total);

      const overlapsSelectedMonth = startedAt <= lastDayOfMonth && endDate >= firstDayOfMonth;

      if (!overlapsSelectedMonth || !isInFreePeriod) return null;

      return {
        companyName: s.companyName,
        email: s.email,
        planKey: s.subscription.planKey,
        freeMonthsStartedAt: startedAt.toISOString(),
        monthsElapsed: elapsed,
        monthsRemaining: remaining,
        invoiceAmount: INVOICE_RATE,
        isInFreePeriod,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const activeMembers = members.filter((m) => m.isInFreePeriod);
  const totalInvoice = activeMembers.length * INVOICE_RATE;

  const [unclaimedRow] = await db
    .select({ count: count() })
    .from(promoCodes)
    .innerJoin(promoCodeCampaigns, eq(promoCodes.campaignId, promoCodeCampaigns.id))
    .where(
      and(
        eq(promoCodeCampaigns.referralSource, referralSource),
        isNull(promoCodes.claimedAt)
      )
    );

  sendSuccess(res, {
    month: targetMonth.toISOString().slice(0, 7),
    source: referralSource,
    invoiceRate: INVOICE_RATE,
    summary: {
      totalMembersOnFreePeriod: activeMembers.length,
      totalInvoiceAmount: totalInvoice,
      avgPerMember: activeMembers.length > 0 ? totalInvoice / activeMembers.length : 0,
      codesRemainingUnclaimed: unclaimedRow?.count ?? 0,
    },
    members,
  });
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
  key: z.enum(['registration_mode']),
  value: z.string().min(1),
});

router.post('/system-config', asyncHandler(async (req: Request, res: Response) => {
  const { key, value } = setConfigSchema.parse(req.body);
  await systemConfigService.setConfig(key, value, req.session.userId!);
  sendSuccess(res, { success: true });
}));

export default router;
