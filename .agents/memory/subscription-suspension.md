---
name: Subscription suspension
description: Product scope and billing policy for suspending subscriptions.
---

Suspending a subscription must stop both billing and company-member access; resuming must restore both.

**Why:** The user explicitly chose both, rather than access-only suspension.

**How to apply:** Keep suspension separate from provider lifecycle status so ordinary Stripe webhooks cannot lift an admin block. The suspension policy voids newly generated invoices, leaves existing invoices/refunds and billing/trial/cancellation dates unchanged, and does not backcharge voided invoices on resume. Confirmation text must explain these consequences.
