import { billingRepository } from '../repositories/billing.repository';
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

    const previousStatus = existing?.status ?? null;
    const previousPlanKey = existing?.planKey ?? null;

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

    await billingRepository.logEvent({
      userCompanyId,
      eventType: 'subscription.activated',
      previousStatus: previousStatus as SubscriptionStatus | null,
      previousPlanKey: previousPlanKey as PlanKey | null,
      newStatus: 'active',
      newPlanKey: data.planKey,
      payload: {
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        billingInterval: data.billingInterval,
      },
    });

    const { track } = await import('./funnel.service');
    track(userCompanyId, null, 'subscription.activated', { planKey: data.planKey, billingInterval: data.billingInterval });

    return subscription;
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
}

export const billingService = new BillingService();
