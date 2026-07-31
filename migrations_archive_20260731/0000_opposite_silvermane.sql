CREATE TABLE "user_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_company_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_company_id" integer NOT NULL,
	"is_company_admin" boolean DEFAULT false,
	"membership_role" varchar(50) DEFAULT 'analyst',
	"joined_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "unique_user_company" UNIQUE("user_id","user_company_id")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"invited_by" integer NOT NULL,
	"invitation_token" varchar(255) NOT NULL,
	"invited_role" varchar(50) NOT NULL,
	"invitation_message" text,
	"invitation_status" varchar(50) DEFAULT 'pending',
	"sent_at" timestamp DEFAULT now(),
	"expires_at" timestamp DEFAULT (NOW() + INTERVAL '7 days'),
	"accepted_at" timestamp,
	"ip_address_sent" "inet",
	"ip_address_accepted" "inet",
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_invitations_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(50) NOT NULL,
	"role_description" text,
	"can_manage_users" boolean DEFAULT false,
	"can_manage_company" boolean DEFAULT false,
	"can_create_deals" boolean DEFAULT false,
	"can_edit_all_deals" boolean DEFAULT false,
	"can_delete_deals" boolean DEFAULT false,
	"can_upload_documents" boolean DEFAULT false,
	"can_create_offers" boolean DEFAULT false,
	"can_view_financials" boolean DEFAULT false,
	"can_access_analytics" boolean DEFAULT false,
	"can_export_data" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_roles_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"user_company_id" integer,
	"current_company_id" integer,
	"role" varchar(50) DEFAULT 'user',
	"user_role" varchar(50) DEFAULT 'analyst',
	"is_company_admin" boolean DEFAULT false,
	"last_login" timestamp,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"activity_date" timestamp NOT NULL,
	"activity_time" varchar(8),
	"duration_minutes" integer,
	"contact_id" integer,
	"is_completed" boolean DEFAULT true,
	"follow_up_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_name" varchar(50) NOT NULL,
	"description" text,
	"requires_contact" boolean DEFAULT false,
	"default_duration" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "activity_types_type_name_unique" UNIQUE("type_name")
);
--> statement-breakpoint
CREATE TABLE "deal_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"note_type" varchar(50) DEFAULT 'General',
	"title" varchar(255) NOT NULL,
	"content" text,
	"reminder_date" timestamp,
	"reminder_completed" boolean DEFAULT false,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_name" varchar(50) NOT NULL,
	"stage_order" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "pipeline_stages_stage_name_unique" UNIQUE("stage_name")
);
--> statement-breakpoint
CREATE TABLE "stage_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"from_stage" varchar(50),
	"to_stage" varchar(50) NOT NULL,
	"changed_by" integer NOT NULL,
	"changed_at" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "target_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"industry" varchar(100),
	"sub_sector" varchar(100),
	"website" varchar(255),
	"phone" varchar(50),
	"email" varchar(255),
	"address" text,
	"annual_revenue" numeric,
	"employee_count" integer,
	"year_established" integer,
	"description" text,
	"website_analysis" text,
	"website_analysis_processed_at" timestamp,
	"stage" varchar(50) DEFAULT 'New Target',
	"stage_updated_at" timestamp DEFAULT now(),
	"stage_updated_by" integer,
	"initial_discussion_completed" boolean DEFAULT false,
	"initial_discussion_date" timestamp,
	"initial_discussion_notes" text,
	"initial_discussion_by" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "target_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"title" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"is_primary" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"target_user_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"notification_title" varchar(255) NOT NULL,
	"notification_message" text,
	"target_company_id" integer,
	"related_object_type" varchar(50),
	"related_object_id" integer,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"is_email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_deal_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"assigned_by" integer NOT NULL,
	"assignment_role" varchar(50) DEFAULT 'analyst',
	"assignment_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"can_edit_company" boolean DEFAULT true,
	"can_upload_documents" boolean DEFAULT true,
	"can_create_activities" boolean DEFAULT true,
	"can_manage_contacts" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_deal_assignments_user_id_target_company_id_unique" UNIQUE("user_id","target_company_id")
);
--> statement-breakpoint
CREATE TABLE "document_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"accessed_by" integer NOT NULL,
	"access_type" varchar(50) NOT NULL,
	"accessed_at" timestamp DEFAULT now(),
	"ip_address" "inet",
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"file_upload_event_id" integer NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"analysis_data" json NOT NULL,
	"processing_time" integer,
	"usage_metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_name" varchar(100) NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "document_categories_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" varchar(200) NOT NULL,
	"document_category" varchar(100) NOT NULL,
	"description" text,
	"is_confidential" boolean DEFAULT true,
	"upload_date" timestamp DEFAULT now(),
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"external_submission_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expert_analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"stage1_event_id" integer,
	"expert_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"analysis_data" json,
	"analysis_markdown" text,
	"score" integer,
	"confidence" varchar(10),
	"processing_time" integer,
	"usage_metadata" json,
	"triggered_by" integer,
	"depends_on" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_upload_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"webhook_sent" boolean DEFAULT false,
	"webhook_response" text,
	"webhook_status" varchar(50) DEFAULT 'pending',
	"webhook_sent_at" timestamp,
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stage1_analysis_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"triggered_by" integer NOT NULL,
	"concatenated_data" json NOT NULL,
	"webhook_sent" boolean DEFAULT false,
	"webhook_response" text,
	"webhook_status" varchar(50) DEFAULT 'pending',
	"webhook_sent_at" timestamp,
	"processing_time" integer,
	"detailed_analysis_data" json,
	"usage_metadata" json,
	"detailed_analysis_markdown" text,
	"detailed_analysis_status" varchar(50) DEFAULT 'pending',
	"detailed_analysis_processing_time" integer,
	"detailed_analysis_usage_metadata" json,
	"detailed_analysis_triggered_by" integer,
	"detailed_analysis_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chase_up_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"portal_token_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"email_sequence_number" integer NOT NULL,
	"email_type" varchar(50) NOT NULL,
	"sent_to_contacts" text[],
	"cc_internal_users" text[],
	"email_subject" varchar(255),
	"scheduled_send_time" timestamp,
	"sent_at" timestamp,
	"delivery_status" varchar(50) DEFAULT 'pending',
	"internal_alert_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chase_up_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"portal_token_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"timeframe_days" integer NOT NULL,
	"submission_deadline" date NOT NULL,
	"email_1_delay_days" integer DEFAULT 0,
	"email_2_delay_days" integer DEFAULT 2,
	"email_3_delay_days" integer DEFAULT 5,
	"email_4_delay_days" integer DEFAULT 8,
	"manual_deadline_delay_days" integer DEFAULT 11,
	"is_active" boolean DEFAULT true,
	"is_completed" boolean DEFAULT false,
	"completion_reason" varchar(100),
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_document_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"requirement_name" varchar(255) NOT NULL,
	"requirement_description" text,
	"document_category" varchar(100),
	"collection_stage" integer DEFAULT 1 NOT NULL,
	"priority_level" varchar(20) DEFAULT 'medium',
	"is_mandatory" boolean DEFAULT true,
	"requirement_status" varchar(50) DEFAULT 'outstanding',
	"submission_status" varchar(50) DEFAULT 'not_started',
	"submitted_document_id" integer,
	"submitted_at" timestamp,
	"submitted_by_contact_id" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_status" varchar(50),
	"review_notes" text,
	"review_score" integer,
	"due_date" timestamp,
	"reminder_sent_count" integer DEFAULT 0,
	"last_reminder_sent" timestamp,
	"next_reminder_due" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_stage_progression" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"current_stage" integer DEFAULT 1,
	"stage_1_status" varchar(50) DEFAULT 'in_progress',
	"stage_2_status" varchar(50) DEFAULT 'not_started',
	"stage_1_completed_at" timestamp,
	"stage_1_completed_by" integer,
	"stage_1_completion_percentage" numeric(5, 2) DEFAULT '0.00',
	"stage_1_mandatory_completed" boolean DEFAULT false,
	"stage_2_started_at" timestamp,
	"stage_2_completed_at" timestamp,
	"stage_2_completed_by" integer,
	"stage_2_completion_percentage" numeric(5, 2) DEFAULT '0.00',
	"stage_2_mandatory_completed" boolean DEFAULT false,
	"total_requirements" integer DEFAULT 0,
	"completed_requirements" integer DEFAULT 0,
	"overall_completion_percentage" numeric(5, 2) DEFAULT '0.00',
	"can_progress_to_offer" boolean DEFAULT false,
	"can_progress_to_legal" boolean DEFAULT false,
	"pipeline_stage_updated_at" timestamp,
	"blocking_issues" text,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "document_stage_progression_target_company_id_unique" UNIQUE("target_company_id")
);
--> statement-breakpoint
CREATE TABLE "external_document_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"portal_token_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"target_contact_id" integer NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"stored_filename" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" varchar(100),
	"document_category" varchar(100),
	"submission_notes" text,
	"submitted_at" timestamp DEFAULT now(),
	"submission_ip" "inet",
	"submission_user_agent" text,
	"processing_status" varchar(50) DEFAULT 'pending',
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"document_requirement_id" integer,
	"virus_scan_status" varchar(50) DEFAULT 'pending',
	"virus_scan_result" text,
	"encryption_status" varchar(50) DEFAULT 'encrypted',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"target_contact_id" integer NOT NULL,
	"user_company_id" integer NOT NULL,
	"access_token" varchar(255) NOT NULL,
	"token_purpose" varchar(50) DEFAULT 'document_submission',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp DEFAULT (NOW() + INTERVAL '30 days'),
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"created_by" integer NOT NULL,
	"ip_addresses_used" text[],
	"user_agent_strings" text[],
	"allowed_actions" text DEFAULT '{"upload": true, "download": true, "message": true}',
	"custom_message" text,
	"portal_branding" text,
	"agreed_submission_timeframe" integer DEFAULT 14,
	"submission_deadline" date,
	"chase_up_status" varchar(50) DEFAULT 'not_started',
	"last_chase_email_sent" timestamp,
	"chase_email_count" integer DEFAULT 0,
	"manual_deadline_set" timestamp,
	"final_deadline_date" date,
	"escalation_level" varchar(50) DEFAULT 'none',
	CONSTRAINT "portal_access_tokens_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "portal_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"portal_token_id" integer NOT NULL,
	"target_contact_id" integer NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"activity_description" text,
	"activity_timestamp" timestamp DEFAULT now(),
	"ip_address" "inet",
	"user_agent" text,
	"session_duration" integer,
	"related_document_id" integer,
	"related_message_id" integer,
	"security_flags" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"analytics_date" date DEFAULT CURRENT_DATE,
	"target_company_id" integer,
	"portal_token_id" integer,
	"unique_visitors" integer DEFAULT 0,
	"total_page_views" integer DEFAULT 0,
	"documents_viewed" integer DEFAULT 0,
	"documents_downloaded" integer DEFAULT 0,
	"average_session_duration" numeric(10, 2) DEFAULT '0',
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"portal_links_generated" integer DEFAULT 0,
	"portal_links_shared" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_communications_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"target_contact_id" integer NOT NULL,
	"communication_type" varchar(50) NOT NULL,
	"subject" varchar(500),
	"message" text,
	"email_status" varchar(50),
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_document_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"portal_token_id" integer NOT NULL,
	"requirement_name" varchar(255) NOT NULL,
	"requirement_description" text,
	"document_category" varchar(100),
	"is_mandatory" boolean DEFAULT true,
	"collection_stage" integer DEFAULT 1,
	"priority_level" varchar(20) DEFAULT 'medium',
	"due_date" timestamp,
	"submission_status" varchar(50) DEFAULT 'outstanding',
	"submitted_document_id" integer,
	"accepted_file_types" text[],
	"max_file_size" integer DEFAULT 10485760,
	"min_file_size" integer DEFAULT 1024,
	"submission_instructions" text,
	"example_documents" text[],
	"help_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"subject" varchar(500) NOT NULL,
	"body_template" text NOT NULL,
	"template_category" varchar(50) DEFAULT 'custom',
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_link_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'draft',
	"target_audience" varchar(255),
	"start_date" date,
	"end_date" date,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_link_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"portal_token_id" integer NOT NULL,
	"shared_by" integer NOT NULL,
	"shared_method" varchar(50),
	"shared_to" varchar(255),
	"share_message" text,
	"max_uses" integer DEFAULT 1,
	"current_uses" integer DEFAULT 0,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"last_accessed" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aged_debtors" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"total_trade_debtors" numeric,
	"current_0_to_30" numeric,
	"days_31_to_60" numeric,
	"days_61_to_90" numeric,
	"days_90_plus" numeric,
	"bad_debt_provision" numeric,
	"doubtful_debts" numeric,
	"recent_revenue" numeric,
	"debtor_days" numeric,
	"top_debtors" json,
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "balance_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"financial_period_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"intangible_assets" numeric,
	"tangible_fixed_assets" numeric,
	"freehold_property" numeric,
	"leasehold_property" numeric,
	"plant_machinery" numeric,
	"fixtures_fittings" numeric,
	"motor_vehicles" numeric,
	"computer_equipment" numeric,
	"stock_inventory" numeric,
	"trade_debtors" numeric,
	"prepayments" numeric,
	"amounts_owed_by_directors" numeric,
	"amounts_owed_by_connected_companies" numeric,
	"directors_current_account" numeric,
	"other_debtors" numeric,
	"cash_at_bank" numeric,
	"total_current_assets" numeric,
	"trade_creditors" numeric,
	"taxation_social_security" numeric,
	"vat_payable" numeric,
	"corporation_tax_due" numeric,
	"bank_loans_overdraft_current" numeric,
	"hire_purchase_current" numeric,
	"accruals" numeric,
	"amounts_owed_to_directors" numeric,
	"other_creditors" numeric,
	"total_current_liabilities" numeric,
	"bank_loans_long_term" numeric,
	"hire_purchase_long_term" numeric,
	"deferred_taxation" numeric,
	"other_long_term_debt" numeric,
	"total_long_term_liabilities" numeric,
	"share_capital" numeric,
	"retained_earnings" numeric,
	"total_equity" numeric,
	"debtors_list" json,
	"creditors_list" json,
	"fixed_assets_detail" json,
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ebitda_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"financial_period_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount" numeric NOT NULL,
	"category" varchar(100),
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"period_start" date,
	"period_end" date NOT NULL,
	"fiscal_year" integer,
	"period_label" varchar(100),
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_financial_period" UNIQUE("target_company_id","period_type","period_end")
);
--> statement-breakpoint
CREATE TABLE "fixed_assets_register" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"total_gross_book_value" numeric,
	"total_accumulated_depreciation" numeric,
	"total_net_book_value" numeric,
	"property_gross_value" numeric,
	"property_net_book_value" numeric,
	"plant_machinery_gross_value" numeric,
	"plant_machinery_net_book_value" numeric,
	"vehicles_gross_value" numeric,
	"vehicles_net_book_value" numeric,
	"it_equipment_gross_value" numeric,
	"it_equipment_net_book_value" numeric,
	"other_assets_gross_value" numeric,
	"other_assets_net_book_value" numeric,
	"refinanceable_assets_value" numeric,
	"fully_depreciated_still_in_use" numeric,
	"asset_items" json,
	"property_details" json,
	"vehicle_details" json,
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "income_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"financial_period_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"revenue" numeric,
	"cost_of_sales" numeric,
	"gross_profit" numeric,
	"administrative_expenses" numeric,
	"depreciation_amortisation" numeric,
	"other_operating_income" numeric,
	"operating_profit" numeric,
	"interest_receivable" numeric,
	"interest_payable" numeric,
	"profit_before_tax" numeric,
	"corporation_tax" numeric,
	"net_profit" numeric,
	"staff_costs" numeric,
	"directors_remuneration" numeric,
	"dividends_paid" numeric,
	"revenue_breakdown" json,
	"cost_of_sales_breakdown" json,
	"overheads_breakdown" json,
	"exceptional_items" json,
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"lender_name" varchar(255),
	"loan_type" varchar(100),
	"original_amount" numeric,
	"outstanding_balance" numeric,
	"interest_rate" numeric,
	"term_months" integer,
	"start_date" date,
	"maturity_date" date,
	"monthly_repayment" numeric,
	"annual_repayment" numeric,
	"security" text,
	"personal_guarantees" boolean,
	"covenants" text,
	"early_repayment_terms" text,
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"financial_period_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"total_headcount" integer,
	"total_staff_costs" numeric,
	"total_gross_salaries" numeric,
	"total_employer_ni" numeric,
	"total_employer_pension" numeric,
	"director_count" integer,
	"director_remuneration" numeric,
	"working_director_count" integer,
	"non_working_director_count" integer,
	"employee_count" integer,
	"employee_costs" numeric,
	"staff_records" json,
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"calculation_method" varchar(50) DEFAULT 'average_3yr',
	"valuation_multiple" numeric DEFAULT '4.0',
	"adjusted_ebitda" numeric,
	"enterprise_value" numeric,
	"net_debt" numeric,
	"equity_value" numeric,
	"funding_structure" json,
	"deal_notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info',
	"target_company_id" integer,
	"is_dismissed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"dismissed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"widget_type" varchar(50) NOT NULL,
	"widget_position" integer NOT NULL,
	"widget_size" varchar(20) DEFAULT 'medium',
	"is_visible" boolean DEFAULT true,
	"widget_config" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_company_id_user_companies_id_fk" FOREIGN KEY ("current_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_target_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_notes" ADD CONSTRAINT "deal_notes_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_notes" ADD CONSTRAINT "deal_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_stage_updated_by_users_id_fk" FOREIGN KEY ("stage_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_initial_discussion_by_users_id_fk" FOREIGN KEY ("initial_discussion_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_contacts" ADD CONSTRAINT "target_contacts_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deal_assignments" ADD CONSTRAINT "user_deal_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deal_assignments" ADD CONSTRAINT "user_deal_assignments_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deal_assignments" ADD CONSTRAINT "user_deal_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_log" ADD CONSTRAINT "document_access_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_log" ADD CONSTRAINT "document_access_log_accessed_by_users_id_fk" FOREIGN KEY ("accessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_analysis_results" ADD CONSTRAINT "document_analysis_results_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_analysis_results" ADD CONSTRAINT "document_analysis_results_file_upload_event_id_file_upload_events_id_fk" FOREIGN KEY ("file_upload_event_id") REFERENCES "public"."file_upload_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_external_submission_id_external_document_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_analysis_results" ADD CONSTRAINT "expert_analysis_results_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_analysis_results" ADD CONSTRAINT "expert_analysis_results_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_upload_events" ADD CONSTRAINT "file_upload_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_upload_events" ADD CONSTRAINT "file_upload_events_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_upload_events" ADD CONSTRAINT "file_upload_events_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ADD CONSTRAINT "stage1_analysis_events_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ADD CONSTRAINT "stage1_analysis_events_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ADD CONSTRAINT "stage1_analysis_events_detailed_analysis_triggered_by_users_id_fk" FOREIGN KEY ("detailed_analysis_triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_emails" ADD CONSTRAINT "chase_up_emails_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_emails" ADD CONSTRAINT "chase_up_emails_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_schedules" ADD CONSTRAINT "chase_up_schedules_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_schedules" ADD CONSTRAINT "chase_up_schedules_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_schedules" ADD CONSTRAINT "chase_up_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_submitted_document_id_external_document_submissions_id_fk" FOREIGN KEY ("submitted_document_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_submitted_by_contact_id_target_contacts_id_fk" FOREIGN KEY ("submitted_by_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_stage_progression" ADD CONSTRAINT "document_stage_progression_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_stage_progression" ADD CONSTRAINT "document_stage_progression_stage_1_completed_by_users_id_fk" FOREIGN KEY ("stage_1_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_stage_progression" ADD CONSTRAINT "document_stage_progression_stage_2_completed_by_users_id_fk" FOREIGN KEY ("stage_2_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ADD CONSTRAINT "portal_activity_log_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ADD CONSTRAINT "portal_activity_log_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ADD CONSTRAINT "portal_activity_log_related_document_id_external_document_submissions_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_analytics" ADD CONSTRAINT "portal_analytics_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_analytics" ADD CONSTRAINT "portal_analytics_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_analytics" ADD CONSTRAINT "portal_analytics_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_communications_log" ADD CONSTRAINT "portal_communications_log_campaign_id_portal_link_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."portal_link_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_communications_log" ADD CONSTRAINT "portal_communications_log_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ADD CONSTRAINT "portal_document_requirements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ADD CONSTRAINT "portal_document_requirements_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ADD CONSTRAINT "portal_document_requirements_submitted_document_id_external_document_submissions_id_fk" FOREIGN KEY ("submitted_document_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_email_templates" ADD CONSTRAINT "portal_email_templates_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_email_templates" ADD CONSTRAINT "portal_email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_campaigns" ADD CONSTRAINT "portal_link_campaigns_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_campaigns" ADD CONSTRAINT "portal_link_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_shares" ADD CONSTRAINT "portal_link_shares_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_shares" ADD CONSTRAINT "portal_link_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aged_debtors" ADD CONSTRAINT "aged_debtors_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aged_debtors" ADD CONSTRAINT "aged_debtors_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets_register" ADD CONSTRAINT "fixed_assets_register_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets_register" ADD CONSTRAINT "fixed_assets_register_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;