import { eq, and, desc, or, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  subscriptions,
  subscriptionEvents,
  addonPurchases,
  type Subscription,
  type InsertSubscription,
  type SubscriptionEvent,
  type InsertSubscriptionEvent,
  type AddonPurchase,
  type InsertAddonPurchase,
  type PlanKey,
  type SubscriptionStatus,
} from '@shared/schema/billing';
import { userCompanies, users, type UserCompany } from '@shared/schema/core';

export class BillingRepository {
  async getByCompanyId(userCompanyId: number): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userCompanyId, userCompanyId));
    return row ?? null;
  }

  async getByStripeSubscriptionId(
    stripeSubscriptionId: string
  ): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return row ?? null;
  }

  async getBetaPlanOverride(userCompanyId: number): Promise<string | null> {
    const [row] = await db
      .select({ betaPlanOverride: userCompanies.betaPlanOverride })
      .from(userCompanies)
      .where(eq(userCompanies.id, userCompanyId));
    return row?.betaPlanOverride ?? null;
  }

  async getWithCompany(
    userCompanyId: number
  ): Promise<(Subscription & { userCompany: UserCompany }) | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .innerJoin(userCompanies, eq(subscriptions.userCompanyId, userCompanies.id))
      .where(eq(subscriptions.userCompanyId, userCompanyId));
    if (!row) return null;
    return { ...row.subscriptions, userCompany: row.user_companies };
  }

  async create(data: InsertSubscription): Promise<Subscription> {
    const [row] = await db.insert(subscriptions).values(data).returning();
    return row;
  }

  async updateByCompanyId(
    userCompanyId: number,
    data: Partial<InsertSubscription>
  ): Promise<Subscription | null> {
    const [row] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.userCompanyId, userCompanyId))
      .returning();
    return row ?? null;
  }

  async upsertByCompanyId(data: InsertSubscription): Promise<Subscription> {
    const [row] = await db
      .insert(subscriptions)
      .values(data)
      .onConflictDoUpdate({
        target: [subscriptions.userCompanyId],
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async logEvent(data: InsertSubscriptionEvent): Promise<SubscriptionEvent | null> {
    if (data.stripeEventId) {
      const [row] = await db
        .insert(subscriptionEvents)
        .values(data)
        .onConflictDoNothing({ target: subscriptionEvents.stripeEventId })
        .returning();
      return row ?? null;
    }
    const [row] = await db.insert(subscriptionEvents).values(data).returning();
    return row;
  }

  async getEventsByCompanyId(
    userCompanyId: number,
    limit: number = 50
  ): Promise<SubscriptionEvent[]> {
    return db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.userCompanyId, userCompanyId))
      .orderBy(desc(subscriptionEvents.processedAt))
      .limit(limit);
  }

  async getEventByStripeId(stripeEventId: string): Promise<SubscriptionEvent | null> {
    const [row] = await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.stripeEventId, stripeEventId));
    return row ?? null;
  }

  async createAddonPurchase(data: InsertAddonPurchase): Promise<AddonPurchase> {
    const [row] = await db.insert(addonPurchases).values(data).returning();
    return row;
  }

  async getAddonPurchasesByCompanyId(userCompanyId: number): Promise<AddonPurchase[]> {
    return db
      .select()
      .from(addonPurchases)
      .where(eq(addonPurchases.userCompanyId, userCompanyId))
      .orderBy(desc(addonPurchases.purchasedAt));
  }

  async getAllSubscriptions(
    filters?: { status?: SubscriptionStatus; planKey?: PlanKey }
  ): Promise<Subscription[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(subscriptions.status, filters.status));
    }
    if (filters?.planKey) {
      conditions.push(eq(subscriptions.planKey, filters.planKey));
    }
    return db
      .select()
      .from(subscriptions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async getSubscriptionsExpiringBefore(date: Date): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .where(
        and(
          or(
            eq(subscriptions.status, 'active'),
            eq(subscriptions.status, 'trialing')
          ),
          or(
            lt(subscriptions.currentPeriodEnd, date),
            lt(subscriptions.trialEnd, date)
          )
        )
      );
  }

  async getAdminEmailForCompany(userCompanyId: number): Promise<{ email: string; firstName: string } | null> {
    const [row] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(
        and(
          eq(users.userCompanyId, userCompanyId),
          eq(users.isCompanyAdmin, true),
          eq(users.isActive, true)
        )
      )
      .limit(1);
    if (!row || !row.email) return null;
    return { email: row.email, firstName: row.firstName || '' };
  }
}

export const billingRepository = new BillingRepository();
