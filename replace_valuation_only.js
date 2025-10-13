import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

// Read the new valuation data
const newValuationData = JSON.parse(
  fs.readFileSync('attached_assets/Pasted--report-metadata-analysis-type-comprehensive-business-valuation-com-1760377451860_1760377451861.txt', 'utf8')
);

console.log('New valuation data loaded');
console.log('Analysis type:', newValuationData[0].report_metadata.analysis_type);

// Fetch current reports array from database
async function updateValuation() {
  try {
    const currentData = await sql`
      SELECT detailed_analysis_data 
      FROM stage1_analysis_events 
      WHERE target_company_id = 36 AND webhook_status = 'success'
      LIMIT 1
    `;
    
    if (!currentData || currentData.length === 0) {
      throw new Error('No data found for company 36');
    }
    
    let reports = currentData[0].detailed_analysis_data;
    
    console.log('\nCurrent reports count:', reports.length);
    
    // Find and replace only the business valuation
    const valuationIndex = reports.findIndex(
      r => r.report_metadata?.analysis_type === 'comprehensive_business_valuation'
    );
    
    if (valuationIndex === -1) {
      throw new Error('Business valuation not found in current data');
    }
    
    console.log('Found business valuation at index:', valuationIndex);
    
    // Replace only the valuation object
    reports[valuationIndex] = newValuationData[0];
    
    console.log('\nUpdating database with modified array...');
    console.log('Total reports:', reports.length);
    reports.forEach(r => console.log(`  - ${r.report_metadata.analysis_type}`));
    
    // Update database
    const result = await sql`
      UPDATE stage1_analysis_events 
      SET detailed_analysis_data = ${JSON.stringify(reports)}::jsonb
      WHERE target_company_id = 36 AND webhook_status = 'success'
      RETURNING id, target_company_id
    `;
    
    console.log('\n✓ Database update successful:', result);
    console.log('✓ Business Valuation replaced, other 8 analyses preserved');
    
  } catch (error) {
    console.error('\n✗ Update failed:', error);
    throw error;
  }
}

updateValuation();
