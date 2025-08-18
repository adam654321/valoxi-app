console.log('Triggering Stage 1 webhook for event 2...');
const { sendStage1AnalysisWebhook } = require('./server/routes.ts');
sendStage1AnalysisWebhook(2);
