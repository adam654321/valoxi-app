import { sql } from 'drizzle-orm';
import { pgTable, serial, varchar, text, integer, boolean, timestamp, inet, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

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
  currentCompanyId: integer("current_company_id").references(() => userCompanies.id),
  role: varchar("role", { length: 50 }).default("user"),
  userRole: varchar("user_role", { length: 50 }).default("analyst"),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for user-company relationships (many-to-many)
export const userCompanyMemberships = pgTable("user_company_memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  membershipRole: varchar("membership_role", { length: 50 }).default("analyst"),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").default(true),
}, (table) => ({
  uniqueUserCompany: unique("unique_user_company").on(table.userId, table.userCompanyId),
}));

// User sessions
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User invitations for team management
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  invitedBy: integer("invited_by").references(() => users.id).notNull(),
  invitationToken: varchar("invitation_token", { length: 255 }).unique().notNull(),
  invitedRole: varchar("invited_role", { length: 50 }).notNull(),
  invitationMessage: text("invitation_message"),
  invitationStatus: varchar("invitation_status", { length: 50 }).default("pending"),
  sentAt: timestamp("sent_at").defaultNow(),
  expiresAt: timestamp("expires_at").default(sql`(NOW() + INTERVAL '7 days')`),
  acceptedAt: timestamp("accepted_at"),
  ipAddressSent: inet("ip_address_sent"),
  ipAddressAccepted: inet("ip_address_accepted"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User roles with permissions
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  roleName: varchar("role_name", { length: 50 }).unique().notNull(),
  roleDescription: text("role_description"),
  canManageUsers: boolean("can_manage_users").default(false),
  canManageCompany: boolean("can_manage_company").default(false),
  canCreateDeals: boolean("can_create_deals").default(false),
  canEditAllDeals: boolean("can_edit_all_deals").default(false),
  canDeleteDeals: boolean("can_delete_deals").default(false),
  canUploadDocuments: boolean("can_upload_documents").default(false),
  canCreateOffers: boolean("can_create_offers").default(false),
  canViewFinancials: boolean("can_view_financials").default(false),
  canAccessAnalytics: boolean("can_access_analytics").default(false),
  canExportData: boolean("can_export_data").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserCompanySchema = createInsertSchema(userCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertUserCompanyMembershipSchema = createInsertSchema(userCompanyMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  expiresAt: true,
  acceptedAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserCompanyMembership = z.infer<typeof insertUserCompanyMembershipSchema>;
export type UserCompanyMembership = typeof userCompanyMemberships.$inferSelect;

export type UserSession = typeof userSessions.$inferSelect;

export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;
