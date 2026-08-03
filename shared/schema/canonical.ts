import { pgTable, serial, integer, varchar, date, boolean, numeric, jsonb, text, timestamp, unique, index, foreignKey } from 'drizzle-orm/pg-core';
import { targetCompanies } from './deals';
import { documentEvidence, documentEvidencePeriod, documentEvidenceFigure } from './evidence';

export const canonicalRun = pgTable('canonical_run', {
  id: serial('id').primaryKey(),
  targetCompanyId: integer('target_company_id').notNull(),
  resolverVersion: integer('resolver_version').notNull(),
  asOfDate: date('as_of_date').notNull(),
  inputFingerprint: text('input_fingerprint').notNull(),
  outputFingerprint: text('output_fingerprint').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  companyIdx: index('canonical_run_company_idx').on(t.targetCompanyId, t.createdAt),
  companyFk: foreignKey({ columns: [t.targetCompanyId], foreignColumns: [targetCompanies.id], name: 'canonical_run_company_fk' }).onDelete('cascade'),
}));

export const canonicalPeriod = pgTable('canonical_period', {
  id: serial('id').primaryKey(),
  canonicalRunId: integer('canonical_run_id').notNull(),
  targetCompanyId: integer('target_company_id').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  statementType: varchar('statement_type', { length: 10 }).notNull(),
  spanKind: varchar('span_kind', { length: 12 }).notNull(),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  monthsCovered: integer('months_covered'),
  isFullYearProvisional: boolean('is_full_year_provisional').notNull().default(true),
  trustState: varchar('trust_state', { length: 20 }).notNull(),
  valuationEligible: boolean('valuation_eligible').notNull().default(false),
  anchorComplete: boolean('anchor_complete').notNull().default(false),
  winningEvidenceId: integer('winning_evidence_id'),
  winningPeriodId: integer('winning_period_id'),
  supersededEvidenceIds: integer('superseded_evidence_ids').array(),
  conflictDetail: jsonb('conflict_detail'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  runCompanyYearStmtSpanUnique: unique('canonical_period_run_company_year_stmt_span_unique')
    .on(t.canonicalRunId, t.targetCompanyId, t.fiscalYear, t.statementType, t.spanKind),
  runFk: foreignKey({ columns: [t.canonicalRunId], foreignColumns: [canonicalRun.id], name: 'canonical_period_run_fk' }).onDelete('cascade'),
  companyFk: foreignKey({ columns: [t.targetCompanyId], foreignColumns: [targetCompanies.id], name: 'canonical_period_company_fk' }).onDelete('cascade'),
  evidenceFk: foreignKey({ columns: [t.winningEvidenceId], foreignColumns: [documentEvidence.id], name: 'canonical_period_evidence_fk' }).onDelete('set null'),
  winningPeriodFk: foreignKey({ columns: [t.winningPeriodId], foreignColumns: [documentEvidencePeriod.id], name: 'canonical_period_winning_period_fk' }).onDelete('set null'),
}));

export const canonicalFigure = pgTable('canonical_figure', {
  id: serial('id').primaryKey(),
  canonicalPeriodId: integer('canonical_period_id').notNull(),
  fieldKey: varchar('field_key', { length: 100 }).notNull(),
  value: numeric('value'),
  sourceEvidenceFigureId: integer('source_evidence_figure_id'),
  // Relative payload path, everything after the first years.N. segment, e.g.
  // balance_sheet.current_assets.total. THIS is the uniqueness key, not
  // field_key. field_key is the leaf name and repeats within a period: dev
  // carries 295 duplicate (period, field_key) groups, 294 of them 'total'.
  // Type text, matching document_evidence_figure.payload_path, deliberately
  // not varchar, because revenue_breakdown paths encode product names as key
  // segments and the vocabulary is unbounded.
  figurePath: text('figure_path').notNull(),
}, (t) => ({
  periodPathUnique: unique('canonical_figure_period_path_unique').on(t.canonicalPeriodId, t.figurePath),
  periodFk: foreignKey({ columns: [t.canonicalPeriodId], foreignColumns: [canonicalPeriod.id], name: 'canonical_figure_period_fk' }).onDelete('cascade'),
  sourceFigureFk: foreignKey({ columns: [t.sourceEvidenceFigureId], foreignColumns: [documentEvidenceFigure.id], name: 'canonical_figure_source_figure_fk' }).onDelete('set null'),
}));

export const canonicalGap = pgTable('canonical_gap', {
  id: serial('id').primaryKey(),
  canonicalRunId: integer('canonical_run_id').notNull(),
  targetCompanyId: integer('target_company_id').notNull(),
  fiscalYear: integer('fiscal_year'),
  gapKind: varchar('gap_kind', { length: 40 }).notNull(),
  detail: jsonb('detail'),
  unlockedBy: text('unlocked_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  runFk: foreignKey({ columns: [t.canonicalRunId], foreignColumns: [canonicalRun.id], name: 'canonical_gap_run_fk' }).onDelete('cascade'),
  companyFk: foreignKey({ columns: [t.targetCompanyId], foreignColumns: [targetCompanies.id], name: 'canonical_gap_company_fk' }).onDelete('cascade'),
}));
