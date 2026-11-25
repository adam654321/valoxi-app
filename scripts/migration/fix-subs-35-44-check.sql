-- READ ONLY. Shows subs 35 and 44 before/after fix-subs-35-44-apply.sql.
-- Usage: psql "$URL" -X -A -t -F '|' -f scripts/migration/fix-subs-35-44-check.sql
-- Expected BEFORE: both 'active'. Expected AFTER: both 'canceled', canceled_at set, one admin event each.
SELECT 'SUB|' || id || '|' || user_company_id || '|' || status || '|' || coalesce(stripe_subscription_id,'') || '|' || coalesce(canceled_at::text,'')
FROM subscriptions WHERE id IN (35, 44) ORDER BY id;
SELECT 'EVT|' || user_company_id || '|' || event_type || '|' || coalesce(previous_status::text,'') || '>' || coalesce(new_status::text,'') || '|' || processed_at
FROM subscription_events WHERE user_company_id IN (34, 56) AND event_type = 'admin.reconciled_already_canceled' ORDER BY id;
