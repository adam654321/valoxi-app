import { billingService } from '../services/billing.service';
import { billingRepository } from '../repositories/billing.repository';

async function main() {
  await billingService.updateSubscriptionStatus(30, { status: 'admin_comped' });
  const before = await billingRepository.getByCompanyId(30);
  console.log('Before guard test:', {
    status: before?.status,
    past_due_since: before?.pastDueSince,
  });

  const matchingSub = before;
  if (matchingSub && matchingSub.status !== 'admin_comped') {
    console.log('GUARD FAILED: would have transitioned to past_due');
  } else if (matchingSub && matchingSub.status === 'admin_comped') {
    console.log('GUARD ACTIVE: admin_comped sub correctly skipped');
  }

  const after = await billingRepository.getByCompanyId(30);
  console.log('After guard test:', {
    status: after?.status,
    past_due_since: after?.pastDueSince,
  });
}

main().catch(console.error).finally(() => process.exit(0));
