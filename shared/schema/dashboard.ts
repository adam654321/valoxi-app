import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { userCompanies, users, type User } from './core';
import { targetCompanies } from './deals';

export const issueReports = pgTable("issue_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id),
  pageUrl: varchar("page_url", { length: 500 }),
  userAgent: varchar("user_agent", { length: 500 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).default("medium"),
  status: varchar("status", { length: 20 }).default("open"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIssueReportSchema = createInsertSchema(issueReports).omit({
  id: true,
  createdAt: true,
});

export type IssueReport = typeof issueReports.$inferSelect;
export type InsertIssueReport = z.infer<typeof insertIssueReportSchema>;

// Dashboard preferences table
export const dashboardPreferences = pgTable("dashboard_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  widgetType: varchar("widget_type", { length: 50 }).notNull(),
  widgetPosition: integer("widget_position").notNull(),
  widgetSize: varchar("widget_size", { length: 20 }).default("medium"),
  isVisible: boolean("is_visible").default(true),
  widgetConfig: text("widget_config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Dashboard alerts table
export const dashboardAlerts = pgTable("dashboard_alerts", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { length: 20 }).default("info"),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
});

// Insert schemas
export const insertDashboardPreferenceSchema = createInsertSchema(dashboardPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDashboardAlertSchema = createInsertSchema(dashboardAlerts).omit({
  id: true,
  createdAt: true,
  dismissedAt: true,
});

// Types
export type InsertDashboardPreference = z.infer<typeof insertDashboardPreferenceSchema>;
export type DashboardPreference = typeof dashboardPreferences.$inferSelect;

export type InsertDashboardAlert = z.infer<typeof insertDashboardAlertSchema>;
export type DashboardAlert = typeof dashboardAlerts.$inferSelect;

export type TeamMember = User & {
  roleDescription?: string;
  assignedDealsCount?: number;
  permissions?: {
    id?: number;
    roleName?: string;
    roleDescription?: string;
    canManageUsers?: boolean;
    canManageCompany?: boolean;
    canCreateDeals?: boolean;
    canEditAllDeals?: boolean;
    canDeleteDeals?: boolean;
    canUploadDocuments?: boolean;
    canCreateOffers?: boolean;
    canViewFinancials?: boolean;
    canAccessAnalytics?: boolean;
    canExportData?: boolean;
    createdAt?: Date;
  };
};

export type UserWithRole = User & {
  roleDescription?: string;
  permissions?: {
    canManageUsers?: boolean;
    canManageCompany?: boolean;
    canCreateDeals?: boolean;
    canEditAllDeals?: boolean;
    canDeleteDeals?: boolean;
    canUploadDocuments?: boolean;
    canCreateOffers?: boolean;
    canViewFinancials?: boolean;
    canAccessAnalytics?: boolean;
    canExportData?: boolean;
  };
};

export const funnelEvents = pgTable("funnel_events", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  event: varchar("event", { length: 100 }).notNull(),
  properties: jsonb("properties"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFunnelEventSchema = createInsertSchema(funnelEvents).omit({
  id: true,
  createdAt: true,
});

export type FunnelEvent = typeof funnelEvents.$inferSelect;
export type InsertFunnelEvent = z.infer<typeof insertFunnelEventSchema>;
