# Security Sweep — Assessment

Status: HISTORICAL (assess complete 2026-05-21). The durable record of
what was found and where.
Owner: Adam
Related: plan.md, removals.md, action log v68

---

## Why this sweep exists

After the Open Access Pivot launch (v67), the app codebase had been
through #109 first-pass security work plus the C-new launch-block
hardening (CORS, collision flow, flag relocation). This sweep is the
second pass: catch what escaped, verify the new attack surface
introduced by self-serve checkout, and produce an actionable apply
roadmap.

Scope: app codebase only. valoxi-site (marketing) touched only where
relevant to the app (wrangler.toml secrets, contact form). Phase E
marketing redesign deferred.

## Methodology

Read-only against local pull (16):
`C:\Users\AdamAuty\Downloads\MandA-Internal-Google-Brain-Test (16)\MandA-Internal-Google-Brain-Test`

Seven slices, sequenced:
1. CSRF coverage + public endpoint hardening
2. RBAC / multi-tenancy
3. Dev/test endpoints in prod
4. Rate limits
5. Secrets handling
6. Structural concerns (auth boundaries, cron, webhook ordering)
7. Public endpoint hardening (file serving, tokens, Nylas)

Each slice yields findings tagged SS{slice}-{H|M|L}{n}. Adam pushback
used to withdraw or downgrade where appropriate. PROD DATA CHECK tags
flag items needing prod state verification before apply.

## Methodology notes (lessons captured during sweep)

- **Filesystem search tool matches filenames, not content.** Slice 4
  conclusions on generalLimiter/authLimiter "dead code" still stand
  because I had already read the only two files that could mount
  global middleware (server/index.ts, routes/index.ts) in full —
  neither imports them. Verification path: read the mount points, not
  rely on search.
- **SS5-M2 correction mid-sweep.** Slice 5 declared `config.smtp.*`
  entirely dead. Slice 6 caught the correction: `config.smtp.alertEmail`
  IS LIVE (`billing.cron.ts` line 296, recipient for Stripe webhook
  failure alert). Other smtp keys dead. Fix shape: rename to
  `alerts.recipientEmail`, drop the rest.
