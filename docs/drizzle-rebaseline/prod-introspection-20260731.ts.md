import { pgTable, unique, serial, varchar, text, boolean, integer, timestamp, foreignKey, numeric, uniqueIndex, jsonb, index, date, check, uuid, type AnyPgColumn, json, inet, pgView, bigint, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const billingInterval = pgEnum("billing_interval", ['month', 'year'])
export const nylasGrantStatus = pgEnum("nylas_grant_status", ['active', 'revoked', 'broken'])
export const nylasProvider = pgEnum("nylas_provider", ['google', 'microsoft'])
export const planKey = pgEnum("plan_key", ['CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE'])
export const subscriptionStatus = pgEnum("subscription_status", ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'admin_comped'])


export const activityTypes = pgTable("activity_types", {
	id: serial().primaryKey().notNull(),
	typeName: varchar("type_name", { length: 50 }).notNull(),
	description: text(),
	requiresContact: boolean("requires_contact").default(false),
	defaultDuration: integer("default_duration"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("activity_types_type_name_unique").on(table.typeName),
]);

export const targetCompanies = pgTable("target_companies", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	companyName: varchar("company_name", { length: 255 }).notNull(),
	industry: varchar({ length: 100 }),
	website: varchar({ length: 255 }),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	address: text(),
	annualRevenue: numeric("annual_revenue"),
	employeeCount: integer("employee_count"),
	yearEstablished: integer("year_established"),
	description: text(),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	stage: varchar({ length: 50 }).default('New Target'),
	stageUpdatedAt: timestamp("stage_updated_at", { mode: 'string' }).defaultNow(),
	stageUpdatedBy: integer("stage_updated_by"),
	websiteAnalysis: text("website_analysis"),
	websiteAnalysisProcessedAt: timestamp("website_analysis_processed_at", { mode: 'string' }),
	subSector: varchar("sub_sector", { length: 100 }),
	initialDiscussionCompleted: boolean("initial_discussion_completed").default(false),
	initialDiscussionDate: timestamp("initial_discussion_date", { mode: 'string' }),
	initialDiscussionNotes: text("initial_discussion_notes"),
	initialDiscussionBy: integer("initial_discussion_by"),
	isArchived: boolean("is_archived").default(false).notNull(),
	archivedAt: timestamp("archived_at", { mode: 'string' }),
	companyNumber: varchar("company_number", { length: 20 }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "target_companies_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.initialDiscussionBy],
			foreignColumns: [users.id],
			name: "target_companies_initial_discussion_by_fkey"
		}),
	foreignKey({
			columns: [table.stageUpdatedBy],
			foreignColumns: [users.id],
			name: "target_companies_stage_updated_by_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "target_companies_user_company_id_user_companies_id_fk"
		}),
]);

export const currentOffers = pgTable("current_offers", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	dealDocumentId: integer("deal_document_id"),
	dealModelId: integer("deal_model_id"),
	offerPrice: text("offer_price"),
	enterpriseValue: text("enterprise_value"),
	transactionType: varchar("transaction_type", { length: 20 }),
	documentData: jsonb("document_data"),
	deliveryMethod: varchar("delivery_method", { length: 10 }),
	status: varchar({ length: 20 }).default('sent'),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	acceptedBy: varchar("accepted_by", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("current_offers_target_company_unique").using("btree", table.targetCompanyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "current_offers_deal_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "current_offers_target_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "current_offers_user_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.dealDocumentId],
			foreignColumns: [dealDocuments.id],
			name: "current_offers_deal_document_id_fkey"
		}).onDelete("set null"),
]);

export const documentEvidence = pgTable("document_evidence", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	documentId: integer("document_id"),
	documentAnalysisResultId: integer("document_analysis_result_id"),
	documentType: varchar("document_type", { length: 100 }).notNull(),
	extractionVersion: integer("extraction_version").default(1).notNull(),
	contentHash: varchar("content_hash", { length: 64 }),
	extractor: varchar({ length: 100 }),
	extractedAt: timestamp("extracted_at", { mode: 'string' }).defaultNow(),
	companyNamesFound: jsonb("company_names_found"),
	registeredNumbersFound: jsonb("registered_numbers_found"),
	yearEndStated: date("year_end_stated"),
	directorsNamed: jsonb("directors_named"),
	accountantName: text("accountant_name"),
	isDraft: boolean("is_draft"),
	isAbridged: boolean("is_abridged"),
	isSigned: boolean("is_signed"),
	reportDate: date("report_date"),
	identityVerdict: varchar("identity_verdict", { length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_document_evidence_company").using("btree", table.targetCompanyId.asc().nullsLast().op("int4_ops")),
	index("idx_document_evidence_document").using("btree", table.documentId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "document_evidence_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.documentAnalysisResultId],
			foreignColumns: [documentAnalysisResults.id],
			name: "document_evidence_analysis_result_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_evidence_document_id_fkey"
		}).onDelete("set null"),
	unique("document_evidence_doc_type_version_unique").on(table.documentId, table.documentType, table.extractionVersion),
]);

export const waitlist = pgTable("waitlist", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fullName: text("full_name").notNull(),
	email: text().notNull(),
	phone: text(),
	acquisitionJourney: text("acquisition_journey").notNull(),
	targetDealSize: text("target_deal_size").notNull(),
	sectors: text().array().notNull(),
	sectorsOther: text("sectors_other"),
	acquisitionsCompleted: text("acquisitions_completed").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	cohort: text().default('5D').notNull(),
	discountTier: text("discount_tier").default('standard').notNull(),
	status: varchar({ length: 20 }).default('new').notNull(),
	statusChangedAt: timestamp("status_changed_at", { mode: 'string' }),
	statusChangedBy: integer("status_changed_by"),
	invitedUserId: integer("invited_user_id"),
	marketingConsent: boolean("marketing_consent").default(false).notNull(),
	marketingConsentAt: timestamp("marketing_consent_at", { mode: 'string' }),
}, (table) => [
	index("waitlist_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("waitlist_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.statusChangedBy],
			foreignColumns: [users.id],
			name: "waitlist_status_changed_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.invitedUserId],
			foreignColumns: [users.id],
			name: "waitlist_invited_user_id_users_id_fk"
		}),
	unique("waitlist_email_unique").on(table.email),
	check("waitlist_status_check", sql`(status)::text = ANY ((ARRAY['new'::character varying, 'approved'::character varying, 'invited'::character varying, 'declined'::character varying])::text[])`),
]);

export const documentEvidencePeriod = pgTable("document_evidence_period", {
	id: serial().primaryKey().notNull(),
	documentEvidenceId: integer("document_evidence_id").notNull(),
	fiscalYearStated: integer("fiscal_year_stated"),
	periodStart: date("period_start"),
	periodEnd: date("period_end"),
	periodLabelAsPrinted: text("period_label_as_printed"),
	monthsCoveredStated: integer("months_covered_stated"),
	monthsCoveredComputed: integer("months_covered_computed"),
	isFullYearComputed: boolean("is_full_year_computed"),
	provenance: varchar({ length: 40 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_document_evidence_period_evidence").using("btree", table.documentEvidenceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.documentEvidenceId],
			foreignColumns: [documentEvidence.id],
			name: "document_evidence_period_evidence_id_fkey"
		}),
]);

export const documentEvidenceFigure = pgTable("document_evidence_figure", {
	id: serial().primaryKey().notNull(),
	documentEvidencePeriodId: integer("document_evidence_period_id").notNull(),
	statementType: varchar("statement_type", { length: 10 }).notNull(),
	fieldKey: varchar("field_key", { length: 100 }).notNull(),
	value: numeric(),
	labelTextAsPrinted: text("label_text_as_printed"),
	pageNumber: integer("page_number"),
	payloadPath: text("payload_path"),
	isModelDerived: boolean("is_model_derived").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_document_evidence_figure_period").using("btree", table.documentEvidencePeriodId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.documentEvidencePeriodId],
			foreignColumns: [documentEvidencePeriod.id],
			name: "document_evidence_figure_period_id_fkey"
		}),
]);

export const documentCategories = pgTable("document_categories", {
	id: serial().primaryKey().notNull(),
	categoryName: varchar("category_name", { length: 100 }).notNull(),
	description: text(),
	isRequired: boolean("is_required").default(false),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("document_categories_category_name_unique").on(table.categoryName),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	userCompanyId: integer("user_company_id"),
	role: varchar({ length: 50 }).default('user'),
	emailVerified: boolean("email_verified").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	userRole: varchar("user_role", { length: 50 }).default('analyst'),
	isCompanyAdmin: boolean("is_company_admin").default(false),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	currentCompanyId: integer("current_company_id"),
	isSystemAdmin: boolean("is_system_admin").default(false).notNull(),
	onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
	onboardingStep: varchar("onboarding_step", { length: 50 }).default('create_target'),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: 'string' }),
	hearAboutUs: varchar("hear_about_us", { length: 100 }),
	jobTitle: varchar("job_title", { length: 100 }),
	clerkUserId: varchar("clerk_user_id", { length: 255 }),
	welcomeEmailSentAt: timestamp("welcome_email_sent_at", { mode: 'string' }),
	assignedPromoCampaignId: integer("assigned_promo_campaign_id"),
	assignedByAdminId: integer("assigned_by_admin_id"),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }),
	checklistCompleted: boolean("checklist_completed").default(false).notNull(),
	marketingConsent: boolean("marketing_consent").default(false).notNull(),
	marketingConsentAt: timestamp("marketing_consent_at", { mode: 'string' }),
}, (table) => [
	index("users_email_lower_idx").using("btree", sql`lower((email)::text)`),
	foreignKey({
			columns: [table.currentCompanyId],
			foreignColumns: [userCompanies.id],
			name: "users_current_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "users_user_company_id_user_companies_id_fk"
		}),
	foreignKey({
			columns: [table.assignedByAdminId],
			foreignColumns: [table.id],
			name: "users_assigned_by_admin_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedPromoCampaignId],
			foreignColumns: [promoCodeCampaigns.id],
			name: "users_assigned_promo_campaign_id_promo_code_campaigns_id_fk"
		}),
	unique("users_email_unique").on(table.email),
	unique("users_clerk_user_id_unique").on(table.clerkUserId),
]);

