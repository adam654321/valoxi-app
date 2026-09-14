# ASSESS-F promo build surface

## STEP 1 — HOW A CAMPAIGN IS IDENTIFIED AS 5D

```text
$ rg -n "isFiveDNewMember" server shared client/src --glob "*.ts*"
client/src/pages/billing.tsx
192:  const isFiveDNewMember =
195:  const showFreePeriodLine = isFiveDNewMember && !!freePeriodState?.isActive;
197:    isFiveDNewMember && !!freePeriodState?.isActive && (freePeriodState.remainingMonths ?? 0) > 0;

server/cron/billing.cron.ts
430:            const isFiveDNewMemberSub = sub.freeMonthsTotal === 6;
435:            if (isFiveDNewMemberSub && !hasStripeCustomer && sub.status === 'trialing') {
540:            const isFiveDNewMemberSub = sub.freeMonthsTotal === 6;
542:            if (isFiveDNewMemberSub) {

server/routes/public-checkout.routes.ts
6:import { promoCodeService, isFiveDNewMember } from '../services/promo-code.service';
73:  const isFiveD = campaign !== null && isFiveDNewMember(campaign);

server/services/promo-code.service.ts
111:    const isNewMember = isFiveDNewMember(campaign);
182:export function isFiveDNewMember(campaign: {

$ sed -n '182,221p' server/services/promo-code.service.ts
export function isFiveDNewMember(campaign: {
  referralSource: string;
  freeMonthsTotal: number;
}): boolean {
  return campaign.referralSource === '5d_community' && campaign.freeMonthsTotal > 0;
}

export interface FreePeriodState {
  isActive: boolean;
  elapsedMonths: number;
  remainingMonths: number;
}

export function getFreePeriodState(subscription: Subscription): FreePeriodState {
  if (subscription.freeMonthsTotal <= 0 || !subscription.freeMonthsStartedAt) {
    return { isActive: false, elapsedMonths: 0, remainingMonths: 0 };
  }
  const elapsed = computeFreeMonthsElapsed(subscription.freeMonthsStartedAt);
  const remaining = Math.max(0, subscription.freeMonthsTotal - elapsed);
  const isActive = elapsed < subscription.freeMonthsTotal;
  return {
    isActive,
    elapsedMonths: elapsed,
    remainingMonths: remaining,
  };
}
```

It keys off `referralSource === '5d_community'` and `freeMonthsTotal > 0`; the slug is irrelevant.

A new campaign with both a new slug and a different new `referral_source` would not match; it could match only if its referral source remained exactly `5d_community`.

## STEP 2 — THE SELF-SERVE WEBHOOK, THE PATH THAT HAS NEVER RUN ON PROD

