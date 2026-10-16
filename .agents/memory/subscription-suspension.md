---
name: Subscription suspension
description: Product scope and billing policy for suspending subscriptions.
---

Suspending a subscription must stop both billing and company-member access; resuming must restore both.

**Why:** The user explicitly chose both, rather than access-only suspension.

**How to apply:** Keep suspension separate from provider lifecycle status so ordinary Stripe webhooks cannot lift an admin block. The suspension policy voids newly generated invoices, leaves existing invoices/refunds and billing/trial/cancellation dates unchanged, and does not backcharge voided invoices on resume. Confirmation text must explain these consequences.

Suspended subscriptions need internal admin check-in reminders at three and five calendar months.

**Why:** The user requested “a 3 month and 5 month reminder to check in with anyone suspended.”

**How to apply:** Remind active system admins, not suspended customers. Stop future reminders when resumed or canceled; a new suspension starts a new schedule.
