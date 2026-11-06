-- #574 ROLLBACK: put the seven document foreign keys back to their pre-#574 rules (SET NULL x5, NO ACTION x2).
-- NOT RUN against any database. Restores the rules only. Rows deleted by a cascade in the meantime are NOT restored (use Neon point-in-time recovery for that).
-- Guard aborts unless every constraint is currently CASCADE, i.e. 574-apply.sql was applied.
-- Usage: psql "$URL" -X -f scripts/migration/574-rollback.sql

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Guard: every constraint must exist, on the expected column, with the expected current rule.
-- Anything else aborts the whole transaction and nothing is changed.
DO $guard$
DECLARE d text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'balance_sheets_source_document_id_fkey' AND conrelid = 'public.balance_sheets'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: balance_sheets_source_document_id_fkey is %, expected FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'document_evidence_analysis_result_id_fkey' AND conrelid = 'public.document_evidence'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (document_analysis_result_id) REFERENCES document_analysis_results(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: document_evidence_analysis_result_id_fkey is %, expected FOREIGN KEY (document_analysis_result_id) REFERENCES document_analysis_results(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'document_evidence_document_id_fkey' AND conrelid = 'public.document_evidence'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: document_evidence_document_id_fkey is %, expected FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'document_evidence_figure_period_id_fkey' AND conrelid = 'public.document_evidence_figure'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (document_evidence_period_id) REFERENCES document_evidence_period(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: document_evidence_figure_period_id_fkey is %, expected FOREIGN KEY (document_evidence_period_id) REFERENCES document_evidence_period(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'document_evidence_period_evidence_id_fkey' AND conrelid = 'public.document_evidence_period'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (document_evidence_id) REFERENCES document_evidence(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: document_evidence_period_evidence_id_fkey is %, expected FOREIGN KEY (document_evidence_id) REFERENCES document_evidence(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'financial_periods_source_document_id_fkey' AND conrelid = 'public.financial_periods'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: financial_periods_source_document_id_fkey is %, expected FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'income_statements_source_document_id_fkey' AND conrelid = 'public.income_statements'::regclass AND contype = 'f';
  IF d IS DISTINCT FROM 'FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE' THEN RAISE EXCEPTION 'guard: income_statements_source_document_id_fkey is %, expected FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE', coalesce(d,'missing'); END IF;
END
$guard$;

ALTER TABLE public.balance_sheets DROP CONSTRAINT balance_sheets_source_document_id_fkey;
ALTER TABLE public.balance_sheets ADD CONSTRAINT balance_sheets_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.document_evidence DROP CONSTRAINT document_evidence_analysis_result_id_fkey;
ALTER TABLE public.document_evidence ADD CONSTRAINT document_evidence_analysis_result_id_fkey FOREIGN KEY (document_analysis_result_id) REFERENCES public.document_analysis_results(id) ON DELETE SET NULL;
ALTER TABLE public.document_evidence DROP CONSTRAINT document_evidence_document_id_fkey;
ALTER TABLE public.document_evidence ADD CONSTRAINT document_evidence_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.document_evidence_figure DROP CONSTRAINT document_evidence_figure_period_id_fkey;
ALTER TABLE public.document_evidence_figure ADD CONSTRAINT document_evidence_figure_period_id_fkey FOREIGN KEY (document_evidence_period_id) REFERENCES public.document_evidence_period(id);
ALTER TABLE public.document_evidence_period DROP CONSTRAINT document_evidence_period_evidence_id_fkey;
ALTER TABLE public.document_evidence_period ADD CONSTRAINT document_evidence_period_evidence_id_fkey FOREIGN KEY (document_evidence_id) REFERENCES public.document_evidence(id);
ALTER TABLE public.financial_periods DROP CONSTRAINT financial_periods_source_document_id_fkey;
ALTER TABLE public.financial_periods ADD CONSTRAINT financial_periods_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.income_statements DROP CONSTRAINT income_statements_source_document_id_fkey;
ALTER TABLE public.income_statements ADD CONSTRAINT income_statements_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

-- Verify inside the transaction; the guard-style check below aborts if any rule is not the target.
DO $verify$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM pg_constraint c WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND ((conname = 'balance_sheets_source_document_id_fkey' AND confdeltype <> 'n') OR (conname = 'document_evidence_analysis_result_id_fkey' AND confdeltype <> 'n') OR (conname = 'document_evidence_document_id_fkey' AND confdeltype <> 'n') OR (conname = 'document_evidence_figure_period_id_fkey' AND confdeltype <> 'a') OR (conname = 'document_evidence_period_evidence_id_fkey' AND confdeltype <> 'a') OR (conname = 'financial_periods_source_document_id_fkey' AND confdeltype <> 'n') OR (conname = 'income_statements_source_document_id_fkey' AND confdeltype <> 'n'));
  IF bad <> 0 THEN RAISE EXCEPTION 'verify: % constraint(s) not at target rule', bad; END IF;
END
$verify$;

-- Guard and verify both passed, so commit. Any failure above aborts the transaction and nothing changes.
COMMIT;
