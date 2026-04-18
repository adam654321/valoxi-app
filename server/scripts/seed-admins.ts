import { db } from '../db';
import { users, userCompanies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seedAdmins() {
  console.log('=== Seeding Admin Users ===\n');

  // 1. Ensure ShiftOps Consulting company exists
  const companyName = 'ShiftOps Consulting';
  let [company] = await db.select().from(userCompanies).where(eq(userCompanies.companyName, companyName));

  if (company) {
    console.log(`[OK] Company "${companyName}" already exists (id: ${company.id})`);
  } else {
    [company] = await db.insert(userCompanies).values({
      companyName,
      email: 'admin@shiftopsconsulting.com',
    }).returning();
    console.log(`[OK] Company "${companyName}" created (id: ${company.id})`);
  }

  const shiftOpsCompanyId = company.id;

  // 2. Viv
  const vivEmail = 'viv@shiftopsconsulting.com';
  const [vivUser] = await db.select().from(users).where(eq(users.email, vivEmail));

  if (vivUser) {
    await db.update(users)
      .set({
        firstName: 'Vivek',
        lastName: 'Kuvelker',
        role: 'admin',
        userRole: 'company_admin',
        isCompanyAdmin: true,
        isSystemAdmin: true,
        isActive: true,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 'create_target',
        userCompanyId: shiftOpsCompanyId,
      })
      .where(eq(users.email, vivEmail));
    console.log(`[OK] ${vivEmail} — updated (id: ${vivUser.id}), company = ${shiftOpsCompanyId}`);
  } else {
    const passwordHash = await bcrypt.hash('ChangeMe2025!', 10);
    const [newUser] = await db.insert(users).values({
      email: vivEmail,
      firstName: 'Vivek',
      lastName: 'Kuvelker',
      passwordHash,
      role: 'admin',
      userRole: 'company_admin',
      isCompanyAdmin: true,
      isSystemAdmin: true,
      isActive: true,
      emailVerified: true,
      onboardingCompleted: true,
      onboardingStep: 'create_target',
      userCompanyId: shiftOpsCompanyId,
    }).returning();
    console.log(`[OK] ${vivEmail} — created (id: ${newUser.id}), company = ${shiftOpsCompanyId}`);
  }

  // 3. Adam
  const adamEmail = 'adam@shiftopsconsulting.com';
  const [adamUser] = await db.select().from(users).where(eq(users.email, adamEmail));

  if (adamUser) {
    await db.update(users)
      .set({
        firstName: 'Adam',
        lastName: 'ShiftOps',
        role: 'admin',
        userRole: 'analyst',
        isCompanyAdmin: false,
        isSystemAdmin: true,
        isActive: true,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 'create_target',
        userCompanyId: shiftOpsCompanyId,
      })
      .where(eq(users.email, adamEmail));
    console.log(`[OK] ${adamEmail} — updated (id: ${adamUser.id}), company = ${shiftOpsCompanyId}`);
  } else {
    const passwordHash = await bcrypt.hash('ChangeMe2025!', 10);
    const [newUser] = await db.insert(users).values({
      email: adamEmail,
      firstName: 'Adam',
      lastName: 'ShiftOps',
      passwordHash,
      role: 'admin',
      userRole: 'analyst',
      isCompanyAdmin: false,
      isSystemAdmin: true,
      isActive: true,
      emailVerified: true,
      onboardingCompleted: true,
      onboardingStep: 'create_target',
      userCompanyId: shiftOpsCompanyId,
    }).returning();
    console.log(`[OK] ${adamEmail} — created (id: ${newUser.id}), company = ${shiftOpsCompanyId}`);
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

seedAdmins().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
