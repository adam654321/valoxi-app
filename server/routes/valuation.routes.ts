import { Router, Request, Response } from 'express';
import { valuationRepository } from '../repositories/valuation.repository';
import { financialDataRepository } from '../repositories/financial-data.repository';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { insertEbitdaAdjustmentSchema, insertValuationSchema } from '@shared/schema';

const router = Router();

router.get('/company/:companyId/adjustments', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const adjustments = await valuationRepository.getAdjustmentsByCompany(targetCompanyId);
    sendSuccess(res, adjustments);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/period/:periodId/adjustments', async (req: Request, res: Response) => {
  try {
    const periodId = parseInt(req.params.periodId);
    if (isNaN(periodId)) throw new BadRequestError('Invalid period ID');
    
    const adjustments = await valuationRepository.getAdjustmentsByPeriod(periodId);
    const total = await valuationRepository.getTotalAdjustmentsByPeriod(periodId);
    
    sendSuccess(res, { adjustments, total });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/adjustments', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const data = insertEbitdaAdjustmentSchema.parse({
      ...req.body,
      createdBy: userId,
    });
    
    const adjustment = await valuationRepository.createAdjustment(data);
    sendSuccess(res, adjustment, 201);
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/adjustments/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid adjustment ID');
    
    const existing = await valuationRepository.getAdjustmentById(id);
    if (!existing) {
      throw new BadRequestError('Adjustment not found');
    }
    
    const { financialPeriodId, targetCompanyId, ...updateData } = req.body;
    
    const updated = await valuationRepository.updateAdjustment(id, updateData);
    sendSuccess(res, updated);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/adjustments/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid adjustment ID');
    
    const deleted = await valuationRepository.deleteAdjustment(id);
    if (!deleted) {
      throw new BadRequestError('Adjustment not found');
    }
    
    sendSuccess(res, { message: 'Adjustment deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/valuation', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const valuation = await valuationRepository.getValuationByCompany(targetCompanyId);
    sendSuccess(res, valuation);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/company/:companyId/valuation', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userId = (req.session as any).userId;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const { calculationMethod, valuationMultiple, fundingStructure, dealNotes } = req.body;
    
    const ebitdaCalc = await valuationRepository.calculateAdjustedEbitda(
      targetCompanyId,
      calculationMethod || 'average_3yr'
    );
    
    const multiple = parseFloat(valuationMultiple || '4.0');
    const enterpriseValue = ebitdaCalc.adjustedEbitda * multiple;
    
    const summary = await financialDataRepository.getFinancialSummary(targetCompanyId);
    let netDebt = 0;
    if (summary.balanceSheets.length > 0) {
      const latestBS = summary.balanceSheets[0];
      const totalDebt = 
        parseFloat(latestBS.bankLoansOverdraftCurrent || '0') +
        parseFloat(latestBS.bankLoansLongTerm || '0') +
        parseFloat(latestBS.hirePurchaseCurrent || '0') +
        parseFloat(latestBS.hirePurchaseLongTerm || '0') +
        parseFloat(latestBS.otherLongTermDebt || '0');
      const cash = parseFloat(latestBS.cashAtBank || '0');
      netDebt = totalDebt - cash;
    }
    
    const equityValue = enterpriseValue - netDebt;
    
    const valuation = await valuationRepository.upsertValuation(targetCompanyId, {
      calculationMethod: calculationMethod || 'average_3yr',
      valuationMultiple: valuationMultiple || '4.0',
      adjustedEbitda: ebitdaCalc.adjustedEbitda.toString(),
      enterpriseValue: enterpriseValue.toString(),
      netDebt: netDebt.toString(),
      equityValue: equityValue.toString(),
      fundingStructure,
      dealNotes,
      createdBy: userId,
    });
    
    sendSuccess(res, {
      valuation,
      calculation: ebitdaCalc,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/calculate-ebitda', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const method = (req.query.method as string) || 'average_3yr';
    const calculation = await valuationRepository.calculateAdjustedEbitda(targetCompanyId, method);
    
    sendSuccess(res, calculation);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/financials', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const periods = await financialDataRepository.getFinancialPeriodsByCompany(targetCompanyId);
    const incomeStatements = await financialDataRepository.getIncomeStatementsByCompany(targetCompanyId);
    const balanceSheets = await financialDataRepository.getBalanceSheetsByCompany(targetCompanyId);
    const staffData = await financialDataRepository.getStaffDataByCompany(targetCompanyId);
    const loans = await financialDataRepository.getLoanFacilitiesByCompany(targetCompanyId);
    const agedDebtors = await financialDataRepository.getAgedDebtorsByCompany(targetCompanyId);
    
    const adjustments = await valuationRepository.getAdjustmentsByCompany(targetCompanyId);
    
    const periodsWithMeta = periods.map(p => ({
      ...p,
      readOnly: p.periodType === 'statutory' || p.periodType === 'historic',
      isHistoric: p.periodType === 'statutory' || p.periodType === 'historic',
    }));
    
    sendSuccess(res, {
      periods: periodsWithMeta,
      incomeStatements,
      balanceSheets,
      staffData,
      loans,
      agedDebtors,
      adjustments,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/financials/income-statement/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { adminOverride } = req.body;
    if (isNaN(id)) throw new BadRequestError('Invalid income statement ID');
    
    const statements = await financialDataRepository.getIncomeStatementsByCompany(req.body.targetCompanyId);
    const statement = statements.find(s => s.id === id);
    
    if (!statement) {
      throw new BadRequestError('Income statement not found');
    }
    
    const isHistoric = await valuationRepository.isHistoricPeriod(statement.financialPeriodId);
    
    if (isHistoric && !adminOverride) {
      const protectedFields = ['revenue', 'costOfSales', 'grossProfit', 'ebitda', 'operatingProfit', 'netProfit'];
      const attemptedProtectedEdits = protectedFields.filter(field => req.body[field] !== undefined);
      
      if (attemptedProtectedEdits.length > 0) {
        throw new ForbiddenError(`Cannot edit ${attemptedProtectedEdits.join(', ')} for historic periods. Use admin override if authorized.`);
      }
    }
    
    sendSuccess(res, { message: 'Update not implemented - use adjustments for EBITDA modifications' });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
