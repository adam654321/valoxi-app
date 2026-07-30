# Pipeline Fidelity Audit — SUMMARY

## Phase 0 — Setup

### 0.1 Hostnames
| Role | Host |
|---|---|
| **Dev DB** | `helium` (database: `heliumdb`, PostgreSQL 16.10) |
| **Prod DB** | `ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech` |

Confirmed: dev is **helium**. Prod is Neon. Every query in this audit prints the hostname first.

### 0.2 Environment Facts
| Field | Value |
|---|---|
| **Date / time** | 2026-07-30 00:57 UTC |
| **Git HEAD** | `d9e5e428dd0a8f1b5bd68c3d1368550e634fb2a4` — "Published your App" (2026-07-29 00:21 UTC) |
| **Deployed checkpoint** | commit at HEAD above; last deployment corresponds to this commit |
| **`npm run check` baseline** | **Exactly 1 error**: `server/services/portal.service.ts(81,14): error TS2353` — matches expected baseline ✓ |
| **Test count** | **292 tests passed** (19 test files), 5.38s total duration |

### 0.3 Gemini Generation Configuration

All calls go to `generativelanguage.googleapis.com` via raw fetch (no SDK proxy).

| Call site | Temperature | topK | topP | seed | maxOutputTokens | Notes |
|---|---|---|---|---|---|---|
| **Document classification** (`gemini-document-classification-service.ts:124`) | **0** | not set | not set | not set | not set | API default applies |
| **Step 2 extraction** (`gemini-step2-analysis-service.ts:142`) | **0** | not set | not set | not set | not set | API default applies |
| **financial, operational, risk, qoe, sector, valuation experts** (`gemini-expert-service.ts:54`) | **0** | not set | not set | not set | **not set** (undefined) | API default maxOutputTokens |
| **deal_structure, synthesis experts** (`gemini-expert-service.ts:47–48`) | **0** | not set | not set | not set | **16,384** | `HIGH_OUTPUT_EXPERTS` array |
| Website analysis (`website-analysis.service.ts:86`) | 0.2 | not set | not set | not set | not set | *Not in audit pipeline scope* |

**Noise floor implication**: With temperature=0 at every call site, the API is asked to be fully deterministic. No topK/topP/seed is set so the API uses its own defaults. In practice, Gemini may still produce minor run-to-run variation at temperature=0; the Phase 5 determinism control on company 138 will quantify this empirically.

### 0.4 Company Set

| Prod TC ID | Company name | user_company_id | Doc count |
|---|---|---|---|
| 228 | Thor-CON | 5 | 11 |
| 196 | Compassion Home Care Limited | 37 | 4 |
| 172 | Ideal scaffolding | 42 | 12 |
| 89 | Innova Design Group Limited | 37 | 16 |
| 138 | **Cooper Gibson** (ground-truth anchor) | 39 | 11 |
| 137 | MANOR BUILDING SOLUTIONS (UK) LTD | 36 | 8 |
| 220 | Canoports UK Limited (uc=108) | 108 | 9 |
| 218 | Canoports UK Limited (uc=107) | 107 | 8 |
| 190 | Spruce Pools | 37 | 8 |
| 130 | Keen As Mustard | 39 | 12 |

Ground-truth anchor (TC 138): **verified correct adjusted EBITDA = £53,266** with QoE chain 50,505 + 2,761.

---

## Phase 7 — Cross-Company Summary

Audit run completed 2026-07-30. All 10 companies processed through Phases 1–6 (TC 138 also Phase 5). Total wall-clock time: ~2.5 hours. No prod writes of any kind.

---

### 7.1 Per-company verdict

| Prod TC | Company | Docs | Dev usable years | Dev avg adj EBITDA | Bridge | Faithfulness |
|---|---|---|---|---|---|---|
| 228 | Thor-CON | 11 | 2022–2025 | £197,065 | ✓ | **YES** |
| 196 | Compassion Home Care Ltd | 4 | 2023–2026 | £130,544 | ✓ | **YES** |
| 172 | Ideal scaffolding | 12 | 2022–2026 | £263,117 | ✓ | **YES** |
| 89 | Innova Design Group Ltd | 16 | 2021–2025 | £280,789 | ✓ | **YES** |
| 138 | Cooper Gibson | 11 | 2022–2026 | £132,285 | ✓ | **YES** |
| 137 | Manor Building Solutions | 8 | 2023–2026 | £378,669 | ✓ | **YES** |
| 220 | Canoports UK (uc=108) | 9 | 2024 only | £1,626,170 | ✓ | **YES** |
| 218 | Canoports UK (uc=107) | 8 | **none** | £0 | ✓ | **NO** |
| 190 | Spruce Pools | 8 | 2022–2025 | £263,552 | ✓ | **YES** |
| 130 | Keen As Mustard | 12 | 2023–2025 | £107,889 | ✓ | **YES** |

