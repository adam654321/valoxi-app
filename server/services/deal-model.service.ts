import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import {
  targetCompanies,
  incomeStatements,
  financialPeriods,
} from '@shared/schema';
import { dealModelRepository, type DealModelWithDetails } from '../repositories/deal-model.repository';
import { dealModelMappingService } from './deal-model-mapping.service';
import {
  calculateFullDealModel,
  toNum,
  type AdjustmentInput,
  type FundingLineInput,
  type SellerPaymentInput,
  type ContingentConsiderationInput,
  type DealModelInput,
  type CalculationResult,
} from '../../shared/calculators/deal-model.calc';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { captureMetricsSnapshot } from './metrics-snapshot.service';
import type { DealModel, DealModelAdjustment, DealModelFundingLine, DealModelSellerPayment, DealModelContingentConsideration, InsertDealModelSellerPayment, InsertDealModelContingentConsideration } from '@shared/schema';

async function verifyOwnership(targetCompanyId: number, userCompanyId: number): Promise<void> {
  const [company] = await db
    .select({ id: targetCompanies.id })
    .from(targetCompanies)
    .where(
      and(
        eq(targetCompanies.id, targetCompanyId),
        eq(targetCompanies.userCompanyId, userCompanyId)
      )
    );

  if (!company) {
    throw new NotFoundError('Target company not found');
  }
}

async function fetchReportedEbitdaByYear(targetCompanyId: number): Promise<Record<string, number>> {
  const rows = await db
    .select({
      periodEnd: financialPeriods.periodEnd,
      fiscalYear: financialPeriods.fiscalYear,
      operatingProfit: incomeStatements.operatingProfit,
      depreciationAmortisation: incomeStatements.depreciationAmortisation,
    })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(eq(incomeStatements.targetCompanyId, targetCompanyId))
    .orderBy(desc(financialPeriods.periodEnd));

  const result: Record<string, number> = {};
  for (const row of rows) {
    const year = row.fiscalYear?.toString() || (row.periodEnd ? new Date(row.periodEnd).getFullYear().toString() : null);
    if (!year) continue;
    const op = toNum(row.operatingProfit);
    const da = toNum(row.depreciationAmortisation);
    result[year] = op + da;
  }
  return result;
}

