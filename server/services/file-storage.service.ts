import fs from 'fs';
import path from 'path';

export const fileStorageService = {
  generateKey(prefix: string, originalFilename: string): string {
    const ext = path.extname(originalFilename) || '';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = `doc-${uniqueSuffix}${ext}`;
    return path.join('uploads', prefix, safeName);
  },

  async upload(key: string, buffer: Buffer): Promise<void> {
    await fs.promises.mkdir(path.dirname(key), { recursive: true });
    await fs.promises.writeFile(key, buffer);
  },

  async download(key: string): Promise<Buffer> {
    return fs.promises.readFile(key);
  },

  async delete(key: string): Promise<void> {
    try {
      if (!key) return;
      await fs.promises.unlink(key);
    } catch {
    }
  },

  isObjectStorageKey(filePath: string): boolean {
    return filePath.startsWith('.private/');
  },
};