- **SS2-H1 withdrawal.** Originally framed as a security bug ("admin
  writes blocked during view-as"). Adam's posture is stricter
  defence-in-depth: no writes in view-as, period. Design-by-choice,
  not a bug. v68 closure of #130 stands.
- **SS3-M1 downgrade.** Originally framed as MEDIUM prompt injection.
  Adam's framing is right that users don't access the LLM directly via
  any public surface. The real attack requires an authenticated user
  crafting their own request. Impact is self-only (compliance hygiene
  not classic security). Downgraded to LOW.

---

## Slice 1 — CSRF Coverage + Public Endpoint Hardening

C-1/C-2 fixes from #131 verified intact. Webhook signature verification
correct (Stripe, Clerk svix, Resend svix). Body parsing order correct
(express.raw before express.json per webhook path).

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS1-H1 | HIGH | repo root | Ten prod DB dumps in repo root; .gitignore doesn't exclude *.sql/*.dump/backup_* |
| SS1-H2 | HIGH | server/middleware/csrf.ts:53-58, 95-97 | validateOrigin fails open if APP_URL/REPLIT_DOMAINS unset |
| SS1-H3 | HIGH-MED | server/middleware/public-cors.ts | publicCors doesn't reject disallowed origins server-side; sets headers conditionally but always calls next() |
| SS1-M1 | MED | server/routes/billing.routes.ts:366-374 | Stripe webhook outer catch returns 200 on internal error; Stripe won't retry |
| SS1-M2 | MED→HIGH (upgraded SS5-H3) | valoxi-site/wrangler.toml | Supabase keys present incl. SERVICE_ROLE_KEY |
| SS1-M3 | MED | valoxi-site/functions/api/contact.ts | Contact form no rate limit, no honeypot, no CAPTCHA |
| SS1-M4 | MED-LOW | server/routes/public-marketing-consent.routes.ts | No per-token rate limit, no alerting on invalid attempts |
| SS1-L1 | LOW | Stripe session_id in success URL — leaks via referrer/browser history |
| SS1-L2 | LOW | Stripe-collected name not sanitized for email templates |
| SS1-L3 | LOW | server/routes/marketing-webhooks.routes.ts | Resend webhook silently no-ops unknown event types |

## Slice 2 — RBAC / Multi-tenancy

C-5 (due-diligence) and C-6 (value-creation) ownership patterns intact.
Every mutating method calls the ownership gate. bulkUpdateAssumptions
uses the batched-join pattern correctly. Nylas grant routes check
grant.userId !== userId on every mutation. Portal submission routes
are token-keyed with server-derived targetCompanyId/userCompanyId.

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS2-H1 | WITHDRAWN | server/middleware/auth.ts blockWritesInViewAsMode | Design-by-choice, not a bug |
| SS2-H2 | HIGH-MED | server/routes/billing.routes.ts:95 | Stripe webhook trusts client-supplied userCompanyId in session.metadata. Stripe dashboard insider could swap. |
| SS2-M1 | MED | server/routes/public-waitlist.routes.ts:27-29 | Discloses email registration via alreadyRegistered:true |
| SS2-M2 | MED-LOW | server/routes/public-marketing-consent.routes.ts | Invalid tokens return 404 with no log |
| SS2-M3 | MED-LOW | server/routes/team.routes.ts publicRouter | GET /invitation/:token returns inviter+company+role unauthenticated |
| SS2-L1 | LOW | server/routes/billing.routes.ts:165-184 | Self-serve checkout can activate paid sub on dormant invited user. Theoretical. |
| SS2-L2 | LOW | server/middleware/auth.ts:195-198 | users.userCompanyId overwritten on every authenticated request; may bypass currentCompanyId switch. Adam confirm needed. |
| SS2-L3 | LOW | server/routes/public-marketing-consent.routes.ts:16 | Token regex lowercase-only, brittle |

## Slice 3 — Dev/Test Endpoints in Prod

No HTTP-exposed dev/test routes found. Test scripts in server/scripts/
are CLI-only (npx tsx). Wipe scripts well-engineered (DRY-RUN default,
±10% tolerance, single-tx rollback). admin-tools properly gated by
isSystemAdmin.

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS3-H1 | HIGH | .replit postMerge stanza + scripts/post-merge.sh | Auto-runs `npm run db:push -- --force` on git merge. Violates LN-012. |
| SS3-M1 | LOW (downgraded) | server/routes/explain.routes.ts | Authenticated user can prompt-inject via devtools or target_company name field. Self-only impact. |
| SS3-M2 | MED | server/routes/admin-tools.routes.ts | /switch-plan plan-tier escalation control, admin-gated but no audit log |
| SS3-M3 | MED-LOW | server/routes/beta-feedback.routes.ts:117-132 | /screenshot/:key endpoint accessible to any authenticated user. Live route despite "beta" name (writes to beta_feedback table, displayed in UI as "Issue Reports"). |
| SS3-L1 | LOW | .replit userenv.shared | BETA_MODE / VITE_BETA_MODE env vars dead per #6 closure but still defined |
| SS3-L2 | LOW | server/scripts/test-dunning-*.ts, test-trial-expiry.ts | CLI-only but could fire against prod if run with PROD_DATABASE_URL exported |

## Slice 4 — Rate Limits

Per-user limits exist on the right hot routes (explainLimiter,
analysisTriggerLimiter, uploadLimiter). All three use user-keyed
keyGenerator. The structural issues are deeper.

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS4-H1 | HIGH | server/index.ts (missing app.set('trust proxy')) + server/middleware/rate-limit.ts portalLimiter/waitlistLimiter | No trust proxy + IP-keyed public limiters default to req.ip which behind Replit's LB is either shared-bucket (DOS amplifier) or skip-localhost-matches (no limit). PROD DATA CHECK needed. |
| SS4-H2 | HIGH | server/middleware/rate-limit.ts exports generalLimiter, authLimiter | generalLimiter defined but never imported. authLimiter same. ~30 auth route groups have zero application-level rate limit. |
| SS4-M1 | MED | server/routes/index.ts publicConfigRoutes mount | No rate limit on /config and /checkout-status |
| SS4-M2 | MED | valoxi-site/functions/api/contact.ts | (same as SS1-M3) |
| SS4-L1 | LOW | webhook mounts | Stripe/Clerk/Resend webhooks no rate limit (signature CPU exhaustion vector) |
| SS4-L2 | LOW | server/routes/team.routes.ts publicRouter mount | No rate limit on invitation token endpoint |
| SS4-CLEANUP-1 | CLEANUP | server/middleware/rate-limit.ts | authLimiter dead code |

## Slice 5 — Secrets Handling

No .env files in repo (Replit secrets manager is the store). Webhook
signatures all verified. sendError() hides stack traces in prod.
SESSION_SECRET validated at boot.

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS5-H1 | HIGH | repo root | (same as SS1-H1) Ten prod DB dumps in repo root |
| SS5-H2 | HIGH | .gitignore | Structurally broken: line 7 malformed comment breaks *.tar.gz pattern; missing .env*, *.dump, *.sql, *.pem, uploads/, attached_assets/, .local/ |
| SS5-H3 | HIGH | valoxi-site/wrangler.toml | SUPABASE_SERVICE_ROLE_KEY (admin bypass of RLS). Even if "unused legacy", rotate hygiene applies. |
| SS5-M1 | MED | server/config.ts | Boots with empty-string defaults, no startup validation. Missing GOOGLE_GEMINI_API_KEY in prod = silent Gemini failure. |
| SS5-M2 | CORRECTED | server/config.ts smtp block | Most smtp.* keys dead; smtp.alertEmail IS LIVE (used in billing.cron.ts). Rename. |
| SS5-L1 | LOW | Replit secrets manager | OPEN_ACCESS_ENABLED env var dead post C-new.9 |
| SS5-L2 | LOW | Replit secrets manager | RESEND_SEGMENT_SIGNED_UP_NO_PLAN never built |

## Slice 6 — Structural Concerns

Clerk-only auth path is clean. handleUserCreated simplification
(C-new.4) verified intact. Webhook ordering enforced at UX layer via
/post-checkout interstitial. TOCTOU re-checks in dunning crons.
Idempotency on all three webhooks.

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS6-H1 | HIGH | server/cron/backup.cron.ts | Writes to /tmp on Replit autoscale (ephemeral). No offsite destination. False sense of backup security. |
| SS6-H2 | CORRECTION | (links to SS5-M2) | smtp.alertEmail IS LIVE — discovered in billing.cron.ts line 296 |
| SS6-M1 | MED | server/cron/*.cron.ts | Cron jobs lack distributed locking. Replit autoscale could double-fire dunning emails. |
| SS6-M2 | MED | server/routes/webhooks.routes.ts handleUserCreated | Stripe-webhook-delay race could trigger orphan-revoke after paid signup |
| SS6-M3 | MED | server/routes/webhooks.routes.ts | Soft-deleted user permanently locked out. No admin reactivation path. |
| SS6-L1 | LOW | server/routes/webhooks.routes.ts:32-39 revokeOrphanClerk | Swallows Clerk API errors |
| SS6-L2 | LOW | server/routes/webhooks.routes.ts | No audit log of orphan-revoke events |
| SS6-L3 | LOW | server/cron/backup.cron.ts | DATABASE_URL interpolated into shell command. Fragile pattern. |

## Slice 7 — Public Endpoint Hardening

Mostly folded into slice 1. Nylas state token cryptographically sound
(HS256, 5min TTL, secret length validated, alg pinned at verify).
Portal token endpoints consistent with token-keyed pattern. File
upload sharedFileFilter requires both MIME and extension match.

| ID | Severity | Location | Summary |
|---|---|---|---|
| SS7-M1 | MED | server/routes/documents-files.routes.ts serveFile() | No X-Content-Type-Options:nosniff. Combined with Content-Disposition:inline and portal upload accepting external files, stored XSS vector. |
| SS7-M2 | MED | server/services/documents-files.service.ts publicToken handling | No expiry, no rotation, no revocation on public document tokens |
| SS7-L1 | LOW | server/routes/documents-files.routes.ts:publicDocumentRoutes | logDocumentAccess uses `null as any` for userId on public access |
| SS7-L2 | LOW | server/routes/documents-files.routes.ts:publicDocumentRoutes | Public token validation is just length >= 10 |
| SS7-L3 | LOW | server/routes/documents-files.routes.ts /view endpoints | Content-Disposition:inline for public viewing |

## Held / Adam input needed

| # | Question | Slice |
|---|---|---|
| 1 | switchUserActiveCompany — writes users.userCompanyId or just currentCompanyId? | SS2-L2 |
| 2 | Are the 10 backup dumps in repo root in git history? | T1.1 PROD DATA CHECK |
| 3 | Does the Supabase project still exist / is the key active? | T1.2 PROD DATA CHECK |
| 4 | Which trust-proxy failure mode is active in prod? | T2.1 PROD DATA CHECK |
| 5 | Backup strategy: Neon vs Object Storage vs document-only | T3.8 |
| 6 | admin-tools /switch-plan: keep+audit or remove | T4.3 |
| 7 | Orphan-revoke buffer mechanism: in-memory vs DB-backed | T3.6 |
| 8 | CSP shape: sandbox alone vs full default-src 'none' + sandbox | T3.4 |

## Deferred (not in this sweep's scope)

| Item | Reason |
|---|---|
| Phase E marketing redesign | Separate workstream |
| Single-source-of-truth pricing (Stripe at runtime) | Not blocking |
| Cycle 2 ownership pattern re-verification | Evidence-accepted per #142 |
| GBP price set in Stripe | USD-only confirmed |
| Admin "delete user" Clerk-aware path | Not needed for security; later if churn requires |
| Funnel analytics refinement | Out of scope |

---

## v69 build findings (2026-05-28)

### F1 — T2.1 partially pre-applied via unverified checkpoint

Discovered at assess time in pull (17): `server/routes.ts` (the real `registerRoutes` entrypoint, NOT `server/index.ts` as the original plan assumed) already contained `app.set('trust proxy', 1)` and `app.use('/api/', generalLimiter)`. The sweep assessment (against pull 16) had both as absent. Git history attributes them to a Replit auto-checkpoint commit (`cd2fe9d "Saved progress at the end of the loop"` or adjacent), i.e. an unverified landing outside the assess/apply/V-check cycle.

Methodology implication: when checkpoint auto-commits land outside the cycle, the next assess must read against live, not against a pull that may pre-date or lag them. Read mount points, not search.

### F2 — Original PROD DATA CHECK for T2 was mis-targeted

removals.md spec'd "sample RateLimit-Remaining on 2-3 authenticated requests" to determine the trust-proxy failure mode. This cannot work: authenticated limiters (analysisTriggerLimiter, explainLimiter, uploadLimiter) are user-keyed and behave identically regardless of trust-proxy state. The trust-proxy failure mode manifests on IP-keyed limiters (portalLimiter, waitlistLimiter, generalLimiter's unauth fallback). The decisive question was hop count, which is an architectural fact: `app.valoxi.ai` is DNS-only to Replit autoscale (one LB hop), so `trust proxy: 1` is correct regardless. The PROD DATA CHECK was dropped entirely. Logged as LN-012 (second instance of the same class: mis-targeted check against the wrong variable).

### F3 — Router fall-through under shared mount prefix

PROD curl of `GET /api/v2/public/config` returned `ratelimit-policy: 10;w=900` — the waitlistLimiter, not generalLimiter. `routes/index.ts` mounts `publicCheckoutRoutes` and `publicConfigRoutes` at the same `/api/v2/public` prefix in that order. Express walks the first stack: publicCors → waitlistLimiter decrements the IP counter → publicCheckoutRoutes finds no `/config` route → `next()`. Express moves to the second stack and publicConfigRoutes serves. Net: every `/config` GET burns a waitlistLimiter token.

Pre-existing, not T2-caused. But it's an M.3 blocker — flag-aware marketing rendering will hit /config on every visitor page load. Tracked as T3.11. Logged as LN-013.

### F4 — Runtime config field values should be captured in assess

The v69 V-check returned a 403 for the `https://valoxi.ai` curl. Root cause: dev secret `MARKETING_SITE_URL=http://localhost:3002` overrides the config default, so `config.marketing.siteUrl` at runtime was not `https://valoxi.ai`. The assess captured the source-default fallback but not the runtime-resolved value. Caught at V-check + diagnostic (`printenv` + `npx tsx -e import.then(console.log(config.marketing.siteUrl))`). One round wasted. Logged as LN-012.