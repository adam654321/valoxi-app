import { runDunningCancellationJob } from '../cron/billing.cron';

async function main() {
  await runDunningCancellationJob();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});