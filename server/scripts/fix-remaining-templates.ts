import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';
import { convertPlaceholders, PlaceholderMapping } from '../utils/docx-placeholder-converter';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

async function getRawXml(filename: string): Promise<string> {
  const data = await fs.readFile(path.join(TEMPLATES_DIR, filename));
  const zip = await JSZip.loadAsync(data);
  return zip.file('word/document.xml')!.async('string');
}

async function writeXml(filename: string, xml: string): Promise<void> {
  const filePath = path.join(TEMPLATES_DIR, filename);
  const data = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  zip.file('word/document.xml', xml);
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, outputBuffer);
}

async function fixNda() {
  console.log('=== NDA: Finding apostrophe patterns in raw XML ===\n');

  let xml = await getRawXml('system_nda.docx');

  const sellerMatches = xml.match(/.{0,100}SELLER.{0,100}/g) || [];
  console.log(`Found ${sellerMatches.length} occurrences of "SELLER" in XML:`);
  sellerMatches.forEach((m, i) => console.log(`  ${i}: ...${m.substring(0, 200)}...`));

  const theirMatches = xml.match(/.{0,100}THEIR.{0,100}/g) || [];
  console.log(`\nFound ${theirMatches.length} occurrences of "THEIR" in XML:`);
  theirMatches.forEach((m, i) => console.log(`  ${i}: ...${m.substring(0, 200)}...`));

  const tagMatches = xml.match(/\{\{[^}]+\}\}/g) || [];
  console.log(`\nExisting {{tags}} in NDA:`);
  tagMatches.forEach(t => console.log(`  ${t}`));

  const plainText = xml.replace(/<[^>]+>/g, '');
  const remaining = plainText.match(/\([A-Z][A-Z\s/&''\u2019]+\)/g) || [];
  console.log(`\nRemaining parenthetical patterns in plain text:`);
  remaining.forEach(r => console.log(`  "${r}"`));

  console.log('\n=== NDA: Attempting direct XML replacements ===\n');

  let modified = false;

  const sellerVariants = [
    "(SELLER\u2019S BUSINESS NAME)",
    "(SELLER&apos;S BUSINESS NAME)",
    "(SELLER'S BUSINESS NAME)",
    "(SELLER\u2018S BUSINESS NAME)",
    "(SELLER&#8217;S BUSINESS NAME)",
    "(SELLER&#39;S BUSINESS NAME)",
  ];

  for (const variant of sellerVariants) {
    if (xml.includes(variant)) {
      console.log(`  Found SELLER variant: "${variant}"`);
      xml = xml.split(variant).join('{{sellerCompanyName}}');
      modified = true;
      break;
    }
  }

  const compositeVariants = [
    "(YOUR BUSINESS &amp; THEIR\u2019S)",
    "(YOUR BUSINESS &amp; THEIR&apos;S)",
    "(YOUR BUSINESS &amp; THEIR'S)",
    "(YOUR BUSINESS & THEIR\u2019S)",
    "(YOUR BUSINESS & THEIR&apos;S)",
    "(YOUR BUSINESS & THEIR'S)",
    "(YOUR BUSINESS &amp; THEIR&#8217;S)",
    "(YOUR BUSINESS &amp; THEIR&#39;S)",
  ];

  for (const variant of compositeVariants) {
    if (xml.includes(variant)) {
      console.log(`  Found COMPOSITE variant: "${variant}"`);
      xml = xml.split(variant).join('{{buyerCompanyName}} &amp; {{sellerCompanyName}}');
      modified = true;
      break;
    }
  }

  if (!modified) {
    console.log('  No exact variants matched. Trying regex approach...');
    const sellerRegex = /\(SELLER['\u2019\u2018&#;0-9]*S BUSINESS NAME\)/g;
    const sellerFound = xml.match(sellerRegex);
    if (sellerFound) {
      console.log(`  Regex found SELLER pattern: "${sellerFound[0]}"`);
      xml = xml.replace(sellerRegex, '{{sellerCompanyName}}');
      modified = true;
    }

    const compositeRegex = /\(YOUR BUSINESS\s*(?:&amp;|&)\s*THEIR['\u2019\u2018&#;0-9]*S\)/g;
    const compositeFound = xml.match(compositeRegex);
    if (compositeFound) {
      console.log(`  Regex found COMPOSITE pattern: "${compositeFound[0]}"`);
      xml = xml.replace(compositeRegex, '{{buyerCompanyName}} &amp; {{sellerCompanyName}}');
      modified = true;
    }
  }

  if (modified) {
    await writeXml('system_nda.docx', xml);
    console.log('  NDA updated with remaining fixes.\n');
  } else {
    console.log('  WARNING: Could not find remaining patterns. Manual inspection needed.\n');
  }

  console.log('=== NDA: Final verification ===\n');
  const finalXml = await getRawXml('system_nda.docx');
  const finalTags = finalXml.match(/\{\{[^}]+\}\}/g) || [];
  console.log(`{{tags}} in final NDA: ${finalTags.length}`);
  finalTags.forEach(t => console.log(`  ${t}`));

  const finalPlain = finalXml.replace(/<[^>]+>/g, '');
  const finalRemaining = finalPlain.match(/\([A-Z][A-Z\s/&''\u2019]+\)/g) || [];
  if (finalRemaining.length > 0) {
    console.log(`\nStill remaining parenthetical patterns:`);
    finalRemaining.forEach(r => console.log(`  "${r}"`));
  } else {
    console.log('\nNo remaining unconverted parenthetical patterns.');
  }
}

async function convertHot() {
  console.log('\n=== HoT: Converting bracket placeholders ===\n');

  const HOT_MAPPINGS: PlaceholderMapping[] = [
    { find: '[THEIR COMPANY NAME]', replace: '{{sellerCompanyName}}' },
    { find: '[Your Company Name]', replace: '{{buyerCompanyName}}' },
    { find: '[Their Company Name]', replace: '{{sellerCompanyName}}' },
    { find: '[Their Company Directors]', replace: '{{sellerContactName}}' },
    { find: '[DATE]', replace: '{{currentDate}}' },
    { find: '[£££]', replace: '{{offerPrice}}' },
    { find: '[TBC]', replace: '{{dayOnePayment}}' },
  ];

  const hotPath = path.join(TEMPLATES_DIR, 'system_heads_of_terms.docx');
  const result = await convertPlaceholders(hotPath, hotPath, HOT_MAPPINGS);

  console.log(`HoT: ${result.replacementsMade} replacements made`);
  result.warnings.forEach(w => console.log(`  ⚠ ${w}`));

  const plainText = (await getRawXml('system_heads_of_terms.docx')).replace(/<[^>]+>/g, '');
  const tags = plainText.match(/\{\{[^}]+\}\}/g) || [];
  console.log(`\nVerification — {{tags}} found in converted HoT:`);
  tags.forEach(t => console.log(`  ${t}`));

  const remainingBrackets = plainText.match(/\[[^\]]+\]/g) || [];
  if (remainingBrackets.length > 0) {
    console.log(`\nRemaining [bracket] patterns:`);
    remainingBrackets.forEach(r => console.log(`  ${r}`));
  } else {
    console.log('\nNo remaining [bracket] patterns.');
  }
}

async function main() {
  await fixNda();
  await convertHot();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
