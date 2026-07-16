/**
 * #247 Document Restore Script
 *
 * Restores documents rows for a single wiped target company by re-reading
 * R2 objects under companies/{tc}/ and inserting new documents rows.
 *
 * Usage:
 *   DATABASE_URL="$PROD_DATABASE_URL" npx tsx scripts/restore-wiped-documents.ts --company <tc_id>
 *   DATABASE_URL="$PROD_DATABASE_URL" npx tsx scripts/restore-wiped-documents.ts --company <tc_id> --execute
 *
 * Dry-run (default): prints the full proposed insert table. No DB writes.
 * --execute: inserts in one transaction, then verifies each row with R2 HEAD.
 */

import pg from 'pg';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

const { Pool } = pg;

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const companyIdx = args.indexOf('--company');
if (companyIdx === -1 || !args[companyIdx + 1]) {
  console.error('ERROR: --company <tc_id> is required');
  process.exit(1);
}
const TC_ID = parseInt(args[companyIdx + 1], 10);
if (isNaN(TC_ID)) {
  console.error(`ERROR: --company value "${args[companyIdx + 1]}" is not a valid integer`);
  process.exit(1);
}

// ─── DB ──────────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('ERROR: DATABASE_URL is not set'); process.exit(1); }

let dbHostDisplay = '(unparseable)';
try {
  const u = new URL(DB_URL.replace(/^postgres(ql)?:\/\//, 'http://'));
  dbHostDisplay = u.hostname;
} catch { /* keep default */ }

const pool = new Pool({ connectionString: DB_URL });

// ─── R2 ──────────────────────────────────────────────────────────────────────
const R2_ACCOUNT_ID  = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET      = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET      = process.env.R2_BUCKET_NAME ?? 'valoxi-documents';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET) {
  console.error('ERROR: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are required');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sep(ch = '─', n = 70) { return ch.repeat(n); }

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function parseKeyTimestamp(key: string): Date | null {
  // key format: companies/{tc}/doc-{epoch_ms}-{random}.{ext}
  const m = path.basename(key).match(/^doc-(\d+)-/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10));
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── R2 operations ───────────────────────────────────────────────────────────
async function listObjectsForTc(tc: number): Promise<{ key: string; r2Size: number }[]> {
  const prefix = `companies/${tc}/`;
  const objects: { key: string; r2Size: number }[] = [];
  let token: string | undefined;
  do {
    const resp = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of resp.Contents ?? []) {
      if (obj.Key) objects.push({ key: obj.Key, r2Size: obj.Size ?? 0 });
    }
    token = resp.NextContinuationToken;
  } while (token);
  return objects;
}

async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const resp = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return {
      size: resp.ContentLength ?? 0,
      contentType: resp.ContentType ?? 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(sep('═'));
  console.log(`  #247 DOCUMENT RESTORE — tc=${TC_ID}  mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(sep('═'));
  console.log(`  DB host : ${dbHostDisplay}`);
  console.log(`  R2 bucket: ${R2_BUCKET}`);
  console.log('');

  // ── 1. Resolve tc → user_company → admin user ──────────────────────────────
  const tcRow = await pool.query<{ user_company_id: number; company_name: string }>(
    `SELECT user_company_id, company_name FROM target_companies WHERE id = $1`, [TC_ID]
  );
  if (tcRow.rowCount === 0) {
    console.error(`ERROR: tc=${TC_ID} not found in target_companies`);
    process.exit(1);
  }
  const { user_company_id: UC_ID, company_name: COMPANY_NAME } = tcRow.rows[0];

  const adminRow = await pool.query<{ id: number; email: string; first_name: string; last_name: string }>(
    `SELECT id, email, first_name, last_name
     FROM users
     WHERE user_company_id = $1 AND is_company_admin = true
     ORDER BY id ASC LIMIT 1`,
    [UC_ID]
  );
  if (adminRow.rowCount === 0) {
    console.error(`ERROR: no is_company_admin=true user found for uc=${UC_ID}`);
    process.exit(1);
  }
  const admin = adminRow.rows[0];
  const ADMIN_NAME = `${admin.first_name} ${admin.last_name}`;

  console.log(`  Company : ${COMPANY_NAME} (tc=${TC_ID}, uc=${UC_ID})`);
  console.log(`  uploaded_by resolved → user id=${admin.id}  (${ADMIN_NAME} <${admin.email}>)`);
  console.log('');

  // ── 2. List R2 objects ─────────────────────────────────────────────────────
  console.log(`  Listing R2 objects under companies/${TC_ID}/ …`);
  const r2Objects = await listObjectsForTc(TC_ID);
  if (r2Objects.length === 0) {
    console.log(`  No R2 objects found. Nothing to restore.`);
    await pool.end();
    return;
  }
  console.log(`  Found ${r2Objects.length} R2 object(s)`);
  console.log('');

  // ── 3. Idempotency check ───────────────────────────────────────────────────
  const existingRes = await pool.query<{ file_path: string }>(
    `SELECT file_path FROM documents WHERE target_company_id = $1`, [TC_ID]
  );
  const existingPaths = new Set(existingRes.rows.map(r => r.file_path));

  // ── 4. Detect size-based duplicates within this tc ─────────────────────────
  const sizeMap = new Map<number, string[]>();
  for (const obj of r2Objects) {
    const group = sizeMap.get(obj.r2Size) ?? [];
    group.push(obj.key);
    sizeMap.set(obj.r2Size, group);
  }
  function dupFlag(key: string, size: number): string {
    const group = sizeMap.get(size) ?? [];
    if (group.length < 2) return '';
    const others = group.filter(k => k !== key);
    return `[possible duplicate of ${others.map(k => path.basename(k)).join(', ')}]`;
  }

  // ── 5. Build insert records ────────────────────────────────────────────────
  console.log(`  Running HEAD on each object for Content-Type …`);
  console.log('');

  type InsertRecord = {
    key: string;
    alreadyPresent: boolean;
    fileSize: number;
    fileType: string;
    uploadDate: Date;
    documentName: string;
    originalFilename: string;
    dupNote: string;
  };

  const toInsert: InsertRecord[] = [];
  let presentCount = 0;
  let objectIndex = 0;

  for (const obj of r2Objects) {
    objectIndex++;

    if (existingPaths.has(obj.key)) {
      presentCount++;
      toInsert.push({
        key: obj.key,
        alreadyPresent: true,
        fileSize: obj.r2Size,
        fileType: '',
        uploadDate: parseKeyTimestamp(obj.key) ?? new Date(),
        documentName: '',
        originalFilename: path.basename(obj.key),
        dupNote: '',
      });
      continue;
    }

    const head = await headObject(obj.key);
    const fileSize = head?.size ?? obj.r2Size;
    const fileType = head?.contentType ?? 'application/octet-stream';
    const uploadDate = parseKeyTimestamp(obj.key) ?? new Date();
    const dup = dupFlag(obj.key, obj.r2Size);

    toInsert.push({
      key: obj.key,
      alreadyPresent: false,
      fileSize,
      fileType,
      uploadDate,
      documentName: '', // filled below once we know total non-present count
      originalFilename: path.basename(obj.key),
      dupNote: dup,
    });
  }

  // Assign sequential names only to non-present records, ordered by timestamp
  const newRecords = toInsert.filter(r => !r.alreadyPresent);
  newRecords.sort((a, b) => a.uploadDate.getTime() - b.uploadDate.getTime());
  const m = newRecords.length;
  newRecords.forEach((r, idx) => {
    r.documentName = `Restored document — ${fmtDate(r.uploadDate)} (${idx + 1} of ${m})`;
  });

  // ── 6. Print full table ────────────────────────────────────────────────────
  console.log(sep());
  console.log(`  OBJECT LISTING  (${r2Objects.length} total, ${presentCount} already-present, ${m} to restore)`);
  console.log(sep());
  console.log(
    `  ${'#'.padEnd(3)} ${'KEY BASENAME'.padEnd(44)} ${'SIZE'.padStart(10)}  ${'TYPE'.padEnd(28)}  ${'TIMESTAMP'.padEnd(20)}  NOTES`
  );
  console.log(sep());

  let rowN = 0;
  for (const r of toInsert) {
    rowN++;
    const basename = path.basename(r.key).slice(0, 42);
    const size = fmtBytes(r.fileSize).padStart(10);
    const type = (r.fileType || '—').slice(0, 26).padEnd(28);
    const ts = r.alreadyPresent ? '—'.padEnd(20) : r.uploadDate.toISOString().slice(0, 19).padEnd(20);
    const note = r.alreadyPresent
      ? 'ALREADY-PRESENT'
      : (r.dupNote ? `proposed: "${r.documentName}"  ${r.dupNote}` : `proposed: "${r.documentName}"`);
    console.log(`  ${String(rowN).padEnd(3)} ${basename.padEnd(44)} ${size}  ${type}  ${ts}  ${note}`);
  }
  console.log(sep());
  console.log('');

  if (m === 0) {
    console.log(`  All ${presentCount} object(s) already present in documents table. Nothing to insert.`);
    await pool.end();
    return;
  }

  if (!EXECUTE) {
    console.log(`  DRY-RUN complete. ${m} row(s) would be inserted. Pass --execute to apply.`);
    await pool.end();
    return;
  }

  // ── 7. Execute: insert in one transaction ─────────────────────────────────
  console.log(`  [EXECUTE] Inserting ${m} row(s) in a single transaction …`);
  const client = await pool.connect();
  const createdIds: { id: number; key: string }[] = [];

  try {
    await client.query('BEGIN');

    for (const r of newRecords) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO documents
           (target_company_id, uploaded_by, document_name, original_filename,
            file_path, file_size, file_type, document_category,
            is_confidential, upload_date, created_at, public_token)
         VALUES
           ($1, $2, $3, $4,
            $5, $6, $7, 'Restored',
            true, $8, $8, gen_random_uuid())
         RETURNING id`,
        [
          TC_ID, admin.id, r.documentName, r.originalFilename,
          r.key, r.fileSize, r.fileType,
          r.uploadDate,
        ]
      );
      createdIds.push({ id: res.rows[0].id, key: r.key });
    }

    await client.query('COMMIT');
    console.log(`  [EXECUTE] Transaction committed. ${createdIds.length} row(s) inserted.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  [EXECUTE] ROLLBACK — error during insert:`, err);
    client.release();
    await pool.end();
    process.exit(1);
  }
  client.release();

  // ── 8. Post-execute R2 HEAD verification ──────────────────────────────────
  console.log('');
  console.log(sep());
  console.log('  POST-EXECUTE R2 HEAD VERIFICATION');
  console.log(sep());

  let okCount = 0; let missingCount = 0;
  for (const { id, key } of createdIds) {
    const head = await headObject(key);
    if (head) {
      console.log(`  documents.id=${id}  ${path.basename(key)}  → OK (${fmtBytes(head.size)})`);
      okCount++;
    } else {
      console.log(`  documents.id=${id}  ${path.basename(key)}  → MISSING (R2 HEAD returned null)`);
      missingCount++;
    }
  }

  console.log(sep());
  console.log(`  VERIFY: ${okCount} OK, ${missingCount} MISSING`);
  console.log('');

  await pool.end();
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
