# Pipeline Fidelity Fix Specification

Drafted 30 July 2026 from three completed reference packs: tc138 Cooper Gibson,
tc228 Midland, tc89 Innova. Those packs are the requirement evidence; action log
items #294 to #306 plus the tc228/tc89 stage 6 findings are the defect base. This is
a behaviour specification, not a patch list. Where current code differs, current
code changes. Implementation follows the standard cycle: per-slice Replit assess
before any apply.

## 0. Is the evidence base sufficient?

Yes, with two acknowledged gaps that do not block. The three references cover:
wrong-company contamination and tier suppression (138); interim-titled-as-full-year,
restated comparatives, draft admission, balance-sheet sign and netting chaos, offer
decoupling (228); full-year-titled-as-YTD, seasonality, duplicate restores, missing
identity, QoE fabrication, both adjustment-application failure states (89). Gaps:
no reference where an IM corroborates rather than contradicts (does not change any
rule); and current code paths are asserted from observed behaviour, to be confirmed
per slice at assess time.

## 1. Design principles

**P1. Evidence and interpretation are separate stores.**
Documents write to an append-only EVIDENCE layer (per-document extraction results,
anchored, versioned, never overwritten, never deleted). The company's financial
history (CANONICAL layer) is not written by documents at all: it is REBUILT
deterministically by a resolver that reads the entire evidence set. This single move
makes upload order irrelevant, makes reprocessing safe, and ends the entire class of
mutation defects: phantom overwrites (#267), period metadata drifting under later
documents (tc89 months 12→null→2, tc228 period_end drifting to the processing
date), nondeterministic restated-year survivorship (#302, #266), ghost periods.

**P2. Content decides; category advises.**
Document class, company identity, fiscal years, period spans and months covered are
derived from document CONTENT with code-computable checks. The front-end category is
a hint and a cross-check. Content-vs-category disagreement raises a flag; it never
silently decides. This is the answer to "wrong category in the front end": the
category cannot corrupt the record because the record never depends on it. (#306
becomes moot: an unknown or placeholder category simply advises nothing.)

**P3. Code computes; the model reads and narrates.**
Gemini's job is verbatim, anchored field extraction: every figure carries document
id, page, and the label text as printed. Every derived number (months covered,
EBITDA, averages, adjustments, EV, bridge) is computed in code from anchored fields.
Model-supplied derivations (months_covered, ratios, "corrected" figures) are stored
as advisory annotations only. Evidence: Gemini months=12 on a 161-day interim
(tc228) and correct months=12 discarded by storage (tc89) — neither the model nor
the current storage layer is reliable; a date subtraction is.

**P4. Trust states gate valuation.**
Every (year, statement, source) combination carries a trust state:
- VERIFIED: identity-matched statutory, casts pass
- CORROBORATED: management figures that tie to a VERIFIED source within tolerance
- UNCORROBORATED: management/draft with no corroborating source
- SELLER_ASSERTED: IM, MI, broker packs
- CONFLICTED: sources disagree beyond tolerance
- QUARANTINED: failed identity or cast checks
Valuation eligibility = (VERIFIED or CORROBORATED) and full-year and basis-complete.
SELLER_ASSERTED is always stored, always displayed, NEVER eligible, and the display
and every offer document states so explicitly ("IM figures shown for context;
excluded from valuation"). UNCORROBORATED years may be made eligible only by
explicit user acceptance, recorded on the model.

**P5. Absence is a first-class fact.**
Every suppression, exclusion and gap is recorded and rendered ("FY2021 exists only
in the IM: stored, excluded, here is why"). Experts receive a data-availability
manifest and must return explicit gaps instead of filling them. Every gap statement
names the data that would close it. Enforced, not requested: see section 5.

## 2. Ingest and extraction (the foundation)

2.1 **Identity block per document.** Extract: company names found (all variants),
registered numbers, year end, directors named, accountant, draft/abridged/signed
markers, print or report date. Registered numbers found in documents are written
into the evidence layer as first-class fields.

AMENDED 31 July 2026 (#338, #294). The identity key is the REGISTERED NUMBER.
Name is a weak corroborator only and never decides a verdict on its own. This is
forced by evidence: target_companies had no company_number column at all, so no
registered number was stored anywhere in the system, and the registry record for
the live Midland deal (dev clone 1877, prod tc228, the deal that received a
£152,815 offer) is named "Thor-CON" while every document in it reads Midland Air
Conditioning & Facility Management Ltd, 06858221. A name-based check would
quarantine an entire genuine document set. The registry record is therefore
treated as UNVERIFIED INPUT, not as authority. target_companies.company_number
(added slice 1a, nullable, unpopulated) is backfilled from document consensus,
never trusted from user input alone.

Identity verdict computed in code, document identity against the registry record:
- MATCH: registered numbers agree. Proceed.
- MISMATCH: registered numbers disagree, or names contradict with no number on
  either side. QUARANTINE. The document is stored, visible, and contributes
  nothing to financial history. (Kills tc138 doc 854 permanently.)
- ABSENT (no identity in document, e.g. tc89 restores): admit with flag; its figures
  reach CORROBORATED at best (they can confirm a verified source, never stand alone).
- VARIANT (name differs, number matches or absent with strong overlap): one-time
  user confirmation, remembered.
- REGISTRY_UNVERIFIED (fourth verdict path, added 31 July 2026): the registry
  record carries no registered number, or carries a name contradicted by a
  document set that is internally consistent. The DOCUMENTS are admitted
  normally; the REGISTRY RECORD is flagged for correction. This is
  registry-wrong as distinct from document-wrong and must never quarantine
  documents. Resolution offers the user the document consensus, name and
  number, as the correction.

2.2 **Span engine in code.** For each period found in a document: period_start,
period_end from content; months = date arithmetic; is_full_year = (months = 12 AND
period_end = company year end). Cross-checks, all code-computed where inputs exist:
print date vs period_end (print date before stated period end ⇒ interim, tc228 doc
1763); YTD label vs computed span (a YTD ending on the year end IS a full year,
tc89); payroll-ratio and BS current-year-earnings tie-outs as corroborators.
Comparative columns create their own period evidence with provenance "comparative
column of doc N". Column discipline: a figure stored for year Y must come from year
Y's column (kills the tc89 tax bleed: FY2024's 99,882 applied to FY2025).

2.3 **Cast checks in code, recorded per document.** P&L casts (GP, OP, PBT chain),
BS casts (net assets = capital + reserves; components sum to totals), cross-document
ties where available (retained earnings roll-forward, BS CY earnings = P&L PBT,
asset register vs BS). Anomalies recorded as structured facts, never silently
handled: negative expense lines (Midland's £79,079 lease credits), suspense balances,
negative loan accounts (Funding Circle −9,859), interest lines inside admin cost
detail. An anomaly does not block storage; it blocks TRUST (year marked
basis-suspect until resolved) and it must surface in QoE candidates and receipts.

2.4 **Signed balances with direction semantics.** Director and related-party
balances stored as signed values on directional fields (owed_by_directors /
owed_to_directors; owed_by_connected / owed_to_connected). abs() is removed
everywhere, including the sign-convention text in the reconciled input (#295: the
inverted instruction currently ships verbatim to experts). Direction is per-date
fact: tc89's DLA genuinely flips sign between FY2024 and May 2026. Control-account
groups (Midland HP) store components AND the net, with the net used downstream and
the components displayed.

2.5 **Duplicates.** Same content hash = same evidence item (tc89 #6). Same year +
same figure-set within tolerance + different bytes = same underlying document,
linked (identity-stripped restores). The resolver sees one evidence item with
multiple files, so re-uploads and restores can never double-write or overwrite.

2.6 **No deletion, no mutation.** Re-extraction appends a new evidence version.
The restore path must preserve original filenames and provenance (live tc89
currently renames all documents "Restored document (N of 16)" and drops analysis).

## 3. The resolver (canonical financial history)

3.1 A pure, versioned function: full evidence set in, canonical history out.
Reruns from scratch on any evidence change. Every downstream consumer (experts,
deal models, offers) references the resolver snapshot id it was computed from. This
is what makes the pipeline order-independent and auditable: shuffle the upload
order and the canonical output must be byte-identical (this is an acceptance test).

3.2 **Precedence per year per statement**: latest signed statutory (restatements:
the later signed set wins, and the superseded version is retained and DISPLAYED as
"restated", Midland FY2023 136,526 vs 132,092) > accountant final > CORROBORATED
management > UNCORROBORATED management > SELLER_ASSERTED. Conflicts beyond tolerance
between admissible sources set the year CONFLICTED, which blocks valuation for that
year until the user picks, and the pick is recorded.

3.3 **Part years** are canonical rows of their own kind: period dates, months,
prior-year same-period comparative where derivable in code (Innova: full year minus
later months). They are never eligible for averaging or annualisation. Display: a
visually distinct YTD row (Adam's requirement), never a year column.

3.4 The reconciled read (getReconciledFinancials successor) reads ONLY canonical
plus the manifest. Tier suppression as it exists today is replaced by trust states:
nothing admissible is silently dropped (tc138's genuine FY2022/23 inside an IM is
stored and displayed with its state; tc228's MI contradiction of the interim is
surfaced as a CONFLICT instead of suppressed).

## 4. Derivations

4.1 EBITDA per year in code: operating profit excluding interest (with anchored
correction when interest sits inside admin detail, Midland) plus D&A. If D&A is
absent from the source (Midland drafts), the year is BASIS-INCOMPLETE: stored,
displayed with the flag, ineligible until user-accepted with the gap stated.

4.2 One-off register per year, as facts not applications: grants, disposal
gains/losses, prior-year tax adjustments, elevated bad debts, negative expense
anomalies. Feeds QoE as the ONLY candidate pool for one-off adjustments.

4.3 Averaging: only over valuation-eligible years on a shared basis; the window is
displayed year by year; basis-blind and span-blind averaging is impossible by
construction (tc228's statutory/draft/interim mean; tc138's collapsing-business
mean is addressed by trend disclosure on the panel, with the analyst choosing the
basis and the choice recorded).

## 5. Experts (agents)

5.1 **Inputs**: canonical figures with trust states and anchors; the one-off and
anomaly registers; the registry director list; the data-availability manifest
(what does not exist: e.g. no customer split, no LTL composition).

5.2 **Grounding contract, enforced by a validator in code**, not by prompt hope:
- Every numeric claim in expert output must carry an anchor reference resolvable
  against the input. Unanchored numbers reject the claim's section.
- Director-related outputs must use the registry director count and names. (Kills
  tc89's "5 working directors" from org-chart job titles, and #300's zero-salary.)
- Adjustments must be members of the computed candidate pool (section 5.4), with
  year, anchor and arithmetic. Novel categories, novel amounts, negative add-backs
  "correcting" figures reject. (Kills −254,209.)
- Balance-sheet items (provision shortfalls, capex gaps) may not be deducted from
  EBITDA; they route to the bridge/DD list. (Kills the 52,988 and pro-forma
  depreciation category errors.)
- **Rejection is SECTION-LEVEL, not agent-level.** Expert output is structured into
  named sections; the validator passes or rejects each section independently. A
  rejected section is re-run once with the named violation; on second failure ONLY
  that section renders as "ANALYSIS NOT AVAILABLE", stating (a) the reason it
  failed or the data that was missing, and (b) **exactly what data must be added to
  produce it** (e.g. "supply FY2025 statutory accounts or the accountant's final
  trial balance to enable the earnings-quality narrative"; "supply a customer
  revenue split to enable concentration analysis"). All valid sections publish
  normally alongside it. The expert as a whole fails only if EVERY section fails,
  and that whole-agent failure carries the same reason-plus-required-data
  statement. A missing narrative is an acceptable output; a fabricated one is not.
- Scores and confidence are computed in code over the sections that published, and
  capped as trust states and coverage fall; a partially available analysis states
  its coverage ("4 of 6 sections available").

5.3 **Gaps are output.** Expert schema includes gaps[]: each gap carries the
missing-data statement ("what to add to get this output") and is rendered to the
user verbatim. Synthesis aggregates every gap and unavailable section across all
experts into a single "what this analysis could not cover, and what would unlock
it" list: that list doubles as the seller information request.

5.4 **QoE adjustment candidates are code-computed**, model-narrated:
- Director normalisation from registry directors, actual remuneration (salary +
  pension, anchored) and a replacement-cost matrix scaled by revenue band and role
  coverage, capped by second-tier evidence. Direction can be a deduction (tc89) or
  net add-back; the arithmetic is code.
- One-off reversals only from the one-off register (correct sign: an expensed
  one-off is an add-back; tc228 deducted one).
- Rent normalisation only when a related-party premises fact exists.
- Broker add-backs from IMs are imported as SELLER_ASSERTED claims for comparison,
  never as candidates.

## 6. Deal model and offer

6.1 **One truth per model version**: one basis (chosen years, displayed), one
calculated figure, one adjustments set with lifecycle
suggested → accepted/modified/rejected (applied ONLY when accepted; auto-accept is
removed and prevented by a DB constraint that new adjustments are created
suggested), one adjusted figure, one EV. The two-EV/two-EBITDA state observed on
all three references becomes unrepresentable: EV is computed, not stored
independently.

6.2 **Valuation basis panel** (the pull-through Adam specified): per-year rows with
figures, trust state and basis flags; YTD rows visually distinct and excluded;
SELLER_ASSERTED rows visually distinct with the fixed legend "IM figures: shown for
context, never used in valuation". The offer document carries the same statements.

6.3 **Bridge**: every line itemised and anchored to the canonical BS: cash
(actual), debt schedule (itemised; control-account nets; unresolved items like the
Funding Circle contradiction appear as UNRESOLVED and block sending, not silently
zeroed or grossed); tax (expected liability computed from PBT and rate vs booked
provision, shortfall shown: kills accepting a £1,208 provision as truth); working
capital as an explicit peg-vs-actual calculation with method and inputs displayed,
seasonally aware where monthly data exists. The blind "N months of costs" deduction
(160,557 / 349,824 / 107,038) is removed. Manual entries are permitted but
rendered as MANUAL with a required note (kills the untraceable 150,000/15,000).

6.4 **Guards, hard**:
- No model and no offer without at least one valuation-eligible year (#296).
- A computed offer ≤ 0 is a "no offer supportable" outcome with reasons; it cannot
  be stored as a price or sent (tc228 −4,411; tc89 −771,213).
- Offers regenerate from the current model version at send time and store model
  version + resolver snapshot id; a model recalculation invalidates unsent drafts
  (kills the model-147/150 sixty-second decoupling and the 57,284/54,284 split).
- The faithfulness check compares offer figures to model figures to canonical
  anchors, and fails loudly on any break.

## 7. User interaction: receipts, not categories

Adam's confirm-before-write idea, shaped to stay simple:

7.1 **Document Receipt.** After extraction, each document produces one receipt:
"This is [class] for [company] covering [periods]. It will be recorded as [rows,
trust states]. Checks passed: N. Flags: M."

7.2 **Auto-commit path (the default).** If identity MATCH, casts pass, no
conflicts, no anomalies, and category (if any) agrees: the receipt auto-commits
with no user action. This is the "system just gets it right in the background"
path, and on the reference evidence it is the COMMON path: all nine statutory sets
across the three companies would sail through untouched.

7.3 **Interrupt path (the exception).** Only flagged receipts ask anything, one
card per flag, plain language, safe default:
- "This document appears to be for a different company (CGA Personnel Ltd,
  04385315). It has been quarantined. [Keep quarantined] / [It is genuinely
  relevant, include as context]"
- "Titled 'YE 31.03.2026' but covers 1 Apr to 8 Sept 2025 (161 days). Recording as
  a 5-month YTD. [Confirm] / [Correct]"
- "FY2023 exists in two versions (profit 136,526 / 132,092 restated). Using the
  restated signed set. [Confirm] / [Choose]"
- "Eight negative expense lines totalling −£79,079. Recorded and flagged; this
  year is not valuation-eligible until explained. [Acknowledge]"
Every answer is recorded on the evidence item. Users never pick categories to make
the system work; the category picker becomes an optional hint. This is LESS front-
end burden than today, not more.

7.4 Honest limit: full automation cannot decide identity mismatches, genuine
conflicts, or adjustment acceptance: those are the user's facts and choices. The
design minimises them to the cases where a human answer is genuinely required and
makes every other document zero-touch.

## 8. Migration and repair

- Backfill: run extraction to evidence for all existing documents (live tc89 has
  none), rebuild canonical per company in shadow mode, diff against live tables,
  review diffs (expect: #267 FY2025 restored; tc228 re-tiered years corrected;
  ghost periods collapsed), then cut reads over.
- Restore path fixed to preserve names/provenance; redaction of regenerated PDFs
  investigated separately (it deletes director identity, which the pipeline needs).
- Adjustment rows on live models re-baselined to the lifecycle model; previously
  auto-accepted rows flagged for re-confirmation.

## 9. Acceptance tests (the packs, executable)

Fixtures encode the three references end to end. Non-negotiable assertions:
1. Order-independence: any upload permutation of each reference set yields
   byte-identical canonical history.
2. tc138: doc 854 quarantined; stored series never contains 14,679/18,202; FY2022
   IM figures stored, displayed, excluded with statement; director loan is an asset.
3. tc228: doc 1763 stored as 161-day YTD regardless of title, category or model
   months; FY2025 draft flagged basis-incomplete (no D&A) and anomalous (−79,079);
   FY2023 restatement resolved deterministically with both versions visible; DLA
   and drawings signed, not abs'd, drawings not netted into otherCreditors; HP net
   134,756.53; no offer possible while zero eligible years; a negative computed
   offer cannot be sent.
4. tc89: "YTD Oct-25" recorded as full FY2025; May-26 as 7-month YTD, never
   annualised, shown in the YTD row; identity-absent restores link to originals,
   no duplicate years; five statutory EBITDA values exact to the pound; QoE cannot
   emit a 5-director adjustment or a −254,209 add-back (validator rejects at
   section level, other sections still publish); model holds exactly one EV;
   live-style auto-accepted adjustments impossible.
5. All three: every expert output passes the grounding validator section by
   section; rejected sections render as "ANALYSIS NOT AVAILABLE" with reason and
   required-data statement while valid sections publish; a whole expert fails only
   when all its sections fail; every offer regenerates at send and reconciles
   offer = model = canonical.

## 10. Build order (one concern per slice)

1. Evidence layer, SPLIT (amended 31 July 2026):
   1a. Schema only, no reads, no writes. SHIPPED dev and prod 31 July.
   1a.1. Foreign key ON DELETE correction (#337). SHIPPED dev and prod 31 July.
   1b. Shadow write path behind system_config key evidence_shadow_write_enabled,
       off by absence. SHIPPED dev and prod 31 July, dev flag false, no prod row.
   1c. Prompt extension: period start, report_date reliability, identity block
       including registered number, page and label anchors. ALL prompt changes
       in the whole programme are consolidated here. Rationale: extraction is
       proven faithful to the pound across twelve statutory year sets (#329),
       which is the one thing that provably works, so every prompt edit is a
       fresh regression risk against it. 1c ships only after all three reference
       companies are re-run and diffed to the pound.
2. Identity block + span engine + cast checks writing to evidence.
3. Resolver + canonical schema, SHADOW mode with diff reports.
4. Receipts + flag cards (front end). DISPLAY ONLY.
5. Cutover: reconciled read from canonical; tier logic replaced by trust states;
   category demoted to hint.
6. Derivations: EBITDA, one-off register, basis rules, averaging constraints.
7. Expert input manifest + section-level grounding validator + gaps rendering.
8. QoE candidate computation + adjustment lifecycle (suggested-only creation).
9. Deal model single-truth, basis panel, bridge itemisation, guards.
10. Offer regeneration-at-send + faithfulness check.
11. Migration backfill + acceptance fixtures wired into CI.

AMENDED 31 July 2026: "category demoted to hint" moves from slice 4 to slice 5.
Demoting it at slice 4 would remove the only live protection against the tc228
161-day interim while the code span engine is still writing to evidence only and
protecting nothing on the live read path. Slice 4 is receipts and flag cards,
display only.

Each slice: assess prompt first, apply with pre-step re-greps, V-check with grep
assertions, stop. Schema changes by direct ALTER with explicit constraint names
(#188/#189 rules). Nothing prod-touching without a TARGET: PROD header. Connection proof is
SELECT current_database(), inet_server_addr() run inside the same connection that
does the work, using an explicit connection string; printing a hostname proves
nothing (LN-017, #334).

## 11. Release strategy (added 31 July 2026)

Slices 1 to 3 are dark and additive: they write evidence and shadow canonical,
change no user-visible behaviour, and each is deployable alone. Slice 5 is the
only cutover. It is released alone, per company, behind a flag, gated on reviewed
shadow diffs, and is instantly reversible. Slices 6 to 10 each ship alone
afterwards.

Four mandatory deploy gates: after 1c, after 3, after 5, after 10. Never more
than two slices of undeployed work at any time.

Shadow diffs are only meaningful against prod's real document set, so the shadow
layer must be live and dark on prod to tell us anything true. That is why the
evidence layer shipped to prod empty and behind a kill switch rather than waiting
for the full build to be finished.
