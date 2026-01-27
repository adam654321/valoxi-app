import { db } from "../db";
import {
  targetCompanies,
  targetContacts,
  users,
  userCompanies,
  type TargetCompany,
  type TargetContact,
  type InsertTargetCompany,
} from "@shared/schema";
import { eq, and, count, desc, asc, sql, or, ilike, gte, lte } from "drizzle-orm";

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

export interface TargetCompanyWithStats extends TargetCompany {
  contactCount: number;
  primaryContactName: string | null;
}

export interface FilterOptions {
  industries: string[];
  revenueRange: {
    min: number | null;
    max: number | null;
  };
  employeeRange: {
    min: number | null;
    max: number | null;
  };
  yearRange: {
    min: number | null;
    max: number | null;
  };
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

type DbInstance = typeof db;

export class CompanyStore {
  constructor(private db: DbInstance) {}

  async getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompanyWithStats[]> {
    return await this.db
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
        totalContacts: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${targetContacts} 
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
        ), 0)`,
        contactCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${targetContacts} 
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
        ), 0)`,
        primaryContactName: sql<string | null>`(
          SELECT ${targetContacts.firstName} || ' ' || ${targetContacts.lastName}
          FROM ${targetContacts}
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
            AND ${targetContacts.isPrimary} = true
          LIMIT 1
        )`
      })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(targetCompanies.createdAt));
  }

  async searchTargetCompanies(userCompanyId: number, searchParams: SearchParams): Promise<TargetCompanyWithStats[]> {
    let query = this.db
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
        contactCount: sql<number>`COALESCE(${sql`(
          SELECT COUNT(*)::int 
          FROM ${targetContacts} 
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
        )`}, 0)`,
        primaryContactName: sql<string | null>`(
          SELECT ${targetContacts.firstName} || ' ' || ${targetContacts.lastName}
          FROM ${targetContacts}
          WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}
            AND ${targetContacts.isPrimary} = true
          LIMIT 1
        )`
      })
      .from(targetCompanies);

    const conditions = [eq(targetCompanies.userCompanyId, userCompanyId)];

    if (searchParams.q) {
      const searchTerm = `%${searchParams.q}%`;
      conditions.push(
        or(
          ilike(targetCompanies.companyName, searchTerm),
          ilike(targetCompanies.industry, searchTerm),
          ilike(targetCompanies.address, searchTerm)
        )!
      );
    }

    if (searchParams.industry && searchParams.industry !== 'all') {
      conditions.push(eq(targetCompanies.industry, searchParams.industry));
    }

    if (searchParams.minRevenue !== undefined) {
      conditions.push(gte(targetCompanies.annualRevenue, searchParams.minRevenue.toString()));
    }

    if (searchParams.maxRevenue !== undefined) {
      conditions.push(lte(targetCompanies.annualRevenue, searchParams.maxRevenue.toString()));
    }

    if (searchParams.minEmployees !== undefined) {
      conditions.push(gte(targetCompanies.employeeCount, searchParams.minEmployees));
    }

    if (searchParams.maxEmployees !== undefined) {
      conditions.push(lte(targetCompanies.employeeCount, searchParams.maxEmployees));
    }

    if (searchParams.minYear !== undefined) {
      conditions.push(gte(targetCompanies.yearEstablished, searchParams.minYear));
    }

    if (searchParams.maxYear !== undefined) {
      conditions.push(lte(targetCompanies.yearEstablished, searchParams.maxYear));
    }

    const finalQuery = query.where(and(...conditions));

    const sortBy = searchParams.sort || 'date_newest';
    let sortedQuery;
    
    switch (sortBy) {
      case 'name_asc':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.companyName));
        break;
      case 'name_desc':
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.companyName));
        break;
      case 'date_oldest':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.createdAt));
        break;
      case 'revenue_high':
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.annualRevenue));
        break;
      case 'revenue_low':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.annualRevenue));
        break;
      case 'employees_high':
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.employeeCount));
        break;
      case 'employees_low':
        sortedQuery = finalQuery.orderBy(asc(targetCompanies.employeeCount));
        break;
      default:
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.createdAt));
        break;
    }

    const results = await sortedQuery.execute();
    return results as TargetCompanyWithStats[];
  }

  async getFilterOptions(userCompanyId: number): Promise<FilterOptions> {
    const industries = await this.db
      .selectDistinct({ industry: targetCompanies.industry })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.industry} IS NOT NULL`
        )
      )
      .orderBy(targetCompanies.industry);

    const revenueStats = await this.db
      .select({
        min: sql<number>`MIN(${targetCompanies.annualRevenue}::numeric)`,
        max: sql<number>`MAX(${targetCompanies.annualRevenue}::numeric)`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.annualRevenue} IS NOT NULL`
        )
      );

    const employeeStats = await this.db
      .select({
        min: sql<number>`MIN(${targetCompanies.employeeCount})`,
        max: sql<number>`MAX(${targetCompanies.employeeCount})`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.employeeCount} IS NOT NULL`
        )
      );

    const yearStats = await this.db
      .select({
        min: sql<number>`MIN(${targetCompanies.yearEstablished})`,
        max: sql<number>`MAX(${targetCompanies.yearEstablished})`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.yearEstablished} IS NOT NULL`
        )
      );

    return {
      industries: industries.map(row => row.industry!).filter(Boolean),
      revenueRange: {
        min: revenueStats[0]?.min || null,
        max: revenueStats[0]?.max || null
      },
      employeeRange: {
        min: employeeStats[0]?.min || null,
        max: employeeStats[0]?.max || null
      },
      yearRange: {
        min: yearStats[0]?.min || null,
        max: yearStats[0]?.max || null
      }
    };
  }

  async getTargetCompanyCount(userCompanyId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    return result.count;
  }

  async getTotalContactsCount(userCompanyId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(targetContacts)
      .leftJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    return result.count;
  }

  async getDashboardMetrics(userCompanyId: number): Promise<{ activeDeals: number; totalDealValue: string }> {
    const [activeResult] = await this.db
      .select({ count: count() })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`(${targetCompanies.stage} IS NULL OR ${targetCompanies.stage} = '' OR ${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified'))`
        )
      );

    const [valueResult] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${targetCompanies.annualRevenue}), 0)::text`
      })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`(${targetCompanies.stage} IS NULL OR ${targetCompanies.stage} = '' OR ${targetCompanies.stage} NOT IN ('Completion', 'Not Qualified'))`,
          sql`${targetCompanies.annualRevenue} IS NOT NULL`
        )
      );

    const totalValue = parseFloat(valueResult?.total || '0');
    const formattedValue = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(totalValue);

    return {
      activeDeals: activeResult.count,
      totalDealValue: formattedValue
    };
  }

  async getTargetCompany(id: number, userCompanyId: number): Promise<TargetCompany | undefined> {
    const [company] = await this.db
      .select()
      .from(targetCompanies)
      .where(
        userCompanyId === 0 
          ? eq(targetCompanies.id, id)
          : and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId))
      );
    return company || undefined;
  }

  async getCompanyProfile(targetCompanyId: number, userCompanyId: number, userId: number): Promise<CompanyProfile | undefined> {
    const [profileData] = await this.db
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
        createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        userCompanyName: userCompanies.companyName,
        totalContacts: sql<number>`COALESCE((SELECT COUNT(*) FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id}), 0)`,
        primaryContactName: sql<string | null>`(SELECT ${targetContacts.firstName} || ' ' || ${targetContacts.lastName} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
        primaryContactEmail: sql<string | null>`(SELECT ${targetContacts.email} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
        primaryContactPhone: sql<string | null>`(SELECT ${targetContacts.phone} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
        primaryContactTitle: sql<string | null>`(SELECT ${targetContacts.title} FROM ${targetContacts} WHERE ${targetContacts.targetCompanyId} = ${targetCompanies.id} AND ${targetContacts.isPrimary} = true LIMIT 1)`,
      })
      .from(targetCompanies)
      .leftJoin(users, eq(targetCompanies.createdBy, users.id))
      .leftJoin(userCompanies, eq(targetCompanies.userCompanyId, userCompanies.id))
      .where(
        and(
          eq(targetCompanies.id, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!profileData) {
      return undefined;
    }

    const contacts = await this.db
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

  async createTargetCompany(insertCompany: InsertTargetCompany): Promise<TargetCompany> {
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
    
    const [company] = await this.db
      .insert(targetCompanies)
      .values([processedData])
      .returning();
    return company;
  }

  async updateTargetCompany(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined> {
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
    
    const [company] = await this.db
      .update(targetCompanies)
      .set(processedData)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)))
      .returning();
    return company || undefined;
  }

  async updateTargetCompanyWebsiteAnalysis(targetCompanyId: number, analysis: string): Promise<boolean> {
    try {
      const [updatedCompany] = await this.db
        .update(targetCompanies)
        .set({
          websiteAnalysis: analysis,
          websiteAnalysisProcessedAt: new Date()
        })
        .where(eq(targetCompanies.id, targetCompanyId))
        .returning();
      
      return !!updatedCompany;
    } catch (error) {
      console.error('Error updating website analysis:', error);
      return false;
    }
  }

  async deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean> {
    const result = await this.db
      .delete(targetCompanies)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));
    return (result.rowCount ?? 0) > 0;
  }
}

export const companyStore = new CompanyStore(db);