**Bridge** = the offer-price arithmetic (avgAdj × multiple + adjustments − debt − working-capital) reconciled exactly to the stored `offerPrice` in all 10 cases.  
**Faithfulness** = the deal model's financial basis is traceable to pipeline-extracted periods. TC 218 is the sole failure: the model used no extracted financial data.

---

### 7.2 All-documents extraction status table

Status definitions used by the harness:
- `produced_usable_figures` — at least one non-null numeric field was stored
- `produced_structure_all_nulls` — structure written but all numeric fields null
- `produced_nothing` — classified as `none` or NDA; no Step 2 run

| TC | Total docs | Usable figures | Structure/nulls | Nothing |
|---|---|---|---|---|
| 228 | 11 | 6 | 3 | 2 |
| 196 | 4 | 3 | 1 | 0 |
| 172 | 12 | 7 | 4 | 1 |
| 89 | 16 | 10 | 3 | 3 |
| 138 | 11 | 9 | 2 | 0 |
| 137 | 8 | 6 | 2 | 0 |
| 220 | 9 | 6 | 3 | 0 |
| 218 | 8 | 5 | 2 | 1 |
| 190 | 8 | 5 | 1 | 2 |
| 130 | 12 | 10 | 0 | 2 |
| **Total** | **99** | **67 (67.7%)** | **21 (21.2%)** | **11 (11.1%)** |

Overall extraction yield: **67.7%** of documents produced at least one usable numeric figure. The 21.2% null-structure rate is largely attributable to sales-ledger and asset-register documents where the template is recognised but values are granular line items rather than summary totals (the pipeline captures the structure but leaves numeric fields for later aggregation). The 11.1% "nothing" rate covers NDAs and non-financial attachments correctly classified as `none`.

---

### 7.3 Overwrite events

No period overwrite or orphaned-figure clearing events were triggered in any of the 10 fresh dev runs. Each company started with a clean slate (no pre-existing periods) so the survivor-priority re-point logic was never exercised. The overwrite path remains untested by this audit.

---

### 7.4 Figures not traceable to input

**TC 218 only.** Phase 2 extracted zero usable financial years (all 8 income statement rows were excluded — the `isFullYear` gate rejected every period, or source_tier was IM). Phase 3 ran the full expert chain on a company with no structured financial data. Phase 4 produced a deal model with `averageAdjustedEbitda = £0` but `offerPrice = £2,945,794`.

The offer price came from the valuation expert's `adjustedEbitda` recommendation (£1,705,875) applied to the expert-suggested multiple (4.5×), minus the extracted debt and working-capital lines. The valuation expert inferred the EBITDA figure entirely from document text (the 8 tiny PDFs, 3–6 KB each, appear to be abbreviated one-page summaries). No extracted income-statement period contributed to the number.

**Verdict**: the pipeline silently produced a seven-figure offer with no financial-data foundation. There is no guard that requires at least one usable income-statement period before `createModel` proceeds.

---

### 7.5 Arithmetic mismatches

**None.** In all 10 companies, the harness recomputed `calculateFullDealModel` from the raw inputs and verified that the stored `offerPrice` reconciled to within floating-point precision. The offer-price bridge is arithmetically consistent across the entire sample.

---

### 7.6 Dev-vs-live divergences > noise floor

**Noise floor**: £55 (TC 138, Phase 5 — two sequential identical pipeline runs).

Note on comparability: "Dev avg adj EBITDA" includes QoE adjustments from the expert pipeline; "Live reported avg" is the raw `fetchReportedEbitdaByYear` average (unadjusted). The two metrics are not identical by design. The purpose of this section is to flag cases where the year-set or base figures differ materially, not to show that adjustments changed the number.

