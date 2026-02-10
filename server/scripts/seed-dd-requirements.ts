import { db } from '../db';
import { ddCategories, ddRequirements } from '@shared/schema/due-diligence';
import { eq } from 'drizzle-orm';

interface CategorySeed {
  refPrefix: string;
  categoryName: string;
  description: string;
  sortOrder: number;
  requirements: RequirementSeed[];
}

interface RequirementSeed {
  refNumber: string;
  documentName: string;
  priority: string;
  guidance: string;
}

const DD_DATA: CategorySeed[] = [
  {
    refPrefix: "1",
    categoryName: "Corporate Information & Shares",
    description: "Core corporate documents including incorporation, shareholding, and governance records.",
    sortOrder: 1,
    requirements: [
      { refNumber: "1.1", documentName: "Certificate of Incorporation", priority: "Mandatory", guidance: "Confirms the legal formation and registration of the company." },
      { refNumber: "1.2", documentName: "Certificate(s) of Incorporation on Change of Name", priority: "Advisory", guidance: "Needed if the company has ever changed its registered name." },
      { refNumber: "1.3", documentName: "Current and historical Memorandum & Articles of Association", priority: "Mandatory", guidance: "Governs the company's constitution including shareholder rights, director powers, and share transfer restrictions." },
      { refNumber: "1.4", documentName: "Shareholders' agreement(s) or related side letters", priority: "Mandatory", guidance: "Reveals any special rights, restrictions, drag/tag provisions, or pre-emption rights affecting share transfers." },
      { refNumber: "1.5", documentName: "Register of Members / Current shareholdings", priority: "Mandatory", guidance: "Confirms who legally owns what percentage of the company." },
      { refNumber: "1.6", documentName: "Details of any share options or warrants or other rights to acquire shares", priority: "Mandatory", guidance: "Identifies any dilution risk or future obligations to issue shares." },
      { refNumber: "1.7", documentName: "Board minutes for the last 3 years", priority: "Advisory", guidance: "Provides insight into key decisions, disputes, and the governance culture of the business." },
      { refNumber: "1.8", documentName: "Shareholder / General meeting minutes for the last 3 years", priority: "Advisory", guidance: "May reveal disputes, special resolutions, or changes in direction agreed by shareholders." },
      { refNumber: "1.9", documentName: "Details of any powers of attorney granted by the company", priority: "Advisory", guidance: "Identifies who else may legally act on behalf of the company." },
      { refNumber: "1.10", documentName: "Group structure chart (if part of a group)", priority: "Mandatory", guidance: "Shows all subsidiaries, associated companies, and intercompany relationships." },
      { refNumber: "1.11", documentName: "Details of any subsidiaries or associated companies", priority: "Mandatory", guidance: "Needed to assess full scope of acquisition and any hidden liabilities in group entities." },
      { refNumber: "1.12", documentName: "Details of any joint ventures or partnerships", priority: "Advisory", guidance: "Identifies shared obligations, profit-sharing, or exit complexities." },
      { refNumber: "1.13", documentName: "Register of charges and any outstanding security interests", priority: "Mandatory", guidance: "Shows what assets are pledged as security and any restrictions on asset disposal." },
    ],
  },
  {
    refPrefix: "2",
    categoryName: "Financial Information",
    description: "Financial statements, tax records, and management accounts.",
    sortOrder: 2,
    requirements: [
      { refNumber: "2.1", documentName: "Statutory financial statements for the last 3 years", priority: "Mandatory", guidance: "Core financial documents showing audited/filed performance and position." },
      { refNumber: "2.2", documentName: "Latest management accounts (P&L, Balance Sheet, Cash Flow)", priority: "Mandatory", guidance: "Shows current trading performance and financial position between year-ends." },
      { refNumber: "2.3", documentName: "Monthly/quarterly management accounts for the current and prior year", priority: "Mandatory", guidance: "Reveals seasonality, trends, and any recent deterioration in performance." },
      { refNumber: "2.4", documentName: "Corporation tax returns and computations for the last 3 years", priority: "Mandatory", guidance: "Confirms tax compliance and identifies any open enquiries or disputes with HMRC." },
      { refNumber: "2.5", documentName: "VAT returns for the last 2 years", priority: "Advisory", guidance: "Verifies VAT compliance and can reveal revenue inconsistencies." },
      { refNumber: "2.6", documentName: "Details of any tax disputes, enquiries, or outstanding liabilities", priority: "Mandatory", guidance: "Critical for identifying potential financial exposure from unresolved tax matters." },
      { refNumber: "2.7", documentName: "Budgets and forecasts for the current and next financial year", priority: "Mandatory", guidance: "Provides forward-looking performance expectations and management's assumptions." },
      { refNumber: "2.8", documentName: "Aged debtor report", priority: "Mandatory", guidance: "Shows quality of receivables and risk of bad debts affecting working capital." },
      { refNumber: "2.9", documentName: "Aged creditor report", priority: "Mandatory", guidance: "Reveals payment practices and any stretched supplier terms that may indicate cash flow issues." },
      { refNumber: "2.10", documentName: "Details of any off-balance sheet liabilities or contingent liabilities", priority: "Mandatory", guidance: "Identifies hidden obligations not visible in standard financial statements." },
      { refNumber: "2.11", documentName: "Schedule of intercompany balances and transactions", priority: "Advisory", guidance: "Needed to understand and unwind any group-level financial dependencies." },
      { refNumber: "2.12", documentName: "Details of any government grants or subsidies received", priority: "Advisory", guidance: "May carry clawback provisions or conditions that affect the business post-acquisition." },
      { refNumber: "2.13", documentName: "Capital expenditure history and plans", priority: "Adds Value", guidance: "Indicates investment levels needed to maintain the business and any deferred spend." },
    ],
  },
  {
    refPrefix: "3",
    categoryName: "Banking & Finance",
    description: "Banking relationships, loan agreements, and financial facilities.",
    sortOrder: 3,
    requirements: [
      { refNumber: "3.1", documentName: "List of all bank accounts with current balances", priority: "Mandatory", guidance: "Confirms cash position and identifies all banking relationships." },
      { refNumber: "3.2", documentName: "Bank facility letters and loan agreements", priority: "Mandatory", guidance: "Shows borrowing terms, covenants, and any change of control clauses that could trigger repayment." },
      { refNumber: "3.3", documentName: "Details of any overdraft facilities", priority: "Mandatory", guidance: "Reveals reliance on short-term borrowing and available headroom." },
      { refNumber: "3.4", documentName: "Details of any mortgages or charges on company assets", priority: "Mandatory", guidance: "Identifies secured obligations that take priority over unsecured creditors." },
      { refNumber: "3.5", documentName: "Details of any guarantees given or received", priority: "Mandatory", guidance: "May create ongoing obligations or expose the company to third-party default risk." },
      { refNumber: "3.6", documentName: "Hire purchase and finance lease schedules", priority: "Advisory", guidance: "Shows committed future payments and assets not fully owned." },
      { refNumber: "3.7", documentName: "Details of any factoring or invoice discounting arrangements", priority: "Advisory", guidance: "Reveals cash flow management practices and effective cost of finance." },
      { refNumber: "3.8", documentName: "Details of any foreign exchange contracts or hedging arrangements", priority: "Adds Value", guidance: "Relevant for businesses with international exposure." },
      { refNumber: "3.9", documentName: "Details of any outstanding bonds or debentures", priority: "Adds Value", guidance: "Identifies long-term debt instruments and their terms." },
      { refNumber: "3.10", documentName: "Correspondence with banks regarding covenant compliance", priority: "Advisory", guidance: "Shows relationship health with lenders and any past covenant breaches." },
    ],
  },
  {
    refPrefix: "4",
    categoryName: "Employees",
    description: "Employment contracts, HR policies, and workforce information.",
    sortOrder: 4,
    requirements: [
      { refNumber: "4.1", documentName: "Full employee list with job titles, start dates, salaries, and benefits", priority: "Mandatory", guidance: "Core people data needed for workforce planning and cost modelling." },
      { refNumber: "4.2", documentName: "Standard contracts of employment", priority: "Mandatory", guidance: "Identifies terms, notice periods, restrictive covenants, and any unusual provisions." },
      { refNumber: "4.3", documentName: "Director service agreements", priority: "Mandatory", guidance: "Often contain enhanced terms, golden parachutes, or change of control provisions." },
      { refNumber: "4.4", documentName: "Details of any bonus or commission schemes", priority: "Mandatory", guidance: "Reveals variable compensation obligations and their triggers." },
      { refNumber: "4.5", documentName: "Details of any share option or incentive schemes", priority: "Mandatory", guidance: "Identifies potential dilution or cash obligations on completion." },
      { refNumber: "4.6", documentName: "Organisation chart", priority: "Advisory", guidance: "Shows reporting structure, key person dependencies, and management depth." },
      { refNumber: "4.7", documentName: "Details of any consultants or self-employed contractors", priority: "Mandatory", guidance: "May indicate IR35 risk or hidden employment obligations." },
      { refNumber: "4.8", documentName: "Employee handbook / HR policies", priority: "Advisory", guidance: "Shows maturity of HR practices and any non-standard commitments." },
      { refNumber: "4.9", documentName: "Details of any ongoing disciplinary or grievance proceedings", priority: "Mandatory", guidance: "Identifies potential employment tribunal claims or settlements." },
      { refNumber: "4.10", documentName: "Details of any redundancies in the last 2 years", priority: "Advisory", guidance: "May indicate business difficulties or restructuring obligations." },
      { refNumber: "4.11", documentName: "Staff turnover data for the last 2 years", priority: "Advisory", guidance: "High turnover may indicate cultural issues or over-reliance on key individuals." },
      { refNumber: "4.12", documentName: "Details of any TUPE transfers (past or anticipated)", priority: "Mandatory", guidance: "Critical for understanding employment obligations transferring with the business." },
      { refNumber: "4.13", documentName: "Details of any trade union recognition or collective agreements", priority: "Advisory", guidance: "May affect ability to change terms or restructure post-acquisition." },
      { refNumber: "4.14", documentName: "Training records and professional development plans", priority: "Adds Value", guidance: "Indicates investment in workforce capability." },
      { refNumber: "4.15", documentName: "Details of any key person dependencies", priority: "Mandatory", guidance: "Identifies individuals whose departure would materially impact the business." },
    ],
  },
  {
    refPrefix: "5",
    categoryName: "Pensions",
    description: "Pension schemes, auto-enrolment compliance, and benefit details.",
    sortOrder: 5,
    requirements: [
      { refNumber: "5.1", documentName: "Details of all pension schemes (defined benefit and defined contribution)", priority: "Mandatory", guidance: "Identifies pension type and potential funding obligations, especially for DB schemes." },
      { refNumber: "5.2", documentName: "Auto-enrolment compliance documentation", priority: "Mandatory", guidance: "Confirms compliance with statutory workplace pension duties." },
      { refNumber: "5.3", documentName: "Latest pension scheme valuation (if defined benefit)", priority: "Advisory", guidance: "Shows funding position and potential deficit requiring buyer contribution." },
      { refNumber: "5.4", documentName: "Schedule of employer and employee contribution rates", priority: "Mandatory", guidance: "Confirms ongoing cost and any planned increases." },
      { refNumber: "5.5", documentName: "Details of any life assurance or death-in-service benefits", priority: "Adds Value", guidance: "Part of total employee benefits package valuation." },
    ],
  },
  {
    refPrefix: "6",
    categoryName: "Property",
    description: "Property ownership, leases, and related obligations.",
    sortOrder: 6,
    requirements: [
      { refNumber: "6.1", documentName: "Schedule of all properties (owned and leased)", priority: "Mandatory", guidance: "Complete picture of the property portfolio and associated costs." },
      { refNumber: "6.2", documentName: "Title deeds or Land Registry entries for owned properties", priority: "Mandatory", guidance: "Confirms legal ownership and any restrictions or covenants on the property." },
      { refNumber: "6.3", documentName: "Lease agreements for all leased properties", priority: "Mandatory", guidance: "Shows lease terms, break clauses, rent review dates, and any onerous provisions." },
      { refNumber: "6.4", documentName: "Details of any dilapidation provisions or obligations", priority: "Advisory", guidance: "May represent a significant cost on lease expiry." },
      { refNumber: "6.5", documentName: "Planning permissions and building regulation approvals", priority: "Advisory", guidance: "Confirms lawful use and any conditions on property use." },
      { refNumber: "6.6", documentName: "Details of any property-related disputes", priority: "Mandatory", guidance: "Identifies potential costs or restrictions from ongoing disputes." },
    ],
  },
  {
    refPrefix: "7",
    categoryName: "Assets",
    description: "Fixed assets, tangible property, and asset registers.",
    sortOrder: 7,
    requirements: [
      { refNumber: "7.1", documentName: "Fixed asset register", priority: "Mandatory", guidance: "Confirms what tangible assets are included in the sale and their values." },
      { refNumber: "7.2", documentName: "Details of any significant tangible assets", priority: "Advisory", guidance: "Identifies high-value items that may need valuation or condition assessment." },
      { refNumber: "7.3", documentName: "HP and lease schedules for assets", priority: "Mandatory", guidance: "Shows which assets are not fully owned and committed future payments." },
      { refNumber: "7.4", documentName: "Details of any assets held on trust or by third parties", priority: "Adds Value", guidance: "Identifies assets that may not transfer with the company." },
    ],
  },
  {
    refPrefix: "8",
    categoryName: "Contracts & Agreements",
    description: "Customer and supplier contracts, terms of trade, and key agreements.",
    sortOrder: 8,
    requirements: [
      { refNumber: "8.1", documentName: "Standard terms and conditions of sale", priority: "Mandatory", guidance: "Shows the contractual basis on which the business trades with customers." },
      { refNumber: "8.2", documentName: "Standard terms and conditions of purchase", priority: "Advisory", guidance: "Shows the contractual basis for supplier relationships." },
      { refNumber: "8.3", documentName: "Top 10 customer contracts by revenue", priority: "Mandatory", guidance: "Identifies key revenue relationships, terms, and any concentration risk." },
      { refNumber: "8.4", documentName: "Top 10 supplier contracts by spend", priority: "Mandatory", guidance: "Shows key cost relationships and any unfavourable or locked-in terms." },
      { refNumber: "8.5", documentName: "Customer concentration analysis", priority: "Mandatory", guidance: "Critical risk metric — high concentration means high dependency on few customers." },
      { refNumber: "8.6", documentName: "Details of any long-term or unusual contracts", priority: "Mandatory", guidance: "Identifies commitments that may be onerous or restrict future flexibility." },
      { refNumber: "8.7", documentName: "Details of any contracts with change of control provisions", priority: "Mandatory", guidance: "These contracts may terminate or require consent on acquisition." },
      { refNumber: "8.8", documentName: "Agency or distribution agreements", priority: "Advisory", guidance: "Defines third-party relationships that generate or support revenue." },
      { refNumber: "8.9", documentName: "Details of any exclusivity or non-compete arrangements", priority: "Advisory", guidance: "May restrict business activities or competitive positioning." },
      { refNumber: "8.10", documentName: "Details of any contracts under negotiation or recently lost", priority: "Adds Value", guidance: "Provides context on pipeline and any recent customer losses." },
    ],
  },
  {
    refPrefix: "9",
    categoryName: "Intellectual Property",
    description: "Patents, trademarks, copyrights, and IP licensing.",
    sortOrder: 9,
    requirements: [
      { refNumber: "9.1", documentName: "Schedule of all patents, trademarks, and registered designs", priority: "Mandatory", guidance: "Confirms ownership of registered IP and renewal status." },
      { refNumber: "9.2", documentName: "Details of any copyrights or unregistered IP", priority: "Advisory", guidance: "Identifies valuable unregistered rights that need protection." },
      { refNumber: "9.3", documentName: "Domain name registrations", priority: "Mandatory", guidance: "Confirms ownership of web domains and any upcoming renewals." },
      { refNumber: "9.4", documentName: "Details of any IP licences granted or received", priority: "Mandatory", guidance: "Shows dependencies on third-party IP or revenue from licensing." },
      { refNumber: "9.5", documentName: "Details of any IP disputes or infringement claims", priority: "Mandatory", guidance: "Identifies litigation risk or challenges to IP ownership." },
      { refNumber: "9.6", documentName: "Details of any design rights", priority: "Adds Value", guidance: "Relevant for businesses with product design as a competitive advantage." },
    ],
  },
  {
    refPrefix: "10",
    categoryName: "Information Technology",
    description: "IT infrastructure, software licences, and cybersecurity.",
    sortOrder: 10,
    requirements: [
      { refNumber: "10.1", documentName: "Inventory of all software and hardware", priority: "Mandatory", guidance: "Complete picture of technology infrastructure and associated costs." },
      { refNumber: "10.2", documentName: "Software licence agreements", priority: "Mandatory", guidance: "Confirms compliance and identifies any transfer restrictions on change of ownership." },
      { refNumber: "10.3", documentName: "Details of any bespoke or proprietary software", priority: "Mandatory", guidance: "Identifies custom technology assets and any development dependencies." },
      { refNumber: "10.4", documentName: "IT disaster recovery and business continuity plans", priority: "Advisory", guidance: "Shows resilience planning and recovery capabilities." },
      { refNumber: "10.5", documentName: "Details of any cybersecurity measures and policies", priority: "Advisory", guidance: "Increasingly critical for risk assessment and insurance purposes." },
      { refNumber: "10.6", documentName: "Details of any IT outsourcing or managed service agreements", priority: "Adds Value", guidance: "Shows reliance on third parties for critical IT functions." },
    ],
  },
  {
    refPrefix: "11",
    categoryName: "Data Protection & Privacy",
    description: "GDPR compliance, data processing agreements, and privacy policies.",
    sortOrder: 11,
    requirements: [
      { refNumber: "11.1", documentName: "ICO registration certificate", priority: "Mandatory", guidance: "Confirms compliance with data protection registration requirements." },
      { refNumber: "11.2", documentName: "Privacy policy and cookie policy", priority: "Mandatory", guidance: "Must comply with UK GDPR and PECR requirements." },
      { refNumber: "11.3", documentName: "Data processing agreements with third parties", priority: "Mandatory", guidance: "Required under UK GDPR for any third-party data processing." },
      { refNumber: "11.4", documentName: "Record of processing activities (ROPA)", priority: "Advisory", guidance: "Demonstrates GDPR compliance maturity." },
      { refNumber: "11.5", documentName: "Data protection impact assessments", priority: "Advisory", guidance: "Required for high-risk processing activities." },
      { refNumber: "11.6", documentName: "Details of any data breaches or ICO complaints", priority: "Mandatory", guidance: "Identifies regulatory risk and potential fines." },
      { refNumber: "11.7", documentName: "Data retention and deletion policies", priority: "Advisory", guidance: "Shows compliance with data minimisation principles." },
      { refNumber: "11.8", documentName: "Staff data protection training records", priority: "Adds Value", guidance: "Demonstrates commitment to data protection compliance." },
    ],
  },
  {
    refPrefix: "12",
    categoryName: "Insurance",
    description: "Insurance policies, coverage levels, and claims history.",
    sortOrder: 12,
    requirements: [
      { refNumber: "12.1", documentName: "Schedule of all current insurance policies", priority: "Mandatory", guidance: "Confirms what risks are covered and at what levels." },
      { refNumber: "12.2", documentName: "Details of coverage levels and excesses", priority: "Mandatory", guidance: "Identifies any gaps in coverage or unusually high excesses." },
      { refNumber: "12.3", documentName: "Claims history for the last 5 years", priority: "Mandatory", guidance: "Reveals risk profile and may affect future premium costs." },
      { refNumber: "12.4", documentName: "Details of any pending or potential claims", priority: "Advisory", guidance: "Identifies exposure not yet reflected in financial statements." },
      { refNumber: "12.5", documentName: "Product liability or professional indemnity insurance details", priority: "Advisory", guidance: "Critical for businesses providing professional services or physical products." },
    ],
  },
  {
    refPrefix: "13",
    categoryName: "Legal & Disputes",
    description: "Litigation, regulatory proceedings, and legal compliance.",
    sortOrder: 13,
    requirements: [
      { refNumber: "13.1", documentName: "Summary of any current or threatened litigation", priority: "Mandatory", guidance: "Identifies legal exposure and potential financial impact." },
      { refNumber: "13.2", documentName: "Details of any ongoing or potential disputes", priority: "Mandatory", guidance: "Broader than litigation — includes contractual disputes, complaints, etc." },
      { refNumber: "13.3", documentName: "Details of any regulatory investigations or proceedings", priority: "Mandatory", guidance: "May indicate compliance failures or reputational risk." },
      { refNumber: "13.4", documentName: "Details of any settlements or judgments in the last 5 years", priority: "Advisory", guidance: "Historical pattern of disputes and their financial impact." },
      { refNumber: "13.5", documentName: "Details of any outstanding court orders or undertakings", priority: "Mandatory", guidance: "Shows binding obligations the company must comply with." },
      { refNumber: "13.6", documentName: "Legal fees analysis for the last 2 years", priority: "Adds Value", guidance: "Unusual levels may indicate hidden legal issues." },
    ],
  },
  {
    refPrefix: "14",
    categoryName: "Environmental & Health & Safety",
    description: "Environmental compliance, health & safety policies, and risk assessments.",
    sortOrder: 14,
    requirements: [
      { refNumber: "14.1", documentName: "Quality management certificates (ISO 9001 etc.)", priority: "Advisory", guidance: "Shows commitment to quality standards and may be required by customers." },
      { refNumber: "14.2", documentName: "Environmental management certificates (ISO 14001 etc.)", priority: "Adds Value", guidance: "Relevant for businesses with environmental impact." },
      { refNumber: "14.3", documentName: "Environmental permits or consents", priority: "Advisory", guidance: "Required for businesses with regulated environmental activities." },
      { refNumber: "14.4", documentName: "Health & Safety policy", priority: "Mandatory", guidance: "Legal requirement for businesses with 5 or more employees." },
      { refNumber: "14.5", documentName: "Risk assessments", priority: "Mandatory", guidance: "Legal requirement and shows proactive safety management." },
      { refNumber: "14.6", documentName: "Accident/incident records for the last 3 years", priority: "Advisory", guidance: "Reveals safety track record and potential liability exposure." },
      { refNumber: "14.7", documentName: "Details of any HSE investigations or improvement notices", priority: "Mandatory", guidance: "Identifies serious compliance failures and ongoing obligations." },
    ],
  },
  {
    refPrefix: "15",
    categoryName: "Compliance & Regulatory",
    description: "Regulatory compliance, licences, permits, and governance policies.",
    sortOrder: 15,
    requirements: [
      { refNumber: "15.1", documentName: "Company handbook / Compliance manual", priority: "Advisory", guidance: "Shows overall governance framework and policy maturity." },
      { refNumber: "15.2", documentName: "Anti-bribery and corruption policy", priority: "Mandatory", guidance: "Legal requirement under the Bribery Act 2010." },
      { refNumber: "15.3", documentName: "Whistleblowing policy", priority: "Advisory", guidance: "Best practice and may be required by sector regulation." },
      { refNumber: "15.4", documentName: "Details of any regulatory bodies or industry associations", priority: "Mandatory", guidance: "Identifies sector-specific compliance requirements." },
      { refNumber: "15.5", documentName: "Copies of any licences, permits, or authorisations", priority: "Mandatory", guidance: "Confirms the business has all required permissions to operate." },
      { refNumber: "15.6", documentName: "Details of any regulatory compliance audits", priority: "Advisory", guidance: "Shows compliance track record and any outstanding findings." },
      { refNumber: "15.7", documentName: "Modern slavery statement (if applicable)", priority: "Adds Value", guidance: "Required for businesses with turnover above £36m but best practice for all." },
    ],
  },
];

