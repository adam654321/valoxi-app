# RESUME: do-migration

**Updated:** 2026-10-22 19:35 UK
**Thread:** Valoxi, Replit to DigitalOcean. Nothing else.

## State
- Phase 0: Neon project created (billowing-block-98253807, eu-west-2). GitHub repo, DO project, DNS host, secrets export, cutover window still NOT YET.
- Phase 1: Gate 1 PASSED. Phase 2: Gate 2 PASSED 2026-10-22 18:30 UTC (check 0, build 0, vitest 34 files / 559 on Neon throwaway, gate grep only the two tolerated fallbacks, Docker proof done).
- All work is local commits on main above de39a9f (see assessment.md section 12 for the table). Nothing pushed. Prod not contacted. Tag replit-final = de39a9f, local only.
- Local .env holds DATABASE_URL for the throwaway branch only (gitignored). Tests: see assessment.md section 10.

## Next action (needs Adam)
1. Create the empty private GitHub repo (plan 0.3) and give me the URL. Then Phase 3: remote, secret scan of history (STOP if nonzero), push, tag. Branch protection is yours to set in GitHub.
2. Set NYLAS_CONNECT_GMAIL_VISIBLE=true on DO later (assessment.md section 11).

## Deferred / deploy-dependent
- Finding C (test host guards only know `ep-old-recipe`): fix in phase 7.
- Backup cron R2 round trip: prove on staging (plan 5.5).
- DO: set VITE_CLERK_PUBLISHABLE_KEY (and GIT_SHA if wanted) as BUILD_TIME vars.
- Uncommitted, not mine: scripts/send-marketing-consent-emails.ts modified, _to_delete/ untracked. Left alone.