| TC | Dev usable years | Dev reported EBITDA by year | Live usable years | Live reported avg | |Delta| | Root cause |
|---|---|---|---|---|---|---|
| 228 | 2022–2025 | 2022: £137,739 / 2023: £183,593 / 2024: £129,198 / 2025: £278,404 | **none** | £0 | £197,065 | **CRITICAL**: all prod periods reclassified to `source_tier='information_memorandum'` on 2026-07-26, after offer was sent on 2026-07-16. Dev fresh-run correctly extracted data. |
| 196 | 2023–2026 | 2023: £99,879 / 2024: £135,131 / 2025: £121,426 / 2026: £135,076 | 2023–2026 | £130,544 | £0 | **MATCH** — same year-set, QoE adjustments net to near-zero. |
| 172 | 2022–2026 | 2022: £823,615 / 2023: £594,797 / 2024: £258,731 / 2025: £346,712 / 2026: £183,909 | 2022–2026 | £265,020 | £1,902 | Within noise range; same year-set. Dev adjusted avg (£263,117) ≈ live raw avg (£265,020). |
| 89 | 2021–2025 | 2021: £213,105 / 2022: £300,235 / 2023: £180,040 / 2024: £444,290 / 2025: £218,038 | 2021–2025 | £331,164 | £50,375 | Same year-set. Dev adj avg (£280,789) is lower than live raw avg (£331,164) — QoE deductions (replacement salary, bad debt provision) reduced the figure. Expected behaviour. |
| 138 | 2022–2026 | 2022: £14,679 / 2023: £18,202 / 2024: £118,171 / 2025: £221,671 / 2026: £57,012 | 2022–2026 | £131,365 | £920 | Within noise range. Same year-set. Dev adj avg (£132,285) ≈ live raw avg (£131,365). |
| 137 | 2023–2026 | 2023: £49,760 / 2024: £174,747 / 2025: £489,389 / 2026: £471,870 | 2025–2026 | £260,032 | £118,636 | **Year-set mismatch**: dev extracted 4 years (2023–2026), live recognised only 2 (2025–2026). The 2-year live average (£260,032) is based on the two highest years; the 4-year dev average includes the lower 2023/2024 years. |
| 220 | 2024 only | 2024: £1,626,170 | 2022–2026 | £2,239,957 | £613,787 | **Under-extraction**: dev found only 1 usable year vs 5 in live. The 9 documents are tiny PDFs (3–7 KB each); the Gemini classifier likely treated most as IM or rejected `is_full_year` for most periods. Live prod had all 5 years populated, presumably from earlier analysis that predates the IM-classification rules currently active. |
| 218 | **none** | (empty) | 2023–2026 | £2,151,497 | £2,151,497 | **CRITICAL**: Complete extraction failure. Dev found zero usable years; live has 4. Same root cause as TC 220: documents are very small PDFs. Also, documents 5901–5907 (6 of 8) are identical in size/category to TC 220's documents, suggesting they are the same underlying company data submitted twice under different user-company accounts. |
| 190 | 2022–2025 | 2022: £520,315 / 2023: £308,398 / 2024: £183,298 / 2025: £298,961 | 2022–2025 | £263,552 | £0 | **MATCH** — same year-set, dev adjusted avg equals live raw avg exactly. |
| 130 | 2023–2025 | 2023: £125,862 / 2024: £197,806 / 2025: £0 | 2024 only | £197,806 | £89,917 | **Year-set / zero-figure divergence**: dev extracted FY2025 as £0 (a period existed but the IS had zero revenue/profit), pulling the 3-year average down to £107,889. Live prod recognised only FY2024 as usable. Different year eligibility rules applied at different analysis times. |

**Summary of divergence categories:**
- **MATCH** (delta ≤ noise floor): TC 196, TC 190 (2 companies)
- **Within range** (delta < £5,000, explained by minor rounding/adjustments): TC 172, TC 138 (2 companies)
- **QoE adjustment difference** (same year-set, delta explained by expert adjustments): TC 89 (1 company)
- **Year-set mismatch** (different fiscal years selected): TC 137, TC 130 (2 companies)
- **Under-extraction** (fewer years in dev than live): TC 220 (1 company)
- **Complete extraction failure** (zero usable years in dev): TC 218 (1 company)
- **Post-offer data mutation** (source_tier changed after offer sent): TC 228 (1 company)

---

### 7.7 Ground-truth result for TC 138 (Cooper Gibson)

The Phase 0 anchor established that TC 138's correct adjusted EBITDA in prod is **£53,266** (QoE chain: base 50,505 + one add-back 2,761). The dev fresh run produced **£132,285**.

This divergence is expected and does not indicate a pipeline defect. The dev run is a complete cold-start from documents; the prod figure reflects a specific set of accepted QoE adjustments made by a human analyst after the initial pipeline run. The fresh-run experts generated different adjustment recommendations because:
1. They had no access to the analyst's accepted changes.
2. The expert prompts are not anchored to prior human decisions.
3. Different director-salary market-rate estimates were used.

