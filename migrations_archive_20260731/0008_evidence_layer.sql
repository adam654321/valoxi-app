-- Slice 1a: evidence layer schema. Additive only.
-- Nothing writes to these tables in this slice.

ALTER TABLE target_companies
  ADD COLUMN company_number varchar(20);

CREATE TABLE document_evidence (
  id serial NOT NULL,
  target_company_id integer NOT NULL,
  document_id integer NOT NULL,
  document_analysis_result_id integer,
  document_type varchar(100) NOT NULL,
  extraction_version integer NOT NULL DEFAULT 1,
  content_hash varchar(64),
  extractor varchar(100),
  extracted_at timestamp DEFAULT now(),
  company_names_found jsonb,
  registered_numbers_found jsonb,
  year_end_stated date,
  directors_named jsonb,
  accountant_name text,
  is_draft boolean,
  is_abridged boolean,
  is_signed boolean,
  report_date date,
  identity_verdict varchar(20),
  created_at timestamp DEFAULT now(),
  CONSTRAINT document_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT document_evidence_target_company_id_fkey
    FOREIGN KEY (target_company_id) REFERENCES target_companies(id),
  CONSTRAINT document_evidence_document_id_fkey
    FOREIGN KEY (document_id) REFERENCES documents(id),
  CONSTRAINT document_evidence_analysis_result_id_fkey
    FOREIGN KEY (document_analysis_result_id)
    REFERENCES document_analysis_results(id),
  CONSTRAINT document_evidence_doc_type_version_unique
    UNIQUE (document_id, document_type, extraction_version)
);

CREATE TABLE document_evidence_period (
  id serial NOT NULL,
  document_evidence_id integer NOT NULL,
  fiscal_year_stated integer,
  period_start date,
  period_end date,
  period_label_as_printed text,
  months_covered_stated integer,
  months_covered_computed integer,
  is_full_year_computed boolean,
  provenance varchar(40),
  created_at timestamp DEFAULT now(),
  CONSTRAINT document_evidence_period_pkey PRIMARY KEY (id),
  CONSTRAINT document_evidence_period_evidence_id_fkey
    FOREIGN KEY (document_evidence_id) REFERENCES document_evidence(id)
);

CREATE TABLE document_evidence_figure (
  id serial NOT NULL,
  document_evidence_period_id integer NOT NULL,
  statement_type varchar(10) NOT NULL,
  field_key varchar(100) NOT NULL,
  value numeric,
  label_text_as_printed text,
  page_number integer,
  payload_path text,
  is_model_derived boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  CONSTRAINT document_evidence_figure_pkey PRIMARY KEY (id),
  CONSTRAINT document_evidence_figure_period_id_fkey
    FOREIGN KEY (document_evidence_period_id)
    REFERENCES document_evidence_period(id)
);

CREATE INDEX idx_document_evidence_company
  ON document_evidence (target_company_id);
CREATE INDEX idx_document_evidence_document
  ON document_evidence (document_id);
CREATE INDEX idx_document_evidence_period_evidence
  ON document_evidence_period (document_evidence_id);
CREATE INDEX idx_document_evidence_figure_period
  ON document_evidence_figure (document_evidence_period_id);
