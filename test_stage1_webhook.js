import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const webhookUrl = process.env.STAGE1_JSON_ANALYSER_WEBHOOK_URL;

async function testStage1Webhook() {
  try {
    console.log('Step 1: Fetching document analysis results for Dr Wass (company_id 36)...\n');
    
    // Get all document analysis results for company 36
    const companyAccountsResults = await sql`
      SELECT analysis_data 
      FROM document_analysis_results dar
      JOIN documents d ON dar.document_id = d.id
      WHERE d.target_company_id = 36 
        AND dar.document_type = 'company_accounts'
      ORDER BY dar.created_at DESC
    `;
    
    const assetRegisterResults = await sql`
      SELECT analysis_data 
      FROM document_analysis_results dar
      JOIN documents d ON dar.document_id = d.id
      WHERE d.target_company_id = 36 
        AND dar.document_type = 'asset_register'
      ORDER BY dar.created_at DESC
    `;
    
    const salesLedgerResults = await sql`
      SELECT analysis_data 
      FROM document_analysis_results dar
      JOIN documents d ON dar.document_id = d.id
      WHERE d.target_company_id = 36 
        AND dar.document_type = 'sales_ledger'
      ORDER BY dar.created_at DESC
    `;
    
    const staffMatrixResults = await sql`
      SELECT analysis_data 
      FROM document_analysis_results dar
      JOIN documents d ON dar.document_id = d.id
      WHERE d.target_company_id = 36 
        AND dar.document_type = 'staff_matrix'
      ORDER BY dar.created_at DESC
    `;
    
    const profitLossResults = await sql`
      SELECT analysis_data 
      FROM document_analysis_results dar
      JOIN documents d ON dar.document_id = d.id
      WHERE d.target_company_id = 36 
        AND dar.document_type = 'profit_and_loss'
      ORDER BY dar.created_at DESC
    `;
    
    const balanceSheetResults = await sql`
      SELECT analysis_data 
      FROM document_analysis_results dar
      JOIN documents d ON dar.document_id = d.id
      WHERE d.target_company_id = 36 
        AND dar.document_type = 'balance_sheet'
      ORDER BY dar.created_at DESC
    `;
    
    console.log('Document counts:');
    console.log(`  Company Accounts: ${companyAccountsResults.length}`);
    console.log(`  Asset Register: ${assetRegisterResults.length}`);
    console.log(`  Sales Ledger: ${salesLedgerResults.length}`);
    console.log(`  Staff Matrix: ${staffMatrixResults.length}`);
    console.log(`  Profit & Loss: ${profitLossResults.length}`);
    console.log(`  Balance Sheet: ${balanceSheetResults.length}`);
    console.log(`  Total: ${companyAccountsResults.length + assetRegisterResults.length + salesLedgerResults.length + staffMatrixResults.length + profitLossResults.length + balanceSheetResults.length}\n`);
    
    // Build aggregated payload
    const concatenatedData = {
      company_accounts: companyAccountsResults.map(r => r.analysis_data),
      asset_register: assetRegisterResults.map(r => r.analysis_data),
      sales_ledger: salesLedgerResults.map(r => r.analysis_data),
      staff_matrix: staffMatrixResults.map(r => r.analysis_data),
      profit_and_loss: profitLossResults.map(r => r.analysis_data),
      balance_sheet: balanceSheetResults.map(r => r.analysis_data),
    };
    
    const webhookPayload = {
      event_type: "stage1_analysis_complete",
      timestamp: new Date().toISOString(),
      id: 36,
      triggered_by: "manual_test",
      ...concatenatedData
    };
    
    console.log('Step 2: Sending webhook to STAGE1_JSON_ANALYSER_WEBHOOK_URL...\n');
    console.log('Webhook URL:', webhookUrl);
    console.log('Payload keys:', Object.keys(webhookPayload));
    
    const startTime = Date.now();
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });
    
    const processingTime = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log(`\nStep 3: Webhook response received (${processingTime}ms):\n`);
    console.log('Status:', response.status, response.statusText);
    console.log('Response length:', responseText.length, 'characters');
    console.log('Response preview:', responseText.substring(0, 500) + '...\n');
    
    const webhookStatus = response.ok ? 'success' : 'failed';
    
    console.log('Step 4: Updating Stage 1 event with webhook response...\n');
    
    // Get the current stage 1 event for company 36
    const events = await sql`
      SELECT id 
      FROM stage1_analysis_events 
      WHERE target_company_id = 36 
        AND webhook_status = 'success'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (events.length === 0) {
      throw new Error('No Stage 1 event found for company 36');
    }
    
    const eventId = events[0].id;
    console.log('Found Stage 1 event ID:', eventId);
    
    // Update ONLY webhook response fields, preserving detailed_analysis_data
    const updated = await sql`
      UPDATE stage1_analysis_events 
      SET 
        webhook_status = ${webhookStatus},
        webhook_response = ${responseText},
        webhook_sent_at = NOW(),
        webhook_sent = ${webhookStatus === 'success'},
        processing_time = ${processingTime}
      WHERE id = ${eventId}
      RETURNING id, webhook_status, webhook_sent, processing_time
    `;
    
    console.log('\n✓ Stage 1 event updated successfully:');
    console.log('  Event ID:', updated[0].id);
    console.log('  Webhook Status:', updated[0].webhook_status);
    console.log('  Webhook Sent:', updated[0].webhook_sent);
    console.log('  Processing Time:', updated[0].processing_time, 'ms');
    console.log('\n✓ Detailed analysis data preserved (not modified)');
    
  } catch (error) {
    console.error('\n✗ Webhook test failed:', error);
    throw error;
  }
}

testStage1Webhook();