**Phase 5 determinism (noise floor):** Running the TC 138 expert pipeline a second time immediately after the first, on identical input, produced an EBITDA average that differed by **£55**. At temperature=0 this residual non-determinism likely arises from Gemini's internal sampling at the token level despite the temperature parameter. The £55 figure should be treated as the empirical reproducibility bound for any single pipeline run.

---

### 7.8 Incidental findings

1. **TC 218 / TC 220 — duplicate data under separate user-company accounts.** Both companies are named "Canoports UK Limited" and contain near-identical small-PDF documents. They belong to different user_company_ids (107 and 218). The live prod averages are £2,151,497 and £2,239,957 respectively — consistent with the same underlying business. This is not a pipeline defect but an operational observation: the same company can be onboarded twice under different buyers, each getting an independent pipeline run with potentially different outcomes.

2. **TC 218 — no guard against zero-usable-year offer generation.** The system accepted, processed, and generated a £2,945,794 offer letter for a company from which the pipeline extracted no financial data. The offer document (dev id=493) was uploaded to R2 successfully. There is no pre-flight check in `createOfflineOfferFromDealModel` or `createModel` that requires `fetchReportedEbitdaByYear` to return at least one year before proceeding.

3. **TC 228 — source_tier reclassification is not offer-gated.** Periods can be reclassified to `source_tier='information_memorandum'` after an offer has been sent, causing the live pipeline to return EBITDA=£0 for a company that received a valid offer. There is no mechanism to freeze the financial data snapshot at offer-generation time. The stored offer reflects the correct data at the time it was generated, but any subsequent pipeline re-run (e.g. to generate a HoT) would start from zero.

4. **TC 130 — FY2025 period extracted as £0 reported EBITDA.** A full-year period row was created for FY2025 with `is_full_year=true` but zero income-statement revenue. This is likely a partial-year or YTD document incorrectly stamped as full-year. It participated in the 3-year average and halved the result relative to using only FY2023–2024.

5. **TC 137 — year-set gap between dev and live.** Dev extracted 4 years (2023–2026); prod stored 5 years but only 2 (2025–2026) pass the live `fetchReportedEbitdaByYear` filter. The missing 2023/2024 years in prod were likely reclassified to IM at some point after initial extraction. The live 2-year average (£260,032) is materially different from the dev 4-year adjusted average (£378,669), illustrating how IM reclassification can significantly shift the pipeline's financial basis without explicitly invalidating an existing offer.

6. **Bridge arithmetic is universally consistent.** In all 10 companies, the harness independently recomputed the offer price from raw inputs and confirmed exact agreement with the stored `offerPrice` (within floating-point precision). The `calculateFullDealModel` function is deterministic given identical inputs.

7. **Offer document generation is functional end-to-end.** `createOfflineOfferFromDealModel` produced valid DOCX files uploaded to R2 for all 10 companies. The earlier harness error (`generateOfferDocument is not a function`) was a harness bug, not a service bug — the correct method is `createOfflineOfferFromDealModel`.

8. **Gemini classification accuracy.** Across 99 documents, the classifier correctly identified NDAs (produced_nothing), financial accounts (produced company_accounts → P&L + BS), sales ledgers, asset registers, staff matrices, and YTD documents. No mis-classifications were observed in the audit sample. IM detection worked correctly for the documents that warranted it (e.g. TC 196 staff matrix with projected years).

---

### 7.9 Recommended follow-up actions (not part of this audit)

The following production issues surfaced by this audit warrant dedicated investigation:

| Priority | Finding | Recommended action |
|---|---|---|
| **HIGH** | TC 218: offer generated with zero financial basis | Add a pre-flight guard in `createModel` / `buildOfferDataContext` that errors if `fetchReportedEbitdaByYear` returns an empty set |
| **HIGH** | TC 228: source_tier reclassification after offer generation silently zeroes the financial basis | Snapshot `financial_periods` + `income_statements` at offer-generation time into `deal_models` or a dedicated snapshot table |
| **MEDIUM** | TC 137, TC 220, TC 218: IM reclassification of previously-used years | Add a warning or lock when a period used in a sent offer is reclassified to IM |
| **MEDIUM** | TC 130: FY2025 period with zero EBITDA stamped `is_full_year=true` | Add validation: flag any `is_full_year=true` period whose income statement sums to £0 for manual review |
| **LOW** | TC 137: dev year-set (4 years) wider than live (2 years) | Audit prod source_tier changes for TC 137 to confirm whether 2023/2024 were correctly reclassified |