export const pipelineStages = pgTable("pipeline_stages", {
	id: serial().primaryKey().notNull(),
	stageName: varchar("stage_name", { length: 50 }).notNull(),
	stageOrder: integer("stage_order").notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("pipeline_stages_stage_name_unique").on(table.stageName),
]);

export const marketingUnsubscribes = pgTable("marketing_unsubscribes", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	email: varchar({ length: 255 }).notNull(),
	topicId: varchar("topic_id", { length: 255 }),
	topicName: varchar("topic_name", { length: 255 }),
	resendEventId: varchar("resend_event_id", { length: 255 }).notNull(),
	resendContactId: varchar("resend_contact_id", { length: 255 }),
	payload: jsonb().default({}).notNull(),
	unsubscribedAt: timestamp("unsubscribed_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	source: varchar({ length: 50 }).default('resend_webhook').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "marketing_unsubscribes_user_id_fkey"
		}),
	unique("marketing_unsubscribes_resend_event_id_unique").on(table.resendEventId),
]);

export const userAcceptances = pgTable("user_acceptances", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	documentType: varchar("document_type", { length: 32 }).notNull(),
	version: varchar({ length: 32 }).notNull(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }).defaultNow().notNull(),
	ipAddress: varchar("ip_address", { length: 64 }),
	userAgent: text("user_agent"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_acceptances_user_id_fkey"
		}).onDelete("cascade"),
]);

export const nylasGrants = pgTable("nylas_grants", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	grantId: varchar("grant_id", { length: 255 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	provider: nylasProvider().notNull(),
	status: nylasGrantStatus().default('active').notNull(),
	scopes: jsonb(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	lastErrorAt: timestamp("last_error_at", { mode: 'string' }),
	lastErrorMessage: varchar("last_error_message", { length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isCompanyDefault: boolean("is_company_default").default(false).notNull(),
	isPersonalDefault: boolean("is_personal_default").default(false).notNull(),
}, (table) => [
	uniqueIndex("nylas_grants_one_company_default_per_company").using("btree", table.userCompanyId.asc().nullsLast().op("int4_ops")).where(sql`(is_company_default = true)`),
	uniqueIndex("nylas_grants_one_personal_default_per_user").using("btree", table.userId.asc().nullsLast().op("int4_ops")).where(sql`(is_personal_default = true)`),
	index("nylas_grants_user_company_idx").using("btree", table.userCompanyId.asc().nullsLast().op("int4_ops")),
	index("nylas_grants_user_status_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "nylas_grants_user_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "nylas_grants_user_id_fkey"
		}),
	unique("nylas_grants_grant_id_unique").on(table.grantId),
]);

export const broadcastsSent = pgTable("broadcasts_sent", {
	id: serial().primaryKey().notNull(),
	composerSessionId: varchar("composer_session_id", { length: 64 }).notNull(),
	subject: varchar({ length: 255 }).notNull(),
	bodyMarkdown: text("body_markdown").notNull(),
	segmentKey: varchar("segment_key", { length: 50 }).notNull(),
	segmentId: varchar("segment_id", { length: 255 }).notNull(),
	isTest: boolean("is_test").default(false).notNull(),
	recipientCountEstimate: integer("recipient_count_estimate"),
	resendBroadcastId: varchar("resend_broadcast_id", { length: 255 }),
	sentByUserId: integer("sent_by_user_id").notNull(),
	status: varchar({ length: 30 }).default('sent').notNull(),
	errorMessage: text("error_message"),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sentByUserId],
			foreignColumns: [users.id],
			name: "broadcasts_sent_sent_by_user_id_fkey"
		}),
]);

export const resendRateLimits = pgTable("resend_rate_limits", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	requestCount: integer("request_count").default(1),
	windowStart: timestamp("window_start", { mode: 'string' }).defaultNow(),
});

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const referralInvoiceRecords = pgTable("referral_invoice_records", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	invoiceMonth: varchar("invoice_month", { length: 7 }).notNull(),
	amountCents: integer("amount_cents").notNull(),
	memberEmail: varchar("member_email", { length: 255 }),
	status: varchar({ length: 20 }).default('pending').notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "referral_invoice_records_user_company_id_fkey"
		}),
	unique("referral_invoice_records_user_company_id_unique").on(table.userCompanyId),
]);