```text
$ rg -n "checkout.session.completed" server --glob "*.ts"
server/routes/public-checkout.routes.ts
23: * signature-verified checkout.session.completed webhook (C-new.2) provisions

server/routes/webhooks.routes.ts
100:  // C-new.4: Stripe owns subscription creation now (checkout.session.completed

server/routes/billing.routes.ts
87:      case 'checkout.session.completed': {
133:            console.error(`[billing-webhook] checkout.session.completed ${session.id}: self-serve session has no customer email; cannot provision`);

server/routes/public.routes.ts
30: * provisioned yet by the checkout.session.completed webhook (C-new.2).
61:      WHERE event_type = 'checkout.session.completed'
80:      WHERE event_type = 'checkout.session.completed'

$ sed -n '87,206p' server/routes/billing.routes.ts
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userCompanyId = parseInt(session.metadata?.userCompanyId ?? '0', 10);
        const planKey = (session.metadata?.planKey as PlanKey) ?? 'CORE';
        const billingInterval = (session.metadata?.billingInterval as BillingInterval) ?? 'month';

        if (userCompanyId && session.customer && session.subscription) {
          const subscriptionId = session.subscription as string;
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
          const primaryItem = stripeSub.items.data[0];
          const periodStart = primaryItem?.current_period_start
            ? new Date(primaryItem.current_period_start * 1000)
            : new Date();
          const periodEnd = primaryItem?.current_period_end
            ? new Date(primaryItem.current_period_end * 1000)
            : new Date();
          const trialEnd = stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000)
            : null;
          const stripeStatusMap: Record<string, SubscriptionStatus> = {
            active: 'active',
            trialing: 'trialing',
            past_due: 'past_due',
            canceled: 'canceled',
            incomplete: 'incomplete',
            incomplete_expired: 'canceled',
            unpaid: 'past_due',
          };
          const mappedStatus: SubscriptionStatus = stripeStatusMap[stripeSub.status] ?? 'active';

          await billingService.activateSubscription(userCompanyId, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            planKey,
            billingInterval,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            status: mappedStatus,
            trialEnd,
          });
        } else if (!userCompanyId && session.customer && session.subscription) {
          // C-new.2: self-serve provisioning. No metadata.userCompanyId means
          // a public-checkout buyer with no account yet. Create the account
          // from the verified session, then activate the subscription.
          const email = session.customer_details?.email?.trim().toLowerCase();
          if (!email) {
            console.error(`[billing-webhook] checkout.session.completed ${session.id}: self-serve session has no customer email; cannot provision`);
            await logWebhookEvent(event.type, event.id, event.data.object, 'error', 'self_serve_no_email');
            return res.status(200).json({ received: true });
          }

          try {
            const subscriptionId = session.subscription as string;
            const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
            const primaryItem = stripeSub.items.data[0];
            const periodStart = primaryItem?.current_period_start
              ? new Date(primaryItem.current_period_start * 1000)
              : new Date();
            const periodEnd = primaryItem?.current_period_end
              ? new Date(primaryItem.current_period_end * 1000)
              : new Date();
            const trialEnd = stripeSub.trial_end
              ? new Date(stripeSub.trial_end * 1000)
              : null;
            const stripeStatusMap: Record<string, SubscriptionStatus> = {
              active: 'active',
              trialing: 'trialing',
              past_due: 'past_due',
              canceled: 'canceled',
              incomplete: 'incomplete',
              incomplete_expired: 'canceled',
              unpaid: 'past_due',
            };
            const mappedStatus: SubscriptionStatus = stripeStatusMap[stripeSub.status] ?? 'active';

            const activationData = {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              planKey,
              billingInterval,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              status: mappedStatus,
              trialEnd,
            };

            // Email-collision check. Case-insensitive, selects across active
            // and inactive rows. Mirrors the Clerk webhook and admin-waitlist.
            const [existingUser] = await db
              .select({ id: users.id, userCompanyId: users.userCompanyId })
              .from(users)
              .where(sql`LOWER(${users.email}) = LOWER(${email})`);

            if (existingUser) {
              // An account already exists for this email. Includes the dormant
              // invited-but-never-signed-up rows. Do NOT create a second user.
              if (!existingUser.userCompanyId) {
                console.error(`[billing-webhook] ${session.id}: existing user ${existingUser.id} has no userCompanyId; cannot activate`);
                await logWebhookEvent(event.type, event.id, event.data.object, 'error', 'existing_user_no_company');
                return res.status(200).json({ received: true });
              }

              const existingSub = await billingRepository.getByCompanyId(existingUser.userCompanyId);
              const LIVE_STATUSES = ['active', 'trialing', 'admin_comped'];
              if (existingSub && LIVE_STATUSES.includes(existingSub.status)) {
                // Existing user already has a live subscription. A second
                // activation would overwrite their subscription row and orphan
                // a paid Stripe sub. Do NOT activate. Flag for manual review.
                console.error(`[billing-webhook] DOUBLE-PAYMENT ALERT: session ${session.id} email ${email} (user ${existingUser.id}, company ${existingUser.userCompanyId}) already has a ${existingSub.status} subscription. New Stripe sub ${subscriptionId} was NOT activated. Manual review and refund required.`);
                await logWebhookEvent(event.type, event.id, event.data.object, 'error', 'duplicate_checkout_existing_subscription');
                return res.status(200).json({ received: true });
              }

              // Existing user with no live subscription (dormant invited row,
              // or a previously-cancelled subscriber). Safe to activate.
              await billingService.activateSubscription(existingUser.userCompanyId, activationData);
              console.log(`[billing-webhook] ${session.id}: activated subscription for existing user ${existingUser.id} (company ${existingUser.userCompanyId})`);
              await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
              break;
            }

$ rg -n "promoSlug|assignCampaignToUser|planKey" server/routes/webhooks.routes.ts | head -40

$ sed -n '207,300p' server/routes/billing.routes.ts

            // No existing user. Resolve the promo campaign (a read, before tx).
            const promoSlug = (session.metadata?.promoSlug ?? '').trim().toLowerCase();
            let campaignId: number | null = null;
            if (promoSlug) {
              const campaign = await promoCodeService.resolveCampaignBySlug(promoSlug);
              if (campaign) {
                campaignId = campaign.id;
              } else {
                console.warn(`[billing-webhook] ${session.id}: promoSlug '${promoSlug}' did not resolve; provisioning without a promo`);
              }
            }

            // Parse first/last name from Stripe's collected billing name.
            // Fall back to the email local-part if Stripe returned no name.
            const rawName = (session.customer_details?.name ?? '').trim();
            let firstName: string;
            let lastName: string;
            if (rawName) {
              const firstSpace = rawName.indexOf(' ');
              if (firstSpace === -1) {
                firstName = rawName.slice(0, 100);
                lastName = '';
              } else {
                firstName = rawName.slice(0, firstSpace).slice(0, 100);
                lastName = rawName.slice(firstSpace + 1).slice(0, 100);
              }
            } else {
              firstName = email.split('@')[0].slice(0, 100);
              lastName = '';
            }

            // Provision the account in one transaction: userCompany + user +
            // membership. Mirrors the admin-waitlist invite pattern. clerkUserId
            // stays null (the Clerk webhook links it later, C-new.4),
            // onboardingCompleted stays false, marketingConsent stays false
            // (collected at onboarding, C-new.5).
            const newUserCompanyId = await db.transaction(async (tx) => {
              const [newCompany] = await tx
                .insert(userCompanies)
                .values({ companyName: 'Pending Setup' })
                .returning({ id: userCompanies.id });

              const [newUser] = await tx
                .insert(users)
                .values({
                  email,
                  firstName,
                  lastName,
                  userCompanyId: newCompany.id,
                  currentCompanyId: newCompany.id,
                  role: 'user',
                  userRole: 'company_admin',
                  isCompanyAdmin: true,
                })
                .returning({ id: users.id });

              if (campaignId !== null) {
                await promoCodeService.assignCampaignToUser(newUser.id, campaignId, null, tx);
              }

              await tx.insert(userCompanyMemberships).values({
                userId: newUser.id,
                userCompanyId: newCompany.id,
                isCompanyAdmin: true,
                membershipRole: 'company_admin',
              });

              return newCompany.id;
            });

            await billingService.activateSubscription(newUserCompanyId, activationData);
            console.log(`[billing-webhook] ${session.id}: provisioned self-serve account (company ${newUserCompanyId})`);
            await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
            break;
          } catch (provisionErr: any) {
            // Provisioning failed. Return non-2xx so Stripe retries. The retry
            // is safe: the collision check finds any user a failed attempt
            // created, and activateSubscription's idempotency guard no-ops a
            // duplicate.
            console.error(`[billing-webhook] ${session.id}: self-serve provisioning failed:`, provisionErr);
            await logWebhookEvent(event.type, event.id, event.data.object, 'error', provisionErr?.message ?? 'provisioning_failed');
            return res.status(500).json({ error: 'provisioning_failed' });
          }
        }

        await logWebhookEvent(event.type, event.id, event.data.object, 'processed');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        // Stripe v20: current_period_start/end moved from Subscription to
        // SubscriptionItem. Read from primary item.

$ rg -n "promoSlug|assignCampaignToUser|planKey" server/routes/billing.routes.ts | head -40
90:        const planKey = (session.metadata?.planKey as PlanKey) ?? 'CORE';
120:            planKey,
165:              planKey,
209:            const promoSlug = (session.metadata?.promoSlug ?? '').trim().toLowerCase();
211:            if (promoSlug) {
212:              const campaign = await promoCodeService.resolveCampaignBySlug(promoSlug);
216:                console.warn(`[billing-webhook] ${session.id}: promoSlug '${promoSlug}' did not resolve; provisioning without a promo`);
265:                await promoCodeService.assignCampaignToUser(newUser.id, campaignId, null, tx);
303:        const planKey = derivePlanKeyFromLookupKey(lookupKey);
329:              planKey,
371:                planKey: matchingSub.planKey,
377:                previousPlanKey: matchingSub.planKey,
379:                newPlanKey: matchingSub.planKey,
431:                previousPlanKey: matchingSub.planKey,
433:                newPlanKey: matchingSub.planKey,
485:                planKey: matchingSub.planKey,
491:                previousPlanKey: matchingSub.planKey,
493:                newPlanKey: matchingSub.planKey,
531:                  planKey: matchingSub.planKey,
545:              previousPlanKey: matchingSub.planKey,
547:              newPlanKey: matchingSub.planKey,
631:      result.subscription.planKey as PlanKey,
680:    const planKey = req.query.planKey as PlanKey;
683:    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
711:        const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
728:          currentPlan: existingSub.planKey,
730:          newPlan: planKey,
747:    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
797:      currentPlan: existingSub.planKey,
799:      newPlan: planKey,
843:    const planKey = (session.metadata?.planKey as PlanKey) ?? 'CORE';
849:      if (existingSub.planKey === planKey) {
850:        return res.status(200).json({ success: true, planKey: existingSub.planKey, status: existingSub.status, alreadyActive: true });
859:          planKey,
876:            previousPlanKey: existingSub.planKey as PlanKey | null,
877:            newPlanKey: planKey,
885:      console.log(`[billing] Session verified — upgraded company ${userCompanyId} from ${existingSub.planKey} to ${planKey}`);
886:      return res.status(200).json({ success: true, planKey, status: 'active' });
893:        planKey,
900:    console.log(`[billing] Session verified and subscription activated for company ${userCompanyId}, plan: ${planKey}`);
```

