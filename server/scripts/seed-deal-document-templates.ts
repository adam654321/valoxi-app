import { db } from '../db';
import { dealDocumentTemplates } from '@shared/schema/deal-documents';
import { eq, and } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

interface TemplateConfig {
  templateName: string;
  documentType: string;
  sourceFile: string;
  placeholderMap: Record<string, string>;
  sections?: Array<{ key: string; label: string; required: boolean }>;
}

const TEMPLATES: TemplateConfig[] = [
  {
    templateName: 'Standard NDA',
    documentType: 'nda',
    sourceFile: 'NDA_.docx',
    placeholderMap: {
      'buyerCompanyName': 'buyerCompanyName',
      'sellerCompanyName': 'sellerCompanyName',
      'sellerCompanyNumber': 'sellerCompanyNumber',
      'sellerAddress': 'sellerAddress',
      'currentDate': 'currentDate',
      'buyerSignatoryName': 'buyerSignatoryName',
    },
  },
  {
    templateName: 'Standard Offer Letter',
    documentType: 'offer_letter',
    sourceFile: 'Offer_Letter.docx',
    placeholderMap: {
      'buyerCompanyName': 'buyerCompanyName',
      'sellerCompanyName': 'sellerCompanyName',
      'sellerContactName': 'sellerContactName',
      'sellerAddress': 'sellerAddress',
      'currentDate': 'currentDate',
      'buyerSignatoryName': 'buyerSignatoryName',
      'averageEbitda': 'averageEbitda',
      'ebitdaMultiple': 'ebitdaMultiple',
      'enterpriseValue': 'enterpriseValue',
      'offerPrice': 'offerPrice',
      'propertyValue': 'propertyValue',
      'excessCash': 'excessCash',
      'primaryDebt': 'primaryDebt',
      'otherDebt': 'otherDebt',
      'corpTaxDue': 'corpTaxDue',
      'workingCapitalAdj': 'workingCapitalAdj',
      'dayOnePayment': 'dayOnePayment',
      'deferredTotal': 'deferredTotal',
    },
  },
  {
    templateName: 'Standard Heads of Terms',
    documentType: 'heads_of_terms',
    sourceFile: 'HOT_Including_Indemnity_Letter_Template__3_.docx',
    placeholderMap: {
      'buyerCompanyName': 'buyerCompanyName',
      'sellerCompanyName': 'sellerCompanyName',
      'sellerContactName': 'sellerContactName',
      'sellerAddress': 'sellerAddress',
      'currentDate': 'currentDate',
      'buyerSignatoryName': 'buyerSignatoryName',
      'offerPrice': 'offerPrice',
      'dayOnePayment': 'dayOnePayment',
      'deferredTotal': 'deferredTotal',
      'exclusivityPeriodDays': 'exclusivityPeriodDays',
      'nonCompetePeriodYears': 'nonCompetePeriodYears',
      'nonSolicitPeriodYears': 'nonSolicitPeriodYears',
      'warrantyClaimPeriodMonths': 'warrantyClaimPeriodMonths',
      'warrantyMinClaim': 'warrantyMinClaim',
    },
    sections: [
      { key: 'proposed_acquisition', label: 'The Proposed Acquisition', required: true },
      { key: 'price', label: 'Price', required: true },
      { key: 'assumptions', label: 'Assumptions', required: false },
      { key: 'conditions', label: 'Conditions', required: false },
      { key: 'due_diligence', label: 'Due Diligence', required: true },
      { key: 'share_purchase_agreement', label: 'Share Purchase Agreement', required: false },
      { key: 'timetable', label: 'Timetable and Negotiations', required: true },
      { key: 'exclusivity', label: 'Exclusivity', required: true },
      { key: 'costs', label: 'Costs', required: false },
      { key: 'law', label: 'Law', required: true },
    ],
  },
];

async function seedTemplates() {
  console.log('Seeding deal document templates...');

  await fs.mkdir(TEMPLATES_DIR, { recursive: true });

  for (const config of TEMPLATES) {
    const [existing] = await db.select().from(dealDocumentTemplates)
      .where(
        and(
          eq(dealDocumentTemplates.documentType, config.documentType),
          eq(dealDocumentTemplates.isSystem, true)
        )
      );

    if (existing) {
      console.log(`  ✓ ${config.templateName} already exists (id: ${existing.id})`);
      continue;
    }

    const destPath = path.join(TEMPLATES_DIR, `system_${config.documentType}.docx`);

    const sourcePath = path.join(process.cwd(), 'attached_assets', config.sourceFile);
    const altPath = path.join('/mnt/user-data/uploads', config.sourceFile);

    let copied = false;
    try {
      await fs.copyFile(sourcePath, destPath);
      console.log(`  Copied ${config.sourceFile} → ${destPath}`);
      copied = true;
    } catch {
      try {
        await fs.copyFile(altPath, destPath);
        console.log(`  Copied from uploads: ${config.sourceFile} → ${destPath}`);
        copied = true;
      } catch {
        console.warn(`  ⚠ Source file not found: ${config.sourceFile}`);
        console.warn(`    Tried: ${sourcePath} and ${altPath}`);
        console.warn(`    Creating template record with placeholder path — upload the .docx file to data/templates/ later`);
      }
    }

    const [record] = await db.insert(dealDocumentTemplates).values({
      templateName: config.templateName,
      documentType: config.documentType,
      templateFileUrl: destPath,
      placeholderMap: config.placeholderMap,
      sections: config.sections || null,
      isSystem: true,
      isActive: true,
    }).returning();

    console.log(`  ✓ Created ${config.templateName} (id: ${record.id}, file${copied ? '' : ' pending'}: ${destPath})`);
  }

  console.log('Template seeding complete.');
}

seedTemplates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });

export { seedTemplates };