async function seedDdRequirements() {
  console.log('Seeding DD categories and requirements...');

  let categoriesCreated = 0;
  let categoriesSkipped = 0;
  let requirementsCreated = 0;
  let requirementsSkipped = 0;

  for (const cat of DD_DATA) {
    const [existing] = await db.select().from(ddCategories)
      .where(eq(ddCategories.refPrefix, cat.refPrefix));

    let categoryId: number;

    if (existing) {
      console.log(`  ✓ Category "${cat.categoryName}" already exists (id: ${existing.id})`);
      categoryId = existing.id;
      categoriesSkipped++;
    } else {
      const [inserted] = await db.insert(ddCategories).values({
        refPrefix: cat.refPrefix,
        categoryName: cat.categoryName,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: true,
      }).returning();
      categoryId = inserted.id;
      categoriesCreated++;
      console.log(`  + Created category "${cat.categoryName}" (id: ${categoryId})`);
    }

    let sortOrder = 1;
    for (const req of cat.requirements) {
      const [existingReq] = await db.select().from(ddRequirements)
        .where(eq(ddRequirements.refNumber, req.refNumber));

      if (existingReq) {
        requirementsSkipped++;
        continue;
      }

      await db.insert(ddRequirements).values({
        categoryId,
        refNumber: req.refNumber,
        documentName: req.documentName,
        priority: req.priority,
        guidance: req.guidance,
        collectionStage: 2,
        sortOrder,
        isActive: true,
      });
      requirementsCreated++;
      sortOrder++;
    }
  }

  console.log(`\nSeed complete:`);
  console.log(`  Categories: ${categoriesCreated} created, ${categoriesSkipped} already existed`);
  console.log(`  Requirements: ${requirementsCreated} created, ${requirementsSkipped} already existed`);
  console.log(`  Total requirements in data: ${DD_DATA.reduce((sum, c) => sum + c.requirements.length, 0)}`);
}

seedDdRequirements()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });

export { seedDdRequirements };