1. When `metadata.userCompanyId` is absent, the verified billing webhook provisions `userCompanies`, `users`, and `userCompanyMemberships` rows inside one transaction, then activates the subscription.

2. Yes: it resolves `metadata.promoSlug` and calls `assignCampaignToUser` for the newly created user when the campaign resolves.

3. `activateSubscription` writes `planKey`; for checkout completion it comes from `session.metadata.planKey`, defaulting to `CORE`.

## STEP 3 — WHAT ACTIVATE DOES WITH A TRIAL

```text
$ rg -n "async activateSubscription" server/services/billing.service.ts
149:  async activateSubscription(

$ sed -n '149,268p' server/services/billing.service.ts
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
      trialEnd?: Date | null;
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
      trialEnd: data.trialEnd ?? null,
      trialEndsAt: data.trialEnd ?? null,
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
```

It records `status` (including `trialing`) from the mapped Stripe subscription status and writes both `trialEnd` and `trialEndsAt` from Stripe's `subscription.trial_end`; it does not record free-month campaign fields.

## STEP 4 — THE CRON THAT TOUCHES TRIALS

```text
$ sed -n '240,300p' server/cron/billing.cron.ts
      and(
        eq(subscriptions.status, 'trialing'),
        eq(subscriptions.freeMonthsTotal, 0),
        isNull(subscriptions.trialExtensionSentAt),
        isNotNull(subscriptions.trialEndsAt),
        gte(subscriptions.trialEndsAt, now),
        lte(subscriptions.trialEndsAt, windowEnd),
        isNotNull(subscriptions.stripeSubscriptionId)
      )
    );

  console.log(`[billing-cron] Trial extension: ${candidates.length} candidate(s)`);

  for (const row of candidates) {
    const sub = row.subscription;
    try {
      const latest = await billingRepository.getByCompanyId(sub.userCompanyId);
      if (
        !latest ||
        latest.status !== 'trialing' ||
        latest.freeMonthsTotal !== 0 ||
        latest.trialExtensionSentAt ||
        !latest.trialEndsAt ||
        !latest.stripeSubscriptionId
      ) continue;

      const newTrialEnd = new Date(latest.trialEndsAt.getTime() + 24 * 60 * 60 * 1000);

      await stripe.subscriptions.update(latest.stripeSubscriptionId, {
        trial_end: Math.floor(newTrialEnd.getTime() / 1000),
      });

      await billingRepository.updateByCompanyId(sub.userCompanyId, {
        trialEndsAt: newTrialEnd,
        trialEnd: newTrialEnd,
        trialExtensionSentAt: new Date(),
      });

      const adminEmail = await billingRepository.getAdminEmailForCompany(sub.userCompanyId);
      if (!adminEmail) {
        console.warn(`[billing-cron] No admin email for company ${sub.userCompanyId}, skipping trial extension email`);
      } else {
        await emailApiService.sendTrialExtensionEmail({
          to: adminEmail.email,
          firstName: adminEmail.firstName || 'there',
          newTrialEnd,
        });
      }

      await billingRepository.logEvent({
        userCompanyId: sub.userCompanyId,
        eventType: 'trial.extended',
        previousStatus: latest.status,
        previousPlanKey: latest.planKey,
        newStatus: 'trialing',
        newPlanKey: latest.planKey,
        payload: { originalTrialEnd: latest.trialEndsAt, newTrialEnd, extensionHours: 24 },
      });

      console.log(`[billing-cron] Trial extension: extended company ${sub.userCompanyId} to ${newTrialEnd.toISOString()}`);
    } catch (err) {

$ rg -n "freeMonthsTotal|freeMonthsStartedAt|trialEndsAt" server/cron/billing.cron.ts | head -30
137:    const trialing = expiring.filter((s) => s.status === 'trialing' && s.freeMonthsTotal === 0 && (
139:      (s.trialEndsAt && new Date(s.trialEndsAt) < new Date())
142:    const trialEndsAtExpired = await db
147:          isNotNull(subscriptions.trialEndsAt),
148:          lt(subscriptions.trialEndsAt, new Date()),
150:          eq(subscriptions.freeMonthsTotal, 0)
155:    for (const sub of trialEndsAtExpired) {
215:          payload: { trialEndsAt: sub.trialEndsAt, trialEnd: sub.trialEnd },
242:        eq(subscriptions.freeMonthsTotal, 0),
244:        isNotNull(subscriptions.trialEndsAt),
245:        gte(subscriptions.trialEndsAt, now),
246:        lte(subscriptions.trialEndsAt, windowEnd),
260:        latest.freeMonthsTotal !== 0 ||
262:        !latest.trialEndsAt ||
266:      const newTrialEnd = new Date(latest.trialEndsAt.getTime() + 24 * 60 * 60 * 1000);
273:        trialEndsAt: newTrialEnd,
296:        payload: { originalTrialEnd: latest.trialEndsAt, newTrialEnd, extensionHours: 24 },
316:        eq(subscriptions.freeMonthsTotal, 0),
319:        isNotNull(subscriptions.trialEndsAt),
320:        gte(subscriptions.trialEndsAt, now),
321:        lte(subscriptions.trialEndsAt, windowEnd)
334:        latest.freeMonthsTotal !== 0 ||
337:        !latest.trialEndsAt
349:        trialEndsAt: latest.trialEndsAt,
363:        payload: { trialEndsAt: latest.trialEndsAt },
366:      console.log(`[billing-cron] Trial warning: sent to company ${sub.userCompanyId}, trial ends ${latest.trialEndsAt.toISOString()}`);
410:            gt(subscriptions.freeMonthsTotal, 0),
422:        if (!sub.freeMonthsStartedAt) continue;
424:        const elapsed = computeFreeMonthsElapsed(sub.freeMonthsStartedAt);
426:        if (elapsed >= sub.freeMonthsTotal) {
```

