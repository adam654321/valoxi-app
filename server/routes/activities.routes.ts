import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { activitiesService } from '../services/activities.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { insertActivitySchema } from '@shared/schema';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

const activityUpdateSchema = z.object({
  activityType: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  activityDate: z.string().datetime().or(z.date()).optional(),
  activityTime: z.string().optional(),
  durationMinutes: z.number().optional().nullable(),
  contactId: z.number().optional().nullable(),
  isCompleted: z.boolean().optional(),
  followUpDate: z.string().datetime().optional().nullable().or(z.date().optional().nullable()),
});

router.get('/types', asyncHandler(async (req: Request, res: Response) => {
  const types = await activitiesService.getActivityTypes();
  sendSuccess(res, types);
}));

router.get('/recent', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const activities = await activitiesService.getRecentActivities(userCompanyId, limit);
  sendSuccess(res, activities);
}));

router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const targetCompanyId = parseInt(req.params.companyId);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const activities = await activitiesService.getActivitiesForCompany(targetCompanyId, userCompanyId);
  sendSuccess(res, activities);
}));

router.get('/company/:companyId/timeline', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const targetCompanyId = parseInt(req.params.companyId);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const timeline = await activitiesService.getActivityTimeline(targetCompanyId, userCompanyId);
  sendSuccess(res, timeline);
}));

router.post('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  const targetCompanyId = parseInt(req.params.companyId);

  if (!userId || !userCompanyId) {
    throw new UnauthorizedError();
  }

  const activityData = insertActivitySchema.omit({ targetCompanyId: true, userId: true }).parse(req.body);

  const activity = await activitiesService.createActivity(
    targetCompanyId,
    activityData,
    userId,
    userCompanyId
  );

  sendCreated(res, activity);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const activityId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const updateData = activityUpdateSchema.parse(req.body);

  const updatedActivity = await activitiesService.updateActivity(
    activityId,
    updateData,
    userCompanyId
  );

  sendSuccess(res, updatedActivity);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const activityId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  await activitiesService.deleteActivity(activityId, userCompanyId);
  sendSuccess(res, { message: 'Activity deleted successfully' });
}));

export default router;