function buildCalcInputs(model: DealModelWithDetails): {
  adjustments: AdjustmentInput[];
  fundingLines: FundingLineInput[];
  sellerPayments: SellerPaymentInput[];
  contingentConsideration: ContingentConsiderationInput[];
  modelInput: DealModelInput;
} {
  const adjustments: AdjustmentInput[] = model.adjustments.map((a) => ({
    adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
    amount: a.amount,
    amountsByYear: a.amountsByYear as Record<string, number> | null,
    status: a.status || 'suggested',
    userOverrideAmount: null,
  }));

  const fundingLines: FundingLineInput[] = model.fundingLines
    .filter((f) => f.fundingType !== 'seller_financing' && f.fundingType !== 'earnout')
    .map((f) => ({
    fundingType: f.fundingType,
    assetBaseValue: f.assetBaseValue,
    ltvPercent: f.ltvPercent,
    amountUsed: f.amountUsed,
    interestRate: f.interestRate,
    termMonths: f.termMonths,
    arrangementFeePercent: f.arrangementFeePercent ?? null,
    isDebt: f.isDebt ?? false,
    repaymentStructure: f.repaymentStructure ?? 'amortizing',
    interestAsEbitdaAdjustment: f.interestAsEbitdaAdjustment ?? false,
    isActive: f.isActive ?? false,
  }));
  const sellerPayments: SellerPaymentInput[] = model.sellerPayments.map((s) => ({
    amount: s.amount,
    termMonths: s.termMonths,
    interestRate: s.interestRate,
    includeInDscr: s.includeInDscr ?? true,
    isActive: s.isActive ?? false,
  }));
  const contingentConsideration: ContingentConsiderationInput[] = model.contingentConsideration.map((c) => ({
    maximumAmount: c.maximumAmount,
    termMonths: c.termMonths,
    includeInDscr: c.includeInDscr ?? true,
    isActive: c.isActive ?? false,
  }));

  const modelInput: DealModelInput = {
    averagingYears: model.averagingYears ?? 3,
    ebitdaMultiple: model.ebitdaMultiple ?? '3.0',
    plusExcessCash: model.plusExcessCash ?? '0',
    minusPrimaryDebt: model.minusPrimaryDebt ?? '0',
    minusOtherDebt: model.minusOtherDebt ?? '0',
    minusCorpTaxDue: model.minusCorpTaxDue ?? '0',
    minusWorkingCapitalAdj: model.minusWorkingCapitalAdj ?? '0',
    plusPropertyValue: model.propertyValue ?? '0',
    otherAdjustments: null,
    feeLegalDdPercent: model.feeLegalDdPercent ?? '2.5',
    feeAccountingDdPercent: model.feeAccountingDdPercent ?? '1.5',
    feeBrokerPercent: model.feeBrokerPercent ?? '2.0',
    feeLoanArrangementPercent: model.feeLoanArrangementPercent ?? '1.0',
    feeDealMakerPercent: model.feeDealMakerPercent ?? '5.0',
    feeLegalDdType: (model.feeLegalDdType as 'percent' | 'fixed') ?? 'percent',
    feeAccountingDdType: (model.feeAccountingDdType as 'percent' | 'fixed') ?? 'percent',
    feeBrokerType: (model.feeBrokerType as 'percent' | 'fixed') ?? 'percent',
    feeLoanArrangementType: (model.feeLoanArrangementType as 'percent' | 'fixed') ?? 'percent',
    feeDealMakerType: (model.feeDealMakerType as 'percent' | 'fixed') ?? 'percent',
    customFees: null,
  };

  return { adjustments, fundingLines, sellerPayments, contingentConsideration, modelInput };
}

export class DealModelService {
  async createModel(
    targetCompanyId: number,
    createdBy: number,
    userCompanyId: number,
    modelName?: string
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    await verifyOwnership(targetCompanyId, userCompanyId);

    const model = await dealModelMappingService.createDealModelFromExperts(
      targetCompanyId,
      createdBy,
      userCompanyId,
      modelName
    );

    const fullModel = await dealModelRepository.getByIdWithDetails(model.id);
    if (!fullModel) throw new NotFoundError('Created deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async getModel(
    id: number,
    userCompanyId: number
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) throw new NotFoundError('Deal model not found');

    await verifyOwnership(model.targetCompanyId, userCompanyId);

    const calculations = await this.recalculate(model);

    return { ...model, calculations };
  }

  async listModels(targetCompanyId: number, userCompanyId: number): Promise<DealModel[]> {
    await verifyOwnership(targetCompanyId, userCompanyId);
    return dealModelRepository.listByCompany(targetCompanyId);
  }

  async updateModel(
    id: number,
    userCompanyId: number,
    updates: Partial<DealModel>
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(id);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot update a locked deal model');
    }

    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as any;
    await dealModelRepository.update(id, safeUpdates);

    const fullModel = await dealModelRepository.getByIdWithDetails(id);
    if (!fullModel) throw new NotFoundError('Deal model not found after update');

    const calculations = await this.recalculate(fullModel);

    captureMetricsSnapshot(id, fullModel.createdBy).catch(err =>
      console.error('[METRICS_SNAPSHOT] Silent failure on model save:', err)
    );

    const { track } = await import('./funnel.service');
    const targetCompany = await db.select().from(targetCompanies).where(eq(targetCompanies.id, fullModel.targetCompanyId)).limit(1);
    if (targetCompany[0]) {
      track(targetCompany[0].userCompanyId, fullModel.createdBy, 'deal_model.saved', {
        hasMultipleFundingLines: (fullModel.fundingLines?.length ?? 0) > 1,
      });
    }

