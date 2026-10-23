-- Plan 4.6 spot checks. Same output expected on both sides.
-- Usage: psql "$URL" -X -A -t -F '|' -f scripts/migration/spot-checks.sql

SELECT 'SPOT|documents|' || coalesce(max(id)::text, 'null') || '|' || coalesce(max(created_at)::text, 'null') FROM documents;
SELECT 'SPOT|deal_models|' || coalesce(max(id)::text, 'null') || '|' || coalesce(max(created_at)::text, 'null') FROM deal_models;
SELECT 'SPOT|financial_periods|' || coalesce(max(id)::text, 'null') || '|' || coalesce(max(created_at)::text, 'null') FROM financial_periods;
SELECT 'SPOT|document_evidence|' || coalesce(max(id)::text, 'null') || '|' || coalesce(max(created_at)::text, 'null') FROM document_evidence;
SELECT 'VER|' || version();
