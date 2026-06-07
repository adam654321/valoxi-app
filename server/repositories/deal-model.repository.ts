import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import {
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  dealModelSellerPayments,
  dealModelContingentConsideration,
  type DealModel,
  type InsertDealModel,
  type DealModelAdjustment,
  type InsertDealModelAdjustment,
  type DealModelFundingLine,
  type InsertDealModelFundingLine,
  type DealModelSellerPayment,
  type DealModelContingentConsideration,
  type InsertDealModelSellerPayment,
  type InsertDealModelContingentConsideration,
} from '@shared/schema';

export interface DealModelWithDetails extends DealModel {
  adjustments: DealModelAdjustment[];
  fundingLines: DealModelFundingLine[];
  sellerPayments: DealModelSellerPayment[];
  contingentConsideration: DealModelContingentConsideration[];
}

export class DealModelRepository {
  async create(data: InsertDealModel): Promise<DealModel> {
    const [record] = await db.insert(dealModels).values(data).returning();
    return record;
  }

  async getById(id: number): Promise<DealModel | undefined> {
    const [record] = await db
      .select()
      .from(dealModels)
      .where(eq(dealModels.id, id));
    return record || undefined;
  }

  async getByIdWithDetails(id: number): Promise<DealModelWithDetails | undefined> {
    const model = await this.getById(id);
    if (!model) return undefined;

    const [adjustments, fundingLines, sellerPayments, contingentConsideration] = await Promise.all([
      this.getAdjustmentsByModelId(id),
      this.getFundingLinesByModelId(id),
      this.getSellerPaymentsByModelId(id),
      this.getContingentConsiderationByModelId(id),
    ]);

    return { ...model, adjustments, fundingLines, sellerPayments, contingentConsideration };
  }

  async listByCompany(targetCompanyId: number): Promise<DealModel[]> {
    return db
      .select()
      .from(dealModels)
      .where(eq(dealModels.targetCompanyId, targetCompanyId))
      .orderBy(desc(dealModels.updatedAt));
  }

