/**
 * TIER 1 PHASE 2 — R2 wipe script
 *
 * Permanently deletes R2 objects from the production bucket (valoxi-documents)
 * that belong to non-kept user companies.
 *
 * Kept user_company IDs: 5, 11, 13
 * Authorised by Adam prior to execution.
 *
 * DO NOT RUN without explicit authorisation.
 */

import { pool } from '../db';
import { fileStorageService } from '../services/file-storage.service';

const KEPT_COMPANY_IDS = [5, 11, 13];
const EXPECTED_DELETE_COUNT = 515;
const EXPECTED_TOLERANCE = 5;

function isR2Key(path: string | null): boolean {
  if (!path) return false;
  return (
    !path.startsWith('/home/') &&
    !path.startsWith('C:\\') &&
    !path.startsWith('uploads/')
  );
}

async function buildKeySet(label: string, query: string): Promise<Set<string>> {
  const result = await pool.query(query);
  const keys = new Set<string>();
  for (const row of result.rows) {
    const val: string | null = row.r2_key;
    if (isR2Key(val)) keys.add(val!);
  }
  console.log(`  [${label}] ${keys.size} R2 keys`);
  return keys;
}

function maskEnv(val: string | undefined): string {
  if (!val) return '(not set)';
  if (val.length <= 8) return '****';
  return `${val.slice(0, 4)}...${val.slice(-4)}`;
}

