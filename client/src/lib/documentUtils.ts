// Shared utility functions for document type formatting and styling
// Used by both document-management.tsx and enhanced-portal-display.tsx

/**
 * Formats document type strings into user-friendly display names
 */
export const formatDocumentType = (type: string): string => {
  // Handle company accounts files (company_accounts_1, company_accounts_2, etc.)
  if (type.startsWith('company_accounts')) {
    return 'Company Accounts';
  }
  
  switch (type) {
    case 'asset_register': return 'Asset Register';
    case 'sales_ledger': return 'Sales Ledger';
    case 'staff_matrix': return 'Staff Matrix';
    case 'profit_and_loss': return 'YTD Profit & Loss';
    case 'balance_sheet': return 'YTD Balance Sheet';
    default: return type;
  }
};

/**
 * Returns consistent CSS class names for document type badges
 */
export const getDocumentTypeColor = (type: string): string => {
  // Handle company accounts files (company_accounts_1, company_accounts_2, etc.)
  if (type.startsWith('company_accounts')) {
    return 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300';
  }
  
  switch (type) {
    case 'asset_register': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
    case 'sales_ledger': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    case 'staff_matrix': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'profit_and_loss': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'balance_sheet': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    default: return 'bg-muted text-foreground';
  }
};

/**
 * Standard document types for dropdowns and forms
 */
export const DOCUMENT_TYPES = [
  { value: 'company_accounts', label: 'Company Accounts' },
  { value: 'profit_and_loss', label: 'YTD Profit and Loss' },
  { value: 'balance_sheet', label: 'YTD Balance Sheet' },
  { value: 'sales_ledger', label: 'Sales Ledger' },
  { value: 'asset_register', label: 'Asset Register' },
  { value: 'staff_matrix', label: 'Staff Matrix' }
];