import { db } from '../db';
import { users, userCompanies } from '@shared/schema';
import { subscriptions } from '@shared/schema/billing';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seedAdmins() {
  console.log('=== Seeding Admin Users ===\n');

  const PASSWORD = 'Changeme2026!';
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. Ensure Valoxi.ai company exists
  const companyName = 'Valoxi.ai';
  let [company] = await db.select().from(userCompanies).where(eq(userCompanies.companyName, companyName));

  if (company) {
    console.log(`[OK] Company "${companyName}" already exists (id: ${company.id})`);
  } else {
    [company] = await db.insert(userCompanies).values({
      companyName,
      email: 'admin@valoxi.ai',
    }).returning();
    console.log(`[OK] Company "${companyName}" created (id: ${company.id})`);
  }

  const companyId = company.id;

  // 2. Upsert admin_comped Expert subscription for Valoxi.ai
  const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.userCompanyId, companyId));

  if (existingSub) {
    await db.update(subscriptions)
      .set({
        planKey: 'EXPERT',
        status: 'admin_comped',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userCompanyId, companyId));
    console.log(`[OK] Subscription updated to EXPERT / admin_comped for company ${companyId}`);
  } else {
    await db.insert(subscriptions).values({
      userCompanyId: companyId,
      planKey: 'EXPERT',
      status: 'admin_comped',
    });
    console.log(`[OK] Subscription created as EXPERT / admin_comped for company ${companyId}`);
  }

  // 3. Viv
  const vivEmail = 'viv@shiftopsconsulting.com';
  const [vivUser] = await db.select().from(users).where(eq(users.email, vivEmail));

  const vivFields = {
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
    betaNdaSigned: true,
    userCompanyId: companyId,
    currentCompanyId: companyId,
  };

  if (vivUser) {
    await db.update(users).set(vivFields).where(eq(users.email, vivEmail));
    console.log(`[OK] ${vivEmail} — updated (id: ${vivUser.id}), company = ${companyId}, password reset`);
  } else {
    const [newUser] = await db.insert(users).values({ email: vivEmail, ...vivFields }).returning();
    console.log(`[OK] ${vivEmail} — created (id: ${newUser.id}), company = ${companyId}`);
  }

  // 4. Adam
  const adamEmail = 'adam@shiftopsconsulting.com';
  const [adamUser] = await db.select().from(users).where(eq(users.email, adamEmail));

  const adamFields = {
    firstName: 'Adam',
    lastName: 'Coxon',
    passwordHash,
    role: 'admin',
    userRole: 'company_admin',
    isCompanyAdmin: true,
    isSystemAdmin: true,
    isActive: true,
    emailVerified: true,
    onboardingCompleted: true,
    onboardingStep: 'create_target',
    betaNdaSigned: true,
    userCompanyId: companyId,
    currentCompanyId: companyId,
  };

  if (adamUser) {
    await db.update(users).set(adamFields).where(eq(users.email, adamEmail));
    console.log(`[OK] ${adamEmail} — updated (id: ${adamUser.id}), company = ${companyId}, password reset`);
  } else {
    const [newUser] = await db.insert(users).values({ email: adamEmail, ...adamFields }).returning();
    console.log(`[OK] ${adamEmail} — created (id: ${newUser.id}), company = ${companyId}`);
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

seedAdmins().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
