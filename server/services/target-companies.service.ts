import { targetCompaniesRepository, type TargetCompanyWithStats, type SearchParams, type FilterOptions } from '../repositories/target-companies.repository';
import { websiteAnalysisService } from './website-analysis.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { TargetCompany, InsertTargetCompany } from '@shared/schema';

export class TargetCompaniesService {
  async getAll(userCompanyId: number): Promise<TargetCompanyWithStats[]> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await targetCompaniesRepository.getAll(userCompanyId);
  }

  async getById(id: number, userCompanyId: number): Promise<TargetCompany> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const company = await targetCompaniesRepository.getById(id, userCompanyId);
    if (!company) {
      throw new NotFoundError('Target company not found');
    }
    return company;
  }

  async create(data: Omit<InsertTargetCompany, 'userCompanyId' | 'createdBy'>, userId: number, userCompanyId: number): Promise<TargetCompany> {
    const processedData = {
      companyName: data.companyName,
      industry: data.industry || null,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      annualRevenue: data.annualRevenue || null,
      employeeCount: typeof data.employeeCount === 'string' && (data.employeeCount as string).trim()
        ? parseInt(data.employeeCount as string) || null
        : data.employeeCount || null,
      yearEstablished: typeof data.yearEstablished === 'string' && (data.yearEstablished as string).trim()
        ? parseInt(data.yearEstablished as string) || null
        : data.yearEstablished || null,
      description: data.description || null,
      stage: data.stage || null,
      userCompanyId,
      createdBy: userId,
    };

    const company = await targetCompaniesRepository.create(processedData as InsertTargetCompany);

    // Trigger website analysis if company has a website
    if (company.website) {
      websiteAnalysisService.triggerAnalysisIfNeeded(company.id, company.website);
    }

    return company;
  }

  async update(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const updated = await targetCompaniesRepository.update(id, updateData, userCompanyId);
    if (!updated) {
      throw new NotFoundError('Target company not found');
    }
    return updated;
  }

  async delete(id: number, userCompanyId: number): Promise<boolean> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const deleted = await targetCompaniesRepository.delete(id, userCompanyId);
    if (!deleted) {
      throw new NotFoundError('Target company not found');
    }
    return true;
  }

  async getFilterOptions(userCompanyId: number): Promise<FilterOptions> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await targetCompaniesRepository.getFilterOptions(userCompanyId);
  }

  async search(userCompanyId: number, params: SearchParams): Promise<TargetCompanyWithStats[]> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await targetCompaniesRepository.search(userCompanyId, params);
  }
}

export const targetCompaniesService = new TargetCompaniesService();
