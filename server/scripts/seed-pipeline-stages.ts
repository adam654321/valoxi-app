import { db } from '../db';
import { pipelineStages } from '@shared/schema/deals';
import { count, sql } from 'drizzle-orm';
import { log } from '../vite';
import { seedSystemConfig } from './seed-system-config';

const DEFAULT_PIPELINE_STAGES = [
  { stageName: 'New Target', stageOrder: 1, description: 'Newly identified company you are considering' },
  { stageName: 'Initial Contact', stageOrder: 2, description: 'You have made first contact with the owner or their representative' },
  { stageName: 'Documents Requested', stageOrder: 3, description: 'You have asked the target to share financial and operational documents' },
  { stageName: 'Under Review', stageOrder: 4, description: 'You are actively reviewing the documents and business' },
  { stageName: 'Offer Stage', stageOrder: 5, description: 'You are preparing or have submitted an offer' },
  { stageName: 'Heads of Terms', stageOrder: 6, description: 'You are negotiating and agreeing the headline deal terms' },
  { stageName: 'Due Diligence', stageOrder: 7, description: 'Formal legal and financial due diligence is underway' },
  { stageName: 'Legal & Accounting', stageOrder: 8, description: 'Legal and accounting workstreams are active' },
  { stageName: 'Completion', stageOrder: 9, description: 'The deal is completing or has completed' },
  { stageName: 'Not Qualified', stageOrder: 10, description: 'The target did not meet your criteria and has been closed out' },
];

export async function seedDefaultPipelineStages(): Promise<void> {
  const [existing] = await db
    .select({ count: count() })
    .from(pipelineStages);

  const isFirstRun = (existing?.count ?? 0) === 0;

  await db
    .insert(pipelineStages)
    .values(DEFAULT_PIPELINE_STAGES)
    .onConflictDoUpdate({
      target: pipelineStages.stageName,
      set: { description: sql`excluded.description` },
    });

  if (isFirstRun) {
    log('[SEED] Seeded default pipeline stages');
    await seedSystemConfig();
  } else {
    log('[SEED] Updated pipeline stage descriptions');
  }
}
