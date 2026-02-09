import { extractDocxText } from '../utils/docx-placeholder-converter';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

async function inspectNdaTemplate() {
  const ndaPath = path.join(TEMPLATES_DIR, 'system_nda.docx');

  console.log('=== NDA TEMPLATE PLAIN TEXT PREVIEW ===\n');

  const text = await extractDocxText(ndaPath);
  console.log(text);

  console.log('\n=== END OF PREVIEW ===\n');

  console.log('=== POTENTIAL PLACEHOLDER PATTERNS ===\n');
  const patterns = [
    /\(YOUR BUSINESS[^)]*\)/gi,
    /\(YOUR COMPANY[^)]*\)/gi,
    /\(THEIR[^)]*\)/gi,
    /\(SELLER[^)]*\)/gi,
    /\(BUYER[^)]*\)/gi,
    /\(COMPANY[^)]*\)/gi,
    /\(DATE[^)]*\)/gi,
    /\(PRODUCT\/SERVICE[^)]*\)/gi,
    /\[YOUR [^\]]*\]/gi,
    /\[THEIR [^\]]*\]/gi,
    /\[COMPANY[^\]]*\]/gi,
    /\[DATE[^\]]*\]/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      console.log(`  Pattern ${pattern}:`);
      for (const match of matches) {
        console.log(`    Found: "${match}"`);
      }
    }
  }
}

inspectNdaTemplate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
