import type { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { hasFeature } from '@shared/entitlements';
import type { TierFeatures } from '@shared/entitlements';
import type { Subscription, PlanKey } from '@shared/schema/billing';

declare global {
  namespace Express {
    interface Request {
      subscription?: Subscription;
    }
  }
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'admin_comped']);

async function loadAndCheckSubscription(
  req: Request,
  res: Response
): Promise<Subscription | null> {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
    return null;
  }

  const subscription = await billingService.getSubscription(userCompanyId);
  if (!subscription || subscription.suspendedAt || !ACTIVE_STATUSES.has(subscription.status)) {
    res.status(402).json({
      error: 'subscription_required',
      message: 'An active subscription is required to access this feature.',
    });
    return null;
  }

  req.subscription = subscription;
  return subscription;
}

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.session?.isSystemAdmin === true) return next();
  const subscription = await loadAndCheckSubscription(req, res);
  if (!subscription) return;
  next();
}

export function requireFeature(feature: keyof TierFeatures) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.session?.isSystemAdmin === true) return next();
    const subscription = await loadAndCheckSubscription(req, res);
    if (!subscription) return;

    if (!hasFeature(subscription.planKey as PlanKey, feature)) {
      return res.status(403).json({
        error: 'feature_not_available',
        message: 'This feature is not available on your current plan.',
        requiredUpgrade: true,
      });
    }

    next();
  };
}

export function requirePlan(...plans: PlanKey[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.session?.isSystemAdmin === true) return next();
    const subscription = await loadAndCheckSubscription(req, res);
    if (!subscription) return;

    if (!plans.includes(subscription.planKey as PlanKey)) {
      return res.status(403).json({
        error: 'plan_required',
        message: 'This feature requires a higher plan.',
        requiredUpgrade: true,
      });
    }

    next();
  };
}
