import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, json } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './core';
import { dealModels } from './deal-models';

export const valueCreationScenarios = pgTable("value_creation_scenarios", {
  id: serial("id").primaryKey(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id, { onDelete: 'cascade' }).notNull(),
  scenarioType: varchar("scenario_type", { length: 20 }).notNull().default('base'),
  name: varchar("name", { length: 100 }).notNull().default('Base Case'),
  
  revenueGrowthMultiplier: decimal("revenue_growth_multiplier").default('1.0'),
  costPressureAdjustment: decimal("cost_pressure_adjustment").default('0'),
  
  scenarioMode: varchar("scenario_mode", { length: 10 }).default('linked'),
  rangePercent: decimal("range_percent").default('10'),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const valueCreationAssumptions = pgTable("value_creation_assumptions", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").references(() => valueCreationScenarios.id, { onDelete: 'cascade' }).notNull(),
  year: integer("year").notNull(),
  
  revenueGrowthPercent: decimal("revenue_growth_percent").default('5.0'),
  costOfSalesGrowthPercent: decimal("cost_of_sales_growth_percent").default('3.0'),
  adminCostGrowthPercent: decimal("admin_cost_growth_percent").default('2.0'),
  staffCostGrowthPercent: decimal("staff_cost_growth_percent").default('3.0'),
  depreciationGrowthPercent: decimal("depreciation_growth_percent").default('0'),
  capexPerYear: decimal("capex_per_year").default('0'),
  workingCapitalPercent: decimal("working_capital_percent").default('0'),
  taxRatePercent: decimal("tax_rate_percent").default('25.0'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const valueCreationSynergies = pgTable("value_creation_synergies", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").references(() => valueCreationScenarios.id, { onDelete: 'cascade' }).notNull(),
  
  synergyType: varchar("synergy_type", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  targetValue: decimal("target_value").default('0'),
  
  realisationY1: decimal("realisation_y1").default('20'),
  realisationY2: decimal("realisation_y2").default('50'),
  realisationY3: decimal("realisation_y3").default('80'),
  realisationY4: decimal("realisation_y4").default('100'),
  realisationY5: decimal("realisation_y5").default('100'),
  
  implementationCost: decimal("implementation_cost").default('0'),
  
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const valueCreationExitAssumptions = pgTable("value_creation_exit_assumptions", {
  id: serial("id").primaryKey(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id, { onDelete: 'cascade' }).notNull(),
  
  exitMultiple: decimal("exit_multiple").default('4.0'),
  holdPeriodYears: integer("hold_period_years").default(5),
  exitCostPercent: decimal("exit_cost_percent").default('3.0'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertValueCreationScenarioSchema = createInsertSchema(valueCreationScenarios).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertValueCreationAssumptionSchema = createInsertSchema(valueCreationAssumptions).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertValueCreationSynergySchema = createInsertSchema(valueCreationSynergies).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertValueCreationExitAssumptionSchema = createInsertSchema(valueCreationExitAssumptions).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ValueCreationScenario = typeof valueCreationScenarios.$inferSelect;
export type InsertValueCreationScenario = z.infer<typeof insertValueCreationScenarioSchema>;
export type ValueCreationAssumption = typeof valueCreationAssumptions.$inferSelect;
export type InsertValueCreationAssumption = z.infer<typeof insertValueCreationAssumptionSchema>;
export type ValueCreationSynergy = typeof valueCreationSynergies.$inferSelect;
export type InsertValueCreationSynergy = z.infer<typeof insertValueCreationSynergySchema>;
export type ValueCreationExitAssumption = typeof valueCreationExitAssumptions.$inferSelect;
export type InsertValueCreationExitAssumption = z.infer<typeof insertValueCreationExitAssumptionSchema>;
