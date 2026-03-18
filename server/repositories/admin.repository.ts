import { eq, and, count, sum, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import {
  tokenUsage,
  platformCosts,
  webhookEvents,
  users,
  userCompanies,
  targetCompanies,
  type InsertPlatformCost,
} from '@shared/schema';

export class AdminRepository {
  async getPlatformOverview() {
    const monthStart = sql`date_trunc('month', now())`;

    const [tokenStats] = await db.select({
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsage.totalTokens}), 0)::int`,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsage.promptTokens}), 0)::int`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsage.candidateTokens}), 0)::int`,
      totalEstimatedCost: sql<string>`COALESCE(SUM(${tokenUsage.estimatedCostUsd}), 0)::numeric(10,6)`,
      inputCost: sql<string>`COALESCE(SUM(${tokenUsage.inputCostUsd}), 0)::numeric(10,6)`,
      outputCost: sql<string>`COALESCE(SUM(${tokenUsage.outputCostUsd}), 0)::numeric(10,6)`,
    }).from(tokenUsage).where(gte(tokenUsage.createdAt, monthStart));

    const [manualCosts] = await db.select({
      totalManualCost: sql<string>`COALESCE(SUM(${platformCosts.amountUsd}), 0)::numeric(10,2)`,
    }).from(platformCosts).where(gte(platformCosts.createdAt, monthStart));

    const [companyCount] = await db.select({ count: count() }).from(userCompanies);
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));

    return {
      totalTokensThisMonth: tokenStats.totalTokens,
      inputTokensThisMonth: tokenStats.inputTokens,
      outputTokensThisMonth: tokenStats.outputTokens,
      totalEstimatedCostThisMonth: parseFloat(tokenStats.totalEstimatedCost),
      inputCostThisMonth: parseFloat(tokenStats.inputCost),
      outputCostThisMonth: parseFloat(tokenStats.outputCost),
      totalManualPlatformCostsThisMonth: parseFloat(manualCosts.totalManualCost),
      activeCompanies: companyCount.count,
      activeUsers: userCount.count,
    };
  }

  async getTokenUsage(filters: {
    companyId?: number;
    dealId?: number;
    service?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }) {
    const conditions = [];
    if (filters.companyId) conditions.push(eq(tokenUsage.userCompanyId, filters.companyId));
    if (filters.dealId) conditions.push(eq(tokenUsage.dealId, filters.dealId));
    if (filters.service) conditions.push(eq(tokenUsage.service, filters.service));
    if (filters.from) conditions.push(gte(tokenUsage.createdAt, sql`${filters.from}::timestamp`));
    if (filters.to) conditions.push(lte(tokenUsage.createdAt, sql`${filters.to}::timestamp`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.limit;

    const [countResult] = await db.select({ count: count() }).from(tokenUsage).where(where);

    const rows = await db
      .select({
        id: tokenUsage.id,
        userId: tokenUsage.userId,
        userEmail: users.email,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userCompanyId: tokenUsage.userCompanyId,
        companyName: userCompanies.companyName,
        dealId: tokenUsage.dealId,
        documentId: tokenUsage.documentId,
        service: tokenUsage.service,
        model: tokenUsage.model,
        promptTokens: tokenUsage.promptTokens,
        candidateTokens: tokenUsage.candidateTokens,
        totalTokens: tokenUsage.totalTokens,
        estimatedCostUsd: tokenUsage.estimatedCostUsd,
        createdAt: tokenUsage.createdAt,
      })
      .from(tokenUsage)
      .leftJoin(users, eq(tokenUsage.userId, users.id))
      .leftJoin(userCompanies, eq(tokenUsage.userCompanyId, userCompanies.id))
      .where(where)
      .orderBy(desc(tokenUsage.createdAt))
      .limit(filters.limit)
      .offset(offset);

    return { rows, total: countResult.count, page: filters.page, limit: filters.limit };
  }

  async getTokenUsageByCompany(from?: string, to?: string) {
    const conditions = [];
    if (from) conditions.push(gte(tokenUsage.createdAt, sql`${from}::timestamp`));
    if (to) conditions.push(lte(tokenUsage.createdAt, sql`${to}::timestamp`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select({
        userCompanyId: tokenUsage.userCompanyId,
        companyName: sql<string>`COALESCE(${userCompanies.companyName}, 'No Company')`,
        promptTokens: sql<number>`SUM(${tokenUsage.promptTokens})::int`,
        candidateTokens: sql<number>`SUM(${tokenUsage.candidateTokens})::int`,
        totalTokens: sql<number>`SUM(${tokenUsage.totalTokens})::int`,
        inputCost: sql<string>`SUM(${tokenUsage.inputCostUsd})::numeric(10,6)`,
        outputCost: sql<string>`SUM(${tokenUsage.outputCostUsd})::numeric(10,6)`,
        totalCost: sql<string>`SUM(${tokenUsage.estimatedCostUsd})::numeric(10,6)`,
      })
      .from(tokenUsage)
      .leftJoin(userCompanies, eq(tokenUsage.userCompanyId, userCompanies.id))
      .where(where)
      .groupBy(tokenUsage.userCompanyId, userCompanies.companyName)
      .orderBy(desc(sql`SUM(${tokenUsage.estimatedCostUsd})`));
  }

  async getTokenUsageByDeal(from?: string, to?: string) {
    const conditions = [];
    if (from) conditions.push(gte(tokenUsage.createdAt, sql`${from}::timestamp`));
    if (to) conditions.push(lte(tokenUsage.createdAt, sql`${to}::timestamp`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select({
        dealId: tokenUsage.dealId,
        dealName: sql<string>`COALESCE(${targetCompanies.companyName}, 'Unknown Deal')`,
        promptTokens: sql<number>`SUM(${tokenUsage.promptTokens})::int`,
        candidateTokens: sql<number>`SUM(${tokenUsage.candidateTokens})::int`,
        totalTokens: sql<number>`SUM(${tokenUsage.totalTokens})::int`,
        inputCost: sql<string>`SUM(${tokenUsage.inputCostUsd})::numeric(10,6)`,
        outputCost: sql<string>`SUM(${tokenUsage.outputCostUsd})::numeric(10,6)`,
        totalCost: sql<string>`SUM(${tokenUsage.estimatedCostUsd})::numeric(10,6)`,
      })
      .from(tokenUsage)
      .leftJoin(targetCompanies, eq(tokenUsage.dealId, targetCompanies.id))
      .where(where)
      .groupBy(tokenUsage.dealId, targetCompanies.companyName)
      .orderBy(desc(sql`SUM(${tokenUsage.estimatedCostUsd})`));
  }

  async getTokenUsageByService(from?: string, to?: string) {
    const conditions = [];
    if (from) conditions.push(gte(tokenUsage.createdAt, sql`${from}::timestamp`));
    if (to) conditions.push(lte(tokenUsage.createdAt, sql`${to}::timestamp`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select({
        service: tokenUsage.service,
        promptTokens: sql<number>`SUM(${tokenUsage.promptTokens})::int`,
        candidateTokens: sql<number>`SUM(${tokenUsage.candidateTokens})::int`,
        totalTokens: sql<number>`SUM(${tokenUsage.totalTokens})::int`,
        inputCost: sql<string>`SUM(${tokenUsage.inputCostUsd})::numeric(10,6)`,
        outputCost: sql<string>`SUM(${tokenUsage.outputCostUsd})::numeric(10,6)`,
        totalCost: sql<string>`SUM(${tokenUsage.estimatedCostUsd})::numeric(10,6)`,
      })
      .from(tokenUsage)
      .where(where)
      .groupBy(tokenUsage.service)
      .orderBy(desc(sql`SUM(${tokenUsage.estimatedCostUsd})`));
  }

  async getPlatformCosts(filters: { costType?: string; from?: string; to?: string }) {
    const conditions = [];
    if (filters.costType) conditions.push(eq(platformCosts.costType, filters.costType));
    if (filters.from) conditions.push(gte(platformCosts.periodStart, filters.from));
    if (filters.to) conditions.push(lte(platformCosts.periodEnd, filters.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db.select().from(platformCosts).where(where).orderBy(desc(platformCosts.createdAt));
  }

  async createPlatformCost(data: InsertPlatformCost) {
    const [row] = await db.insert(platformCosts).values(data).returning();
    return row;
  }

  async getAllCompanies() {
    return await db
      .select({
        id: userCompanies.id,
        companyName: userCompanies.companyName,
        email: userCompanies.email,
        createdAt: userCompanies.createdAt,
        betaPlanOverride: userCompanies.betaPlanOverride,
        userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.user_company_id = user_companies.id)::int`,
        dealCount: sql<number>`(SELECT COUNT(*) FROM target_companies WHERE target_companies.user_company_id = user_companies.id)::int`,
        totalTokenCost: sql<string>`COALESCE((SELECT SUM(estimated_cost_usd) FROM token_usage WHERE token_usage.user_company_id = user_companies.id), 0)::numeric(10,6)`,
      })
      .from(userCompanies)
      .orderBy(userCompanies.companyName);
  }

  async getCompanyById(companyId: number) {
    const [company] = await db
      .select({
        id: userCompanies.id,
        companyName: userCompanies.companyName,
        email: userCompanies.email,
        createdAt: userCompanies.createdAt,
        betaPlanOverride: userCompanies.betaPlanOverride,
        userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.user_company_id = user_companies.id)::int`,
        dealCount: sql<number>`(SELECT COUNT(*) FROM target_companies WHERE target_companies.user_company_id = user_companies.id)::int`,
        totalTokenCost: sql<string>`COALESCE((SELECT SUM(estimated_cost_usd) FROM token_usage WHERE token_usage.user_company_id = user_companies.id), 0)::numeric(10,6)`,
      })
      .from(userCompanies)
      .where(eq(userCompanies.id, companyId));
    return company || null;
  }

  async getAllUsers() {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        userRole: users.userRole,
        isSystemAdmin: users.isSystemAdmin,
        isCompanyAdmin: users.isCompanyAdmin,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        userCompanyId: users.userCompanyId,
        companyName: userCompanies.companyName,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userCompanies, eq(users.userCompanyId, userCompanies.id))
      .orderBy(users.lastName, users.firstName);
  }

  async getWebhookEvents(filters: { status?: string; source?: string; page: number; limit: number }) {
    const conditions = [];
    if (filters.status) conditions.push(eq(webhookEvents.status, filters.status));
    if (filters.source) conditions.push(eq(webhookEvents.source, filters.source));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.limit;

    const [countResult] = await db.select({ count: count() }).from(webhookEvents).where(where);

    const rows = await db
      .select()
      .from(webhookEvents)
      .where(where)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(filters.limit)
      .offset(offset);

    return { rows, total: countResult.count, page: filters.page, limit: filters.limit };
  }
}

export const adminRepository = new AdminRepository();