  async update(id: number, data: Partial<InsertDealModel>): Promise<DealModel> {
    const [record] = await db
      .update(dealModels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealModels.id, id))
      .returning();
    return record;
  }

  async delete(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(dealModelAdjustments).where(eq(dealModelAdjustments.dealModelId, id));
      await tx.delete(dealModelFundingLines).where(eq(dealModelFundingLines.dealModelId, id));
      await tx.delete(dealModels).where(eq(dealModels.id, id));
    });
  }

  async duplicate(id: number, newName: string, userId: number, version?: number): Promise<DealModel> {
    const source = await this.getByIdWithDetails(id);
    if (!source) throw new Error('Deal model not found');

    const { id: _id, createdAt, updatedAt, adjustments, fundingLines, ...modelData } = source;

    const [newModel] = await db
      .insert(dealModels)
      .values({
        ...modelData,
        name: newName,
        createdBy: userId,
        parentModelId: id,
        version: version ?? (source.version ?? 1) + 1,
        status: 'draft',
        isLocked: false,
      })
      .returning();

    if (adjustments.length > 0) {
      const adjValues = adjustments.map(({ id: _adjId, createdAt: _c, updatedAt: _u, dealModelId: _dm, ...adjData }) => ({
        ...adjData,
        dealModelId: newModel.id,
      }));
      await db.insert(dealModelAdjustments).values(adjValues);
    }

    if (fundingLines.length > 0) {
      const lineValues = fundingLines.map(({ id: _lineId, createdAt: _c, updatedAt: _u, dealModelId: _dm, ...lineData }) => ({
        ...lineData,
        dealModelId: newModel.id,
      }));
      await db.insert(dealModelFundingLines).values(lineValues);
    }

    return newModel;
  }

  async lock(id: number, preserveStatus: boolean = false): Promise<DealModel> {
    const setData: Record<string, any> = { isLocked: true, updatedAt: new Date() };
    if (!preserveStatus) {
      setData.status = 'sent';
    }
    const [record] = await db
      .update(dealModels)
      .set(setData)
      .where(eq(dealModels.id, id))
      .returning();
    return record;
  }

  async createAdjustment(data: InsertDealModelAdjustment): Promise<DealModelAdjustment> {
    const [record] = await db.insert(dealModelAdjustments).values(data).returning();
    return record;
  }

  async createAdjustments(data: InsertDealModelAdjustment[]): Promise<DealModelAdjustment[]> {
    if (data.length === 0) return [];
    return db.insert(dealModelAdjustments).values(data).returning();
  }

  async updateAdjustment(id: number, data: Partial<InsertDealModelAdjustment>): Promise<DealModelAdjustment> {
    const [record] = await db
      .update(dealModelAdjustments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealModelAdjustments.id, id))
      .returning();
    return record;
  }

  async bulkUpdateAdjustments(
    dealModelId: number,
    updates: Array<{ id: number; status: string; userOverrideAmount?: string | null; userOverrideReason?: string | null }>
  ): Promise<void> {
    for (const update of updates) {
      const setData: Record<string, any> = {
        status: update.status,
        isAccepted: update.status === 'accepted' || update.status === 'modified',
        updatedAt: new Date(),
      };
      if (update.userOverrideAmount !== undefined) {
        setData.amount = update.userOverrideAmount;
      }
      if (update.userOverrideReason !== undefined) {
        setData.reasoning = update.userOverrideReason;
      }
      await db
        .update(dealModelAdjustments)
        .set(setData)
        .where(
          and(
            eq(dealModelAdjustments.id, update.id),
            eq(dealModelAdjustments.dealModelId, dealModelId)
          )
        );
    }
  }

  async getAdjustmentsByModelId(dealModelId: number): Promise<DealModelAdjustment[]> {
    return db
      .select()
      .from(dealModelAdjustments)
      .where(eq(dealModelAdjustments.dealModelId, dealModelId))
      .orderBy(dealModelAdjustments.sortOrder);
  }

  async deleteAdjustment(id: number): Promise<void> {
    await db.delete(dealModelAdjustments).where(eq(dealModelAdjustments.id, id));
  }

  async createFundingLine(data: InsertDealModelFundingLine): Promise<DealModelFundingLine> {
    const [record] = await db.insert(dealModelFundingLines).values(data).returning();
    return record;
  }

  async createFundingLines(data: InsertDealModelFundingLine[]): Promise<DealModelFundingLine[]> {
    if (data.length === 0) return [];
    return db.insert(dealModelFundingLines).values(data).returning();
  }

  async updateFundingLine(id: number, data: Partial<InsertDealModelFundingLine>): Promise<DealModelFundingLine> {
    const [record] = await db
      .update(dealModelFundingLines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealModelFundingLines.id, id))
      .returning();
    return record;
  }

  async getFundingLinesByModelId(dealModelId: number): Promise<DealModelFundingLine[]> {
    return db
      .select()
      .from(dealModelFundingLines)
      .where(eq(dealModelFundingLines.dealModelId, dealModelId))
      .orderBy(dealModelFundingLines.sortOrder);
  }
  async getSellerPaymentsByModelId(dealModelId: number): Promise<DealModelSellerPayment[]> {
    return db
      .select()
      .from(dealModelSellerPayments)
      .where(eq(dealModelSellerPayments.dealModelId, dealModelId))
      .orderBy(dealModelSellerPayments.sortOrder);
  }
  async getContingentConsiderationByModelId(dealModelId: number): Promise<DealModelContingentConsideration[]> {
    return db
      .select()
      .from(dealModelContingentConsideration)
      .where(eq(dealModelContingentConsideration.dealModelId, dealModelId))
      .orderBy(dealModelContingentConsideration.sortOrder);
  }

  async createSellerPayments(data: InsertDealModelSellerPayment[]): Promise<DealModelSellerPayment[]> {
    if (data.length === 0) return [];
    return db.insert(dealModelSellerPayments).values(data).returning();
  }

  async createContingentConsiderations(data: InsertDealModelContingentConsideration[]): Promise<DealModelContingentConsideration[]> {
    if (data.length === 0) return [];
    return db.insert(dealModelContingentConsideration).values(data).returning();
  }

  async createSellerPayment(data: InsertDealModelSellerPayment): Promise<DealModelSellerPayment> {
    const [record] = await db.insert(dealModelSellerPayments).values(data).returning();
    return record;
  }

  async updateSellerPayment(id: number, data: Partial<InsertDealModelSellerPayment>): Promise<DealModelSellerPayment> {
    const [record] = await db
      .update(dealModelSellerPayments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealModelSellerPayments.id, id))
      .returning();
    return record;
  }

  async deleteSellerPayment(id: number): Promise<void> {
    await db.delete(dealModelSellerPayments).where(eq(dealModelSellerPayments.id, id));
  }

  async createContingentConsideration(data: InsertDealModelContingentConsideration): Promise<DealModelContingentConsideration> {
    const [record] = await db.insert(dealModelContingentConsideration).values(data).returning();
    return record;
  }

  async updateContingentConsideration(id: number, data: Partial<InsertDealModelContingentConsideration>): Promise<DealModelContingentConsideration> {
    const [record] = await db
      .update(dealModelContingentConsideration)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealModelContingentConsideration.id, id))
      .returning();
    return record;
  }

  async deleteContingentConsideration(id: number): Promise<void> {
    await db.delete(dealModelContingentConsideration).where(eq(dealModelContingentConsideration.id, id));
  }

  async deleteFundingLine(id: number): Promise<void> {
    await db.delete(dealModelFundingLines).where(eq(dealModelFundingLines.id, id));
  }
}

export const dealModelRepository = new DealModelRepository();
