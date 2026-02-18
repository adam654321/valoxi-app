import { Router, Request, Response } from 'express';
import { targetCompaniesService } from '../services/target-companies.service';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../utils/errors';
import { insertTargetCompanySchema } from '@shared/schema';
import { asyncHandler } from '../utils/async-handler';

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

router.post('/', asyncHandler(async (req: Request, res: Response) => {
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

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const id = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();

  await targetCompaniesService.delete(id, userCompanyId);
  res.json({ message: 'Target company deleted successfully' });
}));

export default router;
