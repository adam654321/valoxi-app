import { runDunningDay7ReminderJob } from '../cron/billing.cron';

async function main() {
  await runDunningDay7ReminderJob();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});