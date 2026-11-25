/**
 * Which trial a public checkout starts with. Pure, so it can be unit tested without Stripe
 * or a database.
 *
 * Rules, in order:
 *   1. A campaign with free months: a calendar-month trial delivers the free period.
 *   2. A campaign listed in NO_TRIAL_PROMO_SLUGS: no trial, the card is charged at signup.
 *   3. Everything else: the standard 7-day trial.
 */

export const STANDARD_TRIAL_DAYS = 7;

/**
 * Campaigns that charge at signup instead of starting with the standard 7-day trial.
 *
 * bf26-annual: Black Friday 2026 annual offer. Adam decided on 2026-11-25 that the deal takes
 * payment straight away. The rule ends by itself: once the campaign's expires_at passes,
 * resolveCampaignBySlug returns null and the checkout rejects the slug, so a normal annual
 * checkout (no promo) keeps its 7-day trial throughout. The entry can be removed at leisure.
 */
export const NO_TRIAL_PROMO_SLUGS: ReadonlySet<string> = new Set(['bf26-annual']);

export type CheckoutTrial =
  | { kind: 'free_months'; trialDays: number }
  | { kind: 'none' }
  | { kind: 'standard'; trialDays: number };

export function resolveCheckoutTrial(
  campaign: { slug: string; freeMonthsTotal: number } | null,
  now: Date = new Date(),
): CheckoutTrial {
  if (campaign && campaign.freeMonthsTotal > 0) {
    // Calendar-month trial. setMonth can drift 1-2 days on month-end signups;
    // acceptable for a trial length.
    const trialEnd = new Date(now.getTime());
    trialEnd.setMonth(trialEnd.getMonth() + campaign.freeMonthsTotal);
    const trialDays = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { kind: 'free_months', trialDays };
  }
  if (campaign && NO_TRIAL_PROMO_SLUGS.has(campaign.slug)) {
    return { kind: 'none' };
  }
  return { kind: 'standard', trialDays: STANDARD_TRIAL_DAYS };
}
