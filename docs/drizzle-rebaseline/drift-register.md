# Drizzle Re-baseline Drift Register

**Date:** 2026-07-31  
**Source:** `docs/drizzle-rebaseline/drift-report-20260731.sql.md` (587 lines)  
**Prod introspection:** `docs/drizzle-rebaseline/prod-introspection-20260731.ts.md`  
**Policy:** The live DB is the authority for items marked ACCEPTED. Do not generate or run migrations to close these deltas without a dedicated slice that has been reviewed and approved.

---

## ACCEPTED DELTAS (live DB is authoritative)

### 1. FK constraint name convention — 155 pairs

All 155 pairs are pure cosmetic renames. Postgres auto-assigned names end `_fkey`; Drizzle's naming convention generates `_<referenced_table>_<referenced_col>_fk`. Same table, same column, same `ON DELETE`/`ON UPDATE` semantics in every case. No action required; Drizzle will re-emit these on every generate until the DB constraints are renamed, which is not worth the lock cost.

### 2. Unmanaged objects: session table and views

| Object | Type | Notes |
|---|---|---|
| `session` | table | Used by `connect-pg-simple` session store. Not in schema.ts; DB authority. |
| `public.activity_summary` | view | Unmanaged view in DB. Not in schema.ts. |
| `public.deal_progression` | view | Unmanaged view in DB. Not in schema.ts. |
| `public.pipeline_summary` | view | Unmanaged view in DB. Not in schema.ts. |
| `public.stage_1_progress` | view | Unmanaged view in DB. Not in schema.ts. |
| `session` RLS | DISABLE ROW LEVEL SECURITY | Postgres RLS flag on session table. Artefact of pull. |

### 3. Unmanaged indexes — all 25 from the drift report

Indexes 1–4 were resolved by adding declarations to `shared/schema/evidence.ts` in this re-baseline. Indexes 19–25 are already declared in schema (rename cycle only). Indexes 6–18 exist in the DB but have no schema declaration — accepted as live-DB authority until a dedicated slice adds them.

| # | Index name | Status |
|---|---|---|
| 1 | `idx_document_evidence_company` | ✅ Fixed — declared in `evidence.ts` |
| 2 | `idx_document_evidence_document` | ✅ Fixed — declared in `evidence.ts` |
| 3 | `idx_document_evidence_period_evidence` | ✅ Fixed — declared in `evidence.ts` |
| 4 | `idx_document_evidence_figure_period` | ✅ Fixed — declared in `evidence.ts` |
| 5 | `current_offers_target_company_unique` | ACCEPTED — DB authority, no schema declaration |
| 6 | `users_email_lower_idx` | ACCEPTED — DB authority, no schema declaration |
| 7 | `marketing_consent_tokens_user_id_idx` | ACCEPTED — DB authority, no schema declaration |
| 8 | `marketing_consent_tokens_waitlist_id_idx` | ACCEPTED — DB authority, no schema declaration |
| 9 | `idx_documents_public_token` | ACCEPTED — DB authority, no schema declaration |
| 10 | `idx_company_requirements_company` | ACCEPTED — DB authority, no schema declaration |
| 11 | `idx_stage_progression_company` | ACCEPTED — DB authority, no schema declaration |
| 12 | `idx_funnel_events_created_at` | ACCEPTED — DB authority, no schema declaration |
| 13 | `idx_funnel_events_event` | ACCEPTED — DB authority, no schema declaration |
| 14 | `idx_team_notifications_user` | ACCEPTED — DB authority, no schema declaration |
| 15 | `idx_user_deal_assignments_company` | ACCEPTED — DB authority, no schema declaration |
| 16 | `idx_user_deal_assignments_user` | ACCEPTED — DB authority, no schema declaration |
| 17 | `idx_user_invitations_email` | ACCEPTED — DB authority, no schema declaration |
| 18 | `idx_user_invitations_token` | ACCEPTED — DB authority, no schema declaration |
| 19 | `waitlist_created_at_idx` | Schema-managed; DROP+re-CREATE rename cycle only |
| 20 | `waitlist_status_idx` | Schema-managed; DROP+re-CREATE rename cycle only |
| 21 | `nylas_grants_one_company_default_per_company` | Schema-managed; rename cycle only |
| 22 | `nylas_grants_one_personal_default_per_user` | Schema-managed; rename cycle only |
| 23 | `nylas_grants_user_company_idx` | Schema-managed; rename cycle only |
| 24 | `nylas_grants_user_status_idx` | Schema-managed; rename cycle only |
| 25 | `webhook_events_stripe_event_id_idx` | Schema-managed; rename cycle only |

### 4. Column default / type representation — 43 ALTER COLUMN statements

Drizzle's introspected snapshot encodes column defaults and data types differently from the TypeScript schema declarations in several places. These are representation differences only — the data on disk is unaffected. Key item confirmed 2026-07-31:

