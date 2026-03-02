import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export function initializeBackupCron(): void {
  cron.schedule('0 2 * * *', async () => {
    console.log('[backup-cron] Starting daily database backup...');
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        console.error('[backup-cron] DATABASE_URL not set, skipping backup');
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const filename = `backup-${date}.sql.gz`;
      const outputPath = path.join('/tmp', filename);

      await execAsync(
        `pg_dump "${databaseUrl}" | gzip > "${outputPath}"`,
        { timeout: 300_000 }
      );

      const stats = await fs.stat(outputPath);
      const sizeKb = Math.round(stats.size / 1024);
      console.log(`[backup-cron] Backup complete: ${filename} (${sizeKb}kb)`);

      const files = await fs.readdir('/tmp');
      const backupFiles = files
        .filter(f => /^backup-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f))
        .sort()
        .reverse();

      if (backupFiles.length > 7) {
        const toDelete = backupFiles.slice(7);
        for (const old of toDelete) {
          await fs.unlink(path.join('/tmp', old));
          console.log(`[backup-cron] Deleted old backup: ${old}`);
        }
      }
    } catch (err) {
      console.error('[backup-cron] Backup job failed:', err);
    }
  }, {
    timezone: 'Europe/London',
  });

  console.log('[backup-cron] Daily database backup scheduled for 02:00 UK time');
}
