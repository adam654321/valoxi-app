# Document deletion cascade — read-only assessment

**Assessed 2026-09-25, 11:13:41–11:15:48 UTC.** Production was queried using `DATABASE_URL="$PROD_DATABASE_URL"` and `PGOPTIONS='-c default_transaction_read_only=on'` via `psql`. No managed production connection or agent database integration was used. No database, storage, or code changes were made. Counts below are point-in-time readings, not proof that every NULL resulted from a deletion. The only workspace change is this report.

**Requirement:** when a document is deleted, figures derived from it must leave the corpus. **Current behavior does not guarantee that.** The ordinary delete removes contributions and reselects projection winners, but `document_evidence.document_id` is `ON DELETE SET NULL`, leaving its periods and figures intact. Projection tables can likewise retain rows with NULL sources. Existing expert analyses, model snapshots, and saved model values are not invalidated by the document-delete path. A document ID embedded in JSON is not protected by a relational FK.

## 1. What the delete does today

### Entry points and order

| Entry point | Actual delete path, in order | Transaction? |
|---|---|---|
| `server/routes/documents.routes.ts:56-67` → `server/services/documents.service.ts:98-109` | Delegates to `server/services/documents-files.service.ts:112-152`. For a regular document: delete non-projection staff/debtor/asset/loan rows → delete document contributions → `reselect(company)` → detach residual projection source IDs → delete analysis rows → repository deletes analysis rows again, upload events, access logs, document row → optional external-submission row and file → document file. The service's financial and analysis cleanup exceptions are caught and logged. | **No** outer transaction. |
| `server/routes/documents-files.routes.ts:185-193` | Calls the **same** `documents-files.service.ts:112-152` path. Its fallback for an external-only submission deletes the external-submission row then its file; that is not a `documents` row. | **No** outer transaction. |
| `server/routes/portal-submissions.routes.ts:80-85` → `server/services/portal-submissions.service.ts:160-183` | After token/company check: delete non-projection rows → delete contributions → reselect → detach residual projection references (cleanup errors caught/logged) → `server/repositories/portal-submissions.repository.ts:108-113` deletes analysis rows, upload events, document row → delete file. Unlike the ordinary repository path, this repository does **not** explicitly delete `document_access_log`; its `NO ACTION` FK can block deletion if logs exist. | **No** outer transaction. |
| `server/services/target-companies.service.ts:150-230` | Whole-company deletion: in a `db.transaction`, delete analysis by upload event, upload events, document access logs → NULL financial references → delete deal documents → delete all company contributions and documents → delete stage requirements and external submissions → other company data. This is **not** a single-document endpoint. | **Yes**, database transaction; shown path does not unlink document files. |
| `server/repositories/documents.repository.ts:263-360`, exposed by `server/services/documents-files.service.ts:159-161` | Bulk `clearAllCompanyDocuments`: collect document/submission IDs → delete analyses, access logs, upload events → NULL financial and DD document references → delete contributions → delete documents → delete external submissions → unlink files. No route calling this bulk helper was found; it remains a callable service/repository path. | **No** outer transaction. |
| `server/repositories/documents.repository.ts:247-253` | Hard-deletes an **external submission**, called by `documents-files.service.ts:136-143,148-152`; it does not itself delete a `documents` row. Contact cleanup in `server/repositories/contacts.repository.ts:139-140,162` also deletes external submissions, not `documents` rows. Deleting a DD attachment link (`server/routes/due-diligence.routes.ts:100` or `server/routes/portal-submissions.routes.ts:179-195`) removes a link, not the underlying document. | No transaction shown for the standalone path. |

### Verbatim execution excerpts (73 source lines total; line ranges and omissions identified)

