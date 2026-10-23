# Phase 5 runbook: DigitalOcean staging

Staging is the app that becomes production at cutover (plan 6.9 swaps its env vars), so the
spec in `.do/app.yaml` is the real thing. Secrets never enter the repo: names and non-secret
values are in the spec; secret values are typed into the DO console with **Encrypt** ticked.

## Two safeguards before anything is deployed

1. **Staging must not email real people.** `dev` holds 88 real users, and the three crons
   (billing, chase-up, backup) start unconditionally in `server/index.ts:99-101` with no
   environment gate. Email only sends when `RESEND_API_KEY` is set (`server/email.ts:17-30`);
   without it the app logs "not sent" and carries on. So on staging **leave unset**:
   `RESEND_API_KEY`, `RESEND_API_KEY_MARKETING`, `RESEND_WEBHOOK_SECRET`, all `RESEND_SEGMENT_*`,
   all `SMTP_*`, all `NYLAS_*` secrets. Set them only at cutover (6.9).
2. **Stripe is test mode, Clerk is the dev instance.** Live keys are bound to `app.valoxi.ai`
   and real customers.

## Steps (Adam)

1. DigitalOcean: create a project `valoxi`.
2. GitHub: when DO asks, authorise the DigitalOcean GitHub app on the `adam654321/valoxi-app`
   repo only.
3. Create the app: Apps, Create App, pick the repo, branch `main`, then **Edit spec** and paste
   the contents of `.do/app.yaml` (after the PR with it has merged). Confirm the size slug
   exists; if not, pick 1 vCPU / 2 GB in the console and tell me the slug.
4. Clerk: create or open the **development** instance. Add the DO default URL as an allowed
   origin. Create a webhook endpoint `https://<do-url>/api/v2/webhooks/clerk` for `user.created`.
5. Stripe, **test mode**: create a webhook endpoint
   `https://<do-url>/api/v2/billing/webhook/stripe`. Copy its signing secret.
6. Enter the variables below in the DO console. Tick **Encrypt** on every secret.
7. Deploy. Tell me the build log's Chromium line and the `/api/health` output.

## Variables to enter in the console (not in the spec)

Scope B = BUILD_TIME, R = RUN_TIME. "Enc" = tick Encrypt.

| Variable | Scope | Enc | Staging value |
|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | B | no | Clerk **dev** publishable key (`pk_test_...`). Public by design. Without it the build fails (Dockerfile assertion) |
| `CLERK_PUBLISHABLE_KEY` | R | no | same dev key |
| `CLERK_SECRET_KEY` | R | yes | Clerk dev secret |
| `CLERK_WEBHOOK_SIGNING_SECRET` | R | yes | from the dev webhook endpoint |
| `DATABASE_URL` | R | yes | Neon `dev` **pooled** URL (the pooler host; `.env.dev` holds the direct one) |
| `SESSION_SECRET` | R | yes | NEW random value for staging (32 bytes hex). Not the prod one |
| `GOOGLE_GEMINI_API_KEY` | R | yes | the real key |
| `STRIPE_SECRET_KEY` | R | yes | **test** key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | R | yes | from the test webhook endpoint |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R | yes | See bucket choice below |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` | R | no | See bucket choice below |
| `MARKETING_SITE_URL` | R | no | same as prod |
| `ISSUE_REPORT_RECIPIENT` | R | no | your own address, not a customer-facing one |
| `FIVE_D_BILLING_START` | R | no | as prod |
| `TEST_INTERNAL_USER_COMPANY_ID` | R | no | as prod |

Already in the spec, no action: `PORT`, `NODE_ENV`, `GIT_SHA` (from `${_self.COMMIT_HASH}`),
`APP_URL` (from `${APP_URL}`), `CLERK_ENABLED`, `NYLAS_CONNECT_GMAIL_VISIBLE=true`,
`NYLAS_CONNECT_OUTLOOK_VISIBLE=false`.

Left unset on staging on purpose: everything under safeguard 1.

## R2 bucket choice (Adam decides)

- **Separate `valoxi-documents-dev` bucket (recommended).** Staging uploads, the staging
  backup dump and the backup prune cannot touch production documents or `backups/`. Needs a
  new R2 bucket and an API token scoped to it.
- **The real bucket (plan 5.3 default).** Works, but staging then writes dev-database dumps
  into the production `backups/` prefix and its prune runs against it.

## Plan corrections found while preparing this

- Webhook paths are under `/api/v2/`: Clerk `/api/v2/webhooks/clerk`, Stripe
  `/api/v2/billing/webhook/stripe`, Resend `/api/v2/webhooks/resend-marketing`. The plan's
  `/api/webhooks/clerk` would 404.
- `GIT_SHA` is not a build argument. DO exposes bindable variables to Dockerfile builds at
  runtime only, so `/api/health` gets `GIT_SHA=${_self.COMMIT_HASH}` as a runtime variable.
  The Dockerfile's `ARG GIT_SHA` stays as a harmless default.
- Nylas callback is `/api/v2/nylas/auth/callback`. Nylas has one app; leave staging Nylas
  unset rather than adding a staging URL to the production Nylas redirect list.
- `deploy_on_push` is false in the spec. A push during a rolling deploy briefly runs two
  instances, so the crons could double-fire. Deploy by hand until after cutover.
- At cutover `APP_URL` must be changed from `${APP_URL}` to the literal
  `https://app.valoxi.ai` (6.9).

## Smoke list

Unchanged from plan 5.5. Skipped on staging because their services are deliberately off:
anything that sends email, and Nylas. The backup-cron R2 round trip (the last item) is still
required; do it in two minutes by a temporary schedule change on a throwaway branch, never
on `main`.
