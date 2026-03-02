/**
 * Seed a demo target company for testing the onboarding flow.
 *
 * Usage:
 *   npx tsx server/scripts/seed-demo-company.ts <userCompanyId>
 *
 * Example:
 *   npx tsx server/scripts/seed-demo-company.ts 1
 *
 * This creates a realistic target company for the given userCompanyId.
 * It does NOT run automatically on registration — it is for internal testing only.
 */

import { db } from '../db';
import { targetCompanies } from '@shared/schema/deals';

async function seedDemoCompany() {
  const userCompanyId = parseInt(process.argv[2], 10);

  if (!userCompanyId || isNaN(userCompanyId)) {
    console.error('Usage: npx tsx server/scripts/seed-demo-company.ts <userCompanyId>');
    process.exit(1);
  }

  console.log(`Seeding demo company for userCompanyId: ${userCompanyId}`);

  const [company] = await db
    .insert(targetCompanies)
    .values({
      userCompanyId,
      companyName: 'Midlands Engineering Solutions Ltd',
      industry: 'Manufacturing',
      subSector: 'Precision Engineering & CNC',
      annualRevenue: '2400000',
      employeeCount: 28,
      yearEstablished: 2007,
      description:
        'A profitable West Midlands precision engineering firm specialising in CNC machining for the automotive and aerospace supply chain. Trading for 18 years, owner-managed, with recurring contracts.',
      stage: 'New Target',
    })
    .returning();

  console.log(`Demo company created: id=${company.id}, name="${company.companyName}"`);
  process.exit(0);
}

seedDemoCompany().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