`server/services/documents-files.service.ts:112-135,145`:
```ts
  async deleteDocument(documentId: number, userCompanyId: number): Promise<void> {
    const document = await documentsRepository.getDocument(documentId, userCompanyId);
    if (document) {
      try {
        // Non-projection financial data (staff, debtors, assets, loans) — delete directly
        await financialDataRepository.deleteNonProjectionByDocumentId(documentId);
        // Drop contributions then rebuild the projection via reselect
        await db.delete(financialContributions).where(eq(financialContributions.sourceDocumentId, documentId));
        await reselect(document.targetCompanyId);
        // Detach any remaining source_document_id pointers (periods whose only source was this doc).
        // Must run AFTER reselect so winners are already re-pointed before we null the orphans.
        await financialDataRepository.detachDocumentReferences(documentId);
      } catch (error) {
        console.error(`[DELETE_DOCUMENT] Error cleaning financial data for document ${documentId}:`, error);
      }
      
      try {
        await documentAnalysisRepository.deleteByDocumentId(documentId);
      } catch (error) {
        console.error(`[DELETE_DOCUMENT] Error deleting analysis results for document ${documentId}:`, error);
      }
      
      const success = await documentsRepository.deleteDocument(documentId, userCompanyId);
      if (!success) throw new Error('Failed to delete document');
```
`server/services/documents-files.service.ts:145` (after the optional external submission cleanup at lines 136–144):
```ts
      await fileStorageService.delete(document.filePath);
```
`server/repositories/documents.repository.ts:146-150,152-162`:
```ts
  async deleteDocument(documentId: number, userCompanyId: number): Promise<boolean> {
    await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, documentId));
    await db.delete(fileUploadEvents).where(eq(fileUploadEvents.documentId, documentId));
    await db.delete(documentAccessLog).where(eq(documentAccessLog.documentId, documentId));
```
```ts
    const [deletedDocument] = await db
      .delete(documents)
      .where(and(
        eq(documents.id, documentId),
        inArray(
          documents.targetCompanyId,
          db.select({ id: targetCompanies.id })
            .from(targetCompanies)
            .where(eq(targetCompanies.userCompanyId, userCompanyId))
        )
      ))
      .returning();
```
`server/services/portal-submissions.service.ts:160-183` (the deletion sequence):
```ts
  async deleteDocument(accessToken: string, documentId: number): Promise<void> {
    const token = await this.validateToken(accessToken);
    const document = await portalSubmissionsRepository.getDocument(documentId);
    if (!document || document.targetCompanyId !== token.targetCompanyId) throw new NotFoundError('Document not found');
    try {
```
```ts
      await financialDataRepository.deleteNonProjectionByDocumentId(documentId);
      // Drop contributions then rebuild the projection via reselect
      await db.delete(financialContributions).where(eq(financialContributions.sourceDocumentId, documentId));
      await reselect(document.targetCompanyId);
      await financialDataRepository.detachDocumentReferences(documentId);
    } catch (error) {
      console.error(`[PORTAL_DELETE] Error cleaning financial data for document ${documentId}:`, error);
    }
    const success = await portalSubmissionsRepository.deleteDocument(documentId);
    if (!success) throw new Error('Failed to delete document');
    await fileStorageService.delete(document.filePath);
```
`server/repositories/portal-submissions.repository.ts:108-113`:
```ts
  async deleteDocument(documentId: number): Promise<boolean> {
    await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, documentId));
    await db.delete(fileUploadEvents).where(eq(fileUploadEvents.documentId, documentId));
    const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning();
    return !!deleted;
  }
```
`server/services/target-companies.service.ts:160,191-198,209-211`:
```ts
    await db.transaction(async (tx) => {
```
```ts
      await tx.execute(sql`UPDATE financial_periods SET source_document_id = NULL WHERE target_company_id = ${id}`);
      await tx.execute(sql`UPDATE income_statements SET source_document_id = NULL WHERE target_company_id = ${id}`);
      await tx.execute(sql`UPDATE balance_sheets SET source_document_id = NULL WHERE target_company_id = ${id}`);
      await tx.execute(sql`UPDATE staff_data SET source_document_id = NULL WHERE target_company_id = ${id}`);
      await tx.execute(sql`UPDATE aged_debtors SET source_document_id = NULL WHERE target_company_id = ${id}`);
      await tx.execute(sql`UPDATE fixed_assets_register SET source_document_id = NULL WHERE target_company_id = ${id}`);
      await tx.execute(sql`UPDATE loan_facilities SET source_document_id = NULL WHERE target_company_id = ${id}`);
```
```ts
      await tx.execute(sql`DELETE FROM financial_contributions WHERE target_company_id = ${id}`);
      await tx.delete(documents).where(eq(documents.targetCompanyId, id));
```

The bulk path's exact operations are at `server/repositories/documents.repository.ts:303-353`: it deletes `documentAnalysisResults`, `documentAccessLog`, `fileUploadEvents`; sets `sourceDocumentId: null` in seven financial tables and `documentId: null` in two DD tables; deletes `financialContributions`, `documents`, `externalDocumentSubmissions`; then calls `fs.unlink` for collected paths. These are independent awaits, not an atomic transaction. **There is no soft-delete or archive field/mechanism on `documents`: deletion is hard**, and the normal file path calls `fileStorageService.delete` after the DB deletion. `fileStorageService.delete` catches and logs its own storage errors (`server/services/file-storage.service.ts:86-100`).

### Production FK behavior

