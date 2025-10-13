import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

const webhookDataRaw = fs.readFileSync('attached_assets/Pasted--id-36-company-name-Dr-Wass-industry-Healthcare-merged--1760369118351_1760369118363.txt', 'utf8');
const webhookData = JSON.parse(webhookDataRaw);

const merged = webhookData[0].merged;

const detailedAnalysisData = {};

// Process first level of merged array
merged.forEach(item => {
  const analysisType = item.report_metadata?.analysis_type;
  
  if (analysisType === 'sector_competitive_intelligence' && item.sector_analysis?.full_report) {
    detailedAnalysisData.sector_competitive_intelligence = { full_report: item.sector_analysis.full_report };
  }
  else if (analysisType === 'growth_opportunities' && item.growth_analysis?.full_report) {
    detailedAnalysisData.growth_opportunities = { full_report: item.growth_analysis.full_report };
  }
  else if (analysisType === 'comprehensive_business_valuation' && item.valuation_analysis?.full_report) {
    detailedAnalysisData.comprehensive_business_valuation = { full_report: item.valuation_analysis.full_report };
  }
  else if (analysisType === 'comprehensive_deal_structure_financing' && item.deal_structure_analysis?.full_report) {
    detailedAnalysisData.comprehensive_deal_structure_financing = { full_report: item.deal_structure_analysis.full_report };
  }
  // Check for nested reports array (third item has this structure)
  else if (item.reports && Array.isArray(item.reports)) {
    item.reports.forEach(report => {
      const reportType = report.report_metadata?.analysis_type;
      
      if (reportType === 'asset_management_and_capital_efficiency' && report.asset_analysis?.full_report) {
        detailedAnalysisData.asset_management_and_capital_efficiency = { full_report: report.asset_analysis.full_report };
      }
      else if (reportType === 'cashflow_analysis' && report.cashflow_analysis?.full_report) {
        detailedAnalysisData.cashflow_analysis = { full_report: report.cashflow_analysis.full_report };
      }
      else if (reportType === 'financial_analysis' && report.financial_analysis?.full_report) {
        detailedAnalysisData.financial_analysis = { full_report: report.financial_analysis.full_report };
      }
      else if (reportType === 'legal_compliance_risk' && report.legal_analysis?.full_report) {
        detailedAnalysisData.legal_compliance_risk = { full_report: report.legal_analysis.full_report };
      }
      else if (reportType === 'staff_workforce' && report.staff_analysis?.full_report) {
        detailedAnalysisData.staff_workforce = { full_report: report.staff_analysis.full_report };
      }
    });
  }
});

console.log('Found analysis types:', Object.keys(detailedAnalysisData));
console.log('\nAnalysis type report lengths:');
Object.keys(detailedAnalysisData).forEach(key => {
  console.log(`  ${key}: ${detailedAnalysisData[key].full_report.length} chars`);
});

async function updateDatabase() {
  try {
    const result = await sql`
      UPDATE stage1_analysis_events 
      SET detailed_analysis_data = ${JSON.stringify(detailedAnalysisData)}::jsonb
      WHERE target_company_id = 36 AND webhook_status = 'success'
      RETURNING id, target_company_id
    `;
    
    console.log('\nUpdate successful:', result);
  } catch (error) {
    console.error('\nUpdate failed:', error);
    throw error;
  }
}

updateDatabase();
