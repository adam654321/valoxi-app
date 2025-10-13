import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';

async function updateDrWass() {
  const sql = neon(process.env.DATABASE_URL!);
  
  const analysisData = fs.readFileSync('/tmp/dr_wass_analysis.json', 'utf8');
  
  // Update the most recent successful record for Dr Wass (id 37)
  const result = await sql`
    UPDATE stage1_analysis_events 
    SET detailed_analysis_data = ${analysisData}::json,
        webhook_status = 'success',
        webhook_sent = true
    WHERE id = 37 AND target_company_id = 36
    RETURNING id, target_company_id;
  `;
  
  console.log('Updated record:', result);
}

updateDrWass().catch(console.error);