These are **actual PROD constraints** read from `pg_constraint`, not merely intended ORM declarations. PostgreSQL `NO ACTION` is listed as such; it is not `RESTRICT`, but both prevent an unresolved reference at delete time under the ordinary immediate constraints.

| Referencing table.column | Referenced table | PROD ON DELETE |
|---|---|---|
| `document_evidence.document_id` | `documents.id` | **SET NULL** |
| `document_evidence.document_analysis_result_id` | `document_analysis_results.id` | **SET NULL** |
| `document_evidence_period.document_evidence_id` | `document_evidence.id` | NO ACTION |
| `document_evidence_figure.document_evidence_period_id` | `document_evidence_period.id` | NO ACTION |
| `document_analysis_results.document_id` | `documents.id` | NO ACTION |
| `file_upload_events.document_id` | `documents.id` | NO ACTION |
| `document_access_log.document_id` | `documents.id` | NO ACTION |
| `financial_contributions.source_document_id` | `documents.id` | NO ACTION |
| `financial_periods.source_document_id` | `documents.id` | **SET NULL** |
| `income_statements.source_document_id` | `documents.id` | **SET NULL** |
| `balance_sheets.source_document_id` | `documents.id` | **SET NULL** |
| `staff_data.source_document_id` | `documents.id` | NO ACTION |
| `aged_debtors.source_document_id` | `documents.id` | NO ACTION |
| `fixed_assets_register.source_document_id` | `documents.id` | NO ACTION |
| `loan_facilities.source_document_id` | `documents.id` | NO ACTION |
| `dd_requirement_status.document_id` | `documents.id` | NO ACTION |
| `dd_requirement_documents.document_id` | `documents.id` | NO ACTION |
| `token_usage.document_id` | no FK | **NO CONSTRAINT** |

**Mechanism:** `SET NULL` on evidence and projection sources retains the row and removes traceability, not its figures; its child evidence periods and figures retain their parent evidence reference. `NO CONSTRAINT` on `token_usage.document_id` permits dangling IDs. `deal_models.financial_data_snapshot` and `expert_data_snapshot` are JSON, not FK-enforced document references. The schema grep also finds `portal_activity_log.related_document_id` (ORM points to `external_document_submissions`, but **PROD has no FK**), `portal_document_requirements.submitted_document_id` (also external submissions; **no PROD FK**), and `company_document_requirements.submitted_document_id` (external submissions; PROD **NO ACTION**). `deal_documents.parent_document_id` has no FK but is a *deal-document* relationship, not a `documents.id` source.

## 2. PROD size — counts first

Readings below were taken between **11:14:12 and 11:14:14 UTC**; each table query printed its own timestamp. `NULL` and dangling are mutually exclusive. Dangling means a **non-NULL** ID with no row in `documents`; no dangling values were found in the FK-protected direct-document tables.

| Table / reference | UTC query time (11:MM:SS) | Total | NULL | Dangling |
|---|---|---:|---:|---:|
| `aged_debtors.source_document_id` | 11:14:12.492720 | 54 | 5 | 0 |
| `balance_sheets.source_document_id` | 11:14:12.585060 | 785 | 130 | 0 |
| `dd_requirement_documents.document_id` | 11:14:12.656723 | 14 | 0 | 0 |
| `dd_requirement_status.document_id` | 11:14:12.730643 | 20 | 18 | 0 |
| `document_access_log.document_id` | 11:14:12.807872 | 136 | 0 | 0 |
| `document_analysis_results.document_id` | 11:14:12.986793 | 2,054 | 0 | 0 |
| `document_evidence.document_id` | 11:14:13.080031 | 370 | **26** | 0 |
| `file_upload_events.document_id` | 11:14:13.250986 | 1,051 | 0 | 0 |
| `financial_contributions.source_document_id` | 11:14:13.438240 | 2,029 | **301** | 0 |
| `financial_periods.source_document_id` | 11:14:13.517215 | 875 | **143** | 0 |
| `fixed_assets_register.source_document_id` | 11:14:13.598844 | 40 | 5 | 0 |
| `income_statements.source_document_id` | 11:14:13.762246 | 812 | **138** | 0 |
| `loan_facilities.source_document_id` | 11:14:13.832068 | 0 | 0 | 0 |
| `staff_data.source_document_id` | 11:14:14.041880 | 63 | 7 | 0 |
| `token_usage.document_id` (**no FK**) | 11:14:14.230977 | 13,562 | 3,508 | **2,327** |
| `document_evidence_period` (inherited `document_evidence.document_id`) | 11:14:14.318338 | 642 | **46** | 0 |
| `document_evidence_figure` (inherited `document_evidence.document_id`) | 11:14:14.438021 | 16,683 | **1,430** | 0 |
| `document_evidence.document_analysis_result_id` (separate result FK) | 11:14:14.510500 | 370 | 26 | 0 |

