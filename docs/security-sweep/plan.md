# Security Sweep — Plan

Status: T1 substance APPLIED (T1.2 valoxi-site outstanding); T2 APPLIED + PROD VERIFIED 2026-05-28 (v69). Tier 3 onwards post-launch. M.* unblocked except T3.11 (config mount swap — must land before M.3).
Started: 2026-05-21 (action log v68)
Owner: Adam
Related: assessment.md, removals.md, action log v68+

---

## What this sweep does

Second-pass read-only security sweep against the post-launch app
codebase (after Open Access Pivot v67). Goal: identify gaps that
escaped the first pass and the launch-block work, with particular
focus on the new attack surface introduced by the pivot — self-serve
checkout, Stripe-first provisioning, CORS, marketing-site flag pull.

Methodology: seven slices, read-only against local pull (16). No
Replit calls during assess. Each slice yields findings tagged
SS{slice}-{H|M|L}{n}. Forty-four findings total: 9 HIGH, 17 MEDIUM,
18 LOW.

Three findings withdrawn or downgraded after Adam pushback:
- SS2-H1 (blockWritesInViewAsMode) withdrawn — design-by-choice
- SS3-M1 (explain.routes.ts prompt injection) downgraded to LOW
- SS5-M2 corrected mid-sweep — smtp.alertEmail IS LIVE, smtp.* other
  keys dead

## Slice scope

1. CSRF coverage + public endpoint hardening
2. RBAC / multi-tenancy
3. Dev/test endpoints in prod
4. Rate limits
5. Secrets handling
6. Structural concerns (auth boundaries, cron, webhook ordering)
7. Public endpoint hardening (file serving, public tokens, Nylas)

## Apply tiers

| Tier | Scope | Action mode | Status |
|---|---|---|---|
| 1 | File/config edits | Adam-direct, no Replit | T1.1 + T1.3 APPLIED (substance); T1.2 outstanding (valoxi-site) |
| 2 | Combined launch-block slice | One Replit slice | APPLIED + PROD VERIFIED v69 |
| 3 | Defence-in-depth | Individual Replit slices | POST-LAUNCH |
| 4 | Operational hardening | Sequenced into normal cycle | POST-LAUNCH |
| 5 | Cleanup | Opportunistic | POST-LAUNCH |

### Tier 1 — Adam-direct (this week)

| ID | Scope | Risk |
|---|---|---|
| T1.1 | .gitignore rewrite + delete repo-root DB dumps | None |
| T1.2 | Supabase service role key rotation, remove from wrangler.toml | None |
| T1.3 | Delete postMerge stanza from .replit | None |

### Tier 2 — Combined launch-block slice (before marketing M.* slices)

| ID | Scope | Risk |
|---|---|---|
| T2.1 | Trust proxy + apply generalLimiter globally + publicConfigRoutes limiter + webhook limits + invitation limits + drop authLimiter | Med |
| T2.2 | validateOrigin fail-closed + publicCors origin reject | Med |

Combined because trust-proxy is a prerequisite for every IP-keyed
limiter to behave correctly. One assess, one apply, one V-check.

### Tier 3 — Post-launch defence-in-depth

| ID | Scope | Risk |
|---|---|---|
| T3.1 | Stripe webhook returns 500 not 200 on internal error | Low |
| T3.2 | Stripe customer.metadata cross-check (insider hardening) | Low |
| T3.3 | Waitlist endpoint stops disclosing email enumeration | Low |
| T3.4 | nosniff + CSP sandbox in serveFile() | Low |
| T3.5 | pg_try_advisory_lock on cron handlers | Med |
| T3.6 | Orphan-revoke 60s buffer (Stripe-webhook-delay race) | Med |
| T3.7 | Beta-feedback screenshot endpoint ownership scoping | Low |
| T3.8 | Backup strategy decision + implementation | High |

### Tier 4 — Operational hardening

| ID | Scope | Risk |
|---|---|---|
| T4.1 | validateConfig() at boot, throw on missing prod secrets | Med |
| T4.2 | Rename smtp.alertEmail to alerts.recipientEmail | Low |
| T4.3 | admin-tools /switch-plan audit-or-remove | Low |
| T4.4 | Admin user reactivation endpoint | Med |
| T4.5 | revokeOrphanClerk 500 + audit log | Low |
| T4.6 | valoxi-site contact form honeypot + CF rate limit | Low |

