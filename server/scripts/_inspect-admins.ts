import { db } from '../db';
import { users, companies } from '../db/schema';
import { eq, or, inArray } from 'drizzle-orm';

async function main() {
  const adminUsers = await db.select().from(users).where(
    or(eq(users.email, 'viv@shiftopsconsulting.com'), eq(users.email, 'adam@shiftopsconsulting.com'))
  );
  console.log('=== USERS ===');
  console.log(JSON.stringify(adminUsers, null, 2));

  const companyIds = [...new Set(adminUsers.flatMap(u => [u.userCompanyId, u.currentCompanyId]).filter(Boolean))];
  if (companyIds.length > 0) {
    const adminCompanies = await db.select().from(companies).where(inArray(companies.id, companyIds as number[]));
    console.log('\n=== COMPANIES ===');
    console.log(JSON.stringify(adminCompanies, null, 2));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