**Other document-named columns refer to external submissions, not `documents`:** at 11:15:48 UTC, `portal_activity_log.related_document_id` had 2,302 rows, 2,271 NULL, **2 dangling IDs relative to `external_document_submissions`** (no FK). Its two dangling rows belong to **company 23** via `portal_access_tokens` (checked 11:18:08 UTC). `portal_document_requirements.submitted_document_id` and `company_document_requirements.submitted_document_id` each had zero rows. Their counts must not be represented as dangling `documents.id` references. An earlier comparison against `documents` would be the wrong target.

### Affected company IDs, deduplicated per row set

| Set with NULL or dangling document reference | Company IDs |
|---|---|
| `document_evidence` / its analysis-result reference | 196, 234, 249, 250, 259, 279, **282** |
| Indirect `document_evidence_period` and `_figure` | 196, 249, 250, 259, **282** |
| `financial_contributions` | 67, 80, 81, 84, 88, 89, 90, 94, 98, 121, 132, 133, 136, 142, 162, 167, 168, 169, 172, 173, 174, 175, 176, 177, 179, 180, 185, 186, 188, 190, 192, 199, 204, 207, 211, 212, 213, 220 |
| `financial_periods` | 80, 81, 88, 89, 90, 121, 142, 162, 167, 168, 169, 173, 174, 175, 176, 177, 179, 180, 185, 186, 188, 190, 192, 199, 204, 207, 211, 212, 213, 221 |
| `income_statements` | 67, 80, 81, 84, 88, 89, 90, 94, 98, 121, 133, 136, 142, 162, 167, 168, 169, 172, 173, 174, 175, 176, 177, 179, 180, 185, 186, 188, 190, 192, 199, 204, 207, 211, 212, 213 |
| `balance_sheets` | 80, 81, 88, 89, 90, 121, 142, 162, 167, 168, 169, 173, 174, 175, 176, 177, 179, 180, 185, 186, 188, 190, 192, 199, 204, 207, 211, 212, 213, 220, 231 |
| `aged_debtors` | 80, 88, 89, 90, 185 |
| `fixed_assets_register` | 89, 160, 162, 188, 190 |
| `staff_data` | 80, 88, 89, 162, 179, 188, 216 |
| `dd_requirement_status` | 14, 45, 70, 71 |

Other FK-protected direct-document sets had no NULL/dangling rows. `token_usage` has no `target_company_id`; for a deleted or NULL document, the former parent cannot reliably supply a company ID. `portal_activity_log` also lacks that column, but its two dangling external-submission references can be attributed to company 23 through the surviving portal token. NULL references in that log are not treated as company-specific deletion residue.

## 3. Deal-model-facing data and stored model residue

Across **all** companies, `income_statements` + `balance_sheets` + `financial_contributions` contain **3,626 rows: 569 NULL references and 0 dangling** (11:15:26 UTC). Of these, restricting to companies with at least one `deal_models` row and counting each normalized row once (not multiplying by models) gives:

| Table | Rows | NULL source | Dangling source | Affected companies |
|---|---:|---:|---:|---:|
| `income_statements` | 511 | 81 | 0 | 67, 80, 88, 89, 90, 94, 121, 133, 162, 167, 168, 169, 172, 188, 190, 199, 204, 211, 212, 213 |
| `balance_sheets` | 497 | 79 | 0 | 80, 88, 89, 90, 121, 162, 167, 168, 169, 188, 190, 199, 204, 211, 212, 213, 220 |
| `financial_contributions` | 1,289 | 181 | 0 | 67, 80, 88, 89, 90, 94, 121, 133, 162, 167, 168, 169, 172, 188, 190, 199, 204, 211, 212, 213, 220 |
| **Combined** | **2,297** | **341** | **0** | **21 distinct:** 67, 80, 88, 89, 90, 94, 121, 133, 162, 167, 168, 169, 172, 188, 190, 199, 204, 211, 212, 213, 220 |

This is an *exposure count*, not a determination that every NULL row was derived from a deleted file. A NULL could also have arisen during import or other processing.

**41 of 139 deal models** have at least one numeric `sourceDocumentId` recursively embedded in `financial_data_snapshot` or `expert_data_snapshot` that no longer exists in `documents`. All discovered missing IDs were in `financial_data_snapshot`; none was found under the exact JSON key `sourceDocumentId` in `expert_data_snapshot`. This does **not** clear expert snapshots of stale *figures*: their nested values can have no source ID at all. The following list contains every affected model (model ID / company / status / stored `total_purchase_price` / missing document ID):

