import { convertPlaceholders, PlaceholderMapping } from '../utils/docx-placeholder-converter';
import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

async function inspectAndConvert() {
  const filePath = path.join(TEMPLATES_DIR, 'system_offer_letter.docx');

  const data = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('word/document.xml')!.async('string');
  const plainText = xml.replace(/<[^>]+>/g, '');

  console.log('=== FULL OFFER LETTER PLAIN TEXT ===\n');
  console.log(plainText);
  console.log('\n=== END ===\n');

  const OFFER_MAPPINGS: PlaceholderMapping[] = [
    { find: '5D Capital Partners LLC', replace: '{{buyerCompanyName}}' },
    { find: 'Daniel Ludlow', replace: '{{buyerSignatoryName}}' },
    { find: 'Managing Director', replace: '{{buyerSignatoryTitle}}' },

    { find: 'BUSINESS NAME', replace: '{{sellerCompanyName}}' },
    { find: 'BUSINESS ADDRESS', replace: '{{sellerAddress}}' },

    { find: '04/03/2022', replace: '{{currentDate}}' },

    { find: '£8,500,000', replace: '{{offerPrice}}' },
    { find: '£4,300,000', replace: '{{excessCash}}' },
    { find: '£4,200,000', replace: '{{enterpriseValue}}' },
    { find: '£2,600,000', replace: '{{deferredTotal}}' },
    { find: '£1,600,000', replace: '{{dayOnePayment}}' },
    { find: '£520,000', replace: '{{deferredInstalment}}' },

    { find: '8,500,000', replace: '{{offerPrice}}' },
    { find: '4,300,000', replace: '{{excessCash}}' },
    { find: '4,200,000', replace: '{{enterpriseValue}}' },
    { find: '2,600,000', replace: '{{deferredTotal}}' },
    { find: '1,600,000', replace: '{{dayOnePayment}}' },
    { find: '520,000', replace: '{{deferredInstalment}}' },
  ];

  const result = await convertPlaceholders(filePath, filePath, OFFER_MAPPINGS);

  console.log(`Replacements made: ${result.replacementsMade}`);
  result.warnings.forEach(w => console.log(`  ⚠ ${w}`));

  const verifyData = await fs.readFile(filePath);
  const verifyZip = await JSZip.loadAsync(verifyData);
  const verifyXml = await verifyZip.file('word/document.xml')!.async('string');
  const verifyText = verifyXml.replace(/<[^>]+>/g, '');

  const tags = verifyText.match(/\{\{[^}]+\}\}/g) || [];
  console.log(`\n{{tags}} found in converted Offer Letter:`);
  tags.forEach(t => console.log(`  ${t}`));

  console.log('\n=== CONVERTED PLAIN TEXT ===\n');
  console.log(verifyText);
}

inspectAndConvert()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
