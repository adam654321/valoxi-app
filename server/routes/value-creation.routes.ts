import { Router, Request, Response } from 'express';
import { valueCreationService } from '../services/value-creation.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/deal-model/:dealModelId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const dealModelId = parseInt(req.params.dealModelId);
    const result = await valueCreationService.getOrCreateForModel(dealModelId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/assumptions/bulk', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const { updates } = req.body;
    const result = await valueCreationService.bulkUpdateAssumptions(updates);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/assumptions/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const id = parseInt(req.params.id);
    const result = await valueCreationService.updateAssumption(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const id = parseInt(req.params.id);
    const result = await valueCreationService.updateScenario(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/synergies/:scenarioId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const scenarioId = parseInt(req.params.scenarioId);
    const result = await valueCreationService.addSynergy(scenarioId, req.body);
    sendCreated(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/synergies/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const id = parseInt(req.params.id);
    const result = await valueCreationService.updateSynergy(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/synergies/:id', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const id = parseInt(req.params.id);
    const result = await valueCreationService.deleteSynergy(id);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/exit/:dealModelId', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    
    const dealModelId = parseInt(req.params.dealModelId);
    const result = await valueCreationService.updateExitAssumptions(dealModelId, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
