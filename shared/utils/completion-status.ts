/**
 * Pure, deterministic document-requirement coverage calculator.
 *
 * Extracted from DocumentAnalysisService so it can be unit-tested without
 * any database infrastructure.
 *
 * Key invariants enforced here:
 *  - An Information Memorandum (isIM=true) NEVER satisfies a primary
 *    document requirement, even if its extracted type matches.
 *  - categoryToType covers both "YTD *" and plain category names so the
 *    category-fallback path actually fires for those upload slots.
 */

export interface DocumentForCoverage {
  id: number;
  documentCategory: string | null;
}

export interface AnalysisResultForCoverage {
  documentId: number | null;
  documentType: string;
  isIM: boolean;
}

export interface CompletionStatus {
  completedTypes: string[];
  missingTypes: string[];
  isComplete: boolean;
  completionPercentage: number;
  completedCount: number;
  totalCount: number;
}

/** Document category strings → canonical required type. */
export const CATEGORY_TO_TYPE: Record<string, string> = {
  'Asset Register': 'asset_register',
  'Sales Ledger': 'sales_ledger',
  'Staff Matrix': 'staff_matrix',
  'Profit & Loss': 'profit_and_loss',
  'YTD Profit & Loss': 'profit_and_loss',
  'Balance Sheet': 'balance_sheet',
  'YTD Balance Sheet': 'balance_sheet',
};

const REQUIRED_TYPES = ['asset_register', 'sales_ledger', 'staff_matrix', 'profit_and_loss', 'balance_sheet'];

export function computeCompletionStatus(
  allDocuments: DocumentForCoverage[],
  analysisResults: AnalysisResultForCoverage[],
): CompletionStatus {
  // Build map of documentId → { type, isIM }
  // If a document has multiple analysis results (e.g. P&L + BS from a company_accounts
  // result), keep whichever entry would satisfy the requirement (non-IM wins).
  const analyzedDocInfo = new Map<number, { type: string; isIM: boolean }>();
  for (const result of analysisResults) {
    if (result.documentId == null || !result.documentType) continue;
    const existing = analyzedDocInfo.get(result.documentId);
    // A non-IM result for this document always wins over an IM one.
    if (!existing || existing.isIM) {
      analyzedDocInfo.set(result.documentId, {
        type: result.documentType,
        isIM: result.isIM,
      });
    }
  }

  const completedTypesSet = new Set<string>();
  let companyAccountsCount = 0;

  for (const doc of allDocuments) {
    const info = analyzedDocInfo.get(doc.id);

    if (doc.documentCategory === 'Company Accounts') {
      // Company Accounts — counted separately (up to 5 slots)
      companyAccountsCount++;
    } else if (info && REQUIRED_TYPES.includes(info.type)) {
      // Has an analysis result — skip if the document is an IM.
      // An IM never satisfies a primary document requirement.
      if (!info.isIM) {
        completedTypesSet.add(info.type);
      }
    } else if (!info && doc.documentCategory) {
      // No analysis result yet — give immediate credit via category name
      // (brief window between upload and analysis completion).
      const mappedType = CATEGORY_TO_TYPE[doc.documentCategory];
      if (mappedType && REQUIRED_TYPES.includes(mappedType)) {
        completedTypesSet.add(mappedType);
      }
    }
  }

  const completedTypes = Array.from(completedTypesSet);
  const totalRequired = 10; // 5 main types + 5 company accounts slots
  const cappedCompanyAccounts = Math.min(companyAccountsCount, 5);
  const completedCount = completedTypes.length + cappedCompanyAccounts;

  const missingTypes = REQUIRED_TYPES.filter(t => !completedTypes.includes(t));
  for (let i = 0; i < Math.max(0, 5 - companyAccountsCount); i++) {
    missingTypes.push(`company_accounts_${i + 1}`);
  }

  const allCompletedTypes = [
    ...completedTypes,
    ...Array.from({ length: cappedCompanyAccounts }, (_, i) => `company_accounts_${i + 1}`),
  ];

  return {
    completedTypes: allCompletedTypes,
    missingTypes,
    isComplete: completedCount === totalRequired,
    completionPercentage: Math.round((completedCount / totalRequired) * 100),
    completedCount,
    totalCount: totalRequired,
  };
}
