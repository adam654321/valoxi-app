import { db } from '../db';
import { pipelineStages } from '@shared/schema/deals';
import { count } from 'drizzle-orm';
import { log } from '../vite';
import { seedSystemConfig } from './seed-system-config';

const DEFAULT_PIPELINE_STAGES = [
  { stageName: 'New Target', stageOrder: 1, description: 'Newly identified acquisition target' },
  { stageName: 'Initial Contact', stageOrder: 2, description: 'First outreach made to the target' },
  { stageName: 'Documents Requested', stageOrder: 3, description: 'Financial and operational documents requested' },
  { stageName: 'Under Review', stageOrder: 4, description: 'Documents and business under active review' },
  { stageName: 'Offer Stage', stageOrder: 5, description: 'Preparing or submitting an offer' },
  { stageName: 'Heads of Terms', stageOrder: 6, description: 'Negotiating and agreeing heads of terms' },
  { stageName: 'Due Diligence', stageOrder: 7, description: 'Formal due diligence in progress' },
  { stageName: 'Legal & Accounting', stageOrder: 8, description: 'Legal and accounting workstreams active' },
  { stageName: 'Completion', stageOrder: 9, description: 'Deal completing or completed' },
  { stageName: 'Not Qualified', stageOrder: 10, description: 'Target did not meet criteria' },
];

export async function seedDefaultPipelineStages(): Promise<void> {
  const [existing] = await db
    .select({ count: count() })
    .from(pipelineStages);

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  await db.insert(pipelineStages).values(DEFAULT_PIPELINE_STAGES).onConflictDoNothing();
  log('[SEED] Seeded default pipeline stages');
  await seedSystemConfig();
}
