import path from 'path';


export function sanitizeFilename(filename: string): string {
  let name = path.basename(filename);

  name = name.replace(/\0/g, '');
  name = name.replace(/[\x00-\x1f]/g, '');

  name = name.replace(/\.\.\//g, '');
  name = name.replace(/\.\//g, '');
  name = name.replace(/[\\\/]/g, '');

  name = name.replace(/["'\r\n]/g, '');

  name = name.trim();

  if (name.length > 255) {
    const ext = path.extname(name);
    name = name.slice(0, 255 - ext.length) + ext;
  }

  if (!name || name === '.' || name === '..') {
    name = 'unnamed-file';
  }

  return name;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
  'application/vnd.apple.numbers',
  'application/vnd.apple.pages',
  'application/vnd.apple.keynote',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'application/octet-stream',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx',
  'txt', 'csv', 'tsv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
  'numbers', 'pages', 'key', 'odt', 'ods', 'odp', 'rtf',
]);

export function isAllowedFile(filename: string, mimetype: string): boolean {
  const ext = filename?.toLowerCase()?.split('.').pop() || '';
  return ALLOWED_MIME_TYPES.has(mimetype) && ALLOWED_EXTENSIONS.has(ext);
}



