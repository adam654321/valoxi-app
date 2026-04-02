import { db } from '../db';
import { systemConfig } from '@shared/schema/core';
import { log } from '../vite';

const DEFAULT_SYSTEM_CONFIG: { key: string; value: string }[] = [
  { key: 'registration_mode', value: 'invite_only' },
  { key: 'trial_days_default', value: '3' },
  { key: 'max_retrigger_attempts', value: '3' },
  { key: 'analysis_queue_concurrency', value: '2' },
  { key: 'expert_analysis_enabled', value: 'true' },
  { key: 'beta_mode', value: 'true' },
];

export async function seedSystemConfig(): Promise<void> {
  for (const entry of DEFAULT_SYSTEM_CONFIG) {
    await db
      .insert(systemConfig)
      .values({ key: entry.key, value: entry.value })
      .onConflictDoNothing();
  }
  log('[SEED] System config defaults seeded (skipped existing keys)');
}
