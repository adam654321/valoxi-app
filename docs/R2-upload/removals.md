# R2 Presigned Upload — Removals

Operational checklist. Ticked as slices shipped.

## Slice 5 — removed (dev-clean, deploy pending)

- [x] server/routes/documents-files.routes.ts: old POST /company/:id/upload
      handler, multer import, the upload = multer({...}) config
- [x] server/routes/portal-submissions.routes.ts: old POST /:token/submit
      handler, multer import, the portalUpload = multer({...}) config
- [x] server/utils/upload.ts: sharedFileFilter function (orphaned once both
      multer configs were gone)
- [x] client/src/components/simple-portal-display.tsx: deleted entire file (dead,
      never rendered; PortalPage mounts only EnhancedPortalDisplay)

Net: 587 lines removed, TSC held at the 1-error baseline (portal.service.ts:81).

## Kept (load-bearing — do not remove)

- multer in package.json: beta-feedback.routes.ts still uses it.
- isAllowedFile and sanitizeFilename in utils/upload.ts: used by the new routes
  and by portal-submissions.service.ts.
- uploadLimiter: used by the new /upload-url route.
- @aws-sdk/s3-request-presigner 3.1011.0: pinned to @aws-sdk/client-s3.

## Backlog (carried out of this workstream)

- [ ] Split dev and prod R2 into separate buckets. Both currently use
      valoxi-documents on the same account; dev test PUTs land in the prod bucket
      namespace and dev creds can touch prod objects. Plan a clean separation.
- [ ] Orphaned-object sweep: a PUT that never registers leaves an object with no
      row. Storage is cheap; add a periodic sweep (G hygiene).
- [ ] Stage 2 DD analysis: future want. Currently Stage 2 docs classify as none
      and store nothing, which is fine for now.
- [ ] CORS dev origin: update the bucket policy if the dev Replit preview URL
      rotates.
- [ ] Uppy: @uppy/* is installed but no live consumer was found for aws-s3 in the
      upload path. Confirm dead and remove via the Packager UI if so.
- [ ] Padded-trivial-file test (optional, diagnostic only): pad a trivial PDF to
      ~1MB and upload in prod. Passes means content/WAF cause confirmed and size
      exonerated; fails means size back in play. The presigned fix covers both
      either way, so this only labels the cause.