A non-5D campaign with `freeMonthsTotal > 0` is selected when `communityDiscountCouponId` is null; with `freeMonthsStartedAt` set, the cron warns near expiry and, at expiry, resolves/applies its assigned campaign's post-free-period coupon when available, then stamps the transition.

## STEP 5 — PLAN KEYS AND LOOKUP KEYS

```text
$ rg -n "VALID_PLAN_KEYS|LOOKUP_KEY_MAP" server/routes/billing.routes.ts
573:export const VALID_PLAN_KEYS: PlanKey[] = ['CORE', 'PROFESSIONAL', 'EXPERT'];
574:export const LOOKUP_KEY_MAP: Record<string, Record<'month' | 'year', string>> = {
683:    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
711:        const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
747:    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
924:    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
957:    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];
1111:    if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
1134:    const lookupKey = LOOKUP_KEY_MAP[planKey]?.[billingInterval === 'month' ? 'month' : 'year'];

$ sed -n '573,612p' server/routes/billing.routes.ts
export const VALID_PLAN_KEYS: PlanKey[] = ['CORE', 'PROFESSIONAL', 'EXPERT'];
export const LOOKUP_KEY_MAP: Record<string, Record<'month' | 'year', string>> = {
  CORE: { month: 'ma_core_monthly_usd', year: 'ma_core_annual_usd' },
  PROFESSIONAL: { month: 'ma_professional_monthly_usd', year: 'ma_professional_annual_usd' },
  EXPERT: { month: 'ma_expert_monthly_usd', year: 'ma_expert_annual_usd' },
};

router.get('/subscription', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session.userCompanyId;
    if (!userCompanyId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const result = await billingService.getEntitlements(userCompanyId);
    if (!result) {
      return res.status(200).json({ subscription: null, limits: null, features: null });
    }

    // Load the current user's assigned promo campaign, if any.
    const userId = req.session.userId;
    let assignedPromoCampaign: {
      id: number;
      name: string;
      referralSource: string;
      freeMonthsTotal: number;
    } | null = null;

    if (userId) {
      const [userRow] = await db
        .select({ assignedPromoCampaignId: users.assignedPromoCampaignId })
        .from(users)
        .where(eq(users.id, userId));

      if (userRow?.assignedPromoCampaignId) {
        const [campaign] = await db
          .select({
            id: promoCodeCampaigns.id,
            name: promoCodeCampaigns.name,
            referralSource: promoCodeCampaigns.referralSource,
```

