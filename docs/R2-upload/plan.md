# R2 Presigned Upload — Plan

Status: COMPLETE. Slices 1, 2, 3, 4, 4b shipped to prod and proven. Slice 5
(removal) is dev-clean and pending a low-risk deploy.
Owner: Adam
Related: assessment.md, removals.md; action log v71

## Problem

Real PDF uploads failed in prod. The request 403'd with an HTML block page from
a Google Cloud load balancer (34.111.x.x) and never reached Express (zero
backend log). Express only ever returns JSON, so the HTML 403 came from the GCP
edge in front of the Replit deployment, above the app. Reproduced on a different
account and a different network, and with a re-encoded copy of the file, so not
network and not a single-file byte signature. A 15KB trivial PDF passed; 54KB,
210KB and 4.35MB all failed, so not a simple size cap either. Leading cause held
loosely: a content rule (Cloud Armor / WAF) at the GCP edge on the binary PDF
stream. The portal upload route had the identical exposure.

## Fix

Presigned direct-to-R2 upload. The browser asks Express for a short-lived signed
PUT URL, PUTs the file straight to R2 (the r2.cloudflarestorage.com host), then
calls Express with the R2 key to register the document. The file binary never
crosses the GCP edge, so no edge rule or cap can apply at any size. The two small
JSON calls (upload-url, register) cross the edge fine, as JSON to the app always
did.

## Design decisions

- Validation moved off the binary. The old multer fileFilter and 10MB cap ran on
  the bytes server-side. With multer gone, register HeadObjects the key to read
  the TRUE size and content-type from R2, enforces the 10MB cap there, and
  deletes-and-rejects if over, empty, or a disallowed type. The documents row is
  written from the HeadObject, not from client claims.
- Cross-tenant key guard. Register validates the key prefix against the caller's
  company: companies/{id}/ for the main route, portal/{tokenCompanyId}/ for the
  portal. The company always comes from the session or the token, never the
  client, so a client cannot register an object into another company.
- Content-Type is pinned on the signed PUT and echoed back, so the browser PUTs
  exactly the signed value (signature match).
- 10MB cap retained.
- Hand-rolled two-step (request URL, PUT, register), not the installed Uppy
  aws-s3 plugin, to keep the existing upload UI and minimise the diff.

## Slices

- Slice 1 (backend, main route): getPresignedPutUrl + head helpers in
  file-storage.service.ts; POST /company/:id/upload-url and /register; old
  multipart route kept as fallback. Added @aws-sdk/s3-request-presigner.
  SHIPPED, prod-proven.
- Slice 2 (frontend, main): document-management.tsx to the two-step. SHIPPED,
  prod-proven (dev doc 454, then prod).
- Slice 3 (backend, portal): portal upload-url + register; submitDocument
  refactored to take file metadata from HeadObject instead of the multer object;
  portal key scoped to portal/{companyId}. SHIPPED.
- Slice 4 (frontend, portal): enhanced-portal-display.tsx + DdCollection.tsx to
  the two-step. SHIPPED, prod-proven.
- Slice 4b (frontend, internal DD): DueDiligenceTab.tsx upload-and-link to the
  two-step (apiRequest for the app calls, bare fetch for the R2 PUT, then link by
  id). SHIPPED, prod-proven.
- Slice 5 (removal): deleted both old multipart routes and their multer configs,
  removed the orphaned sharedFileFilter, deleted the dead simple-portal-display.tsx.
  multer kept (beta-feedback still uses it). DEV-CLEAN, deploy pending.

## Proof

- Dev: doc 454 (215KB real PDF) through the new main path, 3 analysis types.
  Company 70: docs 455 and 456 internal DD (companies/70/, buyer_linked,
  analysed), doc 457 portal DD (portal/70/, seller_uploaded, external_submission
  94, linked). All requirement link rows present.
- Prod: main Documents tab (earlier deploy), then portal and internal DD on Acme
  Manufacturing. PUTs returned 200 to R2, not 403. Edge bypass confirmed against
  the real edge.

## Dependency note

@aws-sdk/s3-request-presigner pinned to 3.1011.0 to match @aws-sdk/client-s3. A
3.1062 vs 3.1011 skew threw a @smithy private-property type mismatch on
getSignedUrl. Pin both packages together on any future bump.

## CORS

R2 bucket valoxi-documents CORS: the existing localhost:3000 GET rule (unrelated)
is kept; a PUT rule allows https://app.valoxi.ai and the dev Replit origin, with
content-type as an allowed header. If the dev Replit preview URL rotates, update
the dev origin in the bucket policy.