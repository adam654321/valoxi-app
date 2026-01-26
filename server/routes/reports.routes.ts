import { Router, Request, Response } from 'express';
import { reportsService } from '../services/reports.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/pipeline-overview', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const data = await reportsService.getPipelineOverview(userCompanyId, req.query.range as string);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/activity-summary', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const data = await reportsService.getActivitySummary(userCompanyId, req.query.range as string);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/performance-metrics', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const data = await reportsService.getPerformanceMetrics(userCompanyId, req.query.range as string);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/stage-analysis', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const data = await reportsService.getStageAnalysis(userCompanyId, req.query.range as string);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/user-performance', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const data = await reportsService.getUserPerformance(userCompanyId, req.query.range as string);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/export/:type', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const csvData = await reportsService.exportReport(userCompanyId, req.params.type, req.query.format as string || 'csv');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_report_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvData);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
