import { extractDocxText, convertPlaceholders, PlaceholderMapping } from '../utils/docx-placeholder-converter';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

const NDA_MAPPINGS: PlaceholderMapping[] = [
  { find: "(YOUR BUSINESS & THEIR'S)", replace: '{{buyerCompanyName}} & {{sellerCompanyName}}' },
  { find: "(YOUR BUSINESS)", replace: '{{buyerCompanyName}}' },
  { find: "(SELLER'S BUSINESS NAME)", replace: '{{sellerCompanyName}}' },
  { find: "(COMPANY)", replace: '{{sellerCompanyName}}' },
  { find: "(DATE)", replace: '{{currentDate}}' },
  { find: "(PRODUCT/SERVICE)", replace: '{{productOrService}}' },
];

async function convertAll() {
  console.log('=== STEP 1: Inspect Offer Letter ===\n');
  const offerText = await extractDocxText(path.join(TEMPLATES_DIR, 'system_offer_letter.docx'));
  console.log(offerText);
  console.log('\n=== END OFFER LETTER ===\n');

  console.log('=== STEP 2: Inspect Heads of Terms ===\n');
  const hotText = await extractDocxText(path.join(TEMPLATES_DIR, 'system_heads_of_terms.docx'));
  console.log(hotText.substring(0, 6000));
  console.log('\n=== END HOT (first 6000 chars) ===\n');

  const hotPatterns = hotText.match(/\[[A-Z][A-Z\s/'£,.\d]+\]/g) || [];
  const hotParenPatterns = hotText.match(/\([A-Z][A-Z\s/']+\)/g) || [];
  console.log('HoT square bracket patterns:');
  Array.from(new Set(hotPatterns)).forEach(p => console.log(`  ${p}`));
  console.log('HoT parenthetical patterns:');
  Array.from(new Set(hotParenPatterns)).forEach(p => console.log(`  ${p}`));

  console.log('\n=== STEP 3: Convert NDA ===\n');

  const ndaPath = path.join(TEMPLATES_DIR, 'system_nda.docx');
  const ndaResult = await convertPlaceholders(ndaPath, ndaPath, NDA_MAPPINGS);
  console.log(`\nNDA: ${ndaResult.replacementsMade} replacements made`);
  ndaResult.warnings.forEach(w => console.log(`  ⚠ ${w}`));

  console.log('\n=== STEP 4: Verify NDA ===\n');
  const verifyText = await extractDocxText(ndaPath);
  const tags = verifyText.match(/\{\{[^}]+\}\}/g) || [];
  console.log(`{{tags}} found in converted NDA: ${tags.length}`);
  tags.forEach(t => console.log(`  ${t}`));

  const remaining = verifyText.match(/\([A-Z][A-Z\s/']+\)/g) || [];
  if (remaining.length > 0) {
    console.log(`\nRemaining unconverted parenthetical patterns:`);
    remaining.forEach(r => console.log(`  ${r}`));
  } else {
    console.log('\nNo remaining unconverted parenthetical patterns.');
  }
}

convertAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