| Model | Company | Status | Stored price | Missing ID |
|---:|---:|---|---:|---:|
| 58 | 103 | draft | 695250 | 574 |
| 61 | 89 | draft | -771213.5 | 547 |
| 62 | 106 | draft | 651130.3099999999 | 608, 609 |
| 63 | 80 | draft | -251400 | 605 |
| 69 | 121 | draft | 1122574.5 | 688 |
| 80 | 88 | draft | -83039.39200000004 | 596 |
| 99 | 162 | draft | -6986.880000000005 | 1093 |
| 100 | 168 | draft | 314091 | 1102 |
| 101 | 169 | draft | -151063 | 1105 |
| 102 | 167 | draft | 86000.5 | 1108 |
| 103 | 160 | sent | 359508.8 | 1116 |
| 104 | 172 | draft | 518483.93333333335 | 1136 |
| 105 | 190 | draft | 458926.66666666674 | 1167 |
| 107 | 190 | draft | 836258 | 1167 |
| 108 | 188 | sent | 350658 | 1186 |
| 113 | 196 | sent | 380165 | 1276 |
| 115 | 199 | draft | -968800.6666666667 | 1284 |
| 116 | 199 | draft | -741498.5 | 1284 |
| 117 | 103 | draft | 695250 | 574 |
| 120 | 172 | draft | 523239.7666666666 | 1136 |
| 121 | 204 | draft | 59852.5 | 1328 |
| 123 | 211 | draft | -33347.97 | 1377 |
| 124 | 212 | draft | 1140032.3333333333 | 1381 |
| 125 | 213 | draft | -53391.33333333334 | 1386 |
| 126 | 204 | draft | 99767 | 1328 |
| 127 | 188 | sent | 350658 | 1186 |
| 128 | 216 | draft | 140552.83333333335 | 1444 |
| 130 | 218 | draft | 21662159.333333336 | 1471 |
| 131 | 218 | draft | 11677366.583333332 | 1471 |
| 132 | 196 | sent | 410000 | 1276 |
| 134 | 218 | draft | 21662159.333333336 | 1471 |
| 135 | 188 | sent | 368226 | 1186 |
| 136 | 188 | sent | 456655.7733333333 | 1186 |
| 137 | 221 | draft | 0 | 1524 |
| 138 | 89 | draft | -1762 | 547 |
| 139 | 197 | draft | -166308.3 | 1410 |
| 146 | 196 | sent | 410000 | 1276 |
| 152 | 196 | sent | 450000 | 1276 |
| 153 | 130 | draft | 70000 | 860 |
| 172 | 250 | draft | 52147.746666666644 | 1901 |
| 190 | 282 | draft | 1473725.75 | 2112 |

**State:** 32 affected models are unlocked `draft`; 9 are locked `sent`. None of their companies currently has an accepted offer-letter row in `deal_documents`. The offer-generation path (`server/services/deal-document.service.ts:712-774,776-840`) checks accepted offers and recomputes from the latest screen EBITDA; it does not reject a model merely because its snapshot references a missing document or because its status is `sent`. Therefore **all 41 are potentially addressable by document/offer generation paths**, with **32 editable drafts** and **9 sent models that may enter a versioning path**. This is *not* a claim all 41 would successfully generate or send: financial-year and other guards may block them, and no checkout, generation, or write was performed. A cascade on document FKs alone cannot remove these JSON snapshots.

## 4. Cross-check against historical “58 of 154”

At **11:15:26 UTC** the directly rerun full normalized three-table count was **569 / 3,626** untraceable by `NULL`/dangling source: **569 NULL, 0 dangling**. Restricting to companies with a deal model (a plausible reading of “deal-model-visible”) yielded **341 / 2,297: 341 NULL, 0 dangling**. The supplied historical figure **58 / 154** does not specify its company set, row-selection predicate, or original query, and no matching query was found in the project search. **Neither current denominator is claimed to reproduce that historical 154-row cohort. No causal conclusion is drawn from the difference.**

## 5. Safety/transaction conclusion

The normal document delete and portal delete **do not run as one database transaction**; they can leave partially completed work, especially because financial cleanup errors are caught and processing continues. Company deletion *does* run in a database transaction, but it is a different operation; the bulk cleanup helper does not. Documents are **hard-deleted**, not soft-deleted or archived. `ON DELETE SET NULL` and unconstrained/JSON references are the explicit residual mechanisms; `NO ACTION` references instead require cleanup first or prevent the delete. A present NULL by itself is not evidence of which file, if any, supplied its values. No deletion or cleanup has been attempted for this assessment.