# RESUME: do-migration

**Updated:** 2026-10-23 UK
**Thread:** Valoxi, Replit to DigitalOcean. Nothing else.

## State
- Phase 0: Neon project created (billowing-block-98253807, eu-west-2). GitHub repo done. DO project, DNS host, secrets export, cutover window still NOT YET.
- Phase 1 and 2: Gates PASSED (see assessment.md sections 10 and 12).
- Phase 3: DONE 2026-10-23 (assessment.md section 13). Repo https://github.com/adam654321/valoxi-app. `main` and tag `replit-final` (de39a9f) pushed by Adam. Replit remotes removed; only `origin` remains. History scan: no real secret.
- Phase 4: DONE 2026-10-23 (assessment.md sections 14 and 14.1). 94 tables, not 92. rehearsal = ep-lingering-mode-zalkfz3h (expires). dev = ep-frosty-mode-zapfrf2v, restored from the same dump, vitest 34/559 on it. Local .env still points at throwaway; switching to dev is Adam's call.
- Git credentials on this machine are GitHub user AdamValoxi (collaborator on the repo). Pushes are run by Adam with the `!` prefix; the auto-mode classifier blocks `git push`.
- The Phase 3 docs commit is local until Adam pushes it.
- Prod not contacted. Local .env holds DATABASE_URL for the throwaway branch only (gitignored).

## Phase 5 prepared 2026-10-23: .do/app.yaml and docs/do-migration/phase5-staging.md (branch phase-5-do-spec). Needs Adam: DO project, Clerk dev instance, Stripe test keys, R2 bucket choice.

## Next action (needs Adam)
1. Set branch protection on `main` in GitHub (plan 3.4).
2. Say go for Phase 4 (rehearsal restore). Adam runs the prod pg_dump (client must be PostgreSQL 18 or newer). I do not touch prod.
3. Set NYLAS_CONNECT_GMAIL_VISIBLE=true on DO later (assessment.md section 11).

## Deferred / deploy-dependent
- Finding C (test host guards only know `ep-old-recipe`): fix in phase 7.
- Backup cron R2 round trip: prove on staging (plan 5.5).
- DO: set VITE_CLERK_PUBLISHABLE_KEY (and GIT_SHA if wanted) as BUILD_TIME vars.
- Uncommitted, not mine: scripts/send-marketing-consent-emails.ts modified, _to_delete/ untracked. Left alone.
