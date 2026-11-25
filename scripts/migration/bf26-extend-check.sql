-- READ ONLY. Shows the two Black Friday campaign rows before/after bf26-extend-apply.sql.
-- Usage: psql "$URL" -X -A -t -F '|' -f scripts/migration/bf26-extend-check.sql
-- Expected BEFORE: both active, expires_at 2026-12-01 00:00:00. Expected AFTER: 2026-12-05 00:00:00.
-- expires_at has no time zone and is read as UTC: 2026-12-05 00:00:00 is the end of Friday 4 December, UK time.
SELECT 'BF26|' || id || '|' || slug || '|' || stripe_coupon_id || '|' || is_active || '|' || coalesce(expires_at::text, 'null')
FROM promo_code_campaigns WHERE slug IN ('bf26-free-month', 'bf26-annual') ORDER BY slug;
