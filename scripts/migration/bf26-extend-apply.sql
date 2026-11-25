-- CHANGES DATA. One-off, requested by Adam 2026-11-25.
-- Extends the two Black Friday 2026 campaigns from the end of Monday 30 November to the end of
-- Friday 4 December (UK time). Only expires_at changes. No Stripe change: coupon BF26_ANNUAL_PRO
-- was created without a redeem-by date (confirm in the Stripe dashboard).
-- Must match OFFER_ENDS_AT in valoxi-site src/lib/blackFriday.ts.
-- Usage: psql "$URL" -X -v ON_ERROR_STOP=1 -f scripts/migration/bf26-extend-apply.sql
-- All-or-nothing: if either row is not exactly as expected, nothing is changed.
BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM promo_code_campaigns
  WHERE slug IN ('bf26-free-month', 'bf26-annual')
    AND is_active = true
    AND expires_at = TIMESTAMP '2026-12-01 00:00:00';
  IF n <> 2 THEN
    RAISE EXCEPTION 'Expected 2 active bf26 rows expiring 2026-12-01 00:00:00, found %. Nothing changed.', n;
  END IF;
END $$;

UPDATE promo_code_campaigns SET expires_at = TIMESTAMP '2026-12-05 00:00:00'
WHERE slug IN ('bf26-free-month', 'bf26-annual') AND expires_at = TIMESTAMP '2026-12-01 00:00:00';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM promo_code_campaigns
  WHERE slug IN ('bf26-free-month', 'bf26-annual') AND expires_at = TIMESTAMP '2026-12-05 00:00:00';
  IF n <> 2 THEN RAISE EXCEPTION 'Post-check failed (% rows updated). Rolled back.', n; END IF;
END $$;

COMMIT;
SELECT 'DONE|bf26-free-month and bf26-annual now expire 2026-12-05 00:00:00 UTC';
