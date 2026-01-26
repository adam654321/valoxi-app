import { activitiesRepository, type ActivityWithDetails, type ActivityTimeline } from '../repositories/activities.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import type { Activity, ActivityType, InsertActivity } from '@shared/schema';

export class ActivitiesService {
  async getActivityTypes(): Promise<ActivityType[]> {
    return await activitiesRepository.getActivityTypes();
  }

  async createActivity(
    targetCompanyId: number,
    activityData: Omit<InsertActivity, 'targetCompanyId' | 'userId'>,
    userId: number,
    userCompanyId: number
  ): Promise<Activity> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const hasAccess = await activitiesRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new NotFoundError('Company not found or access denied');
    }

    return await activitiesRepository.createActivity({
      ...activityData,
      targetCompanyId,
      userId,
    });
  }

  async getActivitiesForCompany(
    targetCompanyId: number,
    userCompanyId: number
  ): Promise<ActivityWithDetails[]> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid company ID');
    }

    const hasAccess = await activitiesRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new NotFoundError('Company not found or access denied');
    }

    return await activitiesRepository.getActivitiesForCompany(targetCompanyId, userCompanyId);
  }

  async getActivityTimeline(
    targetCompanyId: number,
    userCompanyId: number
  ): Promise<ActivityTimeline> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid company ID');
    }

    const hasAccess = await activitiesRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new NotFoundError('Company not found or access denied');
    }

    return await activitiesRepository.getActivityTimeline(targetCompanyId, userCompanyId);
  }

  async updateActivity(
    activityId: number,
    updateData: Partial<InsertActivity>,
    userCompanyId: number
  ): Promise<Activity> {
    if (!activityId || isNaN(activityId)) {
      throw new BadRequestError('Invalid activity ID');
    }

    const updatedActivity = await activitiesRepository.updateActivity(activityId, updateData, userCompanyId);
    if (!updatedActivity) {
      throw new NotFoundError('Activity not found or access denied');
    }

    return updatedActivity;
  }

  async deleteActivity(activityId: number, userCompanyId: number): Promise<boolean> {
    if (!activityId || isNaN(activityId)) {
      throw new BadRequestError('Invalid activity ID');
    }

    const deleted = await activitiesRepository.deleteActivity(activityId, userCompanyId);
    if (!deleted) {
      throw new NotFoundError('Activity not found or access denied');
    }

    return true;
  }

  async getRecentActivities(userCompanyId: number, limit: number = 20): Promise<ActivityWithDetails[]> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }

    return await activitiesRepository.getRecentActivities(userCompanyId, limit);
  }
}

export const activitiesService = new ActivitiesService();
