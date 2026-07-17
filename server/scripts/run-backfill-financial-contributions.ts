import { backfillFinancialContributions } from './backfill-financial-contributions';

backfillFinancialContributions()
  .then(({ income, balance }) => {
    console.log(`[BACKFILL] Done. income=${income} balance=${balance}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[BACKFILL] Error:', err);
    process.exit(1);
  });
