import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '@shared/schema/billing';

/** Run after identity resolution, including for routes without a paid-plan guard. */
export async function requireUnsuspendedAccount(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl.split('?')[0];
  if (req.session.isSystemAdmin || path.startsWith('/api/v2/admin/') ||
      path.startsWith('/api/v2/admin-') || path.startsWith('/api/v2/auth/') ||
      (req.method === 'GET' && path === '/api/v2/billing/subscription')) {
    return next();
  }
  const companyId = req.session.userCompanyId;
  if (!companyId) return next();
  try {
    const [subscription] = await db.select({ suspendedAt: subscriptions.suspendedAt })
      .from(subscriptions).where(eq(subscriptions.userCompanyId, companyId));
    if (subscription?.suspendedAt) {
      return res.status(403).json({
        error: 'subscription_suspended',
        message: 'Your subscription is suspended. Billing and account access are paused. Contact your administrator.',
      });
    }
    return next();
  } catch (error) {
    next(error);
  }
}
