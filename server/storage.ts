import {
  users,
  userCompanies,
  targetCompanies,
  userSessions,
  type User,
  type UserCompany,
  type TargetCompany,
  type InsertUser,
  type InsertUserCompany,
  type InsertTargetCompany,
  type UserSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count } from "drizzle-orm";

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
  getTargetCompanyCount(userCompanyId: number): Promise<number>;
  
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
      .orderBy(targetCompanies.createdAt);
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
}

export const storage = new DatabaseStorage();
