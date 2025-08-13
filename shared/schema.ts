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
  inet,
  unique,
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
  userRole: varchar("user_role", { length: 50 }).default("analyst"),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
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
  annualRevenue: decimal("annual_revenue"),
  employeeCount: integer("employee_count"),
  yearEstablished: integer("year_established"),
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

// User deal assignments (many-to-many for users and target companies)
export const userDealAssignments = pgTable("user_deal_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id).notNull(),
  assignmentRole: varchar("assignment_role", { length: 50 }).default("analyst"),
  assignmentDate: timestamp("assignment_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  canEditCompany: boolean("can_edit_company").default(true),
  canUploadDocuments: boolean("can_upload_documents").default(true),
  canCreateActivities: boolean("can_create_activities").default(true),
  canManageContacts: boolean("can_manage_contacts").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserCompany: unique().on(table.userId, table.targetCompanyId),
}));

// Team notifications
export const teamNotifications = pgTable("team_notifications", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  notificationType: varchar("notification_type", { length: 50 }).notNull(),
  notificationTitle: varchar("notification_title", { length: 255 }).notNull(),
  notificationMessage: text("notification_message"),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id),
  relatedObjectType: varchar("related_object_type", { length: 50 }),
  relatedObjectId: integer("related_object_id"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isEmailSent: boolean("is_email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userCompaniesRelations = relations(userCompanies, ({ many }) => ({
  users: many(users),
  targetCompanies: many(targetCompanies),
  invitations: many(userInvitations),
  notifications: many(teamNotifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [users.userCompanyId],
    references: [userCompanies.id],
  }),
  targetCompanies: many(targetCompanies),
  sessions: many(userSessions),
  invitationsSent: many(userInvitations, { relationName: "inviter" }),
  dealAssignments: many(userDealAssignments, { relationName: "assignedUser" }),
  dealAssignmentsMade: many(userDealAssignments, { relationName: "assigner" }),
  notificationsReceived: many(teamNotifications, { relationName: "targetUser" }),
  notificationsSent: many(teamNotifications, { relationName: "fromUser" }),
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
  dealAssignments: many(userDealAssignments),
  notifications: many(teamNotifications),
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

// New relations for team management tables
export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [userInvitations.userCompanyId],
    references: [userCompanies.id],
  }),
  inviter: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
    relationName: "inviter",
  }),
}));

export const userDealAssignmentsRelations = relations(userDealAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userDealAssignments.userId],
    references: [users.id],
    relationName: "assignedUser",
  }),
  targetCompany: one(targetCompanies, {
    fields: [userDealAssignments.targetCompanyId],
    references: [targetCompanies.id],
  }),
  assignedBy: one(users, {
    fields: [userDealAssignments.assignedBy],
    references: [users.id],
    relationName: "assigner",
  }),
}));

export const teamNotificationsRelations = relations(teamNotifications, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [teamNotifications.userCompanyId],
    references: [userCompanies.id],
  }),
  targetUser: one(users, {
    fields: [teamNotifications.targetUserId],
    references: [users.id],
    relationName: "targetUser",
  }),
  fromUser: one(users, {
    fields: [teamNotifications.fromUserId],
    references: [users.id],
    relationName: "fromUser",
  }),
  targetCompany: one(targetCompanies, {
    fields: [teamNotifications.targetCompanyId],
    references: [targetCompanies.id],
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
}).extend({
  annualRevenue: z.union([z.string(), z.number(), z.null()]).optional(),
  employeeCount: z.union([z.number(), z.null()]).optional(),
  yearEstablished: z.union([z.number(), z.null()]).optional(),
});

export const insertTargetContactSchema = createInsertSchema(targetContacts).omit({
  id: true,
  createdAt: true,
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

export const insertUserDealAssignmentSchema = createInsertSchema(userDealAssignments).omit({
  id: true,
  createdAt: true,
  assignmentDate: true,
});

export const insertTeamNotificationSchema = createInsertSchema(teamNotifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
  emailSentAt: true,
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

export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertUserDealAssignment = z.infer<typeof insertUserDealAssignmentSchema>;
export type UserDealAssignment = typeof userDealAssignments.$inferSelect;

export type InsertTeamNotification = z.infer<typeof insertTeamNotificationSchema>;
export type TeamNotification = typeof teamNotifications.$inferSelect;
