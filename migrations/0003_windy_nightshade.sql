CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."plan_key" AS ENUM('CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'admin_comped');--> statement-breakpoint
CREATE TABLE "addon_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"addon_type" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"stripe_payment_ref" varchar(255),
	"unit_price_minor_unit" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'gbp' NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_code_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"stripe_coupon_id" varchar(50) NOT NULL,
	"referral_source" varchar(50) NOT NULL,
	"free_months_total" integer DEFAULT 0 NOT NULL,
	"code_prefix" varchar(10) DEFAULT '' NOT NULL,
	"max_uses_per_code" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp,
	"post_free_period_coupon_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"code" varchar(20) NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"claimed_by_user_company_id" integer,
	"claimed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"stripe_event_id" varchar(255),
	"event_type" varchar(100) NOT NULL,
	"previous_status" "subscription_status",
	"previous_plan_key" "plan_key",
	"new_status" "subscription_status",
	"new_plan_key" "plan_key",
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"admin_user_id" integer,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"plan_key" "plan_key" DEFAULT 'CORE' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"billing_interval" "billing_interval" DEFAULT 'month',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"add_on_company_slots" integer DEFAULT 0 NOT NULL,
	"additional_seats" integer DEFAULT 0 NOT NULL,
	"is_community_member" boolean DEFAULT false NOT NULL,
	"community_free_months_remaining" integer DEFAULT 0 NOT NULL,
	"enterprise_overrides" jsonb,
	"admin_notes" text,
	"referral_source" varchar(50),
	"promo_code_id" integer,
	"free_months_total" integer DEFAULT 0 NOT NULL,
	"free_months_started_at" timestamp,
	"community_discount_coupon_id" varchar(50),
	"free_months_warning_email_sent_at" timestamp,
	"trial_ends_at" timestamp,
	"currency" varchar(3) DEFAULT 'gbp',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_company_id_unique" UNIQUE("user_company_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"type" varchar(20) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"invalidated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "resend_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"request_count" integer DEFAULT 1,
	"window_start" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by_user_id" integer,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "deal_metrics_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"deal_model_id" integer,
	"trigger_event" varchar(50) NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_company_id" integer,
	"reporter_email" varchar(255),
	"reporter_name" varchar(255),
	"type" varchar(20) NOT NULL,
	"severity" varchar(10),
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"page_url" varchar(500),
	"page_title" varchar(255),
	"user_agent" varchar(500),
	"screenshot_url" varchar(500),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"user_id" integer,
	"event" varchar(100) NOT NULL,
	"properties" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_company_id" integer,
	"page_url" varchar(500),
	"user_agent" varchar(500),
	"title" varchar(255) NOT NULL,
	"description" text,
	"severity" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'open',
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "current_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"user_company_id" integer NOT NULL,
	"deal_document_id" integer,
	"deal_model_id" integer,
	"offer_price" text,
	"enterprise_value" text,
	"transaction_type" varchar(20),
	"document_data" jsonb,
	"delivery_method" varchar(10),
	"status" varchar(20) DEFAULT 'sent',
	"sent_at" timestamp,
	"accepted_at" timestamp,
	"accepted_by" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "accessed_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_usage" ADD COLUMN "input_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "token_usage" ADD COLUMN "output_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_companies" ADD COLUMN "industry" varchar(100);--> statement-breakpoint
ALTER TABLE "user_companies" ADD COLUMN "company_size" varchar(50);--> statement-breakpoint
ALTER TABLE "user_companies" ADD COLUMN "country" varchar(10);--> statement-breakpoint
ALTER TABLE "user_companies" ADD COLUMN "beta_plan_override" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_step" varchar(50) DEFAULT 'create_target';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hear_about_us" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_title" varchar(100);--> statement-breakpoint
ALTER TABLE "target_companies" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "target_companies" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "public_token" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "deal_models" ADD COLUMN "transaction_type" varchar(20) DEFAULT 'share_sale';--> statement-breakpoint
ALTER TABLE "deal_documents" ADD COLUMN "delivery_method" varchar(10) DEFAULT 'portal' NOT NULL;--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_campaigns" ADD CONSTRAINT "promo_code_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_campaign_id_promo_code_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."promo_code_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_claimed_by_user_company_id_user_companies_id_fk" FOREIGN KEY ("claimed_by_user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_deal_document_id_deal_documents_id_fk" FOREIGN KEY ("deal_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_public_token_unique" UNIQUE("public_token");