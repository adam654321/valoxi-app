CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "platform_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"description" varchar(255) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_company_id" integer,
	"deal_id" integer,
	"document_id" integer,
	"service" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"candidate_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dd_requirement_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_status_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"document_source" varchar(20) NOT NULL,
	"document_id" integer,
	"external_submission_id" integer,
	"added_by" integer,
	"added_at" timestamp DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "value_creation_assumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" integer NOT NULL,
	"year" integer NOT NULL,
	"revenue_growth_percent" numeric DEFAULT '5.0',
	"cost_of_sales_growth_percent" numeric DEFAULT '3.0',
	"admin_cost_growth_percent" numeric DEFAULT '2.0',
	"staff_cost_growth_percent" numeric DEFAULT '3.0',
	"depreciation_growth_percent" numeric DEFAULT '0',
	"capex_per_year" numeric DEFAULT '0',
	"working_capital_percent" numeric DEFAULT '0',
	"tax_rate_percent" numeric DEFAULT '25.0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "value_creation_exit_assumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_model_id" integer NOT NULL,
	"exit_multiple" numeric DEFAULT '4.0',
	"hold_period_years" integer DEFAULT 5,
	"exit_cost_percent" numeric DEFAULT '3.0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "value_creation_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_model_id" integer NOT NULL,
	"scenario_type" varchar(20) DEFAULT 'base' NOT NULL,
	"name" varchar(100) DEFAULT 'Base Case' NOT NULL,
	"revenue_growth_multiplier" numeric DEFAULT '1.0',
	"cost_pressure_adjustment" numeric DEFAULT '0',
	"scenario_mode" varchar(10) DEFAULT 'linked',
	"range_percent" numeric DEFAULT '10',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "value_creation_synergies" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" integer NOT NULL,
	"synergy_type" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"target_value" numeric DEFAULT '0',
	"realisation_y1" numeric DEFAULT '20',
	"realisation_y2" numeric DEFAULT '50',
	"realisation_y3" numeric DEFAULT '80',
	"realisation_y4" numeric DEFAULT '100',
	"realisation_y5" numeric DEFAULT '100',
	"implementation_cost" numeric DEFAULT '0',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ALTER COLUMN "status" SET DEFAULT 'not_submitted';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_system_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "secondary_category" text;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD COLUMN "defensibility_score" integer;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD COLUMN "case_for_inclusion" text;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD COLUMN "case_for_exclusion" text;--> statement-breakpoint
ALTER TABLE "deal_models" ADD COLUMN "working_capital_months" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "deal_models" ADD COLUMN "working_capital_monthly_amount" numeric;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD COLUMN "seller_marked_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD COLUMN "seller_marked_complete_at" timestamp;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD COLUMN "buyer_review_status" varchar(30) DEFAULT 'not_reviewed';--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD COLUMN "buyer_review_notes" text;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD COLUMN "buyer_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD COLUMN "buyer_reviewed_by" integer;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_costs" ADD CONSTRAINT "platform_costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_requirement_status_id_dd_requirement_status_id_fk" FOREIGN KEY ("requirement_status_id") REFERENCES "public"."dd_requirement_status"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_external_submission_id_external_document_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_assumptions" ADD CONSTRAINT "value_creation_assumptions_scenario_id_value_creation_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."value_creation_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_exit_assumptions" ADD CONSTRAINT "value_creation_exit_assumptions_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_scenarios" ADD CONSTRAINT "value_creation_scenarios_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_synergies" ADD CONSTRAINT "value_creation_synergies_scenario_id_value_creation_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."value_creation_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_buyer_reviewed_by_users_id_fk" FOREIGN KEY ("buyer_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;