## STEP 6 — OUTPUT

```text
$ wc -l docs/event-promo-release/ASSESS-F-promo-build-surface.md
633 docs/event-promo-release/ASSESS-F-promo-build-surface.md

$ git status --porcelain
?? docs/event-promo-release/ASSESS-F-promo-build-surface.md

$ git diff --stat
```

V-CHECK — git status: PASS (only the new assessment file is untracked).

V-CHECK — git diff --stat: PASS (no tracked source-file changes).

## TRIAL EXPIRY FOLLOW-UP

### STEP 1 — THE TRIAL EXPIRY JOB, IN FULL

```text
$ sed -n '120,225p' server/cron/billing.cron.ts
        },
      });

      await stripe.subscriptions.cancel(latest.stripeSubscriptionId);
      console.log(`[billing-cron] Stripe sub ${latest.stripeSubscriptionId} cancelled (dunning) for company ${sub.userCompanyId}`);
      // Local status flip and email both happen on the resulting
      // customer.subscription.deleted webhook.
    } catch (err) {
      console.error(`[billing-cron] Day-14 dunning cancel failed for company ${sub.userCompanyId}:`, err);
    }
  }
}

export async function runTrialExpiryJob(): Promise<void> {
  const stripe = new Stripe(config.stripe.secretKey);
  try {
    const expiring = await billingRepository.getSubscriptionsExpiringBefore(new Date());
    const trialing = expiring.filter((s) => s.status === 'trialing' && s.freeMonthsTotal === 0 && (
      (s.trialEnd && new Date(s.trialEnd) < new Date()) ||
      (s.trialEndsAt && new Date(s.trialEndsAt) < new Date())
    ));

    const trialEndsAtExpired = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          isNotNull(subscriptions.trialEndsAt),
          lt(subscriptions.trialEndsAt, new Date()),
          eq(subscriptions.status, 'trialing'),
          eq(subscriptions.freeMonthsTotal, 0)
        )
      );

    const allExpiring = [...trialing];
    for (const sub of trialEndsAtExpired) {
      if (!allExpiring.find(s => s.id === sub.id)) {
        allExpiring.push(sub);
      }
    }
    console.log(`[billing-cron] Trial expiry: processing ${allExpiring.length} non-free-period trial(s). Free-period trials handled by separate cron at 09:15.`);

    let count = 0;

    for (const sub of allExpiring) {
      try {
        if (sub.stripeSubscriptionId) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
            if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
              continue;
            }
          } catch (stripeErr) {
            console.error(`[billing-cron] Failed to check Stripe sub for company ${sub.userCompanyId}:`, stripeErr);
          }
        }

        if (!sub.stripeSubscriptionId && sub.stripeCustomerId) {
          try {
            const result = await stripe.subscriptions.list({
              customer: sub.stripeCustomerId,
              status: 'all',
              limit: 10,
            });
            const liveStripeSub = result.data.find(
              s => s.status === 'active' || s.status === 'trialing'
            );
            if (liveStripeSub) {
              console.warn(
                `[billing-cron] Trial expiry skipped for company ${sub.userCompanyId}: ` +
                `stripeSubscriptionId is NULL but found live Stripe sub ${liveStripeSub.id} ` +
                `(status=${liveStripeSub.status}) via customer ${sub.stripeCustomerId}. ` +
                `Will re-evaluate tomorrow.`
              );
              continue;
            }
          } catch (stripeErr) {
            console.error(
              `[billing-cron] Stripe lookup failed for company ${sub.userCompanyId} ` +
              `(customerId=${sub.stripeCustomerId}), skipping cancel:`,
              stripeErr
            );
            continue;
          }
        }

        await billingService.expireTrial(sub.userCompanyId);

        await billingRepository.logEvent({
          userCompanyId: sub.userCompanyId,
          eventType: 'subscription.trial_expired',
          previousStatus: sub.status as any,
          previousPlanKey: sub.planKey as any,
          newStatus: 'canceled',
          newPlanKey: sub.planKey as any,
          payload: { trialEndsAt: sub.trialEndsAt, trialEnd: sub.trialEnd },
        });

        count++;
      } catch (err) {
        console.error(`[billing-cron] Failed to expire trial for company ${sub.userCompanyId}:`, err);
      }
    }

    console.log(`[billing-cron] Expired ${count} trial(s)`);
  } catch (err) {

$ rg -n "async expireTrial" server/services/billing.service.ts
334:  async expireTrial(userCompanyId: number): Promise<Subscription | null> {

$ sed -n '343,390p' server/services/billing.service.ts
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

$ sed -n '334,355p' server/services/billing.service.ts
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
```

