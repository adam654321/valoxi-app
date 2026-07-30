# Pipeline fidelity fix: assessment

### Method

Three reference companies were read independently from source documents (stages
1 to 6 per reference pack), then compared three ways: reference verdict vs
system dev rerun vs live record. The reference packs live in the Claude project
(REFERENCE-PACK-tc138-cooper-gibson, REFERENCE-PACK-tc228-midland,
REFERENCE-PACK-tc89-innova); the applied action log is the citable record.

### Verdicts

| Company | Reference verdict | System (dev rerun) | System (live) |
|---|---|---|---|
| tc138 Cooper Gibson | NO offer defensible | equity approx 287k vs stored approx 300k, right-looking for wrong reasons | (prior session) |
| tc228 Midland (real deal, KBS 154764) | 320k to 480k indicative, conditional, 7 conditions | offer minus 4,411.55, verdicted faithful | 152,815 SENT to seller 16 Jul, irreproducible, internally inconsistent |
| tc89 Innova | 660k indicative (475k to 900k) | 340,254 | models at minus 771,213.50 and minus 1,762; QoE minus 326,403 at confidence high |

### Findings mapped to the applied action log

- #315 Span integrity broken both directions: a 161-day interim carried model
  months=12 unchecked (tc228 doc 1763); a genuine full year labelled YTD was
  correctly read as 12 months and discarded by storage (tc89 doc 5860).
- #316 Period metadata mutates under later processing: period_end drifts to the
  processing date; months_covered mutates (null to 2 on a 12-month P&L; 5 to 7).
- #317 Comparative-column bleed: FY2024 corporation tax 99,882 applied to
  FY2025 profit, producing net_profit 60,624, a number existing nowhere.
- #318 Balance sheet storage defects: connected-party loans double counted,
  components do not cast to totals, drawings silently netted, FY2026 snapshot
  stored as fiscalYear 2025.
- #319 Debt representation: gross HP control used for net (approx 168k
  overstatement); Funding Circle negative balance netted without challenge.
- #320 Basis-blind averaging: mean over a statutory year, a depreciation-free
  draft and an interim; the draft admitted with no D&A, interest inside admin,
  eight negative expense lines totalling minus 79,079, none flagged.
- #321 QoE fabrication: negative add-back minus 254,209; five directors
  invented from org-chart titles (registry has 2); balance-sheet items deducted
  inside EBITDA; template 57,500 market salary at every company size.
- #322 Adjustment lifecycle: live-era auto-accept and current never-apply, two
  failure states, neither the designed suggested-accepted-applied flow.
- #323 Two EVs and two adjusted EBITDAs coexist per model on all three
  references; EV stored independently of its own bridge.
- #324 Bridge integrity: blind or manual cash, manual round-number debt, token
  tax provision accepted as truth, blind N-months-of-costs working capital.
- #325 Sent offer internally inconsistent (stored 57,284 vs printed 54,284) and
  underivable from any stored state.
- #326 Evidence-carrying document types fail silently: MI pptx never analysed,
  org charts and projections produce nothing, yet figures leak via side
  channels into QoE untraceably.
- #327 Restore path: filenames and provenance destroyed, documents left
  unanalysed, regenerated PDFs strip identity the pipeline needs.
- #328 Fix specification adopted; build slices 1 to 11; this workstream.
- #329 Scoping (positive): statutory extraction verified faithful to the pound
  across 12 statutory year-sets, two FRS 102 formats, abridged and
  identity-stripped included. Only extraction defect class: FRS 105 without an
  operating-profit subtotal (#297). All other failures are downstream.
- #330 Commercial: Midland sent-offer review queued until trustworthy.
tc138 base findings remain #294 to #306; #295 (director loan sign convention)
is a four-company class and direction is a per-date fact, not a per-company
constant.

### Evidence sources and caveats

Dev reruns are the clean evidence; live records are hand corrected and are not.
The audit raw payloads are sound; SUMMARY.md's analysis layer had four
conclusions discarded under #292 and is not citable for them. Gemini runs at
temperature 0; identical runs reproduce.

### What is not broken

Statutory extraction (#329). Content-based classification mostly resolves
document types correctly even under placeholder categories (#262 evidence).
Fix effort belongs downstream of extraction: storage, spans, tiers, QoE,
models, offers.
