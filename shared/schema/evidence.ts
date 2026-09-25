import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { targetCompanies } from './deals';
import { documents } from './documents';
import { documentAnalysisResults } from './documents';

export const documentEvidence = pgTable('document_evidence', {
  id: serial('id').primaryKey(),
  targetCompanyId: integer('target_company_id')
    .references(() => targetCompanies.id)
    .notNull(),
  documentId: integer('document_id')
    .references(() => documents.id, { onDelete: 'cascade' }),
  documentAnalysisResultId: integer('document_analysis_result_id').references(
    () => documentAnalysisResults.id,
    { onDelete: 'cascade' }
  ),
  documentType: varchar('document_type', { length: 100 }).notNull(),
  extractionVersion: integer('extraction_version').notNull().default(1),
  contentHash: varchar('content_hash', { length: 64 }),
  extractor: varchar('extractor', { length: 100 }),
  extractedAt: timestamp('extracted_at').defaultNow(),
  companyNamesFound: jsonb('company_names_found'),
  registeredNumbersFound: jsonb('registered_numbers_found'),
  yearEndStated: date('year_end_stated'),
  directorsNamed: jsonb('directors_named'),
  accountantName: text('accountant_name'),
  isDraft: boolean('is_draft'),
  isAbridged: boolean('is_abridged'),
  isSigned: boolean('is_signed'),
  reportDate: date('report_date'),
  identityVerdict: varchar('identity_verdict', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  docTypeVersionUnique: unique('document_evidence_doc_type_version_unique').on(t.documentId, t.documentType, t.extractionVersion),
  companyIdx: index('idx_document_evidence_company').on(t.targetCompanyId),
  documentIdx: index('idx_document_evidence_document').on(t.documentId),
}));

export const documentEvidencePeriod = pgTable('document_evidence_period', {
  id: serial('id').primaryKey(),
  documentEvidenceId: integer('document_evidence_id')
    .references(() => documentEvidence.id, { onDelete: 'cascade' })
    .notNull(),
  fiscalYearStated: integer('fiscal_year_stated'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  periodLabelAsPrinted: text('period_label_as_printed'),
  monthsCoveredStated: integer('months_covered_stated'),
  monthsCoveredComputed: integer('months_covered_computed'),
  isFullYearComputed: boolean('is_full_year_computed'),
  provenance: varchar('provenance', { length: 40 }),
  anomalies: jsonb('anomalies'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  periodEvidenceIdx: index('idx_document_evidence_period_evidence').on(t.documentEvidenceId),
}));

export const documentEvidenceFigure = pgTable('document_evidence_figure', {
  id: serial('id').primaryKey(),
  documentEvidencePeriodId: integer('document_evidence_period_id')
    .references(() => documentEvidencePeriod.id, { onDelete: 'cascade' })
    .notNull(),
  statementType: varchar('statement_type', { length: 10 }).notNull(),
  fieldKey: varchar('field_key', { length: 100 }).notNull(),
  value: numeric('value'),
  labelTextAsPrinted: text('label_text_as_printed'),
  pageNumber: integer('page_number'),
  payloadPath: text('payload_path'),
  isModelDerived: boolean('is_model_derived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  figurePeriodIdx: index('idx_document_evidence_figure_period').on(t.documentEvidencePeriodId),
}));
