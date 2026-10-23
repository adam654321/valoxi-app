-- Structure fingerprint of the public schema. Compare against pg_restore --list of the dump,
-- or between two databases. One line per check.
-- Usage: psql "$URL" -X -A -t -F '|' -f scripts/migration/structure-checks.sql

SELECT 'STRUCT|tables|' || count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'STRUCT|views|' || count(*) FROM information_schema.views WHERE table_schema = 'public';
SELECT 'STRUCT|fk_constraints|' || count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'f';
SELECT 'STRUCT|pk_constraints|' || count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'p';
SELECT 'STRUCT|unique_constraints|' || count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'u';
SELECT 'STRUCT|check_constraints|' || count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'c';
SELECT 'STRUCT|indexes|' || count(*) FROM pg_indexes WHERE schemaname = 'public';
SELECT 'STRUCT|enums|' || count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e';
SELECT 'STRUCT|fk_names_md5|' || coalesce(md5(string_agg(c.conname, ',' ORDER BY c.conname)), 'none') FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'f';
SELECT 'STRUCT|index_names_md5|' || coalesce(md5(string_agg(indexname, ',' ORDER BY indexname)), 'none') FROM pg_indexes WHERE schemaname = 'public';