### Tier 5 — Cleanup (opportunistic)

| ID | Scope | Risk |
|---|---|---|
| T5.1 | beta_feedback → issue_reports consolidation | Low |
| T5.2 | Dead env var sweep (OPEN_ACCESS_ENABLED, RESEND_SEGMENT_SIGNED_UP_NO_PLAN) | None |
| T5.3 | Test scripts production guard | None |

## Risk register

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Prod DB dumps in git history | Med | High | T1.1 PROD DATA CHECK — verify `git log --all --diff-filter=A --name-only \| grep -E 'backup_'`. If present, rotate any keys in fixtures and plan disclosure. |
| 2 | SUPABASE_SERVICE_ROLE_KEY in wrangler.toml | High | High | T1.2 rotate immediately. Treat as urgent rotation, not routine. |
| 3 | Trust-proxy misconfigured: shared-bucket DOS amplifier | Med | High | T2.1. PROD DATA CHECK: sample RateLimit-Remaining headers from prod before fixing — confirms which failure mode is active. |
| 4 | Trust-proxy fix breaks rate limit behaviour in dev | Low | Med | T2.1 apply confirms localhost skip still fires in dev after the change. |
| 5 | generalLimiter applied at 1000/15min/user breaks legitimate heavy users | Low | Low | 1000/15min is generous. Existing analysis routes have stricter user-keyed limits below it. |
| 6 | Backup cron removal exposes Valoxi to data-loss scenarios | Med | Med | T3.8 decision — Neon native branches recommended. Don't remove cron until replacement is in place. |
| 7 | Orphan-revoke buffer introduces 60s lag on legitimate Clerk-without-Stripe revokes (test signups) | Low | Low | Acceptable trade-off. Buffer only fires on the "no matching DB row" path. |
| 8 | Admin reactivation endpoint enables wider account manipulation | Low | Med | T4.4 gated by isSystemAdmin + audit log entry. |

## Open decisions

| # | Question | Status |
|---|---|---|
| 1 | switchUserActiveCompany write target — users.userCompanyId or just currentCompanyId? | OPEN (SS2-L2) — Adam to confirm |
| 2 | Backup strategy: Neon snapshot branches vs Replit Object Storage push vs delete-cron + document-only | OPEN (T3.8) |
| 3 | admin-tools /switch-plan: keep with audit log or remove (entitlements derive from subscriptions.planKey anyway) | OPEN (T4.3) |
| 4 | Orphan-revoke buffer: in-memory queue vs DB-backed retry table | OPEN (T3.6) |
| 5 | Are the 10 backup dumps in repo root in git history? | CLOSED — 12 files in history. Scenario 1 (Replit-only remote). Filter-repo deferred to coordinated weekend within 30 days. |
| 6 | Does the Supabase project still exist / is the key active? | CLOSED — project deleted. T1.2 re-scoped to wrangler.toml remove-only. |
| 7 | Which CSP shape: `sandbox` alone vs full `default-src 'none'; sandbox`? | OPEN (T3.4) |

## Outstanding before launch

Tier 1 and Tier 2 should complete before the marketing-site M.*
slices ship. Reasoning:
- T1.x is zero-risk and high-urgency
- T2.x is launch-block-class: post-launch the marketing site will pull
  /config on every page load through CF; without trust-proxy + global
  rate limit + fail-closed CORS, the public endpoints are either
  unprotected or shared-bucket-limited
- Tiers 3 onwards are post-launch

## Action log progression

| Version | Phase | Notes |
|---|---|---|
| v67 | Open Access Pivot LAUNCH | Live in prod |
| v68 | Security sweep ASSESS complete ✓ | This entry |
| v69 | T1 substance + T2 APPLIED + PROD VERIFIED ✓ | trust-proxy already in tree pre-slice (verified); publicCors multi-origin + 403; validateOrigin prod-throw; authLimiter dropped; PROD curl all green |
| next | T3.11 (config mount swap) | Pre-M.3 prerequisite — small assess/apply/V-check |
| later | T3.* T4.* T5.* | Post-launch, sequenced |