-- Exact row counts for every public base table, then every sequence position.
-- Run the same file against both sides (source and restored copy), within the same minute.
-- Output is tab-free, one row per line, so two outputs can be diffed.
-- Usage: psql "$URL" -X -A -t -F '|' -f scripts/migration/table-counts.sql

SELECT 'COUNT|' || table_name || '|' ||
  (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT 'SEQ|' || sequencename || '|' || coalesce(last_value::text, 'null')
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
