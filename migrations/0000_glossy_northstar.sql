-- Baseline generated from shared/schema.ts on 2026-07-31 after re-baseline.
-- Bootstrap for empty databases only. NEVER run against dev or prod: both
-- already conform. Known DB-vs-schema deltas: docs/drizzle-rebaseline/.
-- Prior journal in migrations_archive_20260731/.

CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."plan_key" AS ENUM('CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'admin_comped');--> statement-breakpoint
CREATE TYPE "public"."nylas_grant_status" AS ENUM('active', 'revoked', 'broken');--> statement-breakpoint
CREATE TYPE "public"."nylas_provider" AS ENUM('google', 'microsoft');--> statement-breakpoint
CREATE TABLE "addon_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"addon_type" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"stripe_payment_ref" varchar(255),
	"unit_price_minor_unit" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_code_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"stripe_coupon_id" varchar(50) NOT NULL,
	"referral_source" varchar(50) NOT NULL,
	"free_months_total" integer DEFAULT 0 NOT NULL,
	"max_total_claims" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"post_free_period_coupon_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" integer,
	CONSTRAINT "promo_code_campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "referral_invoice_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_company_id" integer NOT NULL,
	"invoice_month" varchar(7) NOT NULL,
	"amount_cents" integer NOT NULL,
	"member_email" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_invoice_records_user_company_id_unique" UNIQUE("user_company_id")
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
	"past_due_since" timestamp,
	"dunning_day7_email_sent_at" timestamp,
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
	"trial_extension_sent_at" timestamp,
	"trial_warning_email_sent_at" timestamp,
	"currency" varchar(3) DEFAULT 'usd',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	CONSTRAINT "subscriptions_user_company_id_unique" UNIQUE("user_company_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "user_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" varchar(32) NOT NULL,
	"version" varchar(32) NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text
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
	"input_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"output_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"industry" varchar(100),
	"company_size" varchar(50),
	"country" varchar(10),
	"beta_plan_override" varchar(20),
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
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"job_title" varchar(100),
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
	"password_hash" varchar(255),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"user_company_id" integer,
	"current_company_id" integer,
	"role" varchar(50) DEFAULT 'user',
	"user_role" varchar(50) DEFAULT 'analyst',
	"is_company_admin" boolean DEFAULT false,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"last_login" timestamp,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" varchar(50) DEFAULT 'create_target',
	"onboarding_completed_at" timestamp,
	"checklist_completed" boolean DEFAULT false NOT NULL,
	"hear_about_us" varchar(100),
	"job_title" varchar(100),
	"clerk_user_id" varchar(255),
	"welcome_email_sent_at" timestamp,
	"assigned_promo_campaign_id" integer,
	"assigned_by_admin_id" integer,
	"assigned_at" timestamp with time zone,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"acquisition_journey" text NOT NULL,
	"target_deal_size" text NOT NULL,
	"sectors" text[] NOT NULL,
	"sectors_other" text,
	"acquisitions_completed" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cohort" text DEFAULT '5D' NOT NULL,
	"discount_tier" text DEFAULT 'standard' NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"status_changed_at" timestamp,
	"status_changed_by" integer,
	"invited_user_id" integer,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_status_check" CHECK ("waitlist"."status" IN ('new','approved','invited','declined'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(100) NOT NULL,
	"stripe_event_id" varchar(255),
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts_sent" (
	"id" serial PRIMARY KEY NOT NULL,
	"composer_session_id" varchar(64) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body_markdown" text NOT NULL,
	"segment_key" varchar(50) NOT NULL,
	"segment_id" varchar(255) NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"recipient_count_estimate" integer,
	"resend_broadcast_id" varchar(255),
	"sent_by_user_id" integer NOT NULL,
	"status" varchar(30) DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_consent_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"user_id" integer,
	"waitlist_id" uuid,
	"email" varchar(255) NOT NULL,
	"resend_message_id" varchar(255),
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"consent_recorded_at" timestamp,
	"ip_address" "inet",
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "marketing_consent_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "marketing_consent_tokens_recipient_check" CHECK (("marketing_consent_tokens"."user_id" IS NOT NULL AND "marketing_consent_tokens"."waitlist_id" IS NULL) OR ("marketing_consent_tokens"."user_id" IS NULL AND "marketing_consent_tokens"."waitlist_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "marketing_unsubscribes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"email" varchar(255) NOT NULL,
	"topic_id" varchar(255),
	"topic_name" varchar(255),
	"resend_event_id" varchar(255) NOT NULL,
	"resend_contact_id" varchar(255),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unsubscribed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source" varchar(50) DEFAULT 'resend_webhook' NOT NULL,
	CONSTRAINT "marketing_unsubscribes_resend_event_id_unique" UNIQUE("resend_event_id")
);
--> statement-breakpoint
CREATE TABLE "nylas_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_company_id" integer NOT NULL,
	"grant_id" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"provider" "nylas_provider" NOT NULL,
	"status" "nylas_grant_status" DEFAULT 'active' NOT NULL,
	"scopes" jsonb,
	"last_used_at" timestamp,
	"last_error_at" timestamp,
	"last_error_message" varchar(500),
	"is_company_default" boolean DEFAULT false NOT NULL,
	"is_personal_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nylas_grants_grant_id_unique" UNIQUE("grant_id")
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
	"created_at" timestamp DEFAULT now(),
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"company_number" varchar(20)
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
	"accessed_by" integer,
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
	"secondary_category" text,
	"description" text,
	"is_confidential" boolean DEFAULT true,
	"upload_date" timestamp DEFAULT now(),
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"external_submission_id" integer,
	"public_token" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "documents_public_token_unique" UNIQUE("public_token")
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
CREATE TABLE "financial_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"fiscal_year" integer,
	"statement_type" varchar(10) NOT NULL,
	"source_document_id" integer,
	"source_tier" varchar(30) NOT NULL,
	"is_full_year" boolean DEFAULT true NOT NULL,
	"is_primary_year" boolean DEFAULT true NOT NULL,
	"months_covered" integer,
	"period_end" date,
	"as_at_date" date,
	"figures" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
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
	"months_covered" integer,
	"is_full_year" boolean DEFAULT true NOT NULL,
	"source_tier" varchar(30),
	"source_document_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"is_full_year" boolean DEFAULT true NOT NULL,
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
	"defensibility_score" integer,
	"case_for_inclusion" text,
	"case_for_exclusion" text,
	"status" varchar(50) DEFAULT 'suggested',
	"is_accepted" boolean DEFAULT false,
	"is_manual" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_model_contingent_consideration" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_model_id" integer NOT NULL,
	"consideration_type" varchar(50) DEFAULT 'custom' NOT NULL,
	"maximum_amount" numeric DEFAULT '0',
	"term_months" integer,
	"trigger_description" text,
	"include_in_dscr" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
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
	"repayment_structure" varchar(50) DEFAULT 'amortizing' NOT NULL,
	"is_active" boolean DEFAULT false,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_model_seller_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_model_id" integer NOT NULL,
	"payment_type" varchar(50) DEFAULT 'fixed_schedule' NOT NULL,
	"amount" numeric DEFAULT '0',
	"term_months" integer,
	"interest_rate" numeric,
	"label" varchar(255),
	"include_in_dscr" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
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
	"transaction_type" varchar(20) DEFAULT 'share_sale',
	"parent_model_id" integer,
	"is_locked" boolean DEFAULT false,
	"averaging_years" integer DEFAULT 3,
	"ebitda_multiple" numeric DEFAULT '3.0',
	"offer_driver" varchar(20) DEFAULT 'ebitda',
	"target_offer_price" numeric,
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
	"working_capital_months" integer DEFAULT 3,
	"working_capital_monthly_amount" numeric,
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
	"fee_legal_dd_amount" numeric,
	"fee_accounting_dd_amount" numeric,
	"fee_loan_arrangement_amount" numeric,
	"fee_deal_maker_amount" numeric,
	"custom_fees" jsonb DEFAULT '[]'::jsonb,
	"expert_data_snapshot" json,
	"financial_data_snapshot" json,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"delivery_method" varchar(10) DEFAULT 'portal' NOT NULL,
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
CREATE TABLE "dd_requirement_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"status" varchar(30) DEFAULT 'not_submitted' NOT NULL,
	"notes" text,
	"document_id" integer,
	"external_submission_id" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"seller_marked_complete" boolean DEFAULT false,
	"seller_marked_complete_at" timestamp,
	"buyer_review_status" varchar(30) DEFAULT 'not_reviewed',
	"buyer_review_notes" text,
	"buyer_reviewed_at" timestamp,
	"buyer_reviewed_by" integer
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
CREATE TABLE "document_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"document_id" integer,
	"document_analysis_result_id" integer,
	"document_type" varchar(100) NOT NULL,
	"extraction_version" integer DEFAULT 1 NOT NULL,
	"content_hash" varchar(64),
	"extractor" varchar(100),
	"extracted_at" timestamp DEFAULT now(),
	"company_names_found" jsonb,
	"registered_numbers_found" jsonb,
	"year_end_stated" date,
	"directors_named" jsonb,
	"accountant_name" text,
	"is_draft" boolean,
	"is_abridged" boolean,
	"is_signed" boolean,
	"report_date" date,
	"identity_verdict" varchar(20),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "document_evidence_doc_type_version_unique" UNIQUE("document_id","document_type","extraction_version")
);
--> statement-breakpoint
CREATE TABLE "document_evidence_figure" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_evidence_period_id" integer NOT NULL,
	"statement_type" varchar(10) NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"value" numeric,
	"label_text_as_printed" text,
	"page_number" integer,
	"payload_path" text,
	"is_model_derived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_evidence_period" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_evidence_id" integer NOT NULL,
	"fiscal_year_stated" integer,
	"period_start" date,
	"period_end" date,
	"period_label_as_printed" text,
	"months_covered_stated" integer,
	"months_covered_computed" integer,
	"is_full_year_computed" boolean,
	"provenance" varchar(40),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_campaigns" ADD CONSTRAINT "promo_code_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_invoice_records" ADD CONSTRAINT "referral_invoice_records_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_acceptances" ADD CONSTRAINT "user_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_costs" ADD CONSTRAINT "platform_costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_company_id_user_companies_id_fk" FOREIGN KEY ("current_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_by_admin_id_users_id_fk" FOREIGN KEY ("assigned_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts_sent" ADD CONSTRAINT "broadcasts_sent_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" ADD CONSTRAINT "marketing_consent_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" ADD CONSTRAINT "marketing_consent_tokens_waitlist_id_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_unsubscribes" ADD CONSTRAINT "marketing_unsubscribes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nylas_grants" ADD CONSTRAINT "nylas_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nylas_grants" ADD CONSTRAINT "nylas_grants_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_contributions" ADD CONSTRAINT "financial_contributions_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_contributions" ADD CONSTRAINT "financial_contributions_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets_register" ADD CONSTRAINT "fixed_assets_register_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets_register" ADD CONSTRAINT "fixed_assets_register_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD CONSTRAINT "deal_model_adjustments_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD CONSTRAINT "deal_model_adjustments_source_expert_result_id_expert_analysis_results_id_fk" FOREIGN KEY ("source_expert_result_id") REFERENCES "public"."expert_analysis_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_contingent_consideration" ADD CONSTRAINT "deal_model_contingent_consideration_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_funding_lines" ADD CONSTRAINT "deal_model_funding_lines_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_seller_payments" ADD CONSTRAINT "deal_model_seller_payments_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_models" ADD CONSTRAINT "deal_models_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_models" ADD CONSTRAINT "deal_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_deal_document_id_deal_documents_id_fk" FOREIGN KEY ("deal_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_document_responses" ADD CONSTRAINT "deal_document_responses_deal_document_id_deal_documents_id_fk" FOREIGN KEY ("deal_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_document_templates" ADD CONSTRAINT "deal_document_templates_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_template_id_deal_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."deal_document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_requirement_status_id_dd_requirement_status_id_fk" FOREIGN KEY ("requirement_status_id") REFERENCES "public"."dd_requirement_status"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_external_submission_id_external_document_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" ADD CONSTRAINT "dd_requirement_documents_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_requirement_id_dd_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."dd_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_external_submission_id_external_document_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirement_status" ADD CONSTRAINT "dd_requirement_status_buyer_reviewed_by_users_id_fk" FOREIGN KEY ("buyer_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_requirements" ADD CONSTRAINT "dd_requirements_category_id_dd_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."dd_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_assumptions" ADD CONSTRAINT "value_creation_assumptions_scenario_id_value_creation_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."value_creation_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_exit_assumptions" ADD CONSTRAINT "value_creation_exit_assumptions_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_scenarios" ADD CONSTRAINT "value_creation_scenarios_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_synergies" ADD CONSTRAINT "value_creation_synergies_scenario_id_value_creation_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."value_creation_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence" ADD CONSTRAINT "document_evidence_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence" ADD CONSTRAINT "document_evidence_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence" ADD CONSTRAINT "document_evidence_document_analysis_result_id_document_analysis_results_id_fk" FOREIGN KEY ("document_analysis_result_id") REFERENCES "public"."document_analysis_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence_figure" ADD CONSTRAINT "document_evidence_figure_document_evidence_period_id_document_evidence_period_id_fk" FOREIGN KEY ("document_evidence_period_id") REFERENCES "public"."document_evidence_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence_period" ADD CONSTRAINT "document_evidence_period_document_evidence_id_document_evidence_id_fk" FOREIGN KEY ("document_evidence_id") REFERENCES "public"."document_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_stripe_event_id_idx" ON "webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "nylas_grants_user_status_idx" ON "nylas_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "nylas_grants_user_company_idx" ON "nylas_grants" USING btree ("user_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nylas_grants_one_company_default_per_company" ON "nylas_grants" USING btree ("user_company_id") WHERE "nylas_grants"."is_company_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "nylas_grants_one_personal_default_per_user" ON "nylas_grants" USING btree ("user_id") WHERE "nylas_grants"."is_personal_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "chase_up_emails_token_seq_unique" ON "chase_up_emails" USING btree ("portal_token_id","email_sequence_number");--> statement-breakpoint
CREATE INDEX "idx_document_evidence_company" ON "document_evidence" USING btree ("target_company_id");--> statement-breakpoint
CREATE INDEX "idx_document_evidence_document" ON "document_evidence" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_evidence_figure_period" ON "document_evidence_figure" USING btree ("document_evidence_period_id");--> statement-breakpoint
CREATE INDEX "idx_document_evidence_period_evidence" ON "document_evidence_period" USING btree ("document_evidence_id");