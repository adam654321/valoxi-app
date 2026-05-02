import { chaseUpService } from '../services/chase-up.service';

async function main(): Promise<void> {
  console.log('[TEST RULE B] Triggering processChaseUpSchedules on dev...');
  const result = await chaseUpService.processChaseUpSchedules();
  console.log(`[TEST RULE B] Complete: ${result.processed} schedules processed, ${result.emailsSent} emails sent`);
  process.exit(0);
}

main().catch(e => {
  console.error('[TEST RULE B] Failed:', e);
  process.exit(1);
});
