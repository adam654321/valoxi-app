---
name: Resend broadcasts — no per-contact variable substitution
description: Resend's broadcast API sends static HTML; it does NOT substitute merge tags per-contact.
---

## Rule
Resend broadcasts (`broadcasts.create` + `broadcasts.send`) send a single static HTML blob to all recipients. There is no native per-contact merge-tag substitution in HTML broadcast content, regardless of what `first_name` properties exist on Resend contacts.

**Why:** Tested end-to-end June 2026. `{{first_name}}` passed through literally to recipients. Resend support indicated contact properties exist but the HTML variable substitution did not work in practice.

**How to apply:**
- For test sends: substitute tokens server-side using the sending admin's first name (so the preview looks realistic).
- For real/mass sends: substitute tokens server-side with a graceful fallback (e.g. "there").
- Do NOT pass tokens through hoping Resend will substitute them — it won't.
- If true per-contact personalisation is needed in future, the only option is individual transactional `emails.send()` calls, one per contact.