export const marketingConsentTokens = pgTable("marketing_consent_tokens", {
	id: serial().primaryKey().notNull(),
	token: varchar({ length: 64 }).notNull(),
	userId: integer("user_id"),
	waitlistId: uuid("waitlist_id"),
	email: varchar({ length: 255 }).notNull(),
	resendMessageId: varchar("resend_message_id", { length: 255 }),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow().notNull(),
	consentRecordedAt: timestamp("consent_recorded_at", { mode: 'string' }),
	ipAddress: inet("ip_address"),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("marketing_consent_tokens_user_id_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")).where(sql`(user_id IS NOT NULL)`),
	index("marketing_consent_tokens_waitlist_id_idx").using("btree", table.waitlistId.asc().nullsLast().op("uuid_ops")).where(sql`(waitlist_id IS NOT NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "marketing_consent_tokens_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.waitlistId],
			foreignColumns: [waitlist.id],
			name: "marketing_consent_tokens_waitlist_id_fkey"
		}).onDelete("cascade"),
	unique("marketing_consent_tokens_token_unique").on(table.token),
	check("marketing_consent_tokens_recipient_check", sql`((user_id IS NOT NULL) AND (waitlist_id IS NULL)) OR ((user_id IS NULL) AND (waitlist_id IS NOT NULL))`),
]);

export const userRoles = pgTable("user_roles", {
	id: serial().primaryKey().notNull(),
	roleName: varchar("role_name", { length: 50 }).notNull(),
	roleDescription: text("role_description"),
	canManageUsers: boolean("can_manage_users").default(false),
	canManageCompany: boolean("can_manage_company").default(false),
	canCreateDeals: boolean("can_create_deals").default(false),
	canEditAllDeals: boolean("can_edit_all_deals").default(false),
	canDeleteDeals: boolean("can_delete_deals").default(false),
	canUploadDocuments: boolean("can_upload_documents").default(false),
	canCreateOffers: boolean("can_create_offers").default(false),
	canViewFinancials: boolean("can_view_financials").default(false),
	canAccessAnalytics: boolean("can_access_analytics").default(false),
	canExportData: boolean("can_export_data").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_roles_role_name_unique").on(table.roleName),
]);

export const dealModelSellerPayments = pgTable("deal_model_seller_payments", {
	id: serial().primaryKey().notNull(),
	dealModelId: integer("deal_model_id").notNull(),
	paymentType: varchar("payment_type", { length: 50 }).default('fixed_schedule').notNull(),
	amount: numeric().default('0'),
	termMonths: integer("term_months"),
	interestRate: numeric("interest_rate"),
	label: varchar({ length: 255 }),
	includeInDscr: boolean("include_in_dscr").default(true).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "deal_model_seller_payments_deal_model_id_fk"
		}),
]);

export const webhookEvents = pgTable("webhook_events", {
	id: serial().primaryKey().notNull(),
	source: varchar({ length: 100 }).notNull(),
	eventType: varchar("event_type", { length: 100 }).notNull(),
	payload: jsonb().default({}).notNull(),
	status: varchar({ length: 20 }).default('received').notNull(),
	error: text(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	stripeEventId: varchar("stripe_event_id", { length: 255 }),
}, (table) => [
	index("webhook_events_stripe_event_id_idx").using("btree", table.stripeEventId.asc().nullsLast().op("text_ops")),
]);

export const dealModelContingentConsideration = pgTable("deal_model_contingent_consideration", {
	id: serial().primaryKey().notNull(),
	dealModelId: integer("deal_model_id").notNull(),
	considerationType: varchar("consideration_type", { length: 50 }).default('custom').notNull(),
	maximumAmount: numeric("maximum_amount").default('0'),
	termMonths: integer("term_months"),
	triggerDescription: text("trigger_description"),
	includeInDscr: boolean("include_in_dscr").default(true).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "deal_model_contingent_consideration_deal_model_id_fk"
		}),
]);

export const targetContacts = pgTable("target_contacts", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	title: varchar({ length: 100 }),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 50 }),
	isPrimary: boolean("is_primary").default(false),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "target_contacts_target_company_id_target_companies_id_fk"
		}),
]);

export const activities = pgTable("activities", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	userId: integer("user_id").notNull(),
	activityType: varchar("activity_type", { length: 50 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	activityDate: timestamp("activity_date", { mode: 'string' }).notNull(),
	activityTime: varchar("activity_time", { length: 8 }),
	durationMinutes: integer("duration_minutes"),
	contactId: integer("contact_id"),
	isCompleted: boolean("is_completed").default(true),
	followUpDate: timestamp("follow_up_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [targetContacts.id],
			name: "activities_contact_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "activities_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activities_user_id_fkey"
		}),
]);

export const addonPurchases = pgTable("addon_purchases", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	addonType: varchar("addon_type", { length: 50 }).notNull(),
	quantity: integer().default(1).notNull(),
	stripePaymentRef: varchar("stripe_payment_ref", { length: 255 }),
	unitPriceMinorUnit: integer("unit_price_minor_unit").notNull(),
	currency: varchar({ length: 3 }).default('gbp').notNull(),
	purchasedAt: timestamp("purchased_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "addon_purchases_user_company_id_fkey"
		}),
]);

export const documents = pgTable("documents", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	uploadedBy: integer("uploaded_by").notNull(),
	documentName: varchar("document_name", { length: 255 }).notNull(),
	originalFilename: varchar("original_filename", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileSize: integer("file_size").notNull(),
	fileType: varchar("file_type", { length: 200 }).notNull(),
	documentCategory: varchar("document_category", { length: 100 }).notNull(),
	description: text(),
	isConfidential: boolean("is_confidential").default(true),
	uploadDate: timestamp("upload_date", { mode: 'string' }).defaultNow(),
	lastAccessed: timestamp("last_accessed", { mode: 'string' }),
	accessCount: integer("access_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	externalSubmissionId: integer("external_submission_id"),
	secondaryCategory: text("secondary_category"),
	publicToken: varchar("public_token", { length: 64 }).notNull(),
}, (table) => [
	uniqueIndex("idx_documents_public_token").using("btree", table.publicToken.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.externalSubmissionId],
			foreignColumns: [externalDocumentSubmissions.id],
			name: "documents_external_submission_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "documents_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "documents_uploaded_by_fkey"
		}),
	unique("documents_public_token_unique").on(table.publicToken),
]);

export const agedDebtors = pgTable("aged_debtors", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	reportDate: date("report_date").notNull(),
	totalTradeDebtors: numeric("total_trade_debtors"),
	current0To30: numeric("current_0_to_30"),
	days31To60: numeric("days_31_to_60"),
	days61To90: numeric("days_61_to_90"),
	days90Plus: numeric("days_90_plus"),
	badDebtProvision: numeric("bad_debt_provision"),
	doubtfulDebts: numeric("doubtful_debts"),
	recentRevenue: numeric("recent_revenue"),
	debtorDays: numeric("debtor_days"),
	topDebtors: json("top_debtors"),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "aged_debtors_source_document_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "aged_debtors_target_company_id_fkey"
		}),
]);

export const balanceSheets = pgTable("balance_sheets", {
	id: serial().primaryKey().notNull(),
	financialPeriodId: integer("financial_period_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	intangibleAssets: numeric("intangible_assets"),
	tangibleFixedAssets: numeric("tangible_fixed_assets"),
	freeholdProperty: numeric("freehold_property"),
	leaseholdProperty: numeric("leasehold_property"),
	plantMachinery: numeric("plant_machinery"),
	fixturesFittings: numeric("fixtures_fittings"),
	motorVehicles: numeric("motor_vehicles"),
	computerEquipment: numeric("computer_equipment"),
	stockInventory: numeric("stock_inventory"),
	tradeDebtors: numeric("trade_debtors"),
	prepayments: numeric(),
	amountsOwedByDirectors: numeric("amounts_owed_by_directors"),
	amountsOwedByConnectedCompanies: numeric("amounts_owed_by_connected_companies"),
	directorsCurrentAccount: numeric("directors_current_account"),
	otherDebtors: numeric("other_debtors"),
	cashAtBank: numeric("cash_at_bank"),
	totalCurrentAssets: numeric("total_current_assets"),
	tradeCreditors: numeric("trade_creditors"),
	taxationSocialSecurity: numeric("taxation_social_security"),
	vatPayable: numeric("vat_payable"),
	corporationTaxDue: numeric("corporation_tax_due"),
	bankLoansOverdraftCurrent: numeric("bank_loans_overdraft_current"),
	hirePurchaseCurrent: numeric("hire_purchase_current"),
	accruals: numeric(),
	amountsOwedToDirectors: numeric("amounts_owed_to_directors"),
	otherCreditors: numeric("other_creditors"),
	totalCurrentLiabilities: numeric("total_current_liabilities"),
	bankLoansLongTerm: numeric("bank_loans_long_term"),
	hirePurchaseLongTerm: numeric("hire_purchase_long_term"),
	deferredTaxation: numeric("deferred_taxation"),
	otherLongTermDebt: numeric("other_long_term_debt"),
	totalLongTermLiabilities: numeric("total_long_term_liabilities"),
	shareCapital: numeric("share_capital"),
	retainedEarnings: numeric("retained_earnings"),
	totalEquity: numeric("total_equity"),
	debtorsList: json("debtors_list"),
	creditorsList: json("creditors_list"),
	fixedAssetsDetail: json("fixed_assets_detail"),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.financialPeriodId],
			foreignColumns: [financialPeriods.id],
			name: "balance_sheets_financial_period_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "balance_sheets_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "balance_sheets_source_document_id_fkey"
		}).onDelete("set null"),
]);

export const betaFeedback = pgTable("beta_feedback", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	userCompanyId: integer("user_company_id"),
	reporterEmail: varchar("reporter_email", { length: 255 }),
	reporterName: varchar("reporter_name", { length: 255 }),
	type: varchar({ length: 20 }).notNull(),
	severity: varchar({ length: 10 }),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	pageUrl: varchar("page_url", { length: 500 }),
	pageTitle: varchar("page_title", { length: 255 }),
	userAgent: varchar("user_agent", { length: 500 }),
	status: varchar({ length: 20 }).default('open').notNull(),
	adminNotes: text("admin_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	screenshotUrl: varchar("screenshot_url", { length: 500 }),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "beta_feedback_user_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "beta_feedback_user_id_fkey"
		}),
]);

export const portalAccessTokens = pgTable("portal_access_tokens", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	targetContactId: integer("target_contact_id").notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	accessToken: varchar("access_token", { length: 255 }).notNull(),
	tokenPurpose: varchar("token_purpose", { length: 100 }).default('document_submission'),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdBy: integer("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	isActive: boolean("is_active").default(true),
	lastAccessed: timestamp("last_accessed", { mode: 'string' }),
	accessCount: integer("access_count").default(0),
	allowedActions: text("allowed_actions"),
	customMessage: text("custom_message"),
	portalBranding: text("portal_branding"),
	ipAddressesUsed: text("ip_addresses_used").array(),
	userAgentStrings: text("user_agent_strings").array(),
	agreedSubmissionTimeframe: integer("agreed_submission_timeframe").default(14),
	submissionDeadline: date("submission_deadline"),
	chaseUpStatus: varchar("chase_up_status", { length: 50 }).default('not_started'),
	lastChaseEmailSent: timestamp("last_chase_email_sent", { mode: 'string' }),
	chaseEmailCount: integer("chase_email_count").default(0),
	manualDeadlineSet: timestamp("manual_deadline_set", { mode: 'string' }),
	finalDeadlineDate: date("final_deadline_date"),
	escalationLevel: varchar("escalation_level", { length: 50 }).default('none'),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "portal_access_tokens_created_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "portal_access_tokens_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.targetContactId],
			foreignColumns: [targetContacts.id],
			name: "portal_access_tokens_target_contact_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "portal_access_tokens_user_company_id_fkey"
		}),
	unique("portal_access_tokens_access_token_unique").on(table.accessToken),
]);

export const chaseUpEmails = pgTable("chase_up_emails", {
	id: serial().primaryKey().notNull(),
	portalTokenId: integer("portal_token_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	emailSequenceNumber: integer("email_sequence_number").notNull(),
	emailType: varchar("email_type", { length: 50 }).notNull(),
	sentToContacts: text("sent_to_contacts").array(),
	ccInternalUsers: text("cc_internal_users").array(),
	emailSubject: varchar("email_subject", { length: 255 }),
	scheduledSendTime: timestamp("scheduled_send_time", { mode: 'string' }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	deliveryStatus: varchar("delivery_status", { length: 50 }).default('pending'),
	internalAlertSent: boolean("internal_alert_sent").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "chase_up_emails_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "chase_up_emails_target_company_id_fkey"
		}),
	unique("chase_up_emails_token_seq_unique").on(table.portalTokenId, table.emailSequenceNumber),
]);

export const chaseUpSchedules = pgTable("chase_up_schedules", {
	id: serial().primaryKey().notNull(),
	portalTokenId: integer("portal_token_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	timeframeDays: integer("timeframe_days").notNull(),
	submissionDeadline: date("submission_deadline").notNull(),
	email1DelayDays: integer("email_1_delay_days").default(0),
	email2DelayDays: integer("email_2_delay_days").default(2),
	email3DelayDays: integer("email_3_delay_days").default(5),
	email4DelayDays: integer("email_4_delay_days").default(8),
	manualDeadlineDelayDays: integer("manual_deadline_delay_days").default(11),
	isActive: boolean("is_active").default(true),
	isCompleted: boolean("is_completed").default(false),
	completionReason: varchar("completion_reason", { length: 100 }),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "chase_up_schedules_created_by_fkey"
		}),
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "chase_up_schedules_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "chase_up_schedules_target_company_id_fkey"
		}),
]);

export const companyDocumentRequirements = pgTable("company_document_requirements", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	requirementStatus: varchar("requirement_status", { length: 50 }).default('outstanding'),
	submissionStatus: varchar("submission_status", { length: 50 }).default('not_started'),
	submittedDocumentId: integer("submitted_document_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	submittedByContactId: integer("submitted_by_contact_id"),
	reviewedBy: integer("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewStatus: varchar("review_status", { length: 50 }),
	reviewNotes: text("review_notes"),
	reviewScore: integer("review_score"),
	dueDate: timestamp("due_date", { mode: 'string' }),
	reminderSentCount: integer("reminder_sent_count").default(0),
	lastReminderSent: timestamp("last_reminder_sent", { mode: 'string' }),
	nextReminderDue: timestamp("next_reminder_due", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	requirementName: varchar("requirement_name", { length: 255 }).default(').notNull(),
	requirementDescription: text("requirement_description").default('),
	documentCategory: varchar("document_category", { length: 100 }).default('),
	collectionStage: integer("collection_stage").default(1).notNull(),
	priorityLevel: varchar("priority_level", { length: 20 }).default('medium'),
	isMandatory: boolean("is_mandatory").default(true),
}, (table) => [
	index("idx_company_requirements_company").using("btree", table.targetCompanyId.asc().nullsLast().op("int4_ops"), table.requirementStatus.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "company_document_requirements_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.submittedByContactId],
			foreignColumns: [targetContacts.id],
			name: "company_document_requirements_submitted_by_contact_id_fkey"
		}),
	foreignKey({
			columns: [table.submittedDocumentId],
			foreignColumns: [externalDocumentSubmissions.id],
			name: "company_document_requirements_submitted_document_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "company_document_requirements_target_company_id_fkey"
		}),
]);

export const externalDocumentSubmissions = pgTable("external_document_submissions", {
	id: serial().primaryKey().notNull(),
	portalTokenId: integer("portal_token_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	targetContactId: integer("target_contact_id").notNull(),
	originalFilename: varchar("original_filename", { length: 255 }).notNull(),
	storedFilename: varchar("stored_filename", { length: 255 }).notNull(),
	filePath: varchar("file_path", { length: 500 }).notNull(),
	fileSize: integer("file_size").notNull(),
	fileType: varchar("file_type", { length: 100 }).notNull(),
	documentCategory: varchar("document_category", { length: 100 }).default('general'),
	submissionNotes: text("submission_notes"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	processingStatus: varchar("processing_status", { length: 50 }).default('pending'),
	reviewedBy: integer("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewNotes: text("review_notes"),
	submissionIp: inet("submission_ip"),
	submissionUserAgent: text("submission_user_agent"),
	documentRequirementId: integer("document_requirement_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	virusScanStatus: varchar("virus_scan_status", { length: 50 }).default('pending'),
	virusScanResult: text("virus_scan_result"),
	encryptionStatus: text("encryption_status"),
}, (table) => [
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "external_document_submissions_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "external_document_submissions_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "external_document_submissions_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.targetContactId],
			foreignColumns: [targetContacts.id],
			name: "external_document_submissions_target_contact_id_fkey"
		}),
]);

export const dashboardAlerts = pgTable("dashboard_alerts", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id"),
	alertType: varchar("alert_type", { length: 50 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	severity: varchar({ length: 20 }).default('info'),
	targetCompanyId: integer("target_company_id"),
	isDismissed: boolean("is_dismissed").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	dismissedAt: timestamp("dismissed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "dashboard_alerts_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "dashboard_alerts_user_company_id_fkey"
		}),
]);

export const dashboardPreferences = pgTable("dashboard_preferences", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	widgetType: varchar("widget_type", { length: 50 }).notNull(),
	widgetPosition: integer("widget_position").notNull(),
	widgetSize: varchar("widget_size", { length: 20 }).default('medium'),
	isVisible: boolean("is_visible").default(true),
	widgetConfig: text("widget_config"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "dashboard_preferences_user_id_fkey"
		}),
]);

export const ddRequirementDocuments = pgTable("dd_requirement_documents", {
	id: serial().primaryKey().notNull(),
	requirementStatusId: integer("requirement_status_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	documentSource: varchar("document_source", { length: 20 }).notNull(),
	documentId: integer("document_id"),
	externalSubmissionId: integer("external_submission_id"),
	addedBy: integer("added_by"),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.addedBy],
			foreignColumns: [users.id],
			name: "dd_requirement_documents_added_by_fk"
		}),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "dd_requirement_documents_document_id_fk"
		}),
	foreignKey({
			columns: [table.externalSubmissionId],
			foreignColumns: [externalDocumentSubmissions.id],
			name: "dd_requirement_documents_external_submission_id_fk"
		}),
	foreignKey({
			columns: [table.requirementStatusId],
			foreignColumns: [ddRequirementStatus.id],
			name: "dd_requirement_documents_requirement_status_id_fk"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "dd_requirement_documents_target_company_id_fk"
		}),
]);

export const ddRequirementStatus = pgTable("dd_requirement_status", {
	id: serial().primaryKey().notNull(),
	requirementId: integer("requirement_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	status: varchar({ length: 30 }).default('not_submitted').notNull(),
	notes: text(),
	documentId: integer("document_id"),
	externalSubmissionId: integer("external_submission_id"),
	reviewedBy: integer("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	updatedBy: integer("updated_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	sellerMarkedComplete: boolean("seller_marked_complete").default(false),
	sellerMarkedCompleteAt: timestamp("seller_marked_complete_at", { mode: 'string' }),
	buyerReviewStatus: varchar("buyer_review_status", { length: 30 }).default('not_reviewed'),
	buyerReviewNotes: text("buyer_review_notes"),
	buyerReviewedAt: timestamp("buyer_reviewed_at", { mode: 'string' }),
	buyerReviewedBy: integer("buyer_reviewed_by"),
}, (table) => [
	foreignKey({
			columns: [table.buyerReviewedBy],
			foreignColumns: [users.id],
			name: "dd_requirement_status_buyer_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "dd_requirement_status_document_id_fkey"
		}),
	foreignKey({
			columns: [table.externalSubmissionId],
			foreignColumns: [externalDocumentSubmissions.id],
			name: "dd_requirement_status_external_submission_id_fkey"
		}),
	foreignKey({
			columns: [table.requirementId],
			foreignColumns: [ddRequirements.id],
			name: "dd_requirement_status_requirement_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "dd_requirement_status_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "dd_requirement_status_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "dd_requirement_status_updated_by_fkey"
		}),
]);

export const ddRequirements = pgTable("dd_requirements", {
	id: serial().primaryKey().notNull(),
	categoryId: integer("category_id").notNull(),
	refNumber: varchar("ref_number", { length: 10 }).notNull(),
	documentName: varchar("document_name", { length: 500 }).notNull(),
	priority: varchar({ length: 20 }).notNull(),
	guidance: text(),
	collectionStage: integer("collection_stage").default(2),
	sortOrder: integer("sort_order").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [ddCategories.id],
			name: "dd_requirements_category_id_fkey"
		}),
	unique("dd_requirements_ref_number_unique").on(table.refNumber),
]);

export const ddCategories = pgTable("dd_categories", {
	id: serial().primaryKey().notNull(),
	refPrefix: varchar("ref_prefix", { length: 10 }).notNull(),
	categoryName: varchar("category_name", { length: 255 }).notNull(),
	description: text(),
	sortOrder: integer("sort_order").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("dd_categories_ref_prefix_unique").on(table.refPrefix),
	unique("dd_categories_category_name_unique").on(table.categoryName),
]);

export const dealDocumentResponses = pgTable("deal_document_responses", {
	id: serial().primaryKey().notNull(),
	dealDocumentId: integer("deal_document_id").notNull(),
	responseType: varchar("response_type", { length: 50 }).notNull(),
	comments: text(),
	respondentName: text("respondent_name").notNull(),
	respondentEmail: text("respondent_email"),
	respondentIp: inet("respondent_ip"),
	respondentUserAgent: text("respondent_user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dealDocumentId],
			foreignColumns: [dealDocuments.id],
			name: "deal_document_responses_deal_document_id_fkey"
		}),
]);

export const dealDocumentTemplates = pgTable("deal_document_templates", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id"),
	templateName: varchar("template_name", { length: 255 }).notNull(),
	documentType: varchar("document_type", { length: 50 }).notNull(),
	templateFileUrl: text("template_file_url").notNull(),
	placeholderMap: json("placeholder_map"),
	sections: json(),
	isSystem: boolean("is_system").default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "deal_document_templates_user_company_id_fkey"
		}),
]);

export const dealMetricsSnapshots = pgTable("deal_metrics_snapshots", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	dealModelId: integer("deal_model_id"),
	triggerEvent: varchar("trigger_event", { length: 50 }).notNull(),
	schemaVersion: integer("schema_version").default(1).notNull(),
	metrics: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "deal_metrics_snapshots_deal_model_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "deal_metrics_snapshots_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "deal_metrics_snapshots_user_company_id_fkey"
		}),
]);

export const dealModelAdjustments = pgTable("deal_model_adjustments", {
	id: serial().primaryKey().notNull(),
	dealModelId: integer("deal_model_id").notNull(),
	sourceExpertResultId: integer("source_expert_result_id"),
	adjustmentType: varchar("adjustment_type", { length: 50 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 500 }).notNull(),
	amount: numeric().notNull(),
	amountsByYear: json("amounts_by_year"),
	sourceExpert: varchar("source_expert", { length: 50 }),
	reasoning: text(),
	confidence: varchar({ length: 20 }),
	defensibilityScore: integer("defensibility_score"),
	caseForInclusion: text("case_for_inclusion"),
	caseForExclusion: text("case_for_exclusion"),
	status: varchar({ length: 50 }).default('suggested'),
	isAccepted: boolean("is_accepted").default(false),
	isManual: boolean("is_manual").default(false),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "deal_model_adjustments_deal_model_id_fkey"
		}),
]);

export const dealNotes = pgTable("deal_notes", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	noteType: varchar("note_type", { length: 50 }).default('General'),
	title: varchar({ length: 255 }).notNull(),
	content: text(),
	reminderDate: timestamp("reminder_date", { mode: 'string' }),
	reminderCompleted: boolean("reminder_completed").default(false),
	createdBy: integer("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "deal_notes_created_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "deal_notes_target_company_id_fkey"
		}),
]);

export const documentAccessLog = pgTable("document_access_log", {
	id: serial().primaryKey().notNull(),
	documentId: integer("document_id").notNull(),
	accessedBy: integer("accessed_by"),
	accessType: varchar("access_type", { length: 50 }).notNull(),
	accessedAt: timestamp("accessed_at", { mode: 'string' }).defaultNow(),
	ipAddress: inet("ip_address"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.accessedBy],
			foreignColumns: [users.id],
			name: "document_access_log_accessed_by_fkey"
		}),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_access_log_document_id_fkey"
		}),
]);

export const documentAnalysisResults = pgTable("document_analysis_results", {
	id: serial().primaryKey().notNull(),
	documentId: integer("document_id").notNull(),
	fileUploadEventId: integer("file_upload_event_id").notNull(),
	documentType: varchar("document_type", { length: 100 }).notNull(),
	analysisData: json("analysis_data").notNull(),
	processingTime: integer("processing_time"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	usageMetadata: text("usage_metadata"),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_analysis_results_document_id_fkey"
		}),
	foreignKey({
			columns: [table.fileUploadEventId],
			foreignColumns: [fileUploadEvents.id],
			name: "document_analysis_results_file_upload_event_id_fkey"
		}),
]);

export const fileUploadEvents = pgTable("file_upload_events", {
	id: serial().primaryKey().notNull(),
	documentId: integer("document_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	uploadedBy: integer("uploaded_by").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileUrl: varchar("file_url", { length: 500 }).notNull(),
	webhookSent: boolean("webhook_sent").default(false),
	webhookResponse: text("webhook_response"),
	webhookStatus: varchar("webhook_status", { length: 50 }).default('pending'),
	webhookSentAt: timestamp("webhook_sent_at", { mode: 'string' }),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "file_upload_events_document_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "file_upload_events_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "file_upload_events_uploaded_by_fkey"
		}),
]);

export const documentStageProgression = pgTable("document_stage_progression", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	currentStage: integer("current_stage").default(1),
	stage1Status: varchar("stage_1_status", { length: 50 }).default('in_progress'),
	stage2Status: varchar("stage_2_status", { length: 50 }).default('not_started'),
	stage1CompletedAt: timestamp("stage_1_completed_at", { mode: 'string' }),
	stage1CompletedBy: integer("stage_1_completed_by"),
	stage1CompletionPercentage: numeric("stage_1_completion_percentage", { precision: 5, scale:  2 }).default('0.00'),
	stage1MandatoryCompleted: boolean("stage_1_mandatory_completed").default(false),
	stage2StartedAt: timestamp("stage_2_started_at", { mode: 'string' }),
	stage2CompletedAt: timestamp("stage_2_completed_at", { mode: 'string' }),
	stage2CompletedBy: integer("stage_2_completed_by"),
	stage2CompletionPercentage: numeric("stage_2_completion_percentage", { precision: 5, scale:  2 }).default('0.00'),
	stage2MandatoryCompleted: boolean("stage_2_mandatory_completed").default(false),
	totalRequirements: integer("total_requirements").default(0),
	completedRequirements: integer("completed_requirements").default(0),
	overallCompletionPercentage: numeric("overall_completion_percentage", { precision: 5, scale:  2 }).default('0.00'),
	canProgressToOffer: boolean("can_progress_to_offer").default(false),
	canProgressToLegal: boolean("can_progress_to_legal").default(false),
	pipelineStageUpdatedAt: timestamp("pipeline_stage_updated_at", { mode: 'string' }),
	blockingIssues: text("blocking_issues"),
	resolutionNotes: text("resolution_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_stage_progression_company").using("btree", table.targetCompanyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stage1CompletedBy],
			foreignColumns: [users.id],
			name: "document_stage_progression_stage_1_completed_by_fkey"
		}),
	foreignKey({
			columns: [table.stage2CompletedBy],
			foreignColumns: [users.id],
			name: "document_stage_progression_stage_2_completed_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "document_stage_progression_target_company_id_fkey"
		}),
	unique("document_stage_progression_target_company_id_unique").on(table.targetCompanyId),
]);

export const ebitdaAdjustments = pgTable("ebitda_adjustments", {
	id: serial().primaryKey().notNull(),
	financialPeriodId: integer("financial_period_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	description: varchar({ length: 500 }).notNull(),
	amount: numeric().notNull(),
	category: varchar({ length: 100 }),
	notes: text(),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "ebitda_adjustments_created_by_fkey"
		}),
	foreignKey({
			columns: [table.financialPeriodId],
			foreignColumns: [financialPeriods.id],
			name: "ebitda_adjustments_financial_period_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "ebitda_adjustments_target_company_id_fkey"
		}),
]);

export const expertAnalysisResults = pgTable("expert_analysis_results", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	stage1EventId: integer("stage1_event_id"),
	expertType: varchar("expert_type", { length: 50 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	analysisData: json("analysis_data"),
	analysisMarkdown: text("analysis_markdown"),
	score: integer(),
	confidence: varchar({ length: 10 }),
	processingTime: integer("processing_time"),
	usageMetadata: json("usage_metadata"),
	triggeredBy: integer("triggered_by"),
	dependsOn: text("depends_on").array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "expert_analysis_results_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.triggeredBy],
			foreignColumns: [users.id],
			name: "expert_analysis_results_triggered_by_fkey"
		}),
]);

export const fixedAssetsRegister = pgTable("fixed_assets_register", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	reportDate: date("report_date").notNull(),
	totalGrossBookValue: numeric("total_gross_book_value"),
	totalAccumulatedDepreciation: numeric("total_accumulated_depreciation"),
	totalNetBookValue: numeric("total_net_book_value"),
	propertyGrossValue: numeric("property_gross_value"),
	propertyNetBookValue: numeric("property_net_book_value"),
	plantMachineryGrossValue: numeric("plant_machinery_gross_value"),
	plantMachineryNetBookValue: numeric("plant_machinery_net_book_value"),
	vehiclesGrossValue: numeric("vehicles_gross_value"),
	vehiclesNetBookValue: numeric("vehicles_net_book_value"),
	itEquipmentGrossValue: numeric("it_equipment_gross_value"),
	itEquipmentNetBookValue: numeric("it_equipment_net_book_value"),
	otherAssetsGrossValue: numeric("other_assets_gross_value"),
	otherAssetsNetBookValue: numeric("other_assets_net_book_value"),
	refinanceableAssetsValue: numeric("refinanceable_assets_value"),
	fullyDepreciatedStillInUse: numeric("fully_depreciated_still_in_use"),
	assetItems: json("asset_items"),
	propertyDetails: json("property_details"),
	vehicleDetails: json("vehicle_details"),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "fixed_assets_register_source_document_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "fixed_assets_register_target_company_id_fkey"
		}),
]);

export const financialPeriods = pgTable("financial_periods", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	periodType: varchar("period_type", { length: 20 }).notNull(),
	periodStart: date("period_start"),
	periodEnd: date("period_end").notNull(),
	fiscalYear: integer("fiscal_year"),
	periodLabel: varchar("period_label", { length: 100 }),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	monthsCovered: integer("months_covered"),
	isFullYear: boolean("is_full_year").default(true).notNull(),
	sourceTier: varchar("source_tier", { length: 30 }),
}, (table) => [
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "financial_periods_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "financial_periods_source_document_id_fkey"
		}).onDelete("set null"),
]);

export const userCompanies = pgTable("user_companies", {
	id: serial().primaryKey().notNull(),
	companyName: varchar("company_name", { length: 255 }).notNull(),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 50 }),
	address: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	industry: varchar({ length: 100 }),
	companySize: varchar("company_size", { length: 50 }),
	betaPlanOverride: varchar("beta_plan_override", { length: 20 }),
	country: varchar({ length: 10 }),
});

export const dealDocuments = pgTable("deal_documents", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	dealModelId: integer("deal_model_id"),
	portalTokenId: integer("portal_token_id"),
	templateId: integer("template_id"),
	documentType: varchar("document_type", { length: 50 }).notNull(),
	status: varchar({ length: 50 }).default('draft').notNull(),
	version: integer().default(1).notNull(),
	parentDocumentId: integer("parent_document_id"),
	documentData: json("document_data"),
	sectionConfig: json("section_config"),
	generatedFileUrl: text("generated_file_url"),
	createdBy: integer("created_by").notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	viewedAt: timestamp("viewed_at", { mode: 'string' }),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	deliveryMethod: varchar("delivery_method", { length: 10 }).default('portal').notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "deal_documents_created_by_fkey"
		}),
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "deal_documents_deal_model_id_fkey"
		}),
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "deal_documents_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "deal_documents_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [dealDocumentTemplates.id],
			name: "deal_documents_template_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "deal_documents_user_company_id_fkey"
		}),
	check("deal_documents_delivery_method_check", sql`(delivery_method)::text = ANY ((ARRAY['portal'::character varying, 'offline'::character varying])::text[])`),
]);

export const dealModelFundingLines = pgTable("deal_model_funding_lines", {
	id: serial().primaryKey().notNull(),
	dealModelId: integer("deal_model_id").notNull(),
	fundingType: varchar("funding_type", { length: 50 }).notNull(),
	label: varchar({ length: 255 }),
	assetBaseValue: numeric("asset_base_value"),
	ltvPercent: numeric("ltv_percent"),
	availableAmount: numeric("available_amount"),
	amountUsed: numeric("amount_used").default('0'),
	interestRate: numeric("interest_rate"),
	arrangementFeePercent: numeric("arrangement_fee_percent"),
	termMonths: integer("term_months"),
	monthlyRepayment: numeric("monthly_repayment"),
	isDebt: boolean("is_debt").default(false),
	isActive: boolean("is_active").default(false),
	notes: text(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	repaymentStructure: varchar("repayment_structure", { length: 50 }).default('amortizing').notNull(),
	interestAsEbitdaAdjustment: boolean("interest_as_ebitda_adjustment").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "deal_model_funding_lines_deal_model_id_fkey"
		}),
]);

export const funnelEvents = pgTable("funnel_events", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	userId: integer("user_id"),
	event: varchar({ length: 100 }).notNull(),
	properties: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_funnel_events_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_funnel_events_event").using("btree", table.event.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "funnel_events_user_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "funnel_events_user_id_fkey"
		}),
]);

export const issueReports = pgTable("issue_reports", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	userCompanyId: integer("user_company_id"),
	pageUrl: varchar("page_url", { length: 500 }),
	userAgent: varchar("user_agent", { length: 500 }),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	severity: varchar({ length: 20 }).default('medium'),
	status: varchar({ length: 20 }).default('open'),
	adminNotes: text("admin_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "issue_reports_user_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "issue_reports_user_id_fkey"
		}),
]);

export const loanFacilities = pgTable("loan_facilities", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	lenderName: varchar("lender_name", { length: 255 }),
	loanType: varchar("loan_type", { length: 100 }),
	originalAmount: numeric("original_amount"),
	outstandingBalance: numeric("outstanding_balance"),
	interestRate: numeric("interest_rate"),
	termMonths: integer("term_months"),
	startDate: date("start_date"),
	maturityDate: date("maturity_date"),
	monthlyRepayment: numeric("monthly_repayment"),
	annualRepayment: numeric("annual_repayment"),
	security: text(),
	personalGuarantees: boolean("personal_guarantees"),
	covenants: text(),
	earlyRepaymentTerms: text("early_repayment_terms"),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "loan_facilities_source_document_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "loan_facilities_target_company_id_fkey"
		}),
]);

export const magicLinks = pgTable("magic_links", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	token: varchar({ length: 64 }).notNull(),
	type: varchar({ length: 20 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	invalidatedAt: timestamp("invalidated_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "magic_links_user_id_fkey"
		}),
	unique("magic_links_token_unique").on(table.token),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	token: varchar({ length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_fk"
		}),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const platformCosts = pgTable("platform_costs", {
	id: serial().primaryKey().notNull(),
	costType: varchar("cost_type", { length: 50 }).notNull(),
	provider: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 255 }).notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	amountUsd: numeric("amount_usd", { precision: 10, scale:  2 }).notNull(),
	notes: text(),
	createdBy: integer("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "platform_costs_created_by_fk"
		}),
]);

export const portalActivityLog = pgTable("portal_activity_log", {
	id: serial().primaryKey().notNull(),
	portalTokenId: integer("portal_token_id").notNull(),
	targetContactId: integer("target_contact_id").notNull(),
	activityType: varchar("activity_type", { length: 100 }).notNull(),
	activityDescription: text("activity_description").notNull(),
	activityTimestamp: timestamp("activity_timestamp", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	relatedDocumentId: integer("related_document_id"),
	sessionDuration: integer("session_duration"),
	relatedMessageId: integer("related_message_id"),
	securityFlags: text("security_flags"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "portal_activity_log_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.targetContactId],
			foreignColumns: [targetContacts.id],
			name: "portal_activity_log_target_contact_id_fkey"
		}),
]);

export const portalAnalytics = pgTable("portal_analytics", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	analyticsDate: date("analytics_date").default(sql`CURRENT_DATE`),
	targetCompanyId: integer("target_company_id"),
	portalTokenId: integer("portal_token_id"),
	uniqueVisitors: integer("unique_visitors").default(0),
	totalPageViews: integer("total_page_views").default(0),
	documentsViewed: integer("documents_viewed").default(0),
	documentsDownloaded: integer("documents_downloaded").default(0),
	averageSessionDuration: numeric("average_session_duration", { precision: 10, scale:  2 }).default('0'),
	emailsSent: integer("emails_sent").default(0),
	emailsOpened: integer("emails_opened").default(0),
	emailsClicked: integer("emails_clicked").default(0),
	portalLinksGenerated: integer("portal_links_generated").default(0),
	portalLinksShared: integer("portal_links_shared").default(0),
	conversionRate: numeric("conversion_rate", { precision: 5, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "portal_analytics_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "portal_analytics_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "portal_analytics_user_company_id_fkey"
		}),
]);

export const portalLinkCampaigns = pgTable("portal_link_campaigns", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	status: varchar({ length: 50 }).default('draft'),
	targetAudience: varchar("target_audience", { length: 255 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	createdBy: integer("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "portal_link_campaigns_created_by_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "portal_link_campaigns_user_company_id_fkey"
		}),
]);

export const portalCommunicationsLog = pgTable("portal_communications_log", {
	id: serial().primaryKey().notNull(),
	campaignId: integer("campaign_id"),
	targetContactId: integer("target_contact_id").notNull(),
	communicationType: varchar("communication_type", { length: 50 }).notNull(),
	subject: varchar({ length: 500 }),
	message: text(),
	emailStatus: varchar("email_status", { length: 50 }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	openedAt: timestamp("opened_at", { mode: 'string' }),
	clickedAt: timestamp("clicked_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [portalLinkCampaigns.id],
			name: "portal_communications_log_campaign_id_fkey"
		}),
	foreignKey({
			columns: [table.targetContactId],
			foreignColumns: [targetContacts.id],
			name: "portal_communications_log_target_contact_id_fkey"
		}),
]);

export const portalDocumentRequirements = pgTable("portal_document_requirements", {
	id: serial().primaryKey().notNull(),
	portalTokenId: integer("portal_token_id").notNull(),
	requirementName: varchar("requirement_name", { length: 200 }).notNull(),
	requirementDescription: text("requirement_description"),
	isMandatory: boolean("is_mandatory").default(false),
	acceptedFileTypes: text("accepted_file_types").array().default(["RAY['pdf'::text", "'doc'::text", "'docx'::tex"]),
	maxFileSize: integer("max_file_size").default(10485760),
	collectionStage: varchar("collection_stage", { length: 100 }).default('due_diligence'),
	submissionStatus: varchar("submission_status", { length: 50 }).default('not_submitted'),
	priorityLevel: integer("priority_level").default(1),
	submissionInstructions: text("submission_instructions"),
	helpText: text("help_text"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	targetCompanyId: integer("target_company_id"),
	documentCategory: varchar("document_category", { length: 100 }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	submittedDocumentId: integer("submitted_document_id"),
	minFileSize: integer("min_file_size"),
	exampleDocuments: text("example_documents").array(),
}, (table) => [
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "portal_document_requirements_portal_token_id_fkey"
		}),
]);

export const portalEmailTemplates = pgTable("portal_email_templates", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	subject: varchar({ length: 500 }).notNull(),
	bodyTemplate: text("body_template").notNull(),
	templateCategory: varchar("template_category", { length: 50 }).default('custom'),
	isActive: boolean("is_active").default(true),
	usageCount: integer("usage_count").default(0),
	lastUsed: timestamp("last_used", { mode: 'string' }),
	createdBy: integer("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "portal_email_templates_created_by_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "portal_email_templates_user_company_id_fkey"
		}),
]);

export const portalLinkShares = pgTable("portal_link_shares", {
	id: serial().primaryKey().notNull(),
	portalTokenId: integer("portal_token_id").notNull(),
	sharedBy: integer("shared_by").notNull(),
	sharedMethod: varchar("shared_method", { length: 50 }),
	sharedTo: varchar("shared_to", { length: 255 }),
	shareMessage: text("share_message"),
	maxUses: integer("max_uses").default(1),
	currentUses: integer("current_uses").default(0),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	lastAccessed: timestamp("last_accessed", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.portalTokenId],
			foreignColumns: [portalAccessTokens.id],
			name: "portal_link_shares_portal_token_id_fkey"
		}),
	foreignKey({
			columns: [table.sharedBy],
			foreignColumns: [users.id],
			name: "portal_link_shares_shared_by_fkey"
		}),
]);

export const staffData = pgTable("staff_data", {
	id: serial().primaryKey().notNull(),
	financialPeriodId: integer("financial_period_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	totalHeadcount: integer("total_headcount"),
	totalStaffCosts: numeric("total_staff_costs"),
	totalGrossSalaries: numeric("total_gross_salaries"),
	totalEmployerNi: numeric("total_employer_ni"),
	totalEmployerPension: numeric("total_employer_pension"),
	directorCount: integer("director_count"),
	directorRemuneration: numeric("director_remuneration"),
	workingDirectorCount: integer("working_director_count"),
	nonWorkingDirectorCount: integer("non_working_director_count"),
	employeeCount: integer("employee_count"),
	employeeCosts: numeric("employee_costs"),
	staffRecords: json("staff_records"),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.financialPeriodId],
			foreignColumns: [financialPeriods.id],
			name: "staff_data_financial_period_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "staff_data_source_document_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "staff_data_target_company_id_fkey"
		}),
]);

export const stage1AnalysisEvents = pgTable("stage1_analysis_events", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	triggeredBy: integer("triggered_by").notNull(),
	concatenatedData: json("concatenated_data").notNull(),
	webhookSent: boolean("webhook_sent").default(false),
	webhookResponse: text("webhook_response"),
	webhookStatus: varchar("webhook_status", { length: 50 }).default('pending'),
	webhookSentAt: timestamp("webhook_sent_at", { mode: 'string' }),
	processingTime: integer("processing_time"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	detailedAnalysisData: json("detailed_analysis_data"),
	usageMetadata: text("usage_metadata"),
	detailedAnalysisMarkdown: text("detailed_analysis_markdown"),
	detailedAnalysisStatus: varchar("detailed_analysis_status", { length: 20 }),
	detailedAnalysisProcessingTime: integer("detailed_analysis_processing_time"),
	detailedAnalysisUsageMetadata: text("detailed_analysis_usage_metadata"),
	detailedAnalysisTriggeredBy: integer("detailed_analysis_triggered_by"),
	detailedAnalysisTriggeredAt: timestamp("detailed_analysis_triggered_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "stage1_analysis_events_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.triggeredBy],
			foreignColumns: [users.id],
			name: "stage1_analysis_events_triggered_by_fkey"
		}),
]);

export const stageHistory = pgTable("stage_history", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	fromStage: varchar("from_stage", { length: 50 }),
	toStage: varchar("to_stage", { length: 50 }).notNull(),
	changedBy: integer("changed_by").notNull(),
	changedAt: timestamp("changed_at", { mode: 'string' }).defaultNow(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [users.id],
			name: "stage_history_changed_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "stage_history_target_company_id_fkey"
		}),
]);

export const subscriptionEvents = pgTable("subscription_events", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	stripeEventId: varchar("stripe_event_id", { length: 255 }),
	eventType: varchar("event_type", { length: 100 }).notNull(),
	previousStatus: subscriptionStatus("previous_status"),
	previousPlanKey: planKey("previous_plan_key"),
	newStatus: subscriptionStatus("new_status"),
	newPlanKey: planKey("new_plan_key"),
	payload: jsonb().default({}).notNull(),
	adminUserId: integer("admin_user_id"),
	processedAt: timestamp("processed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "subscription_events_user_company_id_fkey"
		}),
	unique("subscription_events_stripe_event_id_unique").on(table.stripeEventId),
]);

export const systemConfig = pgTable("system_config", {
	id: serial().primaryKey().notNull(),
	key: varchar({ length: 100 }).notNull(),
	value: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedByUserId: integer("updated_by_user_id"),
}, (table) => [
	foreignKey({
			columns: [table.updatedByUserId],
			foreignColumns: [users.id],
			name: "system_config_updated_by_user_id_fkey"
		}),
	unique("system_config_key_unique").on(table.key),
]);

export const teamNotifications = pgTable("team_notifications", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	targetUserId: integer("target_user_id").notNull(),
	fromUserId: integer("from_user_id").notNull(),
	notificationType: varchar("notification_type", { length: 50 }).notNull(),
	notificationTitle: varchar("notification_title", { length: 255 }).notNull(),
	notificationMessage: text("notification_message"),
	targetCompanyId: integer("target_company_id"),
	relatedObjectType: varchar("related_object_type", { length: 50 }),
	relatedObjectId: integer("related_object_id"),
	isRead: boolean("is_read").default(false),
	readAt: timestamp("read_at", { mode: 'string' }),
	isEmailSent: boolean("is_email_sent").default(false),
	emailSentAt: timestamp("email_sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_team_notifications_user").using("btree", table.targetUserId.asc().nullsLast().op("int4_ops"), table.isRead.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.fromUserId],
			foreignColumns: [users.id],
			name: "team_notifications_from_user_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "team_notifications_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [users.id],
			name: "team_notifications_target_user_id_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "team_notifications_user_company_id_fkey"
		}),
]);

export const tokenUsage = pgTable("token_usage", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	userCompanyId: integer("user_company_id"),
	dealId: integer("deal_id"),
	documentId: integer("document_id"),
	service: varchar({ length: 100 }).notNull(),
	model: varchar({ length: 100 }).notNull(),
	promptTokens: integer("prompt_tokens").default(0).notNull(),
	candidateTokens: integer("candidate_tokens").default(0).notNull(),
	totalTokens: integer("total_tokens").default(0).notNull(),
	estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale:  6 }).default('0').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	inputCostUsd: numeric("input_cost_usd", { precision: 10, scale:  6 }).default('0').notNull(),
	outputCostUsd: numeric("output_cost_usd", { precision: 10, scale:  6 }).default('0').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "token_usage_user_company_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "token_usage_user_id_fk"
		}),
]);

export const userCompanyMemberships = pgTable("user_company_memberships", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	isCompanyAdmin: boolean("is_company_admin").default(false),
	membershipRole: varchar("membership_role", { length: 50 }).default('analyst'),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "user_company_memberships_user_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_company_memberships_user_id_fkey"
		}),
	unique("unique_user_company").on(table.userId, table.userCompanyId),
]);

export const userDealAssignments = pgTable("user_deal_assignments", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	assignedBy: integer("assigned_by").notNull(),
	assignmentRole: varchar("assignment_role", { length: 50 }).default('analyst'),
	assignmentDate: timestamp("assignment_date", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
	canEditCompany: boolean("can_edit_company").default(true),
	canUploadDocuments: boolean("can_upload_documents").default(true),
	canCreateActivities: boolean("can_create_activities").default(true),
	canManageContacts: boolean("can_manage_contacts").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_deal_assignments_company").using("btree", table.targetCompanyId.asc().nullsLast().op("int4_ops")),
	index("idx_user_deal_assignments_user").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [users.id],
			name: "user_deal_assignments_assigned_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "user_deal_assignments_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_deal_assignments_user_id_fkey"
		}),
	unique("user_deal_assignments_user_id_target_company_id_unique").on(table.userId, table.targetCompanyId),
]);

export const userSessions = pgTable("user_sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	sessionToken: varchar("session_token", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sessions_user_id_users_id_fk"
		}),
	unique("user_sessions_session_token_unique").on(table.sessionToken),
]);

export const valuations = pgTable("valuations", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	calculationMethod: varchar("calculation_method", { length: 50 }).default('average_3yr'),
	valuationMultiple: numeric("valuation_multiple").default('4.0'),
	adjustedEbitda: numeric("adjusted_ebitda"),
	enterpriseValue: numeric("enterprise_value"),
	netDebt: numeric("net_debt"),
	equityValue: numeric("equity_value"),
	fundingStructure: json("funding_structure"),
	dealNotes: text("deal_notes"),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "valuations_created_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "valuations_target_company_id_fkey"
		}),
]);

export const valueCreationScenarios = pgTable("value_creation_scenarios", {
	id: serial().primaryKey().notNull(),
	dealModelId: integer("deal_model_id").notNull(),
	scenarioType: varchar("scenario_type", { length: 20 }).default('base').notNull(),
	name: varchar({ length: 100 }).default('Base Case').notNull(),
	revenueGrowthMultiplier: numeric("revenue_growth_multiplier").default('1.0'),
	costPressureAdjustment: numeric("cost_pressure_adjustment").default('0'),
	scenarioMode: varchar("scenario_mode", { length: 10 }).default('linked'),
	rangePercent: numeric("range_percent").default('10'),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "vc_scenarios_deal_model_id_fk"
		}).onDelete("cascade"),
]);

export const valueCreationAssumptions = pgTable("value_creation_assumptions", {
	id: serial().primaryKey().notNull(),
	scenarioId: integer("scenario_id").notNull(),
	year: integer().notNull(),
	revenueGrowthPercent: numeric("revenue_growth_percent").default('5.0'),
	costOfSalesGrowthPercent: numeric("cost_of_sales_growth_percent").default('3.0'),
	adminCostGrowthPercent: numeric("admin_cost_growth_percent").default('2.0'),
	staffCostGrowthPercent: numeric("staff_cost_growth_percent").default('3.0'),
	depreciationGrowthPercent: numeric("depreciation_growth_percent").default('0'),
	capexPerYear: numeric("capex_per_year").default('0'),
	workingCapitalPercent: numeric("working_capital_percent").default('0'),
	taxRatePercent: numeric("tax_rate_percent").default('25.0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [valueCreationScenarios.id],
			name: "vc_assumptions_scenario_id_fk"
		}).onDelete("cascade"),
]);

export const valueCreationExitAssumptions = pgTable("value_creation_exit_assumptions", {
	id: serial().primaryKey().notNull(),
	dealModelId: integer("deal_model_id").notNull(),
	exitMultiple: numeric("exit_multiple").default('4.0'),
	holdPeriodYears: integer("hold_period_years").default(5),
	exitCostPercent: numeric("exit_cost_percent").default('3.0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.dealModelId],
			foreignColumns: [dealModels.id],
			name: "vc_exit_deal_model_id_fk"
		}).onDelete("cascade"),
]);

export const valueCreationSynergies = pgTable("value_creation_synergies", {
	id: serial().primaryKey().notNull(),
	scenarioId: integer("scenario_id").notNull(),
	synergyType: varchar("synergy_type", { length: 20 }).notNull(),
	name: varchar({ length: 200 }).notNull(),
	targetValue: numeric("target_value").default('0'),
	realisationY1: numeric("realisation_y1").default('20'),
	realisationY2: numeric("realisation_y2").default('50'),
	realisationY3: numeric("realisation_y3").default('80'),
	realisationY4: numeric("realisation_y4").default('100'),
	realisationY5: numeric("realisation_y5").default('100'),
	implementationCost: numeric("implementation_cost").default('0'),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [valueCreationScenarios.id],
			name: "vc_synergies_scenario_id_fk"
		}).onDelete("cascade"),
]);

export const promoCodeCampaigns = pgTable("promo_code_campaigns", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	stripeCouponId: varchar("stripe_coupon_id", { length: 50 }).notNull(),
	referralSource: varchar("referral_source", { length: 50 }).notNull(),
	freeMonthsTotal: integer("free_months_total").default(0).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdByUserId: integer("created_by_user_id"),
	postFreePeriodCouponId: varchar("post_free_period_coupon_id", { length: 50 }).default(sql`NULL`),
	slug: varchar({ length: 50 }).notNull(),
	maxTotalClaims: integer("max_total_claims"),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "promo_code_campaigns_created_by_user_id_fkey"
		}),
	unique("promo_code_campaigns_slug_unique").on(table.slug),
]);

export const userInvitations = pgTable("user_invitations", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	invitedBy: integer("invited_by").notNull(),
	invitationToken: varchar("invitation_token", { length: 255 }).notNull(),
	invitedRole: varchar("invited_role", { length: 50 }).notNull(),
	invitationMessage: text("invitation_message"),
	invitationStatus: varchar("invitation_status", { length: 50 }).default('pending'),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).default(sql`(now() + '7 days'::interval)`),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	ipAddressSent: inet("ip_address_sent"),
	ipAddressAccepted: inet("ip_address_accepted"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	jobTitle: varchar("job_title", { length: 100 }),
}, (table) => [
	index("idx_user_invitations_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_user_invitations_token").using("btree", table.invitationToken.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "user_invitations_invited_by_fkey"
		}),
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "user_invitations_user_company_id_fkey"
		}),
	unique("user_invitations_invitation_token_unique").on(table.invitationToken),
]);

export const subscriptions = pgTable("subscriptions", {
	id: serial().primaryKey().notNull(),
	userCompanyId: integer("user_company_id").notNull(),
	stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
	stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
	planKey: planKey("plan_key").default('CORE').notNull(),
	status: subscriptionStatus().default('trialing').notNull(),
	billingInterval: billingInterval("billing_interval").default('month'),
	currentPeriodStart: timestamp("current_period_start", { mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { mode: 'string' }),
	trialStart: timestamp("trial_start", { mode: 'string' }),
	trialEnd: timestamp("trial_end", { mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	addOnCompanySlots: integer("add_on_company_slots").default(0).notNull(),
	additionalSeats: integer("additional_seats").default(0).notNull(),
	isCommunityMember: boolean("is_community_member").default(false).notNull(),
	communityFreeMonthsRemaining: integer("community_free_months_remaining").default(0).notNull(),
	enterpriseOverrides: jsonb("enterprise_overrides"),
	adminNotes: text("admin_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	referralSource: varchar("referral_source", { length: 50 }),
	promoCodeId: integer("promo_code_id"),
	freeMonthsTotal: integer("free_months_total").default(0).notNull(),
	freeMonthsStartedAt: timestamp("free_months_started_at", { mode: 'string' }),
	communityDiscountCouponId: varchar("community_discount_coupon_id", { length: 50 }),
	freeMonthsWarningEmailSentAt: timestamp("free_months_warning_email_sent_at", { mode: 'string' }),
	trialEndsAt: timestamp("trial_ends_at", { mode: 'string' }),
	currency: varchar({ length: 3 }).default('gbp'),
	pastDueSince: timestamp("past_due_since", { mode: 'string' }),
	dunningDay7EmailSentAt: timestamp("dunning_day7_email_sent_at", { mode: 'string' }),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
	trialExtensionSentAt: timestamp("trial_extension_sent_at", { mode: 'string' }),
	trialWarningEmailSentAt: timestamp("trial_warning_email_sent_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userCompanyId],
			foreignColumns: [userCompanies.id],
			name: "subscriptions_user_company_id_fkey"
		}),
	unique("subscriptions_user_company_id_unique").on(table.userCompanyId),
	unique("subscriptions_stripe_subscription_id_unique").on(table.stripeSubscriptionId),
]);

export const dealModels = pgTable("deal_models", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	createdBy: integer("created_by").notNull(),
	name: varchar({ length: 255 }).notNull(),
	status: varchar({ length: 50 }).default('draft'),
	version: integer().default(1),
	parentModelId: integer("parent_model_id"),
	isLocked: boolean("is_locked").default(false),
	averagingYears: integer("averaging_years").default(3),
	ebitdaMultiple: numeric("ebitda_multiple").default('3.0'),
	multipleLow: numeric("multiple_low"),
	multipleHigh: numeric("multiple_high"),
	propertyValue: numeric("property_value").default('0'),
	cashValue: numeric("cash_value").default('0'),
	otherAssets: numeric("other_assets").default('0'),
	calculatedEbitda: numeric("calculated_ebitda"),
	adjustedEbitda: numeric("adjusted_ebitda"),
	enterpriseValue: numeric("enterprise_value"),
	plusExcessCash: numeric("plus_excess_cash"),
	minusPrimaryDebt: numeric("minus_primary_debt"),
	minusOtherDebt: numeric("minus_other_debt"),
	minusCorpTaxDue: numeric("minus_corp_tax_due"),
	minusWorkingCapitalAdj: numeric("minus_working_capital_adj"),
	workingCapitalMonths: integer("working_capital_months").default(3),
	workingCapitalMonthlyAmount: numeric("working_capital_monthly_amount"),
	totalPurchasePrice: numeric("total_purchase_price"),
	totalFundingAvailable: numeric("total_funding_available"),
	equityRequired: numeric("equity_required"),
	upfrontCash: numeric("upfront_cash"),
	deferredAmount: numeric("deferred_amount"),
	deferredTerms: varchar("deferred_terms", { length: 500 }),
	earnoutMaximum: numeric("earnout_maximum"),
	earnoutMetric: varchar("earnout_metric", { length: 255 }),
	earnoutPeriodMonths: integer("earnout_period_months"),
	retentionEscrow: numeric("retention_escrow"),
	expertDataSnapshot: json("expert_data_snapshot"),
	financialDataSnapshot: json("financial_data_snapshot"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	transactionType: varchar("transaction_type", { length: 20 }).default('share_sale'),
	feeLegalDdAmount: numeric("fee_legal_dd_amount"),
	feeAccountingDdAmount: numeric("fee_accounting_dd_amount"),
	feeLoanArrangementAmount: numeric("fee_loan_arrangement_amount"),
	feeDealMakerAmount: numeric("fee_deal_maker_amount"),
	customFees: jsonb("custom_fees").default([]).notNull(),
	offerDriver: varchar("offer_driver", { length: 20 }).default('ebitda'),
	targetOfferPrice: numeric("target_offer_price"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "deal_models_created_by_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "deal_models_target_company_id_fkey"
		}),
]);

export const financialContributions = pgTable("financial_contributions", {
	id: serial().primaryKey().notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	fiscalYear: integer("fiscal_year"),
	statementType: varchar("statement_type", { length: 10 }).notNull(),
	sourceDocumentId: integer("source_document_id"),
	sourceTier: varchar("source_tier", { length: 30 }).notNull(),
	isFullYear: boolean("is_full_year").default(true).notNull(),
	monthsCovered: integer("months_covered"),
	periodEnd: date("period_end"),
	asAtDate: date("as_at_date"),
	figures: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	isPrimaryYear: boolean("is_primary_year").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "financial_contributions_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "financial_contributions_source_document_id_fkey"
		}),
]);

export const incomeStatements = pgTable("income_statements", {
	id: serial().primaryKey().notNull(),
	financialPeriodId: integer("financial_period_id").notNull(),
	targetCompanyId: integer("target_company_id").notNull(),
	revenue: numeric(),
	costOfSales: numeric("cost_of_sales"),
	grossProfit: numeric("gross_profit"),
	administrativeExpenses: numeric("administrative_expenses"),
	depreciationAmortisation: numeric("depreciation_amortisation"),
	otherOperatingIncome: numeric("other_operating_income"),
	operatingProfit: numeric("operating_profit"),
	interestReceivable: numeric("interest_receivable"),
	interestPayable: numeric("interest_payable"),
	profitBeforeTax: numeric("profit_before_tax"),
	corporationTax: numeric("corporation_tax"),
	netProfit: numeric("net_profit"),
	staffCosts: numeric("staff_costs"),
	directorsRemuneration: numeric("directors_remuneration"),
	dividendsPaid: numeric("dividends_paid"),
	revenueBreakdown: json("revenue_breakdown"),
	costOfSalesBreakdown: json("cost_of_sales_breakdown"),
	overheadsBreakdown: json("overheads_breakdown"),
	exceptionalItems: json("exceptional_items"),
	sourceDocumentId: integer("source_document_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	isFullYear: boolean("is_full_year").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.financialPeriodId],
			foreignColumns: [financialPeriods.id],
			name: "income_statements_financial_period_id_fkey"
		}),
	foreignKey({
			columns: [table.targetCompanyId],
			foreignColumns: [targetCompanies.id],
			name: "income_statements_target_company_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "income_statements_source_document_id_fkey"
		}).onDelete("set null"),
]);
export const activitySummary = pgView("activity_summary", {	userId: integer("user_id"),
	userCompanyId: integer("user_company_id"),
	activityType: varchar("activity_type", { length: 50 }),
	activityMonth: timestamp("activity_month", { mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activityCount: bigint("activity_count", { mode: "number" }),
	avgDuration: numeric("avg_duration"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	companiesContacted: bigint("companies_contacted", { mode: "number" }),
}).as(sql`SELECT a.user_id, tc.user_company_id, a.activity_type, date_trunc('month'::text, a.activity_date) AS activity_month, count(*) AS activity_count, COALESCE(avg(a.duration_minutes), 0::numeric) AS avg_duration, count(DISTINCT a.target_company_id) AS companies_contacted FROM activities a JOIN target_companies tc ON a.target_company_id = tc.id WHERE a.activity_date IS NOT NULL GROUP BY a.user_id, tc.user_company_id, a.activity_type, (date_trunc('month'::text, a.activity_date))`);

export const dealProgression = pgView("deal_progression", {	targetCompanyId: integer("target_company_id"),
	userCompanyId: integer("user_company_id"),
	fromStage: varchar("from_stage", { length: 50 }),
	toStage: varchar("to_stage", { length: 50 }),
	changedAt: timestamp("changed_at", { mode: 'string' }),
	previousChange: timestamp("previous_change", { mode: 'string' }),
	daysInPreviousStage: numeric("days_in_previous_stage"),
}).as(sql`SELECT sh.target_company_id, tc.user_company_id, sh.from_stage, sh.to_stage, sh.changed_at, lag(sh.changed_at) OVER (PARTITION BY sh.target_company_id ORDER BY sh.changed_at) AS previous_change, COALESCE(EXTRACT(days FROM sh.changed_at - lag(sh.changed_at) OVER (PARTITION BY sh.target_company_id ORDER BY sh.changed_at)), 0::numeric) AS days_in_previous_stage FROM stage_history sh JOIN target_companies tc ON sh.target_company_id = tc.id WHERE sh.changed_at IS NOT NULL`);

export const pipelineSummary = pgView("pipeline_summary", {	userCompanyId: integer("user_company_id"),
	stage: varchar({ length: 50 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dealCount: bigint("deal_count", { mode: "number" }),
	avgDaysInStage: numeric("avg_days_in_stage"),
	earliestStageEntry: timestamp("earliest_stage_entry", { mode: 'string' }),
	latestStageEntry: timestamp("latest_stage_entry", { mode: 'string' }),
	avgRevenue: numeric("avg_revenue"),
	totalRevenue: numeric("total_revenue"),
}).as(sql`SELECT user_company_id, stage, count(*) AS deal_count, COALESCE(avg(EXTRACT(days FROM now() - stage_updated_at::timestamp with time zone)), 0::numeric) AS avg_days_in_stage, min(stage_updated_at) AS earliest_stage_entry, max(stage_updated_at) AS latest_stage_entry, round(avg(annual_revenue), 2) AS avg_revenue, sum(annual_revenue) AS total_revenue FROM target_companies tc WHERE stage IS NOT NULL GROUP BY user_company_id, stage`);

export const stage1Progress = pgView("stage_1_progress", {	targetCompanyId: integer("target_company_id"),
	companyName: varchar("company_name", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRequirements: bigint("total_requirements", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completedRequirements: bigint("completed_requirements", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submittedCount: bigint("submitted_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	approvedCount: bigint("approved_count", { mode: "number" }),
	completionPercentage: numeric("completion_percentage"),
	overallStatus: text("overall_status"),
	lastActivity: timestamp("last_activity", { mode: 'string' }),
}).as(sql`SELECT tc.id AS target_company_id, tc.company_name, count(cdr.id) AS total_requirements, count( CASE WHEN cdr.requirement_status::text = ANY (ARRAY['submitted'::character varying::text, 'approved'::character varying::text]) THEN 1 ELSE NULL::integer END) AS completed_requirements, count( CASE WHEN cdr.requirement_status::text = 'submitted'::text THEN 1 ELSE NULL::integer END) AS submitted_count, count( CASE WHEN cdr.requirement_status::text = 'approved'::text THEN 1 ELSE NULL::integer END) AS approved_count, round(count( CASE WHEN cdr.requirement_status::text = ANY (ARRAY['submitted'::character varying::text, 'approved'::character varying::text]) THEN 1 ELSE NULL::integer END)::numeric / count(cdr.id)::numeric * 100::numeric, 1) AS completion_percentage, CASE WHEN count( CASE WHEN cdr.requirement_status::text = ANY (ARRAY['submitted'::character varying::text, 'approved'::character varying::text]) THEN 1 ELSE NULL::integer END) = count(cdr.id) THEN 'complete'::text WHEN count( CASE WHEN cdr.requirement_status::text = ANY (ARRAY['submitted'::character varying::text, 'approved'::character varying::text]) THEN 1 ELSE NULL::integer END) > 0 THEN 'in_progress'::text ELSE 'not_started'::text END AS overall_status, max(cdr.updated_at) AS last_activity FROM target_companies tc LEFT JOIN company_document_requirements cdr ON tc.id = cdr.target_company_id AND cdr.collection_stage = 1 GROUP BY tc.id, tc.company_name`);