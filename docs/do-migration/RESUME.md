# RESUME: do-migration

**Updated:** 2026-10-22 19:20 UK
**Thread:** Valoxi, Replit to DigitalOcean. Nothing else.

## State
- Phase 0: Neon project created (billowing-block-98253807, eu-west-2). Region London in effect. GitHub, DO, DNS, secrets, cutover window still NOT YET.
- Phase 1: Gate 1 PASSED 2026-10-22 18:13 UTC. check 0 errors, build clean, vitest 34 files / 559 passed on Neon branch throwaway.
- Local commits above de39a9f: c839760 lockfile hosts, c1ea1a3 .env.example, plus docs. Nothing pushed. Prod not contacted.
- Local tag replit-final = de39a9f, not pushed.
- Local .env holds DATABASE_URL for the throwaway branch only (gitignored).

## Next action (needs Adam)
1. Say go for Phase 2 (de-Replit the code), or fill the rest of Phase 0 first.
2. Optional: decide whether to run 1.8 npm run dev with crons neutralised.

## Deferred / deploy-dependent
- Finding C (test host guards only know `ep-old-recipe`): fix in phase 7.
- Finding D (build passes without `VITE_CLERK_PUBLISHABLE_KEY`): handle in 2.8.
- Uncommitted, not mine: `nohup.out` deleted, `scripts/send-marketing-consent-emails.ts`
  modified, `.config/`, `_to_delete/` untracked. Left alone.
