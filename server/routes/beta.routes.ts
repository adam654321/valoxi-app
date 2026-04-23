import { Router } from 'express';
import { systemConfigService } from '../services/system-config.service';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get('/config', asyncHandler(async (_req, res) => {
  const [tierSwitchEnabled, issueReportingEnabled] = await Promise.all([
    systemConfigService.getConfig('beta_tier_switch_enabled'),
    systemConfigService.getConfig('issue_reporting_enabled'),
  ]);

  sendSuccess(res, {
    tierSwitchEnabled: tierSwitchEnabled !== 'false',
    issueReportingEnabled: issueReportingEnabled !== 'false',
  });
}));

export default router;
