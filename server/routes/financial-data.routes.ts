import { Router, Request, Response } from 'express';
import { financialDataRepository } from '../repositories/financial-data.repository';
import { financialDataService } from '../services/financial-data.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError } from '../utils/errors';

const router = Router();

router.get('/company/:companyId/periods', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const periods = await financialDataRepository.getFinancialPeriodsByCompany(targetCompanyId);
    sendSuccess(res, periods);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/income-statements', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const statements = await financialDataRepository.getIncomeStatementsByCompany(targetCompanyId);
    sendSuccess(res, statements);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/balance-sheets', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const sheets = await financialDataRepository.getBalanceSheetsByCompany(targetCompanyId);
    sendSuccess(res, sheets);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/staff-data', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const data = await financialDataRepository.getStaffDataByCompany(targetCompanyId);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/aged-debtors', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const debtors = await financialDataRepository.getAgedDebtorsByCompany(targetCompanyId);
    sendSuccess(res, debtors);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/fixed-assets', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const assets = await financialDataRepository.getFixedAssetsRegisterByCompany(targetCompanyId);
    sendSuccess(res, assets);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/loans', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const loans = await financialDataRepository.getLoanFacilitiesByCompany(targetCompanyId);
    sendSuccess(res, loans);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/company/:companyId/summary', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const summary = await financialDataService.getFinancialSummary(targetCompanyId);
    
    const calculatedMetrics: any = {};
    
    if (summary.incomeStatements.length > 0) {
      const latestPL = summary.incomeStatements[0];
      calculatedMetrics.latestEBITDA = financialDataService.calculateEBITDA(latestPL);
      calculatedMetrics.latestGrossMargin = financialDataService.calculateGrossMargin(latestPL);
      calculatedMetrics.latestNetMargin = financialDataService.calculateNetMargin(latestPL);
      
      if (summary.incomeStatements.length >= 3) {
        const last3Revenues = summary.incomeStatements.slice(0, 3).map(s => s.revenue);
        const last3NetProfits = summary.incomeStatements.slice(0, 3).map(s => s.netProfit);
        calculatedMetrics.threeYearAverageRevenue = financialDataService.calculate3YearAverage(last3Revenues);
        calculatedMetrics.threeYearAverageNetProfit = financialDataService.calculate3YearAverage(last3NetProfits);
      }
    }
    
    sendSuccess(res, {
      ...summary,
      calculatedMetrics,
    });
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
    
    const adjustments = await financialDataRepository.getAdjustmentsByCompany(targetCompanyId);
    
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

router.get('/company/:companyId/deal-sheet', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    
    const summary = await financialDataService.getFinancialSummary(targetCompanyId);
    
    const dealSheet: any = {
      company_id: targetCompanyId,
      generated_at: new Date().toISOString(),
      financial_periods: summary.periods.map(p => ({
        year: p.fiscalYear,
        period_end: p.periodEnd,
        type: p.periodType,
      })),
      profit_and_loss: {},
      balance_sheet: {},
      staff_summary: null,
      aged_debtors_summary: null,
      fixed_assets_summary: null,
      calculated_metrics: {},
    };
    
    for (const statement of summary.incomeStatements) {
      const period = summary.periods.find(p => p.id === statement.financialPeriodId);
      const year = period?.fiscalYear || 'unknown';
      dealSheet.profit_and_loss[year] = {
        revenue: statement.revenue,
        cost_of_sales: statement.costOfSales,
        gross_profit: statement.grossProfit,
        administrative_expenses: statement.administrativeExpenses,
        depreciation_amortisation: statement.depreciationAmortisation,
        operating_profit: statement.operatingProfit,
        interest_payable: statement.interestPayable,
        interest_receivable: statement.interestReceivable,
        profit_before_tax: statement.profitBeforeTax,
        corporation_tax: statement.corporationTax,
        net_profit: statement.netProfit,
      };
    }
    
    for (const sheet of summary.balanceSheets) {
      const period = summary.periods.find(p => p.id === sheet.financialPeriodId);
      const year = period?.fiscalYear || 'unknown';
      dealSheet.balance_sheet[year] = {
        fixed_assets: {
          intangible: sheet.intangibleAssets,
          tangible: sheet.tangibleFixedAssets,
          freehold_property: sheet.freeholdProperty,
          leasehold_property: sheet.leaseholdProperty,
          plant_machinery: sheet.plantMachinery,
          fixtures_fittings: sheet.fixturesFittings,
          motor_vehicles: sheet.motorVehicles,
          computer_equipment: sheet.computerEquipment,
        },
        current_assets: {
          stock: sheet.stockInventory,
          trade_debtors: sheet.tradeDebtors,
          prepayments: sheet.prepayments,
          amounts_owed_by_directors: sheet.amountsOwedByDirectors,
          other_debtors: sheet.otherDebtors,
          cash_at_bank: sheet.cashAtBank,
          total: sheet.totalCurrentAssets,
        },
        current_liabilities: {
          trade_creditors: sheet.tradeCreditors,
          taxation_social_security: sheet.taxationSocialSecurity,
          corporation_tax_due: sheet.corporationTaxDue,
          bank_loans_current: sheet.bankLoansOverdraftCurrent,
          accruals: sheet.accruals,
          amounts_owed_to_directors: sheet.amountsOwedToDirectors,
          other_creditors: sheet.otherCreditors,
          total: sheet.totalCurrentLiabilities,
        },
        long_term_liabilities: {
          bank_loans: sheet.bankLoansLongTerm,
          deferred_taxation: sheet.deferredTaxation,
          other_debt: sheet.otherLongTermDebt,
          total: sheet.totalLongTermLiabilities,
        },
        equity: {
          share_capital: sheet.shareCapital,
          retained_earnings: sheet.retainedEarnings,
          total: sheet.totalEquity,
        },
      };
    }
    
    if (summary.staffData.length > 0) {
      const latestStaff = summary.staffData[0];
      dealSheet.staff_summary = {
        total_headcount: latestStaff.totalHeadcount,
        total_staff_costs: latestStaff.totalStaffCosts,
        director_count: latestStaff.directorCount,
        director_remuneration: latestStaff.directorRemuneration,
        employee_count: latestStaff.employeeCount,
      };
    }
    
    if (summary.agedDebtors.length > 0) {
      const latestDebtors = summary.agedDebtors[0];
      dealSheet.aged_debtors_summary = {
        report_date: latestDebtors.reportDate,
        total_trade_debtors: latestDebtors.totalTradeDebtors,
        current_0_to_30: latestDebtors.current0To30,
        days_31_to_60: latestDebtors.days31To60,
        days_61_to_90: latestDebtors.days61To90,
        days_90_plus: latestDebtors.days90Plus,
        debtor_days: latestDebtors.debtorDays,
      };
    }
    
    if (summary.fixedAssets.length > 0) {
      const latestAssets = summary.fixedAssets[0];
      dealSheet.fixed_assets_summary = {
        report_date: latestAssets.reportDate,
        total_gross_book_value: latestAssets.totalGrossBookValue,
        total_accumulated_depreciation: latestAssets.totalAccumulatedDepreciation,
        total_net_book_value: latestAssets.totalNetBookValue,
        property_nbv: latestAssets.propertyNetBookValue,
        plant_machinery_nbv: latestAssets.plantMachineryNetBookValue,
        vehicles_nbv: latestAssets.vehiclesNetBookValue,
        it_equipment_nbv: latestAssets.itEquipmentNetBookValue,
      };
    }
    
    if (summary.incomeStatements.length > 0) {
      const latestPL = summary.incomeStatements[0];
      dealSheet.calculated_metrics = {
        ebitda: financialDataService.calculateEBITDA(latestPL),
        gross_margin_percent: financialDataService.calculateGrossMargin(latestPL),
        net_margin_percent: financialDataService.calculateNetMargin(latestPL),
      };
      
      if (summary.incomeStatements.length >= 3) {
        const last3Revenues = summary.incomeStatements.slice(0, 3).map(s => s.revenue);
        const last3NetProfits = summary.incomeStatements.slice(0, 3).map(s => s.netProfit);
        const last3EBITDA = summary.incomeStatements.slice(0, 3).map(s => {
          const ebitda = financialDataService.calculateEBITDA(s);
          return ebitda !== null ? ebitda.toString() : null;
        });
        
        dealSheet.calculated_metrics.three_year_average_revenue = financialDataService.calculate3YearAverage(last3Revenues);
        dealSheet.calculated_metrics.three_year_average_net_profit = financialDataService.calculate3YearAverage(last3NetProfits);
        dealSheet.calculated_metrics.three_year_average_ebitda = financialDataService.calculate3YearAverage(last3EBITDA);
      }
    }
    
    sendSuccess(res, dealSheet);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
