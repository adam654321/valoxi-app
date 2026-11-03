# DRAFT FOR LEGAL REVIEW: processor changes for the privacy policy and DPA

**Status: DRAFT. Not legal advice. Do not publish until a lawyer has reviewed it.**
**Drafted:** 2026-11-03. **Thread:** Valoxi, Replit to DigitalOcean migration.
**Files affected (marketing site, not this repo):** `valoxi-site/src/app/privacy/page.tsx`, `valoxi-site/src/app/dpa/page.tsx`.

## 1. The timing rule that sets the cutover date

DPA section 5.2: the Processor informs the Controller of intended sub-processor changes "by updating Schedule 2 on the Valoxi website or by email notification **at least 14 days before the change takes effect**, giving the Controller the opportunity to object." Section 5.3 lets a Controller who objects terminate.

So, in order:
1. Publish the updated Schedule 2 (and privacy policy) with DigitalOcean and Neon ADDED and Replit still listed, marked "effective [cutover date]". Keep Replit listed until cutover.
2. Wait 14 clear days. Best practice: also email active customers, since "updating the website" alone is easy to miss.
3. Cutover no earlier than day 15.
4. After cutover (and after Phase 8 decommission, day 7 or later), remove Replit and bump "Last updated".

Earliest cutover = publish date + 14 days. Record this in `cutover-readiness.md` section 3 (done).

## 2. What changes and why

| Today | After cutover | Fact |
|---|---|---|
| Replit, Inc. (application hosting and database, United States) | DigitalOcean (application hosting) and Neon (database) | DO App Platform region LON1 (London). Neon project region eu-west-2 (London). Both vendors are US-headquartered companies. Neon runs on AWS infrastructure |
| "Account data and analytical outputs are processed on US-hosted infrastructure" | Stored and processed in London, United Kingdom | Document storage is unchanged: Cloudflare R2, Western Europe |
| Clerk, Resend, Stripe, Google Gemini | Unchanged | Still US or global |

Net effect on data location: application and database data moves from the US to the UK. The "international transfers" story gets simpler for the application layer but does not disappear (US-headquartered processors, remote access, and the unchanged US sub-processors).

## 3. Proposed replacement text (British English, no em dashes)

### 3.1 `privacy/page.tsx`, data layer table (around line 260)

Replace the Replit row:

```
{ layer: 'Application and database', provider: 'Replit', location: 'United States', stored: 'Account data, deal metadata, financial inputs, AI analysis outputs' },
```

with two rows:

```
{ layer: 'Application hosting', provider: 'DigitalOcean', location: 'London, United Kingdom', stored: 'Runs the application; processes account data, deal metadata, financial inputs and AI analysis outputs in memory' },
{ layer: 'Database', provider: 'Neon', location: 'London, United Kingdom', stored: 'Account data, deal metadata, financial inputs, AI analysis outputs' },
```

### 3.2 `privacy/page.tsx`, "In practical terms" paragraph (around line 281)

Replace the last sentence "Analytical outputs and account data are processed on US-hosted infrastructure." with:

> Analytical outputs and account data are stored and processed on infrastructure located in London, United Kingdom, operated by our hosting and database providers.

### 3.3 `privacy/page.tsx`, sub-processor table (around line 312)

Replace the Replit row with:

```
{ name: 'DigitalOcean, LLC', purpose: 'Application hosting', location: 'London, United Kingdom', dpaUrl: '[VERIFY: DigitalOcean DPA URL]' },
{ name: 'Neon, Inc.', purpose: 'Database hosting', location: 'London, United Kingdom', dpaUrl: '[VERIFY: Neon DPA URL]' },
```

### 3.4 `privacy/page.tsx`, section 7 intro and bullet (around lines 345 to 354)

Intro (replace "personal data is transferred to and processed in the United States by certain sub-processors"):

> ADJV LLC is based in the United States. Account data and analytical outputs are stored in the United Kingdom, and documents are stored in Western Europe. Some of our sub-processors are based in, or can access data from, the United States, and personal data is transferred to and processed in the United States by certain of them.

Replace the Replit bullet with:

> — **DigitalOcean:** [COUNSEL TO CONFIRM mechanism: the transfer mechanism in DigitalOcean's Data Processing Agreement, expected to be Standard Contractual Clauses with the UK Addendum]
> — **Neon:** [COUNSEL TO CONFIRM mechanism: the transfer mechanism in Neon's Data Processing Agreement]

### 3.5 `dpa/page.tsx`, Schedule 2 table (around line 277)

Replace the Replit row with:

```
{ name: 'DigitalOcean, LLC', location: 'London, United Kingdom', purpose: 'Application hosting', mechanism: '[COUNSEL TO CONFIRM] (DigitalOcean DPA)', dpaUrl: '[VERIFY URL]' },
{ name: 'Neon, Inc.', location: 'London, United Kingdom', purpose: 'Database hosting', mechanism: '[COUNSEL TO CONFIRM] (Neon DPA)', dpaUrl: '[VERIFY URL]' },
```

Before cutover (step 1 above) show BOTH the Replit row and these rows, with the new rows labelled "Effective [cutover date]" in the Purpose cell.

### 3.6 `dpa/page.tsx`, security measures, "Data protection" (around line 322)

Add one item after "Document storage in Western Europe via Cloudflare R2 (WEUR region)":

> Application hosting and the primary database located in London, United Kingdom

### 3.7 Dates

Bump "Last updated" in `privacy/page.tsx` (line 12, currently May 2026) and `dpa/page.tsx` (line 13, currently April 2026, version 1.0) to the publication month. Consider DPA version 1.1.

## 4. Questions for counsel

1. Does the section 5.2 notice need a direct email to Controllers (customers) as well as the website update? Which customers hold an executed DPA?
2. Is an AWS sub-sub-processor mention needed because Neon runs on AWS (and DigitalOcean's own infrastructure providers)?
3. Transfer mechanism and URLs for the DigitalOcean and Neon DPAs (the SCC and UK Addendum wording, and whether the UK-US Data Bridge applies to either).
4. The UK location does not remove the restricted-transfer analysis where US-headquartered processors or ADJV LLC staff access the data remotely. Confirm the section 7 wording.
5. The cookie policy and terms do not name Replit; no change needed (checked 2026-11-03).

## 5. Not changed

- `terms/page.tsx` and `cookie-policy/page.tsx`: no mention of Replit or hosting location.
- Clerk, Resend, Stripe, Google, Cloudflare rows.
