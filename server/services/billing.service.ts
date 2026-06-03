import { billingRepository } from '../repositories/billing.repository';
import { marketingContactsService } from './marketing-contacts.service';
import {
  type Subscription,
  type InsertSubscription,
  type SubscriptionEvent,
  type AddonPurchase,
  type PlanKey,
  type BillingInterval,
  type SubscriptionStatus,
} from '@shared/schema/billing';
import {
  type TierLimits,
  type TierFeatures,
  getEffectiveLimits,
  getMaxActiveTargets,
  getMaxSeats,
  TIER_FEATURES,
} from '@shared/entitlements';

class BillingService {
  private getEffectivePlanKey(subscription: Subscription, betaPlanOverride: string | null): PlanKey {
    const validOverrides: PlanKey[] = ['CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE'];
    if (betaPlanOverride && validOverrides.includes(betaPlanOverride.toUpperCase() as PlanKey)) {
      return betaPlanOverride.toUpperCase() as PlanKey;
    }
    return subscription.planKey as PlanKey;
  }

  private getTransitionEventType(
    previousStatus: SubscriptionStatus | null,
    newStatus: SubscriptionStatus
  ): string {
    if (newStatus === 'past_due')     return 'invoice.payment_failed';
    if (newStatus === 'canceled')     return 'subscription.canceled';
    if (newStatus === 'admin_comped') return 'admin.comp_granted';
    if (newStatus === 'incomplete')   return 'subscription.incomplete';
    if (newStatus === 'trialing')     return 'subscription.trialing';
    if (newStatus === 'active') {
      if (previousStatus === 'trialing') return 'subscription.trial_converted';
      if (previousStatus === 'past_due') return 'subscription.recovered';
      if (previousStatus === 'canceled') return 'subscription.reactivated';
      return 'subscription.updated';
    }
    return `status.changed_to.${newStatus}`;
  }

  async getSubscription(userCompanyId: number): Promise<Subscription | null> {
    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) return null;

    const betaPlanOverride = await billingRepository.getBetaPlanOverride(userCompanyId);
    const effectivePlanKey = this.getEffectivePlanKey(subscription, betaPlanOverride);

    if (effectivePlanKey !== subscription.planKey) {
      return { ...subscription, planKey: effectivePlanKey };
    }

