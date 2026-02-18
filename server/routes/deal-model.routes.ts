import { Router, Request, Response } from 'express';
import { dealModelService } from '../services/deal-model.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.post('/create/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.companyId);
  const { name } = req.body;

  const result = await dealModelService.createModel(companyId, userId, userCompanyId, name);
  sendCreated(res, result);
}));

router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.companyId);
  const result = await dealModelService.listModels(companyId, userCompanyId);
  sendSuccess(res, result);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const id = parseInt(req.params.id);
  const result = await dealModelService.getModel(id, userCompanyId);
  sendSuccess(res, result);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const id = parseInt(req.params.id);
  const result = await dealModelService.updateModel(id, userCompanyId, req.body);
  sendSuccess(res, result);
}));

router.post('/:id/adjustments', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const result = await dealModelService.addCustomAdjustment(modelId, userCompanyId, req.body);
  sendCreated(res, result);
}));

router.put('/:id/adjustments/bulk', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const { updates } = req.body;
  const result = await dealModelService.bulkUpdateAdjustments(modelId, userCompanyId, updates);
  sendSuccess(res, result);
}));

router.put('/:id/adjustments/:adjId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const adjId = parseInt(req.params.adjId);
  const result = await dealModelService.updateAdjustment(modelId, adjId, userCompanyId, req.body);
  sendSuccess(res, result);
}));

router.delete('/:id/adjustments/:adjId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const adjId = parseInt(req.params.adjId);
  const result = await dealModelService.deleteAdjustment(modelId, adjId, userCompanyId);
  sendSuccess(res, result);
}));

router.post('/:id/funding-lines', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const result = await dealModelService.addFundingLine(modelId, userCompanyId, req.body);
  sendCreated(res, result);
}));

router.put('/:id/funding-lines/:lineId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const lineId = parseInt(req.params.lineId);
  const result = await dealModelService.updateFundingLine(modelId, lineId, userCompanyId, req.body);
  sendSuccess(res, result);
}));

router.delete('/:id/funding-lines/:lineId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const modelId = parseInt(req.params.id);
  const lineId = parseInt(req.params.lineId);
  const result = await dealModelService.deleteFundingLine(modelId, lineId, userCompanyId);
  sendSuccess(res, result);
}));

router.post('/:id/lock', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const id = parseInt(req.params.id);
  const result = await dealModelService.lockModel(id, userCompanyId);
  sendSuccess(res, result);
}));

router.post('/:id/duplicate', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const id = parseInt(req.params.id);
  const { name } = req.body;
  const result = await dealModelService.duplicateModel(id, userCompanyId, name);
  sendCreated(res, result);
}));

router.get('/:id/calculate', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();

  const id = parseInt(req.params.id);
  const result = await dealModelService.calculateOnly(id, userCompanyId);
  sendSuccess(res, result);
}));

export default router;
