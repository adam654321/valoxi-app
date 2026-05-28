# Open Access Pivot — Lessons captured during build

Living document. Captures what went wrong in each phase so the next phase avoids it.

## A1 (2026-05-16)

### LN-001 — Distinguish "code change" from "environment change" in apply prompts

E16 (npm uninstall bcrypt) is package management, which in this Replit goes through the Nix-wrapped Node binary. Direct `npm uninstall` via code_execution doesn't have the right PATH and broke node_modules. Recovery took ~30 minutes via Replit Packager UI.

Mitigation for future phases:
- Any apply step that touches package.json or runs npm should be flagged in the prompt as "USE REPLIT PACKAGER UI, not direct npm via code_execution"
- Or split into two prompts: code changes (one apply prompt) + dependency changes (manual via Packager UI)
- Verify the dependency change as a final step using `grep` against package.json and a `ls node_modules/<package>` check — do NOT use npm commands to verify

### LN-002 — "All verifications pass" is a conclusion, not evidence

First V-check report came back as a summary saying everything was green, but several groups weren't called out at all and the actual grep counts and TSC output weren't pasted. Asking for verbatim output revealed the report was incomplete (E16 had not actually run).

Mitigation: V-check prompts must say "paste verbatim output of each step", not "verify and confirm". And the authorise step waits for raw numbers, not narrative.

### LN-003 — Treat "Confirmed High" risk register entries as flags for verification

Risk #1 (36-user lockout) was based on assuming the 36 unlinked users were pre-Clerk holdovers. They weren't. A 10-minute investigation changed the entire blocker status. The "Confirmed High" label gave false confidence.

Mitigation: when a risk register entry is marked "Confirmed", treat that as a flag for "verify, don't assume". Cheap to investigate. Expensive to plan around a wrong assumption.

### LN-004 — Replit auto-commits checkpoints unprompted

After A1 apply, git status was clean and changes were already at HEAD as commit 1ac43a8. This is normal Replit behaviour. Means:
- Rollback isn't `git checkout .` — needs `git revert <hash>` or `git reset --hard <prev-hash>`
- The apply commit message is auto-generated, not chosen by us
- Multiple checkpoints can stack during one apply

Mitigation: not a problem in practice — just be aware that `git diff` between apply and V-check may show nothing because changes already committed. Use `git log --oneline -5` to see what landed.

### LN-005 — Dead-code scope creep is common; widen the assess greps

The original removals.md scoped A1 to 8 files + a handful of edits. Actual A1 ended up touching:
- admin/database.tsx (bcrypt re-auth gate not in original list)
- /login redirect at App.tsx:192 (not in original list)
- account.tsx legacy password UI (line numbers were under-counted)
- duplicate route registrations at App.tsx:189-190 (not flagged in original)

Mitigation: assess prompts should always include "grep wider than the explicit target list" to surface adjacent surfaces. Done in A1's assess — saved us from at least three would-be misses.

---

## Security sweep T2 (2026-05-28, v69)

### LN-012 — When matching depends on a runtime config value, print the value, not the source default

The T2 V-check 403'd a `https://valoxi.ai` curl in dev because `MARKETING_SITE_URL` was set as a dev secret to `http://localhost:3002`. The assess captured `config.marketing.siteUrl`'s source-code default (`https://valoxi.ai`) but never resolved its runtime value. The mismatch cost one verification round.

Mitigation: when an assess targets behaviour gated by a config field (exact-match origins, ID lookups, env-derived constants), the assess must include both `printenv <VAR>` and a runtime dump such as `npx tsx -e "import('./module').then(m => console.log(m.config.<path>))"`. Source defaults are not what runs.

A second instance of the same class: the original T2 PROD DATA CHECK was spec'd against authenticated requests, which are user-keyed and trust-proxy-independent. The state we needed was the IP-keyed limiters' behaviour. Mis-targeted prod checks waste cycles. Read the spec against the variable that actually changes.

### LN-013 — Two `app.use` mounts at the same prefix share middleware effects via `next()`; assess must trace router fall-through

`routes/index.ts` mounts `publicCheckoutRoutes` and `publicConfigRoutes` at the same `/api/v2/public` prefix. Express walks them in order. A GET to `/config` matches the first prefix, runs publicCors + waitlistLimiter, the router finds no `/config` route, calls `next()`, and Express falls through to the second mount. Net: a GET that "belongs to" publicConfigRoutes still burns a waitlistLimiter token.

The T2 assess noted the middleware on each mount but did not trace what happens when the first router has no matching route. Caught at prod V-check, surfaced as `ratelimit-policy: 10` on /config. Pre-existing, not T2-caused, but the assess should have flagged it as a router-design concern.

Mitigation: when two `app.use` mounts share a prefix, the assess must explicitly list which subpaths each router handles, and confirm there is no overlap. If overlap exists, middleware on the earlier mount runs for requests that ultimately the later mount serves. Either swap the order so the broader router runs second, or split the prefix.