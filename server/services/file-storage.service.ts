import { Client } from '@replit/object-storage';
import path from 'path';

let storageClient: Client | null = null;

function getClient(): Client {
  if (!storageClient) {
    storageClient = new Client();
    (storageClient as any).state?.promise?.catch?.(() => {});
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
    if (!result.ok) throw new Error(`Object storage upload failed: ${result.error}`);
  },

  async download(key: string): Promise<Buffer> {
    const result = await getClient().downloadAsBytes(key);
    if (!result.ok) throw new Error(`Object storage download failed: ${result.error}`);
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
