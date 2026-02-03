import { Router, Request, Response } from 'express';
import { targetCompaniesService } from '../services/target-companies.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertTargetCompanySchema } from '@shared/schema';

const router = Router();

const frontendTargetCompanySchema = insertTargetCompanySchema.omit({
  userCompanyId: true,
  createdBy: true,
  stageUpdatedBy: true,
  stageUpdatedAt: true,
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const companies = await targetCompaniesService.getAll(userCompanyId);
    // Debug: log first company's contact counts
    if (companies.length > 0) {
      const skinPharma = companies.find((c: any) => c.companyName === 'SkinPharma');
      if (skinPharma) {
        console.log('[DEBUG] SkinPharma data:', JSON.stringify({ 
          id: skinPharma.id, 
          totalContacts: skinPharma.totalContacts, 
          contactCount: skinPharma.contactCount,
          keys: Object.keys(skinPharma)
        }));
      }
    }
    sendSuccess(res, companies);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
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
    sendSuccess(res, companies);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/filters', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const filters = await targetCompaniesService.getFilterOptions(userCompanyId);
    sendSuccess(res, filters);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const id = parseInt(req.params.id);
    if (!userCompanyId) throw new UnauthorizedError();

    const company = await targetCompaniesService.getById(id, userCompanyId);
    sendSuccess(res, company);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();

    const validatedData = frontendTargetCompanySchema.parse(req.body);
    const company = await targetCompaniesService.create(validatedData, userId, userCompanyId);
    sendCreated(res, company);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const id = parseInt(req.params.id);
    if (!userCompanyId) throw new UnauthorizedError();

    const validatedData = insertTargetCompanySchema.partial().parse(req.body);
    const company = await targetCompaniesService.update(id, validatedData, userCompanyId);
    sendSuccess(res, company);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const id = parseInt(req.params.id);
    if (!userCompanyId) throw new UnauthorizedError();

    await targetCompaniesService.delete(id, userCompanyId);
    sendSuccess(res, { message: 'Target company deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
