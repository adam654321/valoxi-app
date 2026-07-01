import * as XLSX from 'xlsx';

const SPREADSHEET_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',                                          // xls
  'application/vnd.ms-excel.sheet.macroEnabled.12',                   // xlsm
];

export function isSpreadsheetMimeType(mimeType: string): boolean {
  return SPREADSHEET_MIME_TYPES.includes(mimeType);
}

/**
 * Convert a spreadsheet (xlsx/xls/xlsm) buffer to plain text for embedding in a
 * Gemini prompt. Each sheet is serialised as CSV with a sheet-name header and
 * blank cells preserved as empty fields, so hierarchical/accounting reports keep
 * their row structure. Gemini reads this as text, avoiding the unsupported
 * binary-MIME rejection.
 */
export function convertSpreadsheetToText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    // blankrows:true and defval:'' keep row positions and empty cells, which
    // matters for reports where structure is implied by layout.
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: true });
    parts.push(`--- SHEET: ${sheetName} ---\n${csv}`);
  }
  if (parts.length === 0) {
    return `[Spreadsheet ${fileName} contained no readable sheets]`;
  }
  return parts.join('\n\n');
}
