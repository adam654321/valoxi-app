import { Router, Request, Response } from 'express';
import { documentAnalysisService } from '../services/document-analysis.service';
import { retriggerAnalysisForDocument } from '../services/file-analysis.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/document/:documentId', asyncHandler(async (req: Request, res: Response) => {
  const documentId = parseInt(req.params.documentId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  const results = await documentAnalysisService.getAnalysisForDocument(documentId, userCompanyId);
  sendSuccess(res, results);
}));

router.get('/by-type/:documentType', asyncHandler(async (req: Request, res: Response) => {
  const documentType = req.params.documentType;
  const userCompanyId = req.session.userCompanyId!;
  if (!documentType) throw new BadRequestError('Document type is required');
  const results = await documentAnalysisService.getAnalysisByType(documentType, userCompanyId);
  sendSuccess(res, results);
}));

router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const results = await documentAnalysisService.getAllAnalysisForCompany(targetCompanyId, userCompanyId);
  sendSuccess(res, results);
}));

router.get('/company/:companyId/by-type/:documentType', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const documentType = req.params.documentType;
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const results = await documentAnalysisService.getAnalysisByTypeForCompany(documentType, targetCompanyId, userCompanyId);
  sendSuccess(res, results);
}));

router.get('/company/:companyId/completion', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const status = await documentAnalysisService.getCompletionStatus(targetCompanyId, userCompanyId);
  sendSuccess(res, status);
}));

router.get('/company/:companyId/summary', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const summary = await documentAnalysisService.getAnalysisSummaryForCompany(targetCompanyId, userCompanyId);
  sendSuccess(res, summary);
}));

router.post('/document/:documentId/retry', asyncHandler(async (req: Request, res: Response) => {
  const documentId = parseInt(req.params.documentId);
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  await retriggerAnalysisForDocument(documentId);
  sendSuccess(res, { message: 'Analysis retriggered successfully', documentId });
}));

export default router;
