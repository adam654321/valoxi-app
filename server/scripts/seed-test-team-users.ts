import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const TEST_PASSWORD = 'TestUser123!';

const TEST_USERS = [
  { firstName: 'Deal', lastName: 'Manager', email: 'test.dealmanager@test.com', userRole: 'deal_manager' },
  { firstName: 'Senior', lastName: 'Analyst', email: 'test.senioranalyst@test.com', userRole: 'senior_analyst' },
  { firstName: 'Test', lastName: 'Analyst', email: 'test.analyst@test.com', userRole: 'analyst' },
  { firstName: 'Test', lastName: 'Accountant', email: 'test.accountant@test.com', userRole: 'accountant' },
  { firstName: 'Legal', lastName: 'Advisor', email: 'test.legaladvisor@test.com', userRole: 'legal_advisor' },
  { firstName: 'Test', lastName: 'Viewer', email: 'test.viewer@test.com', userRole: 'viewer' },
];

async function seedTestTeamUsers() {
  console.log('=== Seeding RBAC Test Team Users ===\n');

  // Find Adam Jones (company admin)
  const [adamJones] = await db
    .select()
    .from(users)
    .where(and(eq(users.firstName, 'Adam'), eq(users.lastName, 'Jones'), eq(users.isCompanyAdmin, true)));

  if (!adamJones) {
    console.error('[ERROR] Could not find Adam Jones (company admin). Make sure this user exists before running this script.');
    process.exit(1);
  }

  const companyId = adamJones.userCompanyId;
  if (!companyId) {
    console.error('[ERROR] Adam Jones does not have a userCompanyId set.');
    process.exit(1);
  }

  console.log(`[OK] Found Adam Jones (id: ${adamJones.id}), company id: ${companyId}\n`);

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const results: { name: string; email: string; role: string; status: string }[] = [];

  for (const testUser of TEST_USERS) {
    const [existing] = await db.select().from(users).where(eq(users.email, testUser.email));

    if (existing) {
      // Update to ensure correct company and role
      await db.update(users)
        .set({
          userCompanyId: companyId,
          userRole: testUser.userRole,
          isCompanyAdmin: false,
          isActive: true,
          emailVerified: true,
          onboardingCompleted: true,
          onboardingStep: 'create_target',
          betaNdaSigned: true,
        })
        .where(eq(users.email, testUser.email));

      results.push({
        name: `${testUser.firstName} ${testUser.lastName}`,
        email: testUser.email,
        role: testUser.userRole,
        status: 'updated (already existed)',
      });
    } else {
      await db.insert(users).values({
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
        userCompanyId: companyId,
        role: 'user',
        userRole: testUser.userRole,
        isCompanyAdmin: false,
        isSystemAdmin: false,
        isActive: true,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 'create_target',
        betaNdaSigned: true,
      });

      results.push({
        name: `${testUser.firstName} ${testUser.lastName}`,
        email: testUser.email,
        role: testUser.userRole,
        status: 'created',
      });
    }
  }

  console.log('=== Test Users Summary ===\n');
  console.log(`${'Name'.padEnd(22)} ${'Email'.padEnd(36)} ${'Role'.padEnd(18)} Status`);
  console.log('-'.repeat(100));
  for (const r of results) {
    console.log(`${r.name.padEnd(22)} ${r.email.padEnd(36)} ${r.role.padEnd(18)} ${r.status}`);
  }

  console.log(`\nShared test password: ${TEST_PASSWORD}`);
  console.log('\n=== Done ===');
  process.exit(0);
}

seedTestTeamUsers().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
