# Pipeline fidelity fix: plan

## Purpose

Rebuild the ingest-to-offer pipeline so every number a user sees is anchored to
document evidence, derived in code, and reproducible. Requirement document:
spec.md in this folder (verbatim copy of the agreed fix specification, 30 July
2026). Defect base: action log #294 to #306 (tc138 Cooper Gibson) and #315 to
#330 (tc228 Midland, tc89 Innova; adoption item #328). Acceptance fixtures: the
three reference packs, including upload-order permutation tests (spec s9).

## Principles (full text in spec.md s1)

P1: evidence and interpretation are separate stores. Append-only evidence layer;
canonical history rebuilt by a deterministic resolver. Upload order irrelevant.
P2: content decides identity, class and span; the front-end category is a hint.
P3: code computes; the model extracts verbatim anchored fields and narrates.
P4: trust states (VERIFIED / CORROBORATED / UNCORROBORATED / SELLER_ASSERTED /
CONFLICTED / QUARANTINED) gate valuation; tier suppression is removed.
P5: absence is a first-class fact; gaps are rendered with the data that would
unlock them.

## Build slices (one concern per slice; assess before apply; V-check; stop)

Slice 1: evidence layer, split three ways (amended 31 July 2026).
  1a schema only. SHIPPED dev and prod 31 July. 1a.1 FK ON DELETE correction, #337.
  1b shadow write path behind evidence_shadow_write_enabled. SHIPPED dev and prod.
  1c prompt extension, all programme prompt changes consolidated here, ships only
     after all three reference companies are re-run and diffed to the pound (#329).
Slice 2: identity block, span engine, cast checks writing to evidence (#294, #315, #317, #318 casts, #326, #338).
Slice 3: resolver plus canonical schema, SHADOW mode with diff reports (#316, #266, #302). Database uniqueness constraints considered here, duplicate count first (#332).
Slice 4: receipts and flag cards in the front end. Display only (#262, #305).
Slice 5: cutover, reconciled read from canonical, tier logic replaced by trust states, category demoted to hint (#299, #306, #333).
Slice 6: derivations, EBITDA in code, one-off register, basis rules, averaging constraints (#297, #298, #301, #320, #331).
Slice 7: expert input manifest, section-level grounding validator, gaps rendering (#300, #303, #304, #295 instruction text).
Slice 8: QoE candidates code-computed, adjustment lifecycle created-suggested-only (#321, #322, #261).
Slice 9: deal model single truth, valuation basis panel, bridge itemisation, hard guards (#296, #319, #323, #324).
Slice 10: offer regeneration at send plus faithfulness check (#325, #261).
Slice 11: migration backfill, restore path fix, acceptance fixtures wired into CI (#267, #327).

## Cycle rules

Assess, analyse, apply, V-check, authorise. Apply prompts carry pre-step
re-greps. V-checks carry grep assertions with expected counts and demand verbatim
output, not a summary. Schema changes by direct ALTER with explicit constraint
names (#188, #189). db:push is never run. Drizzle was re-baselined 31 July 2026:
journal at a single entry, drizzle-kit generate emits nothing, the prior journal
is in migrations_archive_20260731/, and accepted database-vs-schema deltas are
recorded in docs/drizzle-rebaseline/drift-register.md with four queued work items.
Nothing prod-touching without a TARGET: PROD header. Connection proof is
SELECT current_database(), inet_server_addr() run inside the same connection that
does the work, using an explicit connection string; printing a hostname proves
nothing (LN-017, #334). Three databases are reachable from the workspace: helium/
heliumdb is dev, ep-old-recipe-an7e4afw is prod and is inspection only, and
ep-green-recipe-af850azd/neondb is a dormant branch last written 24 February 2026
that any bare psql hits silently and successfully. Every prompt stops after V-check.

## Release strategy (added 31 July 2026)

Slices 1 to 3 are dark and additive, each deployable alone. Slice 5 is the only
cutover: released alone, per company, behind a flag, gated on reviewed shadow
diffs, instantly reversible. Slices 6 to 10 each ship alone afterwards. Four
mandatory deploy gates: after 1c, after 3, after 5, after 10. Never more than two
slices of undeployed work.

## Risk register

- Shadow-mode diffs (slice 3) will disagree with live rows that were hand
  corrected; dev reruns are the clean comparator (#292 caveat).
- Cutover (slice 5) changes every financial read; gated on slice 3 shadow diffs
  reviewed per company before any read moves.
- Migration (slice 11) touches prod data; staged behind the full acceptance
  fixture set passing in CI.
- Restore-path redaction strips director identity the pipeline needs; separate
  investigation before the backfill relies on regenerated PDFs (#327).

## Open decisions

- Replacement-cost salary matrix values (revenue band by role coverage) need
  sign-off before slice 8.
- Tolerance thresholds for CORROBORATED ties and CONFLICTED detection, to be
  fixed at slice 3 assess.
- Midland commercial revisit (#330) queued until the system is trustworthy.
