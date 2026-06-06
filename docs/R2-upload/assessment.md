# R2 Presigned Upload — Assessment

Status: HISTORICAL. Assessment done 2026-06-05 via read-only greps and file reads.
Owner: Adam
Related: plan.md, removals.md

## Diagnosis (revised twice, settled)

Prod uploads of real PDFs 403 at the GCP edge in front of the Replit deployment.
The failed request remote address is a Google Cloud load balancer (34.111.x.x)
returning an HTML block page; Express only returns JSON and logs nothing, so the
block is above the app. Ruled out: network or DLP (reproduced on a different
account and network), single-file byte signature (a re-encoded copy still
failed), pure size cap (15KB passed, 54KB / 210KB / 4.35MB failed). Leading cause
held loosely: a content rule (Cloud Armor / WAF) on the binary PDF stream. The
padded-trivial-file test was noted as the one confirming test (pad a trivial file
to ~1MB: passes means content cause, fails means size back in play); it does not
gate the build because presign closes both causes.

## Upload internals at assessment

- Main route POST /api/v2/files/company/:id/upload: multer memoryStorage, 10MB
  cap, sharedFileFilter; buffered in memory then fileStorageService.upload(key,
  buffer) to R2. The full body crossed the edge in, then out.
- Portal route POST /api/v2/portal-submit/:token/submit: identical multer
  pattern; submitDocument writes external_document_submissions + documents +
  file_upload_events, enqueues analysis, and optionally updates
  dd_requirement_status. Same edge exposure.
- R2 already wired server-side: S3Client to the R2 endpoint, bucket
  valoxi-documents, R2_* creds. Helpers present: generateKey, upload, download,
  delete, isObjectStorageKey. No presigner; @aws-sdk/s3-request-presigner absent.
- Upload callers found via the formData.append('document') census. multer is
  .single('document'), so every working multipart upload must append that field,
  which makes the census complete: document-management.tsx (main),
  DueDiligenceTab.tsx (main, upload-and-link), enhanced-portal-display.tsx
  (portal), DdCollection.tsx (portal DD), and simple-portal-display.tsx (portal,
  DEAD, never rendered; PortalPage mounts only EnhancedPortalDisplay).

## Analysis path (checked, unrelated to the fix)

Upload enqueues analysisQueue.enqueue({ eventId, targetCompanyId }); the worker
calls analyzeUploadedFileWithGemini, which reads the file via
fileStorageService.download(key) from R2 (local fs fallback for legacy paths) and
calls the custom GeminiClient (gemini-client.ts): native https direct to
generativelanguage.googleapis.com, GOOGLE_GEMINI_API_KEY, model
gemini-3-flash-preview. This deliberately bypasses the Replit AI Integrations
interceptor (native https cannot be patched at the JS layer); the file carries a
"never swap for replit_integrations/" note. No Anthropic or OpenAI in the path.

The historical "Replit Gemini override" worry was an outbound-routing concern,
already solved in gemini-client.ts before this workstream, and is a different
layer from the inbound GCP edge that this workstream fixed. The R2 change does
not alter which AI runs.

Stage 1 vs Stage 2: every upload enqueues analysis, but Gemini only stores
results for recognised financial types. Stage 1 collects financials (results
stored). Stage 2 DD collects mixed docs that classify as none (nothing stored).
So Stage 2 is effectively not analysed, by classification outcome, not by an
explicit stage gate. This is fine as-is; real Stage 2 DD analysis is a future
want, not yet scoped.

## Decisions and why

- Validation off the binary: HeadObject at register reads true size and type;
  register writes from that, enforces 10MB, deletes-and-rejects on fail.
- Cross-tenant key guard: register checks the key prefix against the session
  company or the token company.
- Hand-rolled two-step over Uppy aws-s3 to keep the UI and shrink the diff.
- 10MB cap kept.
- Presigner pinned to the client-s3 version to avoid the @smithy type skew.
- Portal key rescoped from flat portal/ to portal/{companyId}/ for the tenant
  guard; nothing keys off the old flat prefix (isObjectStorageKey, delete,
  serveFile all checked).
- multer retained: beta-feedback.routes.ts still uses it.

## Prod state

Presigned path live and proven in prod on the main Documents tab and on Acme
Manufacturing for portal and internal DD. PUTs return 200 to R2; the edge is
bypassed.