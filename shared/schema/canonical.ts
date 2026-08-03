import { pgTable, serial, integer, varchar, date, boolean, numeric, jsonb, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { targetCompanies } from './deals';
import { documentEvidence, documentEvidencePeriod, documentEvidenceFigure } from './evidence';

export const canonicalRun = pgTable('canonical_run', {
  id: serial('id').primaryKey(),
  targetCompanyId: integer('target_company_id').references(() => targetCompanies.id, { onDelete: 'cascade' }).notNull(),
  resolverVersion: integer('resolver_version').notNull(),
  asOfDate: date('as_of_date').notNull(),
  inputFingerprint: text('input_fingerprint').notNull(),
  outputFingerprint: text('output_fingerprint').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  companyIdx: index('canonical_run_company_idx').on(t.targetCompanyId, t.createdAt),
}));

export const canonicalPeriod = pgTable('canonical_period', {
  id: serial('id').primaryKey(),
  canonicalRunId: integer('canonical_run_id').references(() => canonicalRun.id, { onDelete: 'cascade' }).notNull(),
  targetCompanyId: integer('target_company_id').references(() => targetCompanies.id, { onDelete: 'cascade' }).notNull(),
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
  winningEvidenceId: integer('winning_evidence_id').references(() => documentEvidence.id, { onDelete: 'set null' }),
  winningPeriodId: integer('winning_period_id').references(() => documentEvidencePeriod.id, { onDelete: 'set null' }),
  supersededEvidenceIds: integer('superseded_evidence_ids').array(),
  conflictDetail: jsonb('conflict_detail'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  runCompanyYearStmtSpanUnique: unique('canonical_period_run_company_year_stmt_span_unique')
    .on(t.canonicalRunId, t.targetCompanyId, t.fiscalYear, t.statementType, t.spanKind),
}));

export const canonicalFigure = pgTable('canonical_figure', {
  id: serial('id').primaryKey(),
  canonicalPeriodId: integer('canonical_period_id').references(() => canonicalPeriod.id, { onDelete: 'cascade' }).notNull(),
  fieldKey: varchar('field_key', { length: 100 }).notNull(),
  value: numeric('value'),
  sourceEvidenceFigureId: integer('source_evidence_figure_id').references(() => documentEvidenceFigure.id, { onDelete: 'set null' }),
}, (t) => ({
  periodFieldUnique: unique('canonical_figure_period_field_unique').on(t.canonicalPeriodId, t.fieldKey),
}));

export const canonicalGap = pgTable('canonical_gap', {
  id: serial('id').primaryKey(),
  canonicalRunId: integer('canonical_run_id').references(() => canonicalRun.id, { onDelete: 'cascade' }).notNull(),
  targetCompanyId: integer('target_company_id').references(() => targetCompanies.id, { onDelete: 'cascade' }).notNull(),
  fiscalYear: integer('fiscal_year'),
  gapKind: varchar('gap_kind', { length: 40 }).notNull(),
  detail: jsonb('detail'),
  unlockedBy: text('unlocked_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
