/**
 * Pure helper — determines whether a company's financials are "provisional",
 * meaning they rest entirely on information memorandum (IM) data and have no
 * primary-tier (statutory / management / user_override) contribution.
 *
 * When true, any offer or HoT calculation built from these figures should be
 * flagged as provisional so the UI / document can warn the user.
 */

const PRIMARY_TIERS = new Set(['statutory', 'management', 'user_override']);

export function isProvisionalFinancials(
  contributions: ReadonlyArray<{ sourceTier: string }>,
): boolean {
  return !contributions.some(c => PRIMARY_TIERS.has(c.sourceTier));
}
