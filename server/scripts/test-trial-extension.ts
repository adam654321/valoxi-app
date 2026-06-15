import { runTrialExtensionJob, runTrialWarningJob } from '../cron/billing.cron';

async function main() {
  const arg = process.argv[2];

  if (arg === '--warning') {
    console.log('Running trial warning job...');
    await runTrialWarningJob();
  } else if (arg === '--both') {
    console.log('Running trial extension job...');
    await runTrialExtensionJob();
    console.log('Running trial warning job...');
    await runTrialWarningJob();
  } else {
    console.log('Running trial extension job...');
    await runTrialExtensionJob();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