    return { ...fullModel, calculations };
  }

  async updateAdjustment(
    modelId: number,
    adjustmentId: number,
    userCompanyId: number,
    updates: Partial<DealModelAdjustment>
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot update adjustments on a locked deal model');
    }

    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as any;
    await dealModelRepository.updateAdjustment(adjustmentId, safeUpdates);

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async bulkUpdateAdjustments(
    modelId: number,
    userCompanyId: number,
    updates: Array<{ id: number; status: string; userOverrideAmount?: string | null; userOverrideReason?: string | null }>
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot update adjustments on a locked deal model');
    }

    await dealModelRepository.bulkUpdateAdjustments(modelId, updates);

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async addFundingLine(
    modelId: number,
    userCompanyId: number,
    data: Omit<DealModelFundingLine, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot add funding lines to a locked deal model');
    }

    await dealModelRepository.createFundingLine({ ...data, dealModelId: modelId });

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async updateFundingLine(
    modelId: number,
    lineId: number,
    userCompanyId: number,
    data: Partial<DealModelFundingLine>
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot update funding lines on a locked deal model');
    }

    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = data as any;
    await dealModelRepository.updateFundingLine(lineId, safeUpdates);

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async deleteFundingLine(
    modelId: number,
    lineId: number,
    userCompanyId: number
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot delete funding lines from a locked deal model');
    }

    await dealModelRepository.deleteFundingLine(lineId);

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async addSellerPayment(modelId: number, userCompanyId: number, data: Omit<DealModelSellerPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);
    if (model.isLocked) throw new BadRequestError('Cannot add seller payments to a locked deal model');
    await dealModelRepository.createSellerPayment({ ...data, dealModelId: modelId });
    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');
    const calculations = await this.recalculate(fullModel);
    return { ...fullModel, calculations };
  }

  async updateSellerPayment(modelId: number, paymentId: number, userCompanyId: number, data: Partial<DealModelSellerPayment>): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);
    if (model.isLocked) throw new BadRequestError('Cannot update seller payments on a locked deal model');
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = data as any;
    await dealModelRepository.updateSellerPayment(paymentId, safeUpdates);
    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');
    const calculations = await this.recalculate(fullModel);
    return { ...fullModel, calculations };
  }

  async deleteSellerPayment(modelId: number, paymentId: number, userCompanyId: number): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);
    if (model.isLocked) throw new BadRequestError('Cannot delete seller payments from a locked deal model');
    await dealModelRepository.deleteSellerPayment(paymentId);
    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');
    const calculations = await this.recalculate(fullModel);
    return { ...fullModel, calculations };
  }

  async addContingentConsideration(modelId: number, userCompanyId: number, data: Omit<DealModelContingentConsideration, 'id' | 'createdAt' | 'updatedAt'>): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);
    if (model.isLocked) throw new BadRequestError('Cannot add earnout to a locked deal model');
    await dealModelRepository.createContingentConsideration({ ...data, dealModelId: modelId });
    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');
    const calculations = await this.recalculate(fullModel);
    return { ...fullModel, calculations };
  }

  async updateContingentConsideration(modelId: number, ccId: number, userCompanyId: number, data: Partial<DealModelContingentConsideration>): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);
    if (model.isLocked) throw new BadRequestError('Cannot update earnout on a locked deal model');
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = data as any;
    await dealModelRepository.updateContingentConsideration(ccId, safeUpdates);
    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');
    const calculations = await this.recalculate(fullModel);
    return { ...fullModel, calculations };
  }

  async deleteContingentConsideration(modelId: number, ccId: number, userCompanyId: number): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);
    if (model.isLocked) throw new BadRequestError('Cannot delete earnout from a locked deal model');
    await dealModelRepository.deleteContingentConsideration(ccId);
    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');
    const calculations = await this.recalculate(fullModel);
    return { ...fullModel, calculations };
  }

  async duplicateModel(
    id: number,
    userCompanyId: number,
    newName?: string
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(id);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    const allModels = await dealModelRepository.listByCompany(model.targetCompanyId);
    const maxVersion = Math.max(...allModels.map(m => m.version ?? 1), 0);
    const nextVersion = maxVersion + 1;

    const name = newName || `Deal Model v${nextVersion}`;
    const newModel = await dealModelRepository.duplicate(id, name, model.createdBy, nextVersion);

    const fullModel = await dealModelRepository.getByIdWithDetails(newModel.id);
    if (!fullModel) throw new NotFoundError('Duplicated deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async lockModel(
    id: number,
    userCompanyId: number
  ): Promise<DealModel> {
    const model = await dealModelRepository.getById(id);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Deal model is already locked');
    }

    return dealModelRepository.lock(id);
  }

  async deleteAdjustment(
    modelId: number,
    adjustmentId: number,
    userCompanyId: number
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot delete adjustments from a locked deal model');
    }

    await dealModelRepository.deleteAdjustment(adjustmentId);

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async addCustomAdjustment(
    modelId: number,
    userCompanyId: number,
    data: { adjustmentType: string; category: string; description: string; amount: string; reasoning?: string; amountsByYear?: Record<string, number> | null }
  ): Promise<DealModelWithDetails & { calculations: CalculationResult }> {
    const model = await dealModelRepository.getById(modelId);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    if (model.isLocked) {
      throw new BadRequestError('Cannot add adjustments to a locked deal model');
    }

    await dealModelRepository.createAdjustment({
      dealModelId: modelId,
      adjustmentType: data.adjustmentType,
      category: data.category,
      description: data.description,
      amount: data.amount,
      amountsByYear: data.amountsByYear || undefined,
      reasoning: data.reasoning || undefined,
      sourceExpert: undefined,
      sourceExpertResultId: undefined,
      status: 'accepted',
      isAccepted: true,
      isManual: true,
      sortOrder: 999,
    });

    const fullModel = await dealModelRepository.getByIdWithDetails(modelId);
    if (!fullModel) throw new NotFoundError('Deal model not found');

    const calculations = await this.recalculate(fullModel);

    return { ...fullModel, calculations };
  }

  async calculateOnly(
    id: number,
    userCompanyId: number
  ): Promise<CalculationResult> {
    const model = await dealModelRepository.getByIdWithDetails(id);
    if (!model) throw new NotFoundError('Deal model not found');
    await verifyOwnership(model.targetCompanyId, userCompanyId);

    const reportedEbitda = await fetchReportedEbitdaByYear(model.targetCompanyId);
    const { adjustments, fundingLines, sellerPayments, contingentConsideration, modelInput } = buildCalcInputs(model);

    return calculateFullDealModel(reportedEbitda, adjustments, fundingLines, modelInput, sellerPayments, contingentConsideration);
  }

  private async recalculate(model: DealModelWithDetails): Promise<CalculationResult> {
    const reportedEbitda = await fetchReportedEbitdaByYear(model.targetCompanyId);
    const { adjustments, fundingLines, sellerPayments, contingentConsideration, modelInput } = buildCalcInputs(model);

    const result = calculateFullDealModel(reportedEbitda, adjustments, fundingLines, modelInput, sellerPayments, contingentConsideration);

    await dealModelRepository.update(model.id, {
      calculatedEbitda: String(result.averageAdjustedEbitda),
      adjustedEbitda: String(result.averageAdjustedEbitda),
      enterpriseValue: String(result.enterpriseValue),
      totalPurchasePrice: String(result.offerPrice),
      totalFundingAvailable: String(result.totalFunded),
      equityRequired: String(result.fundingGap),
    });

    return result;
  }
}

export const dealModelService = new DealModelService();
