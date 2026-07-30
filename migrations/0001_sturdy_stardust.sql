CREATE TABLE "deal_model_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_model_id" integer NOT NULL,
	"source_expert_result_id" integer,
	"adjustment_type" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount" numeric NOT NULL,
	"amounts_by_year" json,
	"source_expert" varchar(50),
	"reasoning" text,
	"confidence" varchar(20),
	"status" varchar(50) DEFAULT 'suggested',
	"is_accepted" boolean DEFAULT false,
	"is_manual" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_model_funding_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_model_id" integer NOT NULL,
	"funding_type" varchar(50) NOT NULL,
	"label" varchar(255),
	"asset_base_value" numeric,
	"ltv_percent" numeric,
	"available_amount" numeric,
	"amount_used" numeric DEFAULT '0',
	"interest_rate" numeric,
	"arrangement_fee_percent" numeric,
	"term_months" integer,
	"monthly_repayment" numeric,
	"is_debt" boolean DEFAULT false,
	"is_active" boolean DEFAULT false,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'draft',
	"version" integer DEFAULT 1,
	"parent_model_id" integer,
	"is_locked" boolean DEFAULT false,
	"averaging_years" integer DEFAULT 3,
	"ebitda_multiple" numeric DEFAULT '3.0',
	"multiple_low" numeric,
	"multiple_high" numeric,
	"property_value" numeric DEFAULT '0',
	"cash_value" numeric DEFAULT '0',
	"other_assets" numeric DEFAULT '0',
	"calculated_ebitda" numeric,
	"adjusted_ebitda" numeric,
	"enterprise_value" numeric,
	"plus_excess_cash" numeric,
	"minus_primary_debt" numeric,
	"minus_other_debt" numeric,
	"minus_corp_tax_due" numeric,
	"minus_working_capital_adj" numeric,
	"total_purchase_price" numeric,
	"total_funding_available" numeric,
	"equity_required" numeric,
	"upfront_cash" numeric,
	"deferred_amount" numeric,
	"deferred_terms" varchar(500),
	"earnout_maximum" numeric,
	"earnout_metric" varchar(255),
	"earnout_period_months" integer,
	"retention_escrow" numeric,
	"fee_legal_dd_percent" numeric DEFAULT '2.5',
	"fee_accounting_dd_percent" numeric DEFAULT '1.5',
	"fee_broker_percent" numeric DEFAULT '2.0',
	"fee_loan_arrangement_percent" numeric DEFAULT '1.0',
	"fee_deal_maker_percent" numeric DEFAULT '5.0',
	"fee_legal_dd_type" varchar(20) DEFAULT 'percent',
	"fee_accounting_dd_type" varchar(20) DEFAULT 'percent',
	"fee_broker_type" varchar(20) DEFAULT 'percent',
	"fee_loan_arrangement_type" varchar(20) DEFAULT 'percent',
	"fee_deal_maker_type" varchar(20) DEFAULT 'percent',
	"expert_data_snapshot" json,
	"financial_data_snapshot" json,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_document_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_document_id" integer NOT NULL,
	"response_type" varchar(50) NOT NULL,
	"comments" text,
	"respondent_name" text NOT NULL,
	"respondent_email" text,
	"respondent_ip" "inet",
	"respondent_user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_document_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer,
	"template_name" varchar(255) NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"template_file_url" text NOT NULL,
	"placeholder_map" json,
	"sections" json,
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"user_company_id" integer NOT NULL,
	"deal_model_id" integer,
	"portal_token_id" integer,
	"template_id" integer,
	"document_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_document_id" integer,
	"document_data" json,
	"section_config" json,
	"generated_file_url" text,
	"created_by" integer NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"responded_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dd_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref_prefix" varchar(10) NOT NULL,
	"category_name" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dd_categories_ref_prefix_unique" UNIQUE("ref_prefix"),
	CONSTRAINT "dd_categories_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "dd_requirement_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"status" varchar(30) DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"document_id" integer,
	"external_submission_id" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dd_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"ref_number" varchar(10) NOT NULL,
	"document_name" varchar(500) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"guidance" text,
	"collection_stage" integer DEFAULT 2,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dd_requirements_ref_number_unique" UNIQUE("ref_number")
);
--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD CONSTRAINT "deal_model_adjustments_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD CONSTRAINT "deal_model_adjustments_source_expert_result_id_expert_analysis_results_id_fk" FOREIGN KEY ("source_expert_result_id") REFERENCES "public"."expert_analysis_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_funding_lines" ADD CONSTRAINT "deal_model_funding_lines_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_models" ADD CONSTRAINT "deal_models_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_models" ADD CONSTRAINT "deal_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_document_responses" ADD CONSTRAINT "deal_document_responses_deal_document_id_deal_documents_id_fk" FOREIGN KEY ("deal_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_document_templates" ADD CONSTRAINT "deal_document_templates_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_template_id_deal_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."deal_document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_requirement_id_dd_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."dd_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_external_submission_id_external_document_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirements" ADD CONSTRAINT "dd_requirements_category_id_dd_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."dd_categories"("id") ON DELETE no action ON UPDATE no action;