-- CHANGES DATA. One-off, authorised by Adam 2026-11-25.
-- Subs 35 (company 34, test) and 44 (company 56, Dentiva): app says active, Stripe says canceled
-- (08:30 reconciliation report 25 Nov). Correct the app record only. No Stripe change, no email.
-- Usage: psql "$URL" -X -v ON_ERROR_STOP=1 -f scripts/migration/fix-subs-35-44-apply.sql
-- All-or-nothing: if either row is not exactly as expected, nothing is changed.
BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM subscriptions
  WHERE (id = 35 AND user_company_id = 34 AND stripe_subscription_id = 'sub_1TPjInRt4SRGCmCvK6WqHqoV' AND status = 'active')
     OR (id = 44 AND user_company_id = 56 AND stripe_subscription_id = 'sub_1TQWOoRt4SRGCmCvoxZH6n0s' AND status = 'active');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Expected 2 matching active rows, found %. Nothing changed.', n;
  END IF;
END $$;

INSERT INTO subscription_events (user_company_id, event_type, previous_status, previous_plan_key, new_status, new_plan_key, payload)
SELECT user_company_id, 'admin.reconciled_already_canceled', status, plan_key, 'canceled', plan_key,
       jsonb_build_object('stripeSubscriptionId', stripe_subscription_id, 'stripeStatus', 'canceled',
                          'source', '08:30 reconciliation report 2026-11-25', 'authorisedBy', 'Adam', 'emailSent', false)
FROM subscriptions WHERE id IN (35, 44);

UPDATE subscriptions SET status = 'canceled', canceled_at = coalesce(canceled_at, now()), updated_at = now()
WHERE id IN (35, 44) AND status = 'active';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM subscriptions WHERE id IN (35, 44) AND status = 'canceled';
  IF n <> 2 THEN RAISE EXCEPTION 'Post-check failed (% canceled). Rolled back.', n; END IF;
END $$;

COMMIT;
SELECT 'DONE|subs 35 and 44 set to canceled';