1. It sets the subscription row's `status` to `canceled` and `canceledAt` to the current time.

2. It calls Stripe only to retrieve/list subscription state; expiry itself writes locally and does not cancel the Stripe subscription.

3. A row Stripe already reports as `active` or `trialing` is excluded by `continue` when the Stripe lookup succeeds.

### STEP 2 — WHAT THE STATUS CHANGE COSTS THE USER

```text
$ rg -n "async getEntitlements" server/services/billing.service.ts
64:  async getEntitlements(

$ sed -n '64,143p' server/services/billing.service.ts
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
```

When status is `canceled`, `getEntitlements` still returns the subscription and the effective plan's limits and features because this method does not gate entitlements by status.

### STEP 3 — THE TRIAL WARNING EMAIL COPY

```text
$ rg -n "sendTrialWarningEmail|sendTrialExtensionEmail" server --glob "*.ts" | head -10
server/cron/billing.cron.ts:282:        await emailApiService.sendTrialExtensionEmail({
server/cron/billing.cron.ts:346:      await emailApiService.sendTrialWarningEmail({
server/services/email.service.ts:756:  async sendTrialExtensionEmail(params: {
server/services/email.service.ts:803:  async sendTrialWarningEmail(params: {

$ rg -n "7.day|seven day|7 day" server/services/email-api.service.ts server/services/email.service.ts 2>/dev/null | head -20
server/services/email.service.ts:350:    blocks.push({ type: 'paragraph', text: 'This invitation expires in 7 days. If it expires, contact <a href="mailto:support@valoxi.ai" style="color:#E05115;text-decoration:none;">support@valoxi.ai</a> for a new one.' });
server/services/email.service.ts:464:      { type: 'paragraph', text: `Your <strong style="color:#FFFFFF;">${planLabel}</strong> annual plan renews in 7 days.` },
server/services/email.service.ts:479:      heading: 'Your plan renews in 7 days',
server/services/email.service.ts:486:      subject: `Your Valoxi ${planLabel} plan renews in 7 days`,
server/services/email.service.ts:639:          body: 'Your subscription will be cancelled in 7 days unless payment succeeds. Please update your payment method to keep your account active.',
server/services/email.service.ts:647:      preheader: `Action needed: your Valoxi ${planLabel} subscription will be cancelled in 7 days.`,
server/services/email.service.ts:649:      heading: 'Your subscription will be cancelled in 7 days',
server/services/email.service.ts:656:      subject: `Action needed: your Valoxi ${planLabel} subscription will be cancelled in 7 days`,

$ sed -n '756,850p' server/services/email.service.ts
  async sendTrialExtensionEmail(params: {
    to: string;
    firstName: string;
    newTrialEnd: Date;
  }): Promise<SendInvitationResult> {
    const { to, firstName, newTrialEnd } = params;
    const safeFirstName = escapeHtml(firstName);

    const formatDateTime = (d: Date): string => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} at ${hh}:${mm}`;
    };

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: 'We hope you have had a chance to explore Valoxi over the last 48 hours.' },
      { type: 'paragraph', text: 'We would love you to have a little more time, so we have added an extra 24 hours to your trial - no action needed on your part.' },
      {
        type: 'info_box',
        box: {
          tone: 'info',
          body: `Your trial now ends on <strong>${escapeHtml(formatDateTime(newTrialEnd))}</strong>.`,
        },
      },
      { type: 'paragraph', text: 'After that, your card will be charged and your subscription will begin automatically.' },
      { type: 'paragraph', text: 'If you have any questions or want to talk through what you have seen so far, just reply to this email.' },
      { type: 'paragraph', text: 'Adam Auty<br/>Founder, Valoxi' },
    ];

    const html = renderBrandedEmail({
      preheader: 'We have added an extra 24 hours to your Valoxi trial.',
      eyebrow: 'Trial extended',
      heading: 'You have got an extra 24 hours on us',
      blocks,
      footerLine: 'You are receiving this because you have an active Valoxi trial.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'You have got an extra 24 hours on us',
      html,
    });
    return { success, message: success ? 'Trial extension email sent' : 'Failed to send trial extension email' };
  }

  async sendTrialWarningEmail(params: {
    to: string;
    firstName: string;
    trialEndsAt: Date;
  }): Promise<SendInvitationResult> {
    const { to, firstName, trialEndsAt } = params;
    const safeFirstName = escapeHtml(firstName);

    const formatDateTime = (d: Date): string => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} at ${hh}:${mm}`;
    };

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: `Hi ${safeFirstName},` },
      { type: 'paragraph', text: `Your free trial ends on <strong>${escapeHtml(formatDateTime(trialEndsAt))}</strong>.` },
      { type: 'paragraph', text: 'After that, your subscription will begin and your card will be charged automatically.' },
      { type: 'paragraph', text: `If you would like to cancel before then, you can do so from your <a href="${appUrl}/settings">account settings</a>.` },
      { type: 'paragraph', text: 'If you have any questions, just reply to this email.' },
      { type: 'paragraph', text: 'Adam Auty<br/>Founder, Valoxi' },
    ];

    const html = renderBrandedEmail({
      preheader: 'Your Valoxi free trial is ending soon.',
      eyebrow: 'Trial ending',
      heading: 'Your Valoxi trial ends soon',
      blocks,
      footerLine: 'You are receiving this because you have an active Valoxi trial.',
    });

    const success = await (legacyEmailService as any).sendEmail({
      to,
      subject: 'Your Valoxi trial ends soon',
      html,
    });
    return { success, message: success ? 'Trial warning email sent' : 'Failed to send trial warning email' };
  }

  async sendFiveDPartnerInvoice(params: {
    to: string;
    billingMonth: string; // 'YYYY-MM'
    members: Array<{ companyName: string | null; email: string | null; freeMonths: number; amountCents: number }>;
    totalCents: number;
  }): Promise<SendInvitationResult> {
```

Neither trial email hardcodes a 7-day framing; the extension says 24 hours, and the warning uses the supplied trial end date and “ending soon.”

### STEP 4 — OUTPUT

```text
$ git status --porcelain
 M docs/event-promo-release/ASSESS-F-promo-build-surface.md

$ git diff --stat
 .../ASSESS-F-promo-build-surface.md                | 408 ++++++++++++++++++++-
 1 file changed, 407 insertions(+), 1 deletion(-)
```