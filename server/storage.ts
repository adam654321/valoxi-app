import {
  users,
  userCompanies,
  targetCompanies,
  targetContacts,
  userSessions,
  type User,
  type UserCompany,
  type TargetCompany,
  type TargetContact,
  type InsertUser,
  type InsertUserCompany,
  type InsertTargetCompany,
  type InsertTargetContact,
  type UserSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, desc, asc, sql, or, ilike, gte, lte, isNull } from "drizzle-orm";

// Search and filter types
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

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // User company operations
  getUserCompany(id: number): Promise<UserCompany | undefined>;
  createUserCompany(company: InsertUserCompany): Promise<UserCompany>;
  
  // Target company operations
  getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompany[]>;
  searchTargetCompanies(userCompanyId: number, searchParams: SearchParams): Promise<TargetCompanyWithStats[]>;
  getFilterOptions(userCompanyId: number): Promise<FilterOptions>;
  getTargetCompanyCount(userCompanyId: number): Promise<number>;
  getTargetCompany(id: number, userCompanyId: number): Promise<TargetCompany | undefined>;
  getCompanyProfile(targetCompanyId: number, userCompanyId: number, userId: number): Promise<CompanyProfile | undefined>;
  createTargetCompany(company: InsertTargetCompany): Promise<TargetCompany>;
  updateTargetCompany(id: number, company: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined>;
  deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean>;
  
  // Target contact operations
  getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]>;
  createTargetContact(contact: InsertTargetContact): Promise<TargetContact>;
  updateTargetContact(id: number, contact: Partial<InsertTargetContact>, userCompanyId: number): Promise<TargetContact | undefined>;
  deleteTargetContact(id: number, userCompanyId: number): Promise<boolean>;
  
  // Session operations
  createSession(userId: number, sessionToken: string, expiresAt: Date): Promise<UserSession>;
  getSessionByToken(sessionToken: string): Promise<UserSession | undefined>;
  deleteSession(sessionToken: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserCompany(id: number): Promise<UserCompany | undefined> {
    const [company] = await db.select().from(userCompanies).where(eq(userCompanies.id, id));
    return company || undefined;
  }

  async createUserCompany(insertCompany: InsertUserCompany): Promise<UserCompany> {
    const [company] = await db
      .insert(userCompanies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async getTargetCompaniesByUserCompany(userCompanyId: number): Promise<TargetCompany[]> {
    return await db
      .select()
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(desc(targetCompanies.createdAt));
  }

  async searchTargetCompanies(userCompanyId: number, searchParams: SearchParams): Promise<TargetCompanyWithStats[]> {
    // Build the base query with contact count and primary contact info
    let query = db
      .select({
        id: targetCompanies.id,
        userCompanyId: targetCompanies.userCompanyId,
        companyName: targetCompanies.companyName,
        industry: targetCompanies.industry,
        website: targetCompanies.website,
        phone: targetCompanies.phone,
        email: targetCompanies.email,
        address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue,
        employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished,
        description: targetCompanies.description,
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

    // Build WHERE conditions
    const conditions = [eq(targetCompanies.userCompanyId, userCompanyId)];

    // Add search conditions
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

    // Execute query with conditions
    const finalQuery = query.where(and(...conditions));

    // Add sorting
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
      default: // 'date_newest'
        sortedQuery = finalQuery.orderBy(desc(targetCompanies.createdAt));
        break;
    }

    const results = await sortedQuery.execute();
    return results as TargetCompanyWithStats[];
  }

  async getFilterOptions(userCompanyId: number): Promise<FilterOptions> {
    // Get unique industries
    const industries = await db
      .selectDistinct({ industry: targetCompanies.industry })
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.userCompanyId, userCompanyId),
          sql`${targetCompanies.industry} IS NOT NULL`
        )
      )
      .orderBy(targetCompanies.industry);

    // Get revenue range
    const revenueStats = await db
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

    // Get employee count range
    const employeeStats = await db
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

    // Get year established range
    const yearStats = await db
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
    const [result] = await db
      .select({ count: count() })
      .from(targetCompanies)
      .where(eq(targetCompanies.userCompanyId, userCompanyId));
    return result.count;
  }

  async createSession(userId: number, sessionToken: string, expiresAt: Date): Promise<UserSession> {
    const [session] = await db
      .insert(userSessions)
      .values({ userId, sessionToken, expiresAt })
      .returning();
    return session;
  }

  async getSessionByToken(sessionToken: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionToken, sessionToken));
    return session || undefined;
  }

  async deleteSession(sessionToken: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.sessionToken, sessionToken));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(userSessions).where(
      eq(userSessions.expiresAt, new Date())
    );
  }

  async getTargetCompany(id: number, userCompanyId: number): Promise<TargetCompany | undefined> {
    const [company] = await db
      .select()
      .from(targetCompanies)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));
    return company || undefined;
  }

  async getCompanyProfile(targetCompanyId: number, userCompanyId: number, userId: number): Promise<CompanyProfile | undefined> {
    // Get comprehensive company data with user and contact information
    const [profileData] = await db
      .select({
        // Company fields
        id: targetCompanies.id,
        userCompanyId: targetCompanies.userCompanyId,
        companyName: targetCompanies.companyName,
        industry: targetCompanies.industry,
        website: targetCompanies.website,
        phone: targetCompanies.phone,
        email: targetCompanies.email,
        address: targetCompanies.address,
        annualRevenue: targetCompanies.annualRevenue,
        employeeCount: targetCompanies.employeeCount,
        yearEstablished: targetCompanies.yearEstablished,
        description: targetCompanies.description,
        createdBy: targetCompanies.createdBy,
        createdAt: targetCompanies.createdAt,
        // Enhanced profile data
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

    // Get all contacts for this company
    const contacts = await db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));

    // Calculate additional metrics
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
    // Convert numeric fields to appropriate types
    const processedData = {
      ...insertCompany,
      annualRevenue: typeof insertCompany.annualRevenue === 'number' 
        ? insertCompany.annualRevenue.toString() 
        : insertCompany.annualRevenue
    };
    
    const [company] = await db
      .insert(targetCompanies)
      .values(processedData)
      .returning();
    return company;
  }

  async updateTargetCompany(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany | undefined> {
    // Convert numeric fields to appropriate types
    const processedData = {
      ...updateData,
      annualRevenue: typeof updateData.annualRevenue === 'number' 
        ? updateData.annualRevenue.toString() 
        : updateData.annualRevenue
    };
    
    const [company] = await db
      .update(targetCompanies)
      .set(processedData)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)))
      .returning();
    return company || undefined;
  }

  async deleteTargetCompany(id: number, userCompanyId: number): Promise<boolean> {
    const result = await db
      .delete(targetCompanies)
      .where(and(eq(targetCompanies.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Contact operations
  async getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]> {
    // Verify the target company belongs to the user's company first
    const targetCompany = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!targetCompany) {
      return [];
    }

    return await db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));
  }

  async createTargetContact(insertContact: InsertTargetContact): Promise<TargetContact> {
    // If this contact is marked as primary, unset other primary contacts for this company
    if (insertContact.isPrimary) {
      await db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, insertContact.targetCompanyId));
    }

    const [contact] = await db
      .insert(targetContacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateTargetContact(id: number, updateData: Partial<InsertTargetContact>, userCompanyId: number): Promise<TargetContact | undefined> {
    // First verify access by checking if the contact belongs to a target company owned by the user's company
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    // If setting as primary, unset other primary contacts for this company
    if (updateData.isPrimary) {
      await db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, existingContact.target_contacts.targetCompanyId));
    }

    const [contact] = await db
      .update(targetContacts)
      .set(updateData)
      .where(eq(targetContacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteTargetContact(id: number, userCompanyId: number): Promise<boolean> {
    // First verify access by checking if the contact belongs to a target company owned by the user's company
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return false;
    }

    const result = await db
      .delete(targetContacts)
      .where(eq(targetContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllContactsForUserCompany(userCompanyId: number) {
    const contacts = await db
      .select({
        id: targetContacts.id,
        targetCompanyId: targetContacts.targetCompanyId,
        firstName: targetContacts.firstName,
        lastName: targetContacts.lastName,
        title: targetContacts.title,
        email: targetContacts.email,
        phone: targetContacts.phone,
        isPrimary: targetContacts.isPrimary,
        notes: targetContacts.notes,
        createdAt: targetContacts.createdAt,
        company: {
          id: targetCompanies.id,
          companyName: targetCompanies.companyName,
          industry: targetCompanies.industry,
        },
      })
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(
        sql`${targetContacts.isPrimary} DESC`,
        targetCompanies.companyName,
        targetContacts.lastName
      );

    return contacts;
  }
}

export const storage = new DatabaseStorage();
