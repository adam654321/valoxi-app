import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileStorageService } from '../services/file-storage.service';

const execAsync = promisify(exec);

const BACKUP_PREFIX = 'backups/';
const KEEP_BACKUPS = 7;

// Newest KEEP_BACKUPS stay; everything older is returned for deletion.
export function selectBackupsToPrune(keys: string[], keep: number = KEEP_BACKUPS): string[] {
  return keys
    .filter(k => /^backups\/backup-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(k))
    .sort()
    .reverse()
    .slice(keep);
}

export function initializeBackupCron(): void {
  cron.schedule('0 2 * * *', async () => {
    console.log('[backup-cron] Starting daily database backup...');
    let outputPath: string | null = null;
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        console.error('[backup-cron] DATABASE_URL not set, skipping backup');
        return;
      }

      // pg_dump must use the direct Neon endpoint, not the pooler.
      const directUrl = databaseUrl.replace('-pooler', '');
      const date = new Date().toISOString().slice(0, 10);
      const filename = `backup-${date}.sql.gz`;
      outputPath = path.join(os.tmpdir(), filename);

      await execAsync(
        `pg_dump "${directUrl}" | gzip > "${outputPath}"`,
        { timeout: 300_000 }
      );

      const body = await fs.readFile(outputPath);
      await fileStorageService.upload(`${BACKUP_PREFIX}${filename}`, body);
      console.log(`[backup-cron] Backup complete: ${filename} (${Math.round(body.length / 1024)}kb)`);

      const toDelete = selectBackupsToPrune(await fileStorageService.list(BACKUP_PREFIX));
      for (const old of toDelete) {
        await fileStorageService.delete(old);
        console.log(`[backup-cron] Deleted old backup: ${old}`);
      }
    } catch (err) {
      console.error('[backup-cron] Backup job failed:', err);
    } finally {
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
    }
  }, {
    timezone: 'Europe/London',
  });

  console.log('[backup-cron] Daily database backup scheduled for 02:00 UK time');
}
