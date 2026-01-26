import { dashboardRepository } from '../repositories/dashboard.repository';
import { BadRequestError } from '../utils/errors';
import type { DashboardPreference, InsertDashboardPreference } from '@shared/schema';

export class DashboardService {
  async getStats(userCompanyId: number) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    const targetCompanyCount = await dashboardRepository.getTargetCompanyCount(userCompanyId);
    const totalContactsCount = await dashboardRepository.getTotalContactsCount(userCompanyId);
    const metrics = await dashboardRepository.getDashboardMetrics(userCompanyId);
    return { targetCompanies: targetCompanyCount, activeDeals: metrics.activeDeals, totalContacts: totalContactsCount, dealValue: metrics.totalDealValue };
  }

  async getWidgetData(userCompanyId: number, userId: number, widgetType: string) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    switch (widgetType) {
      case 'pipeline-overview': return await dashboardRepository.getPipelineOverviewWidget(userCompanyId);
      case 'recent-activities': return await dashboardRepository.getRecentActivitiesWidget(userCompanyId);
      case 'hot-deals': return await dashboardRepository.getHotDealsWidget(userCompanyId);
      case 'quick-stats': return await dashboardRepository.getQuickStatsWidget(userCompanyId);
      case 'upcoming-reminders': return await dashboardRepository.getUpcomingRemindersWidget(userId);
      case 'team-activity': return await dashboardRepository.getTeamActivityWidget(userCompanyId);
      case 'stage-alerts': return await dashboardRepository.getStageAlertsWidget(userCompanyId);
      default: throw new BadRequestError('Invalid widget type');
    }
  }

  async getPreferences(userId: number): Promise<DashboardPreference[]> {
    return await dashboardRepository.getPreferences(userId);
  }

  async updatePreferences(userId: number, preferences: InsertDashboardPreference[]): Promise<void> {
    await dashboardRepository.updatePreferences(userId, preferences);
  }

  async getAlerts(userCompanyId: number) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await dashboardRepository.getAlerts(userCompanyId);
  }

  async dismissAlert(alertId: number, userCompanyId: number): Promise<boolean> {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await dashboardRepository.dismissAlert(alertId, userCompanyId);
  }
}

export const dashboardService = new DashboardService();