- **`document_analysis_results.usage_metadata`**: DB stores as `text`; schema declares `json`. Do not change without a dedicated slice that has been reviewed against all read paths.

The remaining 42 cover: `portal_access_tokens` (5 columns), `company_document_requirements` (3), `external_document_submissions` (6), `dashboard_alerts` (1), `dashboard_preferences` (1), `portal_activity_log` (4), `portal_document_requirements` (9), `stage1_analysis_events` (4), `promo_code_campaigns` (1), `user_invitations` (1), `subscriptions` (1), `deal_models` (1), `addon_purchases` (1). All are default-value or minor type-width differences with no data impact.

### 5. CHECK constraint permanently absent from schema

| Constraint | Table | Status |
|---|---|---|
| `deal_documents_delivery_method_check` | `deal_documents` | ACCEPTED — no reference in any server or shared code (`grep` confirmed 0 hits 2026-07-31). DB authority. |
| `waitlist_status_check` | `waitlist` | Schema-managed; DROP+re-ADD cycle only. |
| `marketing_consent_tokens_recipient_check` | `marketing_consent_tokens` | Schema-managed; DROP+re-ADD cycle only. |

### 6. UNIQUE constraint conversion

| Constraint | Status |
|---|---|
| `chase_up_emails_token_seq_unique` | ACCEPTED — DB has it as a UNIQUE constraint; schema declares it as `CREATE UNIQUE INDEX` with the same name and columns. Semantically equivalent. |

---

## QUEUED WORK (schema is authoritative; DB needs to be brought in line via explicit migrations)

### QW-1. Five FKs declared in schema but absent from the live DB

These foreign keys exist in `shared/schema/*.ts` but were not present in the prod introspection snapshot. Each requires an explicit `ALTER TABLE … ADD CONSTRAINT` migration before it can be enforced.

| Table | Column | References |
|---|---|---|
| `deal_model_adjustments` | `source_expert_result_id` | `expert_analysis_results.id` ON DELETE no action |
| `portal_activity_log` | `related_document_id` | `external_document_submissions.id` ON DELETE no action |
| `portal_document_requirements` | `target_company_id` | `target_companies.id` ON DELETE no action |
| `portal_document_requirements` | `submitted_document_id` | `external_document_submissions.id` ON DELETE no action |
| `stage1_analysis_events` | `detailed_analysis_triggered_by` | `users.id` ON DELETE no action |

### QW-2. FK losses — constraints in DB that schema dropped silently

| Table | Dropped FK | Impact |
|---|---|---|
| `users` | `users_assigned_promo_campaign_id_promo_code_campaigns_id_fk` (`users.assigned_promo_campaign_id → promo_code_campaigns.id`) | FK dropped from schema at some point; DB still enforces it. If this column is written in code, the constraint may block writes. Verify and either re-add to schema or issue a DROP CONSTRAINT migration. |
| `current_offers` | `current_offers_deal_model_id_fkey` (`current_offers.deal_model_id → deal_models.id`) | FK dropped from schema; DB still enforces it. Verify intentionality. |

### QW-3. Four `value_creation_*` FK ON DELETE discrepancies (latent cascade-delete bug candidate)

The live DB has constraints named `vc_*_fk` (manually named, ON DELETE behaviour unknown from introspection alone). The schema declares all four with `ON DELETE CASCADE`. If the DB constraints currently use `NO ACTION`, deleting a `deal_models` row or `value_creation_scenarios` row will behave differently in dev/test (where schema is authoritative via generate) vs prod (where the old constraint is in place). Verify the current DB ON DELETE clause with `\d value_creation_scenarios` and either align the DB or remove the CASCADE declaration from schema.

| Table | DB constraint name | Schema ON DELETE |
|---|---|---|
| `value_creation_scenarios` | `vc_scenarios_deal_model_id_fk` | CASCADE |
| `value_creation_assumptions` | `vc_assumptions_scenario_id_fk` | CASCADE |
| `value_creation_exit_assumptions` | `vc_exit_deal_model_id_fk` | CASCADE |
| `value_creation_synergies` | `vc_synergies_scenario_id_fk` | CASCADE |

### QW-4. Columns present in DB but absent from schema

| Table | Column | Classification |
|---|---|---|
| `deal_documents` | `notes` | Present in live DB (confirmed by prod introspection); absent from `shared/schema/deal-documents.ts` (0 hits confirmed 2026-07-31). No reference in any server/ or shared/ source code. Either add to schema to prevent accidental data loss on future migrations, or issue an explicit DROP COLUMN migration. |
| `deal_model_funding_lines` | `interest_as_ebitda_adjustment` | Present in live DB; absent from schema. Referenced only in a test comment (`shared/calculators/__tests__/deal-model.calc.test.ts:477`) — not live code. Same decision required: add to schema or explicit drop. |
