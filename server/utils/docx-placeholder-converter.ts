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

export interface PlaceholderMapping {
  find: string;
  replace: string;
}

/**
 * Merge all <w:t> text within each <w:p> paragraph into a single <w:r> run,
 * preserving the formatting of the first run. This ensures placeholders that
 * Word has split across multiple runs can be found and replaced as plain text.
 */
function mergeRunsInParagraphs(xml: string): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    const runs = Array.from(paragraph.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g));
    if (runs.length <= 1) return paragraph;

    let combinedText = '';
    let firstRunWithText: string | null = null;

    for (const runMatch of runs) {
      const run = runMatch[0];
      const textMatch = run.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
      if (textMatch) {
        combinedText += textMatch[1];
        if (!firstRunWithText) {
          firstRunWithText = run;
        }
      }
    }

    if (!firstRunWithText || !combinedText) return paragraph;

    const mergedRun = firstRunWithText.replace(
      /<w:t[^>]*>[\s\S]*?<\/w:t>/,
      `<w:t xml:space="preserve">${combinedText}</w:t>`
    );

    let result = paragraph;
    let replacedFirst = false;
    for (const runMatch of runs) {
      const run = runMatch[0];
      const hasText = /<w:t[^>]*>/.test(run);
      if (hasText) {
        if (!replacedFirst) {
          result = result.replace(run, mergedRun);
          replacedFirst = true;
        } else {
          result = result.replace(run, '');
        }
      }
    }

    return result;
  });
}

export async function convertPlaceholders(
  inputPath: string,
  outputPath: string,
  mappings: PlaceholderMapping[]
): Promise<{ replacementsMade: number; warnings: string[] }> {
  const data = await fs.readFile(inputPath);
  const zip = await JSZip.loadAsync(data);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('No word/document.xml found in docx');

  let modified = mergeRunsInParagraphs(documentXml);
  let totalReplacements = 0;
  const warnings: string[] = [];

  for (const mapping of mappings) {
    const escapedFind = mapping.find
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;');

    const escapedReplace = mapping.replace
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;');

    const rawRegex = new RegExp(
      mapping.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g'
    );
    const xmlRegex = new RegExp(
      escapedFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g'
    );

    const before = modified;
    modified = modified.replace(xmlRegex, escapedReplace);
    modified = modified.replace(rawRegex, mapping.replace);

    if (modified !== before) {
      const countRaw = (before.match(rawRegex) || []).length;
      const countXml = (before.match(xmlRegex) || []).length;
      const total = Math.max(countRaw, countXml);
      totalReplacements += total;
      console.log(`  ✓ "${mapping.find}" → "${mapping.replace}" (${total} occurrence${total !== 1 ? 's' : ''})`);
    } else {
      warnings.push(`Pattern not found in XML: "${mapping.find}"`);
    }
  }

  zip.file('word/document.xml', modified);
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, outputBuffer);

  return { replacementsMade: totalReplacements, warnings };
}
