import { Router, Request, Response } from 'express';
import { valueCreationService } from '../services/value-creation.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/deal-model/:dealModelId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const dealModelId = parseInt(req.params.dealModelId);
  const result = await valueCreationService.getOrCreateForModel(dealModelId);
  sendSuccess(res, result);
}));

router.put('/assumptions/bulk', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const { updates } = req.body;
  const result = await valueCreationService.bulkUpdateAssumptions(updates);
  sendSuccess(res, result);
}));

router.put('/assumptions/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const id = parseInt(req.params.id);
  const result = await valueCreationService.updateAssumption(id, req.body);
  sendSuccess(res, result);
}));

router.put('/scenarios/deal-model/:dealModelId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const dealModelId = parseInt(req.params.dealModelId);
  const result = await valueCreationService.updateAllScenariosForModel(dealModelId, req.body);
  sendSuccess(res, result);
}));

router.put('/scenarios/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const id = parseInt(req.params.id);
  const result = await valueCreationService.updateScenario(id, req.body);
  sendSuccess(res, result);
}));

router.post('/synergies/:scenarioId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const scenarioId = parseInt(req.params.scenarioId);
  const result = await valueCreationService.addSynergy(scenarioId, req.body);
  sendCreated(res, result);
}));

router.put('/synergies/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const id = parseInt(req.params.id);
  const result = await valueCreationService.updateSynergy(id, req.body);
  sendSuccess(res, result);
}));

router.delete('/synergies/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const id = parseInt(req.params.id);
  const result = await valueCreationService.deleteSynergy(id);
  sendSuccess(res, result);
}));

router.put('/exit/:dealModelId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  
  const dealModelId = parseInt(req.params.dealModelId);
  const result = await valueCreationService.updateExitAssumptions(dealModelId, req.body);
  sendSuccess(res, result);
}));

export default router;
