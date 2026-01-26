import { reportsRepository } from '../repositories/reports.repository';
import { BadRequestError } from '../utils/errors';

export class ReportsService {
  async getPipelineOverview(userCompanyId: number, dateRange?: string) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await reportsRepository.getPipelineOverview(userCompanyId, dateRange);
  }

  async getActivitySummary(userCompanyId: number, dateRange?: string) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await reportsRepository.getActivitySummary(userCompanyId, dateRange);
  }

  async getPerformanceMetrics(userCompanyId: number, dateRange?: string) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await reportsRepository.getPerformanceMetrics(userCompanyId, dateRange);
  }

  async getStageAnalysis(userCompanyId: number, dateRange?: string) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await reportsRepository.getStageAnalysis(userCompanyId, dateRange);
  }

  async getUserPerformance(userCompanyId: number, dateRange?: string) {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    return await reportsRepository.getUserPerformance(userCompanyId, dateRange);
  }

  async exportReport(userCompanyId: number, reportType: string, format: string = 'csv'): Promise<string> {
    if (!userCompanyId) throw new BadRequestError('User company not found');
    let data: any[] = [];
    let headers: string[] = [];
    switch (reportType) {
      case 'pipeline-overview':
        const pipelineData = await reportsRepository.getPipelineOverview(userCompanyId);
        data = pipelineData.stageStats.map(stat => ({
          stage: stat.stageName, count: stat.companyCount,
          percentage: pipelineData.totalCompanies > 0 ? Math.round((stat.companyCount / pipelineData.totalCompanies) * 100 * 100) / 100 : 0
        }));
        headers = ['stage', 'count', 'percentage'];
        break;
      case 'activity-summary':
        const activityData = await reportsRepository.getActivitySummary(userCompanyId);
        data = activityData.activityByType;
        headers = ['activity_type', 'count', 'avg_duration', 'companies_contacted'];
        break;
      case 'performance-metrics':
        const perfData = await reportsRepository.getPerformanceMetrics(userCompanyId);
        data = [perfData];
        headers = ['total_deals', 'active_deals', 'completed_deals', 'success_rate'];
        break;
      case 'stage-analysis':
        data = await reportsRepository.getStageAnalysis(userCompanyId);
        headers = ['stage_name', 'deal_count', 'avg_days', 'risk_level'];
        break;
      case 'user-performance':
        data = await reportsRepository.getUserPerformance(userCompanyId);
        headers = ['user_name', 'active_deals', 'total_activities', 'success_rate'];
        break;
      default:
        throw new BadRequestError('Invalid report type');
    }
    let csv = headers.join(',') + '\n';
    data.forEach((row: any) => {
      const values = headers.map(header => `"${row[header] || ''}"`);
      csv += values.join(',') + '\n';
    });
    return csv;
  }
}

export const reportsService = new ReportsService();
