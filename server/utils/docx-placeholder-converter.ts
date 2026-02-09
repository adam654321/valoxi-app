import JSZip from 'jszip';
import fs from 'fs/promises';

export async function extractDocxText(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('No word/document.xml found in docx');

  const text = documentXml
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<w:p[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:tab[^>]*\/>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

export interface ReplacementRule {
  pattern: string | RegExp;
  replacement: string;
}

export async function replaceInDocx(
  inputPath: string,
  outputPath: string,
  rules: ReplacementRule[]
): Promise<{ replacementsMade: number; warnings: string[] }> {
  const data = await fs.readFile(inputPath);
  const zip = await JSZip.loadAsync(data);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('No word/document.xml found in docx');

  let modified = documentXml;
  let totalReplacements = 0;
  const warnings: string[] = [];

  for (const rule of rules) {
    const before = modified;
    if (typeof rule.pattern === 'string') {
      const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      modified = modified.replace(regex, rule.replacement);
    } else {
      modified = modified.replace(rule.pattern, rule.replacement);
    }
    const changed = before !== modified;
    if (changed) {
      totalReplacements++;
    } else {
      warnings.push(`Pattern not found: ${rule.pattern}`);
    }
  }

  zip.file('word/document.xml', modified);
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, outputBuffer);

  return { replacementsMade: totalReplacements, warnings };
}
