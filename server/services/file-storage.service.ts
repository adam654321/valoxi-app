import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) throw new Error('[FILE_STORAGE] R2_ACCOUNT_ID env var not set');
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    console.log(`[FILE_STORAGE] Initialised R2 client for account: ${accountId}`);
  }
  return s3Client;
}

const BUCKET = process.env.R2_BUCKET_NAME ?? 'valoxi-documents';

export const fileStorageService = {
  generateKey(prefix: string, filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1_000_000_000);
    return `${prefix}/doc-${timestamp}-${random}${ext}`;
  },

  isObjectStorageKey(filePath: string): boolean {
    return !filePath.startsWith('/home/') && !filePath.startsWith('C:\\') && !filePath.startsWith('uploads/');
  },

  async upload(key: string, buffer: Buffer): Promise<void> {
    const client = getClient();
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
    }));
    console.log(`[FILE_STORAGE] Uploaded to R2: ${key}`);
  },

  async download(key: string): Promise<Buffer> {
    const client = getClient();
    const response = await client.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    const stream = response.Body;
    if (!stream) throw new Error(`[FILE_STORAGE] Empty response body for key: ${key}`);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },

  async delete(key: string): Promise<void> {
    if (key.startsWith('/home/') || key.startsWith('uploads/') || key.startsWith('.private/')) {
      console.log(`[FILE_STORAGE] Skipping delete for non-R2 path: ${key}`);
      return;
    }
    try {
      const client = getClient();
      await client.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }));
      console.log(`[FILE_STORAGE] Deleted from R2: ${key}`);
    } catch (err) {
      console.error(`[FILE_STORAGE] Delete failed for key ${key}:`, err);
    }
  },
};
