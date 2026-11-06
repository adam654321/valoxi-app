-- #574 pre/post check. READ ONLY. Safe on any database.
-- Shows the ON DELETE rule and full definition of the seven document foreign keys, plus
-- how many dependent rows exist (these are the rows a future document delete would remove after #574).
-- Usage: psql "$URL" -X -A -t -F '|' -f scripts/migration/574-precheck.sql
-- Expected BEFORE #574: SET NULL x5, NO ACTION x2. Expected AFTER #574: CASCADE x7.

SELECT 'FK574|' || c.conrelid::regclass || '|' || c.conname || '|'
  || CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                        WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END
  || '|' || pg_get_constraintdef(c.oid)
FROM pg_constraint c
WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND c.conname IN (
  'balance_sheets_source_document_id_fkey',
  'document_evidence_analysis_result_id_fkey',
  'document_evidence_document_id_fkey',
  'document_evidence_figure_period_id_fkey',
  'document_evidence_period_evidence_id_fkey',
  'financial_periods_source_document_id_fkey',
  'income_statements_source_document_id_fkey')
ORDER BY c.conname;

-- Must print 7 (a missing constraint means the names in assessment.md section 5 no longer match).
SELECT 'FK574_FOUND|' || count(*) FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND conname IN (
  'balance_sheets_source_document_id_fkey','document_evidence_analysis_result_id_fkey',
  'document_evidence_document_id_fkey','document_evidence_figure_period_id_fkey',
  'document_evidence_period_evidence_id_fkey','financial_periods_source_document_id_fkey',
  'income_statements_source_document_id_fkey');

-- Rows that reference a document (what a document delete would take with it after #574).
SELECT 'DEP574|balance_sheets|' || count(*) FROM public.balance_sheets WHERE source_document_id IS NOT NULL;
SELECT 'DEP574|income_statements|' || count(*) FROM public.income_statements WHERE source_document_id IS NOT NULL;
SELECT 'DEP574|financial_periods|' || count(*) FROM public.financial_periods WHERE source_document_id IS NOT NULL;
SELECT 'DEP574|document_evidence|' || count(*) FROM public.document_evidence WHERE document_id IS NOT NULL OR document_analysis_result_id IS NOT NULL;
SELECT 'DEP574|document_evidence_period|' || count(*) FROM public.document_evidence_period;
SELECT 'DEP574|document_evidence_figure|' || count(*) FROM public.document_evidence_figure;
