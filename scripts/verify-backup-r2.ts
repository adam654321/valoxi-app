// One-off check that the backup path works: pg_dump -> gzip -> R2 upload/head/download/delete.
// Uses the same fileStorageService as server/cron/backup.cron.ts, but a throwaway key
// outside the real `backups/` prefix. Refuses to run unless the bucket is the dev one.
// Run in the DO console: npx tsx scripts/verify-backup-r2.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileStorageService } from '../server/services/file-storage.service';

const execAsync = promisify(exec);
const EXPECTED_BUCKET = 'valoxi-documents-dev';

async function main() {
  const bucket = process.env.R2_BUCKET_NAME;
  console.log('bucket:', bucket);
  if (bucket !== EXPECTED_BUCKET) {
    console.error(`ABORT: R2_BUCKET_NAME must be ${EXPECTED_BUCKET}`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ABORT: DATABASE_URL not set');
    process.exit(1);
  }

  const directUrl = process.env.DATABASE_URL.replace('-pooler', '');
  const outputPath = path.join(os.tmpdir(), 'r2check.sql.gz');
  const key = 'r2check/roundtrip-test.sql.gz';

  try {
    await execAsync(`pg_dump "${directUrl}" | gzip > "${outputPath}"`, { timeout: 300_000 });
    const body = await fs.readFile(outputPath);
    console.log('dump bytes:', body.length);
    if (body.length < 1024) throw new Error('dump suspiciously small');

    await fileStorageService.upload(key, body);
    const head = await fileStorageService.head(key);
    console.log('head size:', head?.size);
    const back = await fileStorageService.download(key);
    console.log('downloaded bytes:', back.length, back.length === body.length ? 'MATCH' : 'MISMATCH');
    const listed = await fileStorageService.list('r2check/');
    console.log('listed:', listed);
    await fileStorageService.delete(key);
    const after = await fileStorageService.head(key);
    console.log(after === null ? 'deleted test key. ROUND TRIP OK' : 'DELETE FAILED');
  } finally {
    await fs.unlink(outputPath).catch(() => {});
  }
}

main().catch((err) => {
  console.error('FAILED:', err?.name, err?.message);
  process.exit(1);
});
