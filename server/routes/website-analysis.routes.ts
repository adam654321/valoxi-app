import { Router, Request, Response } from 'express';
import { websiteAnalysisService } from '../services/website-analysis.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';

const router = Router();

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { websiteUrl } = req.body;
    if (!websiteUrl) throw new BadRequestError('Website URL is required');
    const result = await websiteAnalysisService.analyzeWebsite(websiteUrl);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.post('/company/:companyId/analyze', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    if (!company.website) throw new BadRequestError('Company has no website URL');
    const result = await websiteAnalysisService.analyzeAndUpdateCompany(targetCompanyId, company.website);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/status', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    sendSuccess(res, {
      hasWebsite: !!company.website,
      hasAnalysis: !!company.websiteAnalysis,
      analysisProcessedAt: company.websiteAnalysisProcessedAt,
      analysis: company.websiteAnalysis
    });
  } catch (error) { sendError(res, error); }
});

export default router;
