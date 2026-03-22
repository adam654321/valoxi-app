import { db } from '../db';
import { activityTypes } from '@shared/schema/deals';
import { count } from 'drizzle-orm';
import { log } from '../vite';

const DEFAULT_ACTIVITY_TYPES = [
  { typeName: 'Phone Call',         description: 'Telephone conversation with a contact',        requiresContact: true,  defaultDuration: 30,   isActive: true },
  { typeName: 'Email',              description: 'Email correspondence',                          requiresContact: true,  defaultDuration: null,  isActive: true },
  { typeName: 'Meeting',            description: 'In-person or virtual meeting',                  requiresContact: true,  defaultDuration: 60,   isActive: true },
  { typeName: 'Note',               description: 'Internal note or observation',                  requiresContact: false, defaultDuration: null,  isActive: true },
  { typeName: 'Follow-up',          description: 'Follow-up action or reminder',                  requiresContact: false, defaultDuration: null,  isActive: true },
  { typeName: 'Initial Discussion', description: 'First outreach or introductory conversation',   requiresContact: true,  defaultDuration: 30,   isActive: true },
];

export async function seedActivityTypes(): Promise<{ seeded: boolean; count: number }> {
  const [existing] = await db.select({ count: count() }).from(activityTypes);

  if ((existing?.count ?? 0) > 0) {
    log('[SEED] Activity types already seeded — skipping');
    return { seeded: false, count: existing?.count ?? 0 };
  }

  await db.insert(activityTypes).values(DEFAULT_ACTIVITY_TYPES).onConflictDoNothing();
  log('[SEED] Seeded default activity types');
  return { seeded: true, count: DEFAULT_ACTIVITY_TYPES.length };
}

// Allow running directly: npx tsx server/scripts/seed-activity-types.ts
if (process.argv[1]?.endsWith('seed-activity-types.ts')) {
  seedActivityTypes()
    .then(({ seeded, count }) => {
      if (seeded) console.log(`✓ Seeded ${count} activity types`);
      else console.log(`✓ Already seeded (${count} types exist) — nothing to do`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Seeding failed:', err);
      process.exit(1);
    });
}
