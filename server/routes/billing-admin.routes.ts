import { Router, type Request, type Response } from 'express';
import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';
import { isAuthenticated, isSystemAdmin } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';
import type { PlanKey, SubscriptionStatus } from '@shared/schema/billing';

const router = Router();

router.post('/admin/comp', isAuthenticated, validateCsrfToken, isSystemAdmin, async (req: Request, res: Response) => {
  try {
    const { userCompanyId, planKey, notes } = req.body as { userCompanyId: number; planKey: PlanKey; notes?: string };

    if (!userCompanyId || typeof userCompanyId !== 'number') {
      return res.status(400).json({ error: 'invalid_company', message: 'A valid userCompanyId is required.' });
    }

    if (!planKey || !['CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE'].includes(planKey)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'A valid planKey is required.' });
    }

    const adminUserId = req.session.userId!;
    const subscription = await billingService.grantAdminComp(userCompanyId, planKey, adminUserId, notes);

    return res.status(200).json({ subscription });
  } catch (err: any) {
    console.error('[Billing] Error granting admin comp:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to grant comped access.' });
  }
});

router.get('/admin/subscriptions', isAuthenticated, isSystemAdmin, async (req: Request, res: Response) => {
  try {
    const filters: { status?: SubscriptionStatus; planKey?: PlanKey } = {};
    if (req.query.status) {
      filters.status = req.query.status as SubscriptionStatus;
    }
    if (req.query.planKey) {
      filters.planKey = req.query.planKey as PlanKey;
    }

    const subscriptions = await billingRepository.getAllSubscriptions(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return res.status(200).json({ subscriptions });
  } catch (err: any) {
    console.error('[Billing] Error fetching all subscriptions:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to fetch subscriptions.' });
  }
});

export default router;