    return subscription;
  }

  async getEntitlements(
    userCompanyId: number
  ): Promise<{ subscription: Subscription; limits: TierLimits; features: TierFeatures } | null> {
    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) return null;

    const betaPlanOverride = await billingRepository.getBetaPlanOverride(userCompanyId);
    const effectivePlanKey = this.getEffectivePlanKey(subscription, betaPlanOverride);

    const effectiveSubscription = effectivePlanKey !== subscription.planKey
      ? { ...subscription, planKey: effectivePlanKey }
      : subscription;

    const limits = getEffectiveLimits(
      effectivePlanKey,
      effectiveSubscription.enterpriseOverrides as Record<string, unknown> | null
    );
    const features = TIER_FEATURES[effectivePlanKey];

    return { subscription: effectiveSubscription, limits, features };
  }

  async createTrialSubscription(
    userCompanyId: number,
    trialDays: number,
    trialEndsAt?: Date
  ): Promise<Subscription> {
    const now = new Date();
    const trialEnd = trialEndsAt ?? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const subscription = await billingRepository.create({
      userCompanyId,
      planKey: 'PROFESSIONAL',
      status: 'trialing',
      trialStart: now,
      trialEnd,
      trialEndsAt: trialEnd,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'trial.started',
      newStatus: 'trialing',
      newPlanKey: 'PROFESSIONAL',
      payload: { trialDays },
    });

    const { track } = await import('./funnel.service');
    track(userCompanyId, null, 'trial.started', { planKey: 'PROFESSIONAL', trialDays });

    return subscription;
  }

  async createFiveDNewMemberTrial(userCompanyId: number): Promise<Subscription> {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setMonth(trialEnd.getMonth() + 6);

    const subscription = await billingRepository.create({
      userCompanyId,
      planKey: 'CORE',
      status: 'trialing',
      trialStart: now,
      trialEnd,
      trialEndsAt: trialEnd,
      freeMonthsStartedAt: now,
      freeMonthsTotal: 6,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'trial.started',
      newStatus: 'trialing',
      newPlanKey: 'CORE',
      payload: { trialDays: null, freeMonthsTotal: 6, variant: '5d_new_member' },
    });

    const { track } = await import('./funnel.service');
    track(userCompanyId, null, 'trial.started', { planKey: 'CORE', freeMonthsTotal: 6, variant: '5d_new_member' });

    console.log(`[billing] created 5D New Member trial userCompanyId=${userCompanyId} trialEndsAt=${trialEnd.toISOString()}`);

    return subscription;
  }

  async activateSubscription(
    userCompanyId: number,
    data: {
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      planKey: PlanKey;
      billingInterval: BillingInterval;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      status?: SubscriptionStatus;
    }
  ): Promise<Subscription> {
    const existing = await billingRepository.getByCompanyId(userCompanyId);

    // Idempotency guard: if this exact subscription is already in the desired state, no-op
    if (
      existing &&
      existing.stripeSubscriptionId === data.stripeSubscriptionId &&
      (existing.status === 'active' || existing.status === 'trialing') &&
      existing.canceledAt === null
    ) {
      return existing;
    }

    const subscription = await billingRepository.upsertByCompanyId({
      userCompanyId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      planKey: data.planKey,
      status: data.status ?? 'active',
      billingInterval: data.billingInterval,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      canceledAt: null,
    });

    // Marketing segment sync, fire-and-forget — must never break billing flows
    void marketingContactsService.reconcileSubscriptionAudiences(userCompanyId);
    return subscription;
  }

  async confirmFirstPayment(
    userCompanyId: number,
    paidInvoiceId?: string
  ): Promise<{ wasFirstPayment: boolean }> {
    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) {
      return { wasFirstPayment: false };
    }

    const alreadyFired = await billingRepository.hasEventOfType(
      userCompanyId,
      'subscription.activated'
    );
    if (alreadyFired) {
      return { wasFirstPayment: false };
    }

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'subscription.activated',
      previousStatus: null,
      previousPlanKey: null,
      newStatus: subscription.status as SubscriptionStatus,
      newPlanKey: subscription.planKey as PlanKey,
      payload: {
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        billingInterval: subscription.billingInterval,
        paidInvoiceId: paidInvoiceId ?? null,
      },
    });

    const { track } = await import('./funnel.service');
    track(userCompanyId, null, 'subscription.activated', {
      planKey: subscription.planKey,
      billingInterval: subscription.billingInterval,
    });

    return { wasFirstPayment: true };
  }

  async updateSubscriptionStatus(
    userCompanyId: number,
    data: {
      status: SubscriptionStatus;
      planKey?: PlanKey;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
    },
    stripeEventId?: string
  ): Promise<Subscription | null> {
    if (stripeEventId) {
      const existingEvent = await billingRepository.getEventByStripeId(stripeEventId);
      if (existingEvent) {
        return billingRepository.getByCompanyId(userCompanyId);
      }
    }

    const existing = await billingRepository.getByCompanyId(userCompanyId);
    const previousStatus = existing?.status ?? null;
    const previousPlanKey = existing?.planKey ?? null;

    const updateData: Record<string, unknown> = { status: data.status };
    if (data.planKey !== undefined) updateData.planKey = data.planKey;
    if (data.currentPeriodStart !== undefined) updateData.currentPeriodStart = data.currentPeriodStart;
    if (data.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = data.currentPeriodEnd;
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;

    // Dunning lifecycle: stamp past_due_since on first entry to past_due,
    // clear it (and the day-7 email gate) on recovery to active or terminal canceled.
    if (data.status === 'past_due' && previousStatus !== 'past_due') {
      updateData.pastDueSince = new Date();
      updateData.dunningDay7EmailSentAt = null;
    }
    if (data.status === 'active' || data.status === 'canceled') {
      updateData.pastDueSince = null;
      updateData.dunningDay7EmailSentAt = null;
    }

    // Clear canceled_at when transitioning OUT of canceled
    if (existing && existing.status === 'canceled' && data.status !== 'canceled') {
      updateData.canceledAt = null;
    }

    const subscription = await billingRepository.updateByCompanyId(userCompanyId, updateData);

    await billingRepository.logEvent({
      userCompanyId,
      stripeEventId: stripeEventId ?? null,
      eventType: this.getTransitionEventType(
        previousStatus as SubscriptionStatus | null,
        data.status
      ),
      previousStatus: previousStatus as SubscriptionStatus | null,
      previousPlanKey: previousPlanKey as PlanKey | null,
      newStatus: data.status,
      newPlanKey: (data.planKey as PlanKey) ?? (previousPlanKey as PlanKey) ?? null,
      payload: { ...data },
    });

    // Marketing segment sync, fire-and-forget — must never break billing flows
    void marketingContactsService.reconcileSubscriptionAudiences(userCompanyId);
    return subscription;
  }

  async grantAdminComp(
    userCompanyId: number,
    planKey: PlanKey,
    adminUserId: number,
    notes?: string
  ): Promise<Subscription> {
    const existing = await billingRepository.getByCompanyId(userCompanyId);
    const previousStatus = existing?.status ?? null;
    const previousPlanKey = existing?.planKey ?? null;

    const subscription = await billingRepository.upsertByCompanyId({
      userCompanyId,
      planKey,
      status: 'admin_comped',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      adminNotes: notes ?? null,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'admin.comp_granted',
      previousStatus: previousStatus as SubscriptionStatus | null,
      previousPlanKey: previousPlanKey as PlanKey | null,
      newStatus: 'admin_comped',
      newPlanKey: planKey,
      adminUserId,
      payload: { notes: notes ?? null },
    });

    // Marketing segment sync, fire-and-forget — must never break billing flows
    void marketingContactsService.reconcileSubscriptionAudiences(userCompanyId);
    return subscription;
  }

  async expireTrial(userCompanyId: number): Promise<Subscription | null> {
    const existing = await billingRepository.getByCompanyId(userCompanyId);
    if (!existing) return null;

    const subscription = await billingRepository.updateByCompanyId(userCompanyId, {
      status: 'canceled',
      canceledAt: new Date(),
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'trial.expired',
      previousStatus: existing.status as SubscriptionStatus,
      previousPlanKey: existing.planKey as PlanKey,
      newStatus: 'canceled',
      newPlanKey: existing.planKey as PlanKey,
      payload: { trialEnd: existing.trialEnd },
    });

    // Marketing segment sync, fire-and-forget — must never break billing flows
    void marketingContactsService.reconcileSubscriptionAudiences(userCompanyId);
    return subscription;
  }

  async expireFreePeriodTrial(userCompanyId: number): Promise<Subscription | null> {
    const existing = await billingRepository.getByCompanyId(userCompanyId);
    if (!existing) return null;

    const now = new Date();
    const subscription = await billingRepository.updateByCompanyId(userCompanyId, {
      status: 'canceled',
      canceledAt: now,
    });

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'referral.free_period_expired',
      previousStatus: existing.status as SubscriptionStatus,
      previousPlanKey: existing.planKey as PlanKey,
      newStatus: 'canceled',
      newPlanKey: existing.planKey as PlanKey,
      payload: {
        freeMonthsTotal: existing.freeMonthsTotal,
        freeMonthsStartedAt: existing.freeMonthsStartedAt,
        reason: 'no_payment_details',
      },
    });

    // Marketing segment sync, fire-and-forget — must never break billing flows
    void marketingContactsService.reconcileSubscriptionAudiences(userCompanyId);
    return subscription;
  }

  async purchaseAddonSlots(
    userCompanyId: number,
    addonType: 'company_slot' | 'seat',
    quantity: number,
    unitPriceMinorUnit: number,
    currency: string,
    stripePaymentRef?: string
  ): Promise<{ subscription: Subscription; purchase: AddonPurchase }> {
    const purchase = await billingRepository.createAddonPurchase({
      userCompanyId,
      addonType,
      quantity,
      unitPriceMinorUnit,
      currency,
      stripePaymentRef: stripePaymentRef ?? null,
    });

    const existing = await billingRepository.getByCompanyId(userCompanyId);
    const updateData: Record<string, unknown> = {};

    if (addonType === 'company_slot') {
      updateData.addOnCompanySlots = (existing?.addOnCompanySlots ?? 0) + quantity;
    } else {
      updateData.additionalSeats = (existing?.additionalSeats ?? 0) + quantity;
    }

    const subscription = (await billingRepository.updateByCompanyId(
      userCompanyId,
      updateData
    ))!;

    return { subscription, purchase };
  }

  async canAddTarget(
    userCompanyId: number,
    currentActiveCount: number
  ): Promise<boolean> {
    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) return false;
    if (subscription.status === 'canceled') return false;

    const max = getMaxActiveTargets(
      subscription.planKey as PlanKey,
      subscription.addOnCompanySlots,
      subscription.enterpriseOverrides as Record<string, unknown> | null
    );

    if (max === null) return true;
    return currentActiveCount < max;
  }

  async canAddSeat(
    userCompanyId: number,
    currentSeatCount: number
  ): Promise<boolean> {
    const subscription = await billingRepository.getByCompanyId(userCompanyId);
    if (!subscription) return false;
    if (subscription.status === 'canceled') return false;

    const max = getMaxSeats(
      subscription.planKey as PlanKey,
      subscription.additionalSeats,
      subscription.enterpriseOverrides as Record<string, unknown> | null
    );

    if (max === null) return true;
    return currentSeatCount < max;
  }

  // Shared 5D subsidy selection, used by both the admin invoice route and the
  // monthly cron. Returns members whose free period STARTED in the target
  // month, each billed UPFRONT at the discounted CORE rate x the campaign's
  // free_months. Entitlement is read off the campaign, not the subscription
  // (the live Stripe-first path leaves subscription.free_months_total at 0).
  async getBillableMembers(month?: string, source?: string): Promise<{
    month: string;
    source: string;
    monthlyRate: number;
    summary: { newMembers: number; totalInvoiceAmount: number; avgPerMember: number };
    members: Array<{
      userCompanyId: number;
      companyName: string | null;
      email: string | null;
      planKey: string;
      signedUpAt: string;
      freeMonths: number;
      invoiceAmount: number;
    }>;
  }> {
    const referralSource = source || '5d_community';

    let targetMonth: Date;
    if (month) {
      targetMonth = new Date(month + '-01');
    } else {
      targetMonth = new Date();
      targetMonth.setDate(1);
    }
    targetMonth.setHours(0, 0, 0, 0);

    const rows = await billingRepository.getReferralBillableRows(referralSource);

    // $73.95 = CORE $87 x 0.85. Phase G consolidates to config.billing.coreMonthlyDiscountedCents.
    const MONTHLY_RATE_CENTS = 7395;
    const MONTHLY_RATE = MONTHLY_RATE_CENTS / 100;

    const firstDayOfMonth = targetMonth;
    const lastDayOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    const members = rows
      .map((r) => {
        const freeMonths = r.campaignFreeMonths;
        const start = r.subscription.trialStart ?? r.subscription.createdAt;
        if (!start) return null;
        const startDate = new Date(start);

        const signedUpThisMonth = startDate >= firstDayOfMonth && startDate <= lastDayOfMonth;
        if (!signedUpThisMonth) return null;

        return {
          userCompanyId: r.subscription.userCompanyId,
          companyName: r.companyName,
          email: r.email,
          planKey: r.subscription.planKey,
          signedUpAt: startDate.toISOString(),
          freeMonths,
          invoiceAmount: MONTHLY_RATE * freeMonths,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const totalInvoiceAmount = members.reduce((sum, m) => sum + m.invoiceAmount, 0);

    return {
      month: targetMonth.toISOString().slice(0, 7),
      source: referralSource,
      monthlyRate: MONTHLY_RATE,
      summary: {
        newMembers: members.length,
        totalInvoiceAmount,
        avgPerMember: members.length > 0 ? totalInvoiceAmount / members.length : 0,
      },
      members,
    };
  }
}

export const billingService = new BillingService();
