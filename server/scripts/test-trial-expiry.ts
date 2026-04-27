import { runTrialExpiryJob } from '../cron/billing.cron';

async function main() {
  await runTrialExpiryJob();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
