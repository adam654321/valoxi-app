# Deal Modeller — Funding Structures Overhaul (#98): Assessment

Status: assessed 2026-06-06 (read-only, against code + both source docs). Build not started.
Owner: Adam. Architect: Claude (relay to Replit).
Sources: Deal Modeller Overhaul docx (29 May 2026); Jag review transcript (5 June 2026).

## Why
The modeller services every debt funding line as an amortising term loan (PMT). That is wrong for invoice finance, RCFs, mezzanine, seller deferred and earnout. The Payment Cover Ratio (the team's DSCR) is overstated in debt service for those structures, so genuinely fundable deals read as critical/unfundable and buyers lose trust.

## Source reconciliation
The docx is the pre-review plan. It proposed lifting seller payments and earnout out of the funding stack AND out of the DSCR (docx 4.2, 4.3, Q5, Q9). Jag's 5 June review reversed the DSCR exclusion: seller and earnout are separated in the UI but KEPT in the DSCR, because lenders assess total debt service. The settled spec is the docx minus that exclusion, plus Jag's refinements. Everything else in the docx stands.

## Current state (confirmed against code)
- DSCR calc (shared/calculators/deal-model.calc.ts): paymentCoverRatio = averageAdjustedEbitda / totalAnnualDebtService. The denominator sums annual repayment only from funding lines with isDebt = true. Per-line: termMonths <= 1 gives interest-only (used * rate/12), else amortising PMT. No per-line repayment mode.
- Data model (shared/schema/deal-models.ts): seller and earnout are NOT separate tables. They are deal_model_funding_lines rows with fundingType 'seller_financing' / 'earnout'. deal_models also carries vestigial scalar columns (deferredAmount, deferredTerms, earnoutMaximum, earnoutMetric, earnoutPeriodMonths, upfrontCash, retentionEscrow) that the deal-structure AI writes to but the calc does not read.
- isDebt defaults (FundingSection.tsx DEBT_DEFAULT_TYPES): seller_financing = true (in the DSCR today). earnout = NOT listed, so isDebt = false (NOT in the DSCR today). This is the key migration finding: adding earnout-at-max to the denominator is a real DSCR change for earnout deals, not neutral.
- UI: FundingSection is one flat list of 10 funding types with a per-line collapsible card; Collapsible is already imported. PaymentTermsPanel (Section 5) already reads seller_financing / earnout funding lines, computes dayOne = offerPrice - deferred - earnout, reconciles all three to offerPrice, and already labels earnout "maximum / conditional". The display target largely exists; it just needs re-pointing to new tables.
- offerPrice is the EV-bridge result (calculateOfferPrice), independent of the funding lines; the funding stack reconciles to it via the funding gap.

## Settled direction (build to this)
- DSCR keeps seller payments and earnout in the denominator. UI separates them, maths does not.
- One "How do we pay for this" section, three sub-blocks: day-one funding (invoice finance, amortising loans, investor finance, AND equity), seller financing, earnout. Three reconciling subtotals (day-one / deferred / earnout, earnout defaults to zero) sum to the offer price.
- Earnout modelled at maximum (worst case) in the DSCR and shown in the offer workings (trust point). Non-payment is upside cash; the deal is assessed as if the ceiling is payable.
- Invoice-finance / revolving interest modelled as an EBITDA deduction (lowers the numerator), NOT a denominator debt-service line.
- Three repayment modes now: amortizing, interest-only, principal-only. PIK and bullet DEFERRED pending Dee; design left open to add without rework. If added later: bullet interest hits the DSCR with principal flagged at term-end; PIK excluded from the DSCR and flagged as equity erosion.
- Seller and earnout blocks collapsible.
- Rating bands UNCHANGED (nothing leaves the denominator, so the docx Q9 recalibration is moot).
- AI deal-structure prompt update is a SEPARATE assess after the tables land. Out of scope here.

## Conceptual note for the build
Day-one block = funding sources (debt + equity) for the upfront payment. Seller and earnout = deferred consideration the business services over time. DSCR denominator = day-one debt service + seller payments + earnout-at-max. Reconciliation = day-one total + deferred + earnout = offer price.

## Migration (verify at the migration assess, do not assume)
- 21 seller + 3 earnout funding-line rows across 22 deal models / 8 user companies (per docx). Read the live isDebt on these at assess.
- Seller already isDebt=true: near-neutral IF the new per-type calc reproduces today's PMT monthly figure exactly (a 0% seller deferred currently falls through PMT to principal/term).
- Earnout default isDebt=false: adding earnout-at-max to the denominator WILL move the DSCR for those deals. Intended, but quantify and tell the 8 owners; not a silent migration.
- Existing day-one funding lines default to repayment_structure = amortizing: PMT unchanged, no shift.

## Surfaces to locate at their slice assess (not yet read)
- Server locked-model read-overwrite bug (reads silently overwriting computed fields on locked models). Slice 5.
- Document generation (offer letter / heads of terms) reads of seller/earnout. Slice 5.
- Deal-model save/load path and the funding-line PUT/POST/DELETE routes (/api/v2/deal-models/:id/funding-lines). Slices 1, 3.

## Baseline at assess
- TSC: 1 pre-existing error (server/services/portal.service.ts:81). Any other = regression.
- git: clean, HEAD 2660f9a (post-#202).
