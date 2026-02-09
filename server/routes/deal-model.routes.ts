import { Router, Request, Response } from 'express';
import { dealModelService } from '../services/deal-model.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.post('/create/:companyId', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();

    const companyId = parseInt(req.params.companyId);
    const { name } = req.body;

    const result = await dealModelService.createModel(companyId, userId, userCompanyId, name);
    sendCreated(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const companyId = parseInt(req.params.companyId);
    const result = await dealModelService.listModels(companyId, userCompanyId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const id = parseInt(req.params.id);
    const result = await dealModelService.getModel(id, userCompanyId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const id = parseInt(req.params.id);
    const result = await dealModelService.updateModel(id, userCompanyId, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/adjustments', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const result = await dealModelService.addCustomAdjustment(modelId, userCompanyId, req.body);
    sendCreated(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id/adjustments/bulk', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const { updates } = req.body;
    const result = await dealModelService.bulkUpdateAdjustments(modelId, userCompanyId, updates);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id/adjustments/:adjId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const adjId = parseInt(req.params.adjId);
    const result = await dealModelService.updateAdjustment(modelId, adjId, userCompanyId, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id/adjustments/:adjId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const adjId = parseInt(req.params.adjId);
    const result = await dealModelService.deleteAdjustment(modelId, adjId, userCompanyId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/funding-lines', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const result = await dealModelService.addFundingLine(modelId, userCompanyId, req.body);
    sendCreated(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id/funding-lines/:lineId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const lineId = parseInt(req.params.lineId);
    const result = await dealModelService.updateFundingLine(modelId, lineId, userCompanyId, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id/funding-lines/:lineId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const modelId = parseInt(req.params.id);
    const lineId = parseInt(req.params.lineId);
    const result = await dealModelService.deleteFundingLine(modelId, lineId, userCompanyId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/lock', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const id = parseInt(req.params.id);
    const result = await dealModelService.lockModel(id, userCompanyId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const id = parseInt(req.params.id);
    const { name } = req.body;
    const result = await dealModelService.duplicateModel(id, userCompanyId, name);
    sendCreated(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id/calculate', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();

    const id = parseInt(req.params.id);
    const result = await dealModelService.calculateOnly(id, userCompanyId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
