import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seedAdmins() {
  console.log('=== Seeding Admin Users ===\n');

  const vivEmail = 'viv@shiftopsconsulting.com';
  const [vivUser] = await db.select().from(users).where(eq(users.email, vivEmail));

  if (vivUser) {
    await db.update(users).set({ isSystemAdmin: true }).where(eq(users.email, vivEmail));
    console.log(`[OK] ${vivEmail} — found (id: ${vivUser.id}), set isSystemAdmin = true`);
  } else {
    const passwordHash = await bcrypt.hash('ChangeMe2025!', 10);
    const [newUser] = await db.insert(users).values({
      email: vivEmail,
      firstName: 'Viv',
      lastName: '',
      passwordHash,
      isSystemAdmin: true,
      isCompanyAdmin: true,
      isActive: true,
      role: 'admin',
      userCompanyId: null,
    }).returning();
    console.log(`[OK] ${vivEmail} — created new user (id: ${newUser.id}) with isSystemAdmin = true`);
  }

  const adamEmail = 'adam@shiftopsconsulting.com';
  const [adamUser] = await db.select().from(users).where(eq(users.email, adamEmail));

  if (adamUser) {
    await db.update(users).set({ isSystemAdmin: true }).where(eq(users.email, adamEmail));
    console.log(`[OK] ${adamEmail} — found (id: ${adamUser.id}), set isSystemAdmin = true`);
  } else {
    const passwordHash = await bcrypt.hash('ChangeMe2025!', 10);
    const [newUser] = await db.insert(users).values({
      email: adamEmail,
      firstName: 'Adam',
      lastName: 'Auty',
      passwordHash,
      isSystemAdmin: true,
      isCompanyAdmin: true,
      isActive: true,
      role: 'admin',
      userCompanyId: null,
    }).returning();
    console.log(`[OK] ${adamEmail} — created new user (id: ${newUser.id}) with isSystemAdmin = true`);
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

seedAdmins().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
