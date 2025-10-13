import fs from 'fs';

const webhookDataRaw = fs.readFileSync('attached_assets/Pasted--id-36-company-name-Dr-Wass-industry-Healthcare-merged--1760369118351_1760369118363.txt', 'utf8');
const webhookData = JSON.parse(webhookDataRaw);

const merged = webhookData[0].merged;

console.log('Total merged items:', merged.length);

merged.forEach((item, idx) => {
  const analysisType = item.report_metadata?.analysis_type;
  console.log(`\n${idx + 1}. Analysis Type: ${analysisType}`);
  
  // Check all possible keys for full_report
  const keys = Object.keys(item);
  keys.forEach(key => {
    if (item[key]?.full_report) {
      console.log(`   - Found full_report in: ${key}`);
      console.log(`   - Report length: ${item[key].full_report.length} chars`);
    }
  });
});
