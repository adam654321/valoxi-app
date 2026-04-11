import { Router, Request, Response } from 'express';
import { targetCompaniesService } from '../services/target-companies.service';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../utils/errors';
import { insertTargetCompanySchema } from '@shared/schema';
import { asyncHandler } from '../utils/async-handler';
import { requirePermission } from '../middleware/auth';
import { db } from '../db';
import { targetCompanies } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

const router = Router();

const frontendTargetCompanySchema = insertTargetCompanySchema.omit({
  userCompanyId: true,
  createdBy: true,
  stageUpdatedBy: true,
  stageUpdatedAt: true,
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const companies = await targetCompaniesService.getAll(userCompanyId);
  res.json(companies);
}));

router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const searchParams = {
    q: req.query.q as string,
    industry: req.query.industry as string,
    minRevenue: req.query.minRevenue ? Number(req.query.minRevenue) : undefined,
    maxRevenue: req.query.maxRevenue ? Number(req.query.maxRevenue) : undefined,
    minEmployees: req.query.minEmployees ? Number(req.query.minEmployees) : undefined,
    maxEmployees: req.query.maxEmployees ? Number(req.query.maxEmployees) : undefined,
    minYear: req.query.minYear ? Number(req.query.minYear) : undefined,
    maxYear: req.query.maxYear ? Number(req.query.maxYear) : undefined,
    sort: req.query.sort as string,
  };

  const companies = await targetCompaniesService.search(userCompanyId, searchParams);
  res.json(companies);
}));

router.get('/filters', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const filters = await targetCompaniesService.getFilterOptions(userCompanyId);
  res.json(filters);
}));

router.get('/archived', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const companies = await targetCompaniesService.getArchived(userCompanyId);
  res.json(companies);
}));

router.patch('/:id/archive', requirePermission('canDeleteDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();
  if (isNaN(id)) throw new BadRequestError('Invalid target company ID');

  const company = await targetCompaniesService.archive(id, userCompanyId);
  res.json({ message: 'Company archived successfully', company });
}));

router.patch('/:id/unarchive', requirePermission('canDeleteDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();
  if (isNaN(id)) throw new BadRequestError('Invalid target company ID');

  const company = await targetCompaniesService.unarchive(id, userCompanyId);
  res.json({ message: 'Company reinstated successfully', company });
}));

router.get('/:id/profile', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const userId = req.session?.userId;
  if (!userCompanyId || !userId) throw new UnauthorizedError();

  const targetCompanyId = parseInt(req.params.id);
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid target company ID');

  const profile = await targetCompaniesRepository.getCompanyProfile(targetCompanyId, userCompanyId, userId);
  if (!profile) throw new NotFoundError('Target company not found');

  if (profile.websiteAnalysis) {
    console.log(`Website analysis found for company ${targetCompanyId}:`, {
      analysisLength: profile.websiteAnalysis?.length,
      processedAt: profile.websiteAnalysisProcessedAt
    });
  }

  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  res.json(profile);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();

  const company = await targetCompaniesService.getById(id, userCompanyId);
  res.json(company);
}));

router.post('/', requirePermission('canCreateDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const validatedData = frontendTargetCompanySchema.parse(req.body);
  const company = await targetCompaniesService.create(validatedData, userId, userCompanyId);
  res.status(201).json(company);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();

  const validatedData = insertTargetCompanySchema.partial().parse(req.body);
  const company = await targetCompaniesService.update(id, validatedData, userCompanyId);
  res.json(company);
}));

router.patch('/:id/business-info', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();
  if (isNaN(id)) throw new BadRequestError('Invalid target company ID');

  console.log('[BUSINESS-INFO PATCH] raw body keys:', Object.keys(req.body || {}));
  console.log('[BUSINESS-INFO PATCH] description value:', JSON.stringify(req.body?.description));
  console.log('[BUSINESS-INFO PATCH] websiteAnalysis length:', req.body?.websiteAnalysis?.length ?? 'undefined');
  const { description, websiteAnalysis } = req.body;

  const [updated] = await db
    .update(targetCompanies)
    .set({
      description: description ?? null,
      websiteAnalysis: websiteAnalysis ?? null,
    })
    .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)))
    .returning();

  console.log('[BUSINESS-INFO PATCH] updated description:', updated?.description);

  if (!updated) throw new NotFoundError('Target company not found');
  res.json(updated);
}));

router.delete('/:id', requirePermission('canDeleteDeals'), asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();

  await targetCompaniesService.delete(id, userCompanyId);
  res.json({ message: 'Target company deleted successfully' });
}));

export default router;
