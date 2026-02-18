import { adminRepository } from '../repositories/admin.repository';
import type { InsertPlatformCost } from '@shared/schema';

export class AdminService {
  async getPlatformOverview() {
    return await adminRepository.getPlatformOverview();
  }

  async getTokenUsage(filters: {
    companyId?: number;
    dealId?: number;
    service?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }) {
    return await adminRepository.getTokenUsage(filters);
  }

  async getTokenUsageByCompany(from?: string, to?: string) {
    return await adminRepository.getTokenUsageByCompany(from, to);
  }

  async getTokenUsageByDeal(from?: string, to?: string) {
    return await adminRepository.getTokenUsageByDeal(from, to);
  }

  async getTokenUsageByService(from?: string, to?: string) {
    return await adminRepository.getTokenUsageByService(from, to);
  }

  async getPlatformCosts(filters: { costType?: string; from?: string; to?: string }) {
    return await adminRepository.getPlatformCosts(filters);
  }

  async createPlatformCost(data: InsertPlatformCost) {
    return await adminRepository.createPlatformCost(data);
  }

  async getAllCompanies() {
    return await adminRepository.getAllCompanies();
  }

  async getCompanyById(companyId: number) {
    return await adminRepository.getCompanyById(companyId);
  }

  async getAllUsers() {
    return await adminRepository.getAllUsers();
  }

  async getWebhookEvents(filters: { status?: string; source?: string; page: number; limit: number }) {
    return await adminRepository.getWebhookEvents(filters);
  }
}

export const adminService = new AdminService();
