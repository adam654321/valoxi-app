import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { adminService } from '../services/admin.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';

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

export default router;