async function main() {
  console.log('=== TIER 1 PHASE 2 — R2 WIPE ===\n');

  // Startup credential log — operator must eyeball these before proceeding
  console.log('--- R2 CREDENTIALS (masked) ---');
  console.log(`R2_ACCOUNT_ID:    ${maskEnv(process.env.R2_ACCOUNT_ID)}`);
  console.log(`R2_ACCESS_KEY_ID: ${maskEnv(process.env.R2_ACCESS_KEY_ID)}`);
  console.log(`R2_BUCKET_NAME:   ${process.env.R2_BUCKET_NAME ?? 'valoxi-documents'}`);
  console.log(`Kept user_company IDs: ${KEPT_COMPANY_IDS.join(', ')}\n`);

  // ── Step 1: Build to-delete key set ─────────────────────────────────────────
  console.log('Building to-delete R2 key set from live DB...');

  const deleteDocs = await buildKeySet('documents', `
    SELECT file_path AS r2_key
    FROM documents
    WHERE target_company_id IN (
      SELECT id FROM target_companies WHERE user_company_id NOT IN (5,11,13)
    )
    AND file_path IS NOT NULL
    AND file_path NOT LIKE '/home/%'
    AND file_path NOT LIKE 'uploads/%'
  `);

  const deleteExt = await buildKeySet('external_document_submissions', `
    SELECT file_path AS r2_key
    FROM external_document_submissions
    WHERE target_company_id IN (
      SELECT id FROM target_companies WHERE user_company_id NOT IN (5,11,13)
    )
    AND file_path IS NOT NULL
    AND file_path NOT LIKE '/home/%'
    AND file_path NOT LIKE 'uploads/%'
  `);

  const deleteDeal = await buildKeySet('deal_documents', `
    SELECT generated_file_url AS r2_key
    FROM deal_documents
    WHERE user_company_id NOT IN (5,11,13)
    AND generated_file_url IS NOT NULL
    AND generated_file_url NOT LIKE '/home/%'
    AND generated_file_url NOT LIKE 'uploads/%'
  `);

  const deleteUploads = await buildKeySet('file_upload_events', `
    SELECT file_url AS r2_key
    FROM file_upload_events
    WHERE target_company_id IN (
      SELECT id FROM target_companies WHERE user_company_id NOT IN (5,11,13)
    )
    AND file_url IS NOT NULL
    AND file_url NOT LIKE '/home/%'
    AND file_url NOT LIKE 'uploads/%'
  `);

  const toDelete = new Set<string>([
    ...deleteDocs,
    ...deleteExt,
    ...deleteDeal,
    ...deleteUploads,
  ]);

  console.log(`\nTo-delete set (deduped): ${toDelete.size} keys`);

  // ── Step 2: Build kept key set ───────────────────────────────────────────────
  console.log('\nBuilding kept R2 key set for safety check...');

  const keptDocs = await buildKeySet('documents [kept]', `
    SELECT file_path AS r2_key
    FROM documents
    WHERE target_company_id IN (
      SELECT id FROM target_companies WHERE user_company_id IN (5,11,13)
    )
    AND file_path IS NOT NULL
    AND file_path NOT LIKE '/home/%'
    AND file_path NOT LIKE 'uploads/%'
  `);

  const keptExt = await buildKeySet('external_document_submissions [kept]', `
    SELECT file_path AS r2_key
    FROM external_document_submissions
    WHERE target_company_id IN (
      SELECT id FROM target_companies WHERE user_company_id IN (5,11,13)
    )
    AND file_path IS NOT NULL
    AND file_path NOT LIKE '/home/%'
    AND file_path NOT LIKE 'uploads/%'
  `);

  const keptDeal = await buildKeySet('deal_documents [kept]', `
    SELECT generated_file_url AS r2_key
    FROM deal_documents
    WHERE user_company_id IN (5,11,13)
    AND generated_file_url IS NOT NULL
    AND generated_file_url NOT LIKE '/home/%'
    AND generated_file_url NOT LIKE 'uploads/%'
  `);

  const keptUploads = await buildKeySet('file_upload_events [kept]', `
    SELECT file_url AS r2_key
    FROM file_upload_events
    WHERE target_company_id IN (
      SELECT id FROM target_companies WHERE user_company_id IN (5,11,13)
    )
    AND file_url IS NOT NULL
    AND file_url NOT LIKE '/home/%'
    AND file_url NOT LIKE 'uploads/%'
  `);

  const keptSet = new Set<string>([
    ...keptDocs,
    ...keptExt,
    ...keptDeal,
    ...keptUploads,
  ]);

  console.log(`Kept set (deduped): ${keptSet.size} keys`);

  // ── Step 3: Safety check — intersection must be zero ─────────────────────────
  console.log('\n--- SAFETY CHECK ---');
  const overlap = [...toDelete].filter(k => keptSet.has(k));
  if (overlap.length > 0) {
    console.error(`ABORT: intersection of to-delete and kept sets is non-zero (${overlap.length} keys):`);
    overlap.forEach(k => console.error(`  OVERLAP: ${k}`));
    process.exit(1);
  }
  console.log(`Intersection: 0 — CLEAR\n`);

  // ── Step 4: Count sanity check ───────────────────────────────────────────────
  console.log(`--- COUNT CHECK ---`);
  console.log(`Expected: ~${EXPECTED_DELETE_COUNT} (±${EXPECTED_TOLERANCE})`);
  console.log(`Actual:    ${toDelete.size}`);
  if (Math.abs(toDelete.size - EXPECTED_DELETE_COUNT) > EXPECTED_TOLERANCE) {
    console.error(`ABORT: to-delete count (${toDelete.size}) differs from expected (${EXPECTED_DELETE_COUNT}) by more than ${EXPECTED_TOLERANCE}.`);
    process.exit(1);
  }
  console.log(`Count within tolerance — CLEAR\n`);

  // ── Step 5: Delete ───────────────────────────────────────────────────────────
  console.log(`--- DELETING ${toDelete.size} R2 OBJECTS ---\n`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  const failedKeys: string[] = [];

  const keys = [...toDelete];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    // Determine skip/delete BEFORE calling the service.
    // fileStorageService.delete() silently returns void for non-R2 paths,
    // so we cannot infer skipped vs succeeded from its return value.
    if (!fileStorageService.isObjectStorageKey(key)) {
      skipped++;
      console.warn(`  SKIPPED [${i + 1}]: not an R2 key — ${key}`);
    } else {
      try {
        await fileStorageService.delete(key);
        succeeded++;
      } catch (err: any) {
        failed++;
        failedKeys.push(key);
        console.error(`  FAILED [${i + 1}]: ${key} — ${err?.message ?? err}`);
      }
    }

    if ((i + 1) % 25 === 0 || i + 1 === keys.length) {
      console.log(`  Progress: ${i + 1}/${keys.length} — succeeded: ${succeeded}, skipped: ${skipped}, failed: ${failed}`);
    }
  }

  // ── Step 6: Summary ──────────────────────────────────────────────────────────
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Attempted:  ${keys.length}`);
  console.log(`Succeeded:  ${succeeded}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Failed:     ${failed}`);

  if (failedKeys.length > 0) {
    console.log('\nFailed keys:');
    failedKeys.forEach(k => console.log(`  - ${k}`));
  }

  await pool.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
