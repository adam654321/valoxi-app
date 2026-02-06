// This file is for local dev testing only.
// The stage1 analysis webhook is now triggered via the v2 API endpoints:
//   POST /api/v2/stage1-analysis/:companyId/trigger
//   POST /api/v2/stage1-analysis/:companyId/trigger-bypass
// Use those endpoints directly via curl or the UI instead.
console.log('This script is deprecated. Use the v2 API endpoints instead.');
console.log('Example: POST /api/v2/stage1-analysis/:companyId/trigger-bypass');
