-- Slice 1a.1: correct ON DELETE on the evidence layer.
-- Evidence must survive DAR churn and document deletion, never block them.

ALTER TABLE document_evidence
  DROP CONSTRAINT document_evidence_analysis_result_id_fkey;
ALTER TABLE document_evidence
  ADD CONSTRAINT document_evidence_analysis_result_id_fkey
  FOREIGN KEY (document_analysis_result_id)
  REFERENCES document_analysis_results(id) ON DELETE SET NULL;

ALTER TABLE document_evidence
  ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE document_evidence
  DROP CONSTRAINT document_evidence_document_id_fkey;
ALTER TABLE document_evidence
  ADD CONSTRAINT document_evidence_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES documents(id) ON DELETE SET NULL;
