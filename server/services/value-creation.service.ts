import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  valueCreationScenarios,
  valueCreationAssumptions,
  valueCreationSynergies,
  valueCreationExitAssumptions,
  dealModels,
} from '@shared/schema';

class ValueCreationService {
  
  async getOrCreateForModel(dealModelId: number) {
    const existing = await db.select().from(valueCreationScenarios)
      .where(eq(valueCreationScenarios.dealModelId, dealModelId));
    
    if (existing.length > 0) {
      return this.getFullData(dealModelId);
    }

    const baseDefaults = {
      revenueGrowthPercent: 5.0,
      costOfSalesGrowthPercent: 3.0,
      adminCostGrowthPercent: 2.0,
      staffCostGrowthPercent: 3.0,
      depreciationGrowthPercent: 0,
      capexPerYear: 0,
      workingCapitalPercent: 0,
      taxRatePercent: 25.0,
    };

    const scenarioDefaults = [
      { scenarioType: 'bear', name: 'Bear Case', revenueGrowthMultiplier: '0.6', costPressureAdjustment: '1.5', factor: 0.8 },
      { scenarioType: 'base', name: 'Base Case', revenueGrowthMultiplier: '1.0', costPressureAdjustment: '0', factor: 1.0 },
      { scenarioType: 'bull', name: 'Bull Case', revenueGrowthMultiplier: '1.4', costPressureAdjustment: '-0.5', factor: 1.2 },
    ];

    for (const scenDef of scenarioDefaults) {
      const { factor, ...scenFields } = scenDef;
      const [scenario] = await db.insert(valueCreationScenarios).values({
        dealModelId,
        ...scenFields,
      }).returning();

      for (let year = 1; year <= 5; year++) {
        await db.insert(valueCreationAssumptions).values({
          scenarioId: scenario.id,
          year,
          revenueGrowthPercent: String(parseFloat((baseDefaults.revenueGrowthPercent * factor).toFixed(2))),
          costOfSalesGrowthPercent: String(parseFloat((baseDefaults.costOfSalesGrowthPercent * factor).toFixed(2))),
          adminCostGrowthPercent: String(parseFloat((baseDefaults.adminCostGrowthPercent * factor).toFixed(2))),
          staffCostGrowthPercent: String(parseFloat((baseDefaults.staffCostGrowthPercent * factor).toFixed(2))),
          depreciationGrowthPercent: String(baseDefaults.depreciationGrowthPercent),
          capexPerYear: String(baseDefaults.capexPerYear),
          workingCapitalPercent: String(baseDefaults.workingCapitalPercent),
          taxRatePercent: String(baseDefaults.taxRatePercent),
        });
      }
    }

    await db.insert(valueCreationExitAssumptions).values({
      dealModelId,
      exitMultiple: '4.0',
      holdPeriodYears: 5,
      exitCostPercent: '3.0',
    });

    return this.getFullData(dealModelId);
  }

  async getFullData(dealModelId: number) {
    const scenarios = await db.select().from(valueCreationScenarios)
      .where(eq(valueCreationScenarios.dealModelId, dealModelId));

    const scenarioIds = scenarios.map(s => s.id);
    
    let assumptions: any[] = [];
    let synergies: any[] = [];
    
    for (const sid of scenarioIds) {
      const a = await db.select().from(valueCreationAssumptions)
        .where(eq(valueCreationAssumptions.scenarioId, sid));
      assumptions.push(...a);
      
      const s = await db.select().from(valueCreationSynergies)
        .where(eq(valueCreationSynergies.scenarioId, sid));
      synergies.push(...s);
    }

    const [exitAssumptions] = await db.select().from(valueCreationExitAssumptions)
      .where(eq(valueCreationExitAssumptions.dealModelId, dealModelId));

    return {
      scenarios,
      assumptions,
      synergies,
      exitAssumptions: exitAssumptions || null,
    };
  }

  async updateAssumption(assumptionId: number, data: Partial<typeof valueCreationAssumptions.$inferInsert>) {
    const [updated] = await db.update(valueCreationAssumptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(valueCreationAssumptions.id, assumptionId))
      .returning();
    return updated;
  }

  async bulkUpdateAssumptions(updates: Array<{ id: number; data: Record<string, any> }>) {
    const results = [];
    for (const { id, data } of updates) {
      const [updated] = await db.update(valueCreationAssumptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valueCreationAssumptions.id, id))
        .returning();
      results.push(updated);
    }
    return results;
  }

  async updateScenario(scenarioId: number, data: Partial<typeof valueCreationScenarios.$inferInsert>) {
    const [updated] = await db.update(valueCreationScenarios)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(valueCreationScenarios.id, scenarioId))
      .returning();
    return updated;
  }

  async addSynergy(scenarioId: number, data: typeof valueCreationSynergies.$inferInsert) {
    const [created] = await db.insert(valueCreationSynergies)
      .values({ ...data, scenarioId })
      .returning();
    return created;
  }

  async updateSynergy(synergyId: number, data: Partial<typeof valueCreationSynergies.$inferInsert>) {
    const [updated] = await db.update(valueCreationSynergies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(valueCreationSynergies.id, synergyId))
      .returning();
    return updated;
  }

  async deleteSynergy(synergyId: number) {
    await db.delete(valueCreationSynergies)
      .where(eq(valueCreationSynergies.id, synergyId));
    return { deleted: true };
  }

  async updateExitAssumptions(dealModelId: number, data: Partial<typeof valueCreationExitAssumptions.$inferInsert>) {
    const existing = await db.select().from(valueCreationExitAssumptions)
      .where(eq(valueCreationExitAssumptions.dealModelId, dealModelId));
    
    if (existing.length > 0) {
      const [updated] = await db.update(valueCreationExitAssumptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valueCreationExitAssumptions.dealModelId, dealModelId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(valueCreationExitAssumptions)
        .values({ dealModelId, ...data })
        .returning();
      return created;
    }
  }
}

export const valueCreationService = new ValueCreationService();
