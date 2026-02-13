import { Router, Request, Response } from 'express';
import { documentAnalysisService } from '../services/document-analysis.service';
import { retriggerAnalysisForDocument } from '../services/file-analysis.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/document/:documentId', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    const results = await documentAnalysisService.getAnalysisForDocument(documentId, userCompanyId);
    sendSuccess(res, results);
  } catch (error) { sendError(res, error); }
});

router.get('/by-type/:documentType', async (req: Request, res: Response) => {
  try {
    const documentType = req.params.documentType;
    const userCompanyId = req.session.userCompanyId!;
    if (!documentType) throw new BadRequestError('Document type is required');
    const results = await documentAnalysisService.getAnalysisByType(documentType, userCompanyId);
    sendSuccess(res, results);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const results = await documentAnalysisService.getAllAnalysisForCompany(targetCompanyId, userCompanyId);
    sendSuccess(res, results);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/by-type/:documentType', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const documentType = req.params.documentType;
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const results = await documentAnalysisService.getAnalysisByTypeForCompany(documentType, targetCompanyId, userCompanyId);
    sendSuccess(res, results);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/completion', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const status = await documentAnalysisService.getCompletionStatus(targetCompanyId, userCompanyId);
    sendSuccess(res, status);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/summary', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const summary = await documentAnalysisService.getAnalysisSummaryForCompany(targetCompanyId, userCompanyId);
    sendSuccess(res, summary);
  } catch (error) { sendError(res, error); }
});

router.post('/document/:documentId/retry', async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();
    if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
    await retriggerAnalysisForDocument(documentId);
    sendSuccess(res, { message: 'Analysis retriggered successfully', documentId });
  } catch (error) { sendError(res, error); }
});

export default router;
