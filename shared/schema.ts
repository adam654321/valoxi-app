import { sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// User companies (the acquiring organizations)
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users (M&A professionals who use the system)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id),
  role: varchar("role", { length: 50 }).default("user"),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Target companies (businesses users want to acquire)
export const targetCompanies = pgTable("target_companies", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  website: varchar("website", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  annualRevenue: varchar("annual_revenue", { length: 50 }),
  employeeCount: varchar("employee_count", { length: 50 }),
  yearEstablished: varchar("year_established", { length: 50 }),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Primary contacts at target companies
export const targetContacts = pgTable("target_contacts", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User sessions
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userCompaniesRelations = relations(userCompanies, ({ many }) => ({
  users: many(users),
  targetCompanies: many(targetCompanies),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [users.userCompanyId],
    references: [userCompanies.id],
  }),
  targetCompanies: many(targetCompanies),
  sessions: many(userSessions),
}));

export const targetCompaniesRelations = relations(targetCompanies, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [targetCompanies.userCompanyId],
    references: [userCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [targetCompanies.createdBy],
    references: [users.id],
  }),
  contacts: many(targetContacts),
}));

export const targetContactsRelations = relations(targetContacts, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [targetContacts.targetCompanyId],
    references: [targetCompanies.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserCompanySchema = createInsertSchema(userCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTargetCompanySchema = createInsertSchema(targetCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertTargetContactSchema = createInsertSchema(targetContacts).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTargetCompany = z.infer<typeof insertTargetCompanySchema>;
export type TargetCompany = typeof targetCompanies.$inferSelect;

export type InsertTargetContact = z.infer<typeof insertTargetContactSchema>;
export type TargetContact = typeof targetContacts.$inferSelect;

export type UserSession = typeof userSessions.$inferSelect;
