import { Router, Request, Response } from 'express';
import { reportsService } from '../services/reports.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/pipeline-overview', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const data = await reportsService.getPipelineOverview(userCompanyId, req.query.range as string);
  sendSuccess(res, data);
}));

router.get('/activity-summary', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const data = await reportsService.getActivitySummary(userCompanyId, req.query.range as string);
  sendSuccess(res, data);
}));

router.get('/performance-metrics', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const data = await reportsService.getPerformanceMetrics(userCompanyId, req.query.range as string);
  sendSuccess(res, data);
}));

router.get('/stage-analysis', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const data = await reportsService.getStageAnalysis(userCompanyId, req.query.range as string);
  sendSuccess(res, data);
}));

router.get('/user-performance', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const data = await reportsService.getUserPerformance(userCompanyId, req.query.range as string);
  sendSuccess(res, data);
}));

router.get('/export/:type', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const csvData = await reportsService.exportReport(userCompanyId, req.params.type, req.query.format as string || 'csv');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_report_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csvData);
}));

export default router;
