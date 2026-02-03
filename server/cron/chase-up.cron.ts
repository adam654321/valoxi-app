import cron from 'node-cron';
import { chaseUpService } from '../services/chase-up.service';

export function initializeChaseUpCron(): void {
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Starting daily chase-up processing...');
    try {
      const result = await chaseUpService.processChaseUpSchedules();
      console.log(`[CRON] Chase-up processing complete: ${result.processed} schedules processed, ${result.emailsSent} emails sent`);
    } catch (error) {
      console.error('[CRON] Chase-up processing failed:', error);
    }
  }, {
    timezone: 'Europe/London'
  });

  console.log('[CRON] Chase-up daily job scheduled for 9:00 AM UK time');
}
