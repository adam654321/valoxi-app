import { Client } from '@replit/object-storage';
import path from 'path';

let storageClient: Client | null = null;

function getClient(): Client {
  if (!storageClient) {
    const privateDir = process.env.PRIVATE_OBJECT_DIR ?? '';
    const bucketId = privateDir.split('/')[1] ?? undefined;
    storageClient = bucketId ? new Client({ bucketId }) : new Client();
    console.log(`[FILE_STORAGE] Initialised object storage client, bucketId: ${bucketId ?? 'default'}`);
  }
  return storageClient;
}

export const fileStorageService = {
  generateKey(prefix: string, originalFilename: string): string {
    const ext = path.extname(originalFilename) || '';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = `doc-${uniqueSuffix}${ext}`;
    return `.private/${prefix}/${safeName}`;
  },

  async upload(key: string, buffer: Buffer): Promise<void> {
    const result = await getClient().uploadFromBytes(key, buffer);
    if (!result.ok) throw new Error(`Object storage upload failed: ${JSON.stringify(result.error)}`);
  },

  async download(key: string): Promise<Buffer> {
    const result = await getClient().downloadAsBytes(key);
    if (!result.ok) throw new Error(`Object storage download failed: ${JSON.stringify(result.error)}`);
    return result.value[0];
  },

  async delete(key: string): Promise<void> {
    try {
      if (!key || !key.startsWith('.private/')) return;
      await getClient().delete(key);
    } catch {
    }
  },

  isObjectStorageKey(filePath: string): boolean {
    return filePath.startsWith('.private/');
  },
};
