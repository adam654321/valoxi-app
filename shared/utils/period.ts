export function isPartYearPeriod(p: {
  monthsCovered?: number | null;
  isFullYear?: boolean | null;
  documentCategory?: string | null;
}): boolean {
  if (p?.monthsCovered != null) return p.monthsCovered < 11;
  if (p?.isFullYear === false) return true;
  return !!p?.documentCategory?.toLowerCase().includes('ytd');
}