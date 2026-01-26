import { pipelineRepository, type PipelineOverviewResult, type StageUpdateResult } from '../repositories/pipeline.repository';
import { NotFoundError, BadRequestError } from '../utils/errors';
import type { PipelineStage, StageHistory } from '@shared/schema';

export class PipelineService {
  async getPipelineStages(): Promise<PipelineStage[]> {
    return await pipelineRepository.getPipelineStages();
  }

  async getStageHistory(targetCompanyId: number): Promise<StageHistory[]> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid company ID');
    }
    return await pipelineRepository.getStageHistory(targetCompanyId);
  }

  async updateCompanyStage(
    companyId: number,
    newStage: string,
    userId: number,
    notes: string = ''
  ): Promise<StageUpdateResult> {
    if (!companyId || isNaN(companyId)) {
      throw new BadRequestError('Invalid company ID');
    }

    if (!newStage || typeof newStage !== 'string') {
      throw new BadRequestError('Stage is required');
    }

    const result = await pipelineRepository.updateCompanyStage(companyId, newStage, userId, notes);
    
    if (!result.success && result.message === 'Company not found') {
      throw new NotFoundError('Company not found');
    }

    return result;
  }

  async getPipelineOverview(userCompanyId: number): Promise<PipelineOverviewResult> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await pipelineRepository.getPipelineOverview(userCompanyId);
  }
}

export const pipelineService = new PipelineService();
