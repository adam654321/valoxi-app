import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userCompanies,
  userCompanyMemberships,
  type User,
  type InsertUser,
  type UserCompany,
  type InsertUserCompany,
  type UserCompanyMembership,
  type InsertUserCompanyMembership,
} from '@shared/schema';

export class UsersRepository {
  async getById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async create(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async update(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUserCompany(id: number): Promise<UserCompany | undefined> {
    const [company] = await db.select().from(userCompanies).where(eq(userCompanies.id, id));
    return company || undefined;
  }

  async createUserCompany(insertCompany: InsertUserCompany): Promise<UserCompany> {
    const [company] = await db.insert(userCompanies).values(insertCompany).returning();
    return company;
  }

  async getUserCompanies(userId: number): Promise<UserCompanyMembership[]> {
    return await db
      .select()
      .from(userCompanyMemberships)
      .where(and(eq(userCompanyMemberships.userId, userId), eq(userCompanyMemberships.isActive, true)))
      .orderBy(desc(userCompanyMemberships.joinedAt));
  }

  async createUserCompanyMembership(membership: InsertUserCompanyMembership): Promise<UserCompanyMembership> {
    const [newMembership] = await db.insert(userCompanyMemberships).values(membership).returning();
    return newMembership;
  }

  async updateUserCompanyMembership(id: number, membership: Partial<InsertUserCompanyMembership>): Promise<UserCompanyMembership | undefined> {
    const [updated] = await db
      .update(userCompanyMemberships)
      .set(membership)
      .where(eq(userCompanyMemberships.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUserCompanyMembership(id: number): Promise<boolean> {
    const result = await db
      .update(userCompanyMemberships)
      .set({ isActive: false })
      .where(eq(userCompanyMemberships.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async switchUserActiveCompany(userId: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ currentCompanyId: companyId })
      .where(eq(users.id, userId));
    return (result.rowCount ?? 0) > 0;
  }
}

export const usersRepository = new UsersRepository();
