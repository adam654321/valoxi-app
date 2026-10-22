# RESUME: do-migration

**Updated:** 2026-10-22 17:20 UK
**Thread:** Valoxi, Replit to DigitalOcean. Nothing else.

## State
- Phase 0: all seven answers NOT YET (assessment.md section 0).
- Phase 1: at Gate 1, NOT passed. check clean, build clean, tests blocked on a DB.
- Local commits on `main` above `de39a9f`: `c839760` lockfile hosts, `c1ea1a3` `.env.example`.
- Local tag `replit-final` = `de39a9f`. Not pushed (no remote yet, plan 3.5).
- Nothing pushed. Prod not contacted.

## Next action (needs Adam)
1. Create a throwaway Neon branch (any Neon project Adam owns) and give the URL for local
   `.env` only. Then: 1.6 vitest against it, expect 34 files / 559 tests; 1.8 `npm run dev`.
2. Adam says go for Phase 2, or fills Phase 0.

## Deferred / deploy-dependent
- Finding C (test host guards only know `ep-old-recipe`): fix in phase 7.
- Finding D (build passes without `VITE_CLERK_PUBLISHABLE_KEY`): handle in 2.8.
- Uncommitted, not mine: `nohup.out` deleted, `scripts/send-marketing-consent-emails.ts`
  modified, `.config/`, `_to_delete/` untracked. Left alone.
