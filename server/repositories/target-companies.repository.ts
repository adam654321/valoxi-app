import { eq, and, desc, asc, sql, or, ilike, gte, lte, count } from 'drizzle-orm';
import { db } from '../db';
import {
  targetCompanies,
  targetContacts,
  users,
  userCompanies,
  type TargetCompany,
  type InsertTargetCompany,
  type TargetContact,
} from '@shared/schema';

export interface TargetCompanyWithStats extends TargetCompany {
  totalContacts?: number;
  contactCount?: number;
  primaryContactName?: string | null;
}

export interface CompanyProfile extends TargetCompany {
  createdByName: string;
  userCompanyName: string;
  totalContacts: number;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactTitle: string | null;
  yearsInBusiness: number | null;
  revenuePerEmployee: number | null;
  contacts: TargetContact[];
}

export interface SearchParams {
  q?: string;
  industry?: string;
  minRevenue?: number;
  maxRevenue?: number;
  minEmployees?: number;
  maxEmployees?: number;
  minYear?: number;
  maxYear?: number;
  sort?: string;
}

export interface FilterOptions {
  industries: string[];
  revenueRange: { min: number | null; max: number | null };
  employeeRange: { min: number | null; max: number | null };
  yearRange: { min: number | null; max: number | null };
}

export class TargetCompaniesRepository {
  async getAll(userCompanyId: number): Promise<TargetCompanyWithStats[]> {
    return await db
      .select({
        id: targetCompanies.id,
        userCompanyId: targetCompanies.userCompanyId,
        companyName: targetCompanies.companyName,
        industry: targetCompanies.industry,
        subSector: targetCompanies.subSector,
        website: targetCompanies.website,
        phone: targetCompanies.phone,
        email: targetCompanies.email,
        address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue,
        employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished,
        description: targetCompanies.description,
        websiteAnalysis: targetCompanies.websiteAnalysis,
        websiteAnalysisProcessedAt: targetCompanies.websiteAnalysisProcessedAt,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        stageUpdatedBy: targetCompanies.stageUpdatedBy,
        createdBy: targetCompanies.createdBy,
        createdAt: targetCompanies.createdAt,
        initialDiscussionCompleted: targetCompanies.initialDiscussionCompleted,
        initialDiscussionDate: targetCompanies.initialDiscussionDate,
        initialDiscussionNotes: targetCompanies.initialDiscussionNotes,
        initialDiscussionBy: targetCompanies.initialDiscussionBy,
        totalContacts: sql<number>`COALESCE((SELECT COUNT(*)::int FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id}), 0)`.as('totalContacts'),
        contactCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id}), 0)`.as('contactCount'),
        primaryContactName: sql<string | null>`(SELECT target_contacts.first_name || ' ' || target_contacts.last_name FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id} AND target_contacts.is_primary = true LIMIT 1)`.as('primaryContactName')
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(targetCompanies.createdAt));
  }

  async getById(id: number, userCompanyId: number): Promise<TargetCompany | undefined> {
    const [company] = await db
      .select()
      .from(targetCompanies)
      .where(
        userCompanyId === 0 
          ? eq(targetCompanies.id, id)
          : and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId))
      );
    return company || undefined;
  }

  async create(insertCompany: InsertTargetCompany): Promise<TargetCompany> {
    const processedData = {
      ...insertCompany,
      annualRevenue: typeof insertCompany.annualRevenue === 'number' 
        ? insertCompany.annualRevenue.toString() 
        : insertCompany.annualRevenue,
      employeeCount: typeof insertCompany.employeeCount === 'string' 
        ? parseInt(insertCompany.employeeCount) || null
        : insertCompany.employeeCount,
      yearEstablished: typeof insertCompany.yearEstablished === 'string' 
        ? parseInt(insertCompany.yearEstablished) || null
        : insertCompany.yearEstablished
    };
    
    const [company] = await db.insert(targetCompanies).values([processedData]).returning();
    return company;
  }

  async update(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined> {
    const processedData = {
      ...updateData,
      annualRevenue: typeof updateData.annualRevenue === 'number' 
        ? updateData.annualRevenue.toString() 
        : updateData.annualRevenue,
      employeeCount: typeof updateData.employeeCount === 'string' 
        ? parseInt(updateData.employeeCount) || null
        : updateData.employeeCount,
      yearEstablished: typeof updateData.yearEstablished === 'string' 
        ? parseInt(updateData.yearEstablished) || null
        : updateData.yearEstablished
    };
    
    const [company] = await db
      .update(targetCompanies)
      .set(processedData)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)))
      .returning();
    return company || undefined;
  }

  async delete(id: number, userCompanyId: number): Promise<boolean> {
    const result = await db
      .delete(targetCompanies)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getFilterOptions(userCompanyId: number): Promise<FilterOptions> {
    const industries = await db
      .selectDistinct({ industry: targetCompanies.industry })
      .from(targetCompanies)
      .where(and(eq(targetCompanies.userCompanyId, userCompanyId), sql`${targetCompanies.industry} IS NOT NULL`))
      .orderBy(targetCompanies.industry);

    const revenueStats = await db.select({
      min: sql<number>`MIN(${targetCompanies.annualRevenue}::numeric)`,
      max: sql<number>`MAX(${targetCompanies.annualRevenue}::numeric)`
    }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), sql`${targetCompanies.annualRevenue} IS NOT NULL`));

    const employeeStats = await db.select({
      min: sql<number>`MIN(${targetCompanies.employeeCount})`,
      max: sql<number>`MAX(${targetCompanies.employeeCount})`
    }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), sql`${targetCompanies.employeeCount} IS NOT NULL`));

    const yearStats = await db.select({
      min: sql<number>`MIN(${targetCompanies.yearEstablished})`,
      max: sql<number>`MAX(${targetCompanies.yearEstablished})`
    }).from(targetCompanies).where(and(eq(targetCompanies.userCompanyId, userCompanyId), sql`${targetCompanies.yearEstablished} IS NOT NULL`));

    return {
      industries: industries.map(row => row.industry!).filter(Boolean),
      revenueRange: { min: revenueStats[0]?.min || null, max: revenueStats[0]?.max || null },
      employeeRange: { min: employeeStats[0]?.min || null, max: employeeStats[0]?.max || null },
      yearRange: { min: yearStats[0]?.min || null, max: yearStats[0]?.max || null }
    };
  }

  async search(userCompanyId: number, params: SearchParams): Promise<TargetCompanyWithStats[]> {
    const conditions = [eq(targetCompanies.userCompanyId, userCompanyId)];

    if (params.q) {
      const searchTerm = `%${params.q}%`;
      conditions.push(or(ilike(targetCompanies.companyName, searchTerm), ilike(targetCompanies.industry, searchTerm), ilike(targetCompanies.address, searchTerm))!);
    }
    if (params.industry && params.industry !== 'all') conditions.push(eq(targetCompanies.industry, params.industry));
    if (params.minRevenue !== undefined) conditions.push(gte(targetCompanies.annualRevenue, params.minRevenue.toString()));
    if (params.maxRevenue !== undefined) conditions.push(lte(targetCompanies.annualRevenue, params.maxRevenue.toString()));
    if (params.minEmployees !== undefined) conditions.push(gte(targetCompanies.employeeCount, params.minEmployees));
    if (params.maxEmployees !== undefined) conditions.push(lte(targetCompanies.employeeCount, params.maxEmployees));
    if (params.minYear !== undefined) conditions.push(gte(targetCompanies.yearEstablished, params.minYear));
    if (params.maxYear !== undefined) conditions.push(lte(targetCompanies.yearEstablished, params.maxYear));

    let orderBy;
    switch (params.sort) {
      case 'name_asc': orderBy = asc(targetCompanies.companyName); break;
      case 'name_desc': orderBy = desc(targetCompanies.companyName); break;
      case 'date_oldest': orderBy = asc(targetCompanies.createdAt); break;
      case 'revenue_high': orderBy = desc(targetCompanies.annualRevenue); break;
      case 'revenue_low': orderBy = asc(targetCompanies.annualRevenue); break;
      case 'employees_high': orderBy = desc(targetCompanies.employeeCount); break;
      case 'employees_low': orderBy = asc(targetCompanies.employeeCount); break;
      default: orderBy = desc(targetCompanies.createdAt);
    }

    return await db
      .select({
        id: targetCompanies.id, userCompanyId: targetCompanies.userCompanyId, companyName: targetCompanies.companyName,
        industry: targetCompanies.industry, subSector: targetCompanies.subSector, website: targetCompanies.website,
        phone: targetCompanies.phone, email: targetCompanies.email, address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue, employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished, description: targetCompanies.description,
        websiteAnalysis: targetCompanies.websiteAnalysis, websiteAnalysisProcessedAt: targetCompanies.websiteAnalysisProcessedAt,
        stage: targetCompanies.stage, stageUpdatedAt: targetCompanies.stageUpdatedAt, stageUpdatedBy: targetCompanies.stageUpdatedBy,
        createdBy: targetCompanies.createdBy, createdAt: targetCompanies.createdAt,
        initialDiscussionCompleted: targetCompanies.initialDiscussionCompleted,
        initialDiscussionDate: targetCompanies.initialDiscussionDate,
        initialDiscussionNotes: targetCompanies.initialDiscussionNotes,
        initialDiscussionBy: targetCompanies.initialDiscussionBy,
        contactCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id}), 0)`.as('contactCount'),
        primaryContactName: sql<string | null>`(SELECT target_contacts.first_name || ' ' || target_contacts.last_name FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id} AND target_contacts.is_primary = true LIMIT 1)`.as('primaryContactName')
      })
      .from(targetCompanies)
      .where(and(...conditions))
      .orderBy(orderBy);
  }

  async getCompanyProfile(targetCompanyId: number, userCompanyId: number, _userId: number): Promise<CompanyProfile | undefined> {
    const [profileData] = await db
      .select({
        id: targetCompanies.id,
        userCompanyId: targetCompanies.userCompanyId,
        companyName: targetCompanies.companyName,
        industry: targetCompanies.industry,
        subSector: targetCompanies.subSector,
        website: targetCompanies.website,
        phone: targetCompanies.phone,
        email: targetCompanies.email,
        address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue,
        employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished,
        description: targetCompanies.description,
        websiteAnalysis: targetCompanies.websiteAnalysis,
        websiteAnalysisProcessedAt: targetCompanies.websiteAnalysisProcessedAt,
        stage: targetCompanies.stage,
        stageUpdatedAt: targetCompanies.stageUpdatedAt,
        stageUpdatedBy: targetCompanies.stageUpdatedBy,
        initialDiscussionCompleted: targetCompanies.initialDiscussionCompleted,
        initialDiscussionDate: targetCompanies.initialDiscussionDate,
        initialDiscussionNotes: targetCompanies.initialDiscussionNotes,
        initialDiscussionBy: targetCompanies.initialDiscussionBy,
        createdBy: targetCompanies.createdBy,
        createdAt: targetCompanies.createdAt,
        createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`.as('createdByName'),
        userCompanyName: userCompanies.companyName,
        totalContacts: sql<number>`COALESCE((SELECT COUNT(*)::int FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id}), 0)`.as('totalContacts'),
        primaryContactName: sql<string | null>`(SELECT target_contacts.first_name || ' ' || target_contacts.last_name FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id} AND target_contacts.is_primary = true LIMIT 1)`.as('primaryContactName'),
        primaryContactEmail: sql<string | null>`(SELECT target_contacts.email FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id} AND target_contacts.is_primary = true LIMIT 1)`.as('primaryContactEmail'),
        primaryContactPhone: sql<string | null>`(SELECT target_contacts.phone FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id} AND target_contacts.is_primary = true LIMIT 1)`.as('primaryContactPhone'),
        primaryContactTitle: sql<string | null>`(SELECT target_contacts.title FROM target_contacts WHERE target_contacts.target_company_id = ${targetCompanies.id} AND target_contacts.is_primary = true LIMIT 1)`.as('primaryContactTitle'),
      })
      .from(targetCompanies)
      .leftJoin(users, eq(targetCompanies.createdBy, users.id))
      .leftJoin(userCompanies, eq(targetCompanies.userCompanyId, userCompanies.id))
      .where(and(eq(targetCompanies.id, targetCompanyId), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!profileData) {
      return undefined;
    }

    const contacts = await db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));

    const currentYear = new Date().getFullYear();
    const yearsInBusiness = profileData.yearEstablished ? currentYear - profileData.yearEstablished : null;
    
    const revenuePerEmployee = (profileData.annualRevenue && profileData.employeeCount) 
      ? parseFloat(profileData.annualRevenue) / profileData.employeeCount 
      : null;

    return {
      ...profileData,
      userCompanyName: profileData.userCompanyName || 'Unknown Organization',
      yearsInBusiness,
      revenuePerEmployee,
      contacts,
    };
  }
}

export const targetCompaniesRepository = new TargetCompaniesRepository();
