ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP VIEW "public"."activity_summary";--> statement-breakpoint
DROP VIEW "public"."deal_progression";--> statement-breakpoint
DROP VIEW "public"."pipeline_summary";--> statement-breakpoint
DROP VIEW "public"."stage_1_progress";--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
ALTER TABLE "document_evidence" DROP CONSTRAINT "document_evidence_doc_type_version_unique";--> statement-breakpoint
ALTER TABLE "chase_up_emails" DROP CONSTRAINT "chase_up_emails_token_seq_unique";--> statement-breakpoint
ALTER TABLE "waitlist" DROP CONSTRAINT "waitlist_status_check";--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" DROP CONSTRAINT "marketing_consent_tokens_recipient_check";--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_delivery_method_check";--> statement-breakpoint
ALTER TABLE "target_companies" DROP CONSTRAINT "target_companies_initial_discussion_by_fkey";
--> statement-breakpoint
ALTER TABLE "target_companies" DROP CONSTRAINT "target_companies_stage_updated_by_fkey";
--> statement-breakpoint
ALTER TABLE "current_offers" DROP CONSTRAINT "current_offers_deal_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "current_offers" DROP CONSTRAINT "current_offers_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "current_offers" DROP CONSTRAINT "current_offers_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "current_offers" DROP CONSTRAINT "current_offers_deal_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_evidence" DROP CONSTRAINT "document_evidence_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_evidence" DROP CONSTRAINT "document_evidence_analysis_result_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_evidence" DROP CONSTRAINT "document_evidence_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_evidence_period" DROP CONSTRAINT "document_evidence_period_evidence_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_evidence_figure" DROP CONSTRAINT "document_evidence_figure_period_id_fkey";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_current_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_assigned_promo_campaign_id_promo_code_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "marketing_unsubscribes" DROP CONSTRAINT "marketing_unsubscribes_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_acceptances" DROP CONSTRAINT "user_acceptances_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "nylas_grants" DROP CONSTRAINT "nylas_grants_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "nylas_grants" DROP CONSTRAINT "nylas_grants_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "broadcasts_sent" DROP CONSTRAINT "broadcasts_sent_sent_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "referral_invoice_records" DROP CONSTRAINT "referral_invoice_records_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" DROP CONSTRAINT "marketing_consent_tokens_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" DROP CONSTRAINT "marketing_consent_tokens_waitlist_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_model_seller_payments" DROP CONSTRAINT "deal_model_seller_payments_deal_model_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_model_contingent_consideration" DROP CONSTRAINT "deal_model_contingent_consideration_deal_model_id_fk";
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "addon_purchases" DROP CONSTRAINT "addon_purchases_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_external_submission_id_fkey";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_uploaded_by_fkey";
--> statement-breakpoint
ALTER TABLE "aged_debtors" DROP CONSTRAINT "aged_debtors_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "aged_debtors" DROP CONSTRAINT "aged_debtors_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "balance_sheets" DROP CONSTRAINT "balance_sheets_financial_period_id_fkey";
--> statement-breakpoint
ALTER TABLE "balance_sheets" DROP CONSTRAINT "balance_sheets_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "balance_sheets" DROP CONSTRAINT "balance_sheets_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "beta_feedback" DROP CONSTRAINT "beta_feedback_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "beta_feedback" DROP CONSTRAINT "beta_feedback_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_access_tokens" DROP CONSTRAINT "portal_access_tokens_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "portal_access_tokens" DROP CONSTRAINT "portal_access_tokens_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_access_tokens" DROP CONSTRAINT "portal_access_tokens_target_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_access_tokens" DROP CONSTRAINT "portal_access_tokens_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "chase_up_emails" DROP CONSTRAINT "chase_up_emails_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "chase_up_emails" DROP CONSTRAINT "chase_up_emails_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "chase_up_schedules" DROP CONSTRAINT "chase_up_schedules_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "chase_up_schedules" DROP CONSTRAINT "chase_up_schedules_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "chase_up_schedules" DROP CONSTRAINT "chase_up_schedules_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "company_document_requirements" DROP CONSTRAINT "company_document_requirements_reviewed_by_fkey";
--> statement-breakpoint
ALTER TABLE "company_document_requirements" DROP CONSTRAINT "company_document_requirements_submitted_by_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "company_document_requirements" DROP CONSTRAINT "company_document_requirements_submitted_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "company_document_requirements" DROP CONSTRAINT "company_document_requirements_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "external_document_submissions" DROP CONSTRAINT "external_document_submissions_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "external_document_submissions" DROP CONSTRAINT "external_document_submissions_reviewed_by_fkey";
--> statement-breakpoint
ALTER TABLE "external_document_submissions" DROP CONSTRAINT "external_document_submissions_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "external_document_submissions" DROP CONSTRAINT "external_document_submissions_target_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "dashboard_alerts" DROP CONSTRAINT "dashboard_alerts_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "dashboard_alerts" DROP CONSTRAINT "dashboard_alerts_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "dashboard_preferences" DROP CONSTRAINT "dashboard_preferences_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" DROP CONSTRAINT "dd_requirement_documents_added_by_fk";
--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" DROP CONSTRAINT "dd_requirement_documents_document_id_fk";
--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" DROP CONSTRAINT "dd_requirement_documents_external_submission_id_fk";
--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" DROP CONSTRAINT "dd_requirement_documents_requirement_status_id_fk";
--> statement-breakpoint
ALTER TABLE "dd_requirement_documents" DROP CONSTRAINT "dd_requirement_documents_target_company_id_fk";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_buyer_reviewed_by_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_external_submission_id_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_requirement_id_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_reviewed_by_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirement_status" DROP CONSTRAINT "dd_requirement_status_updated_by_fkey";
--> statement-breakpoint
ALTER TABLE "dd_requirements" DROP CONSTRAINT "dd_requirements_category_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_document_responses" DROP CONSTRAINT "deal_document_responses_deal_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_document_templates" DROP CONSTRAINT "deal_document_templates_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" DROP CONSTRAINT "deal_metrics_snapshots_deal_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" DROP CONSTRAINT "deal_metrics_snapshots_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" DROP CONSTRAINT "deal_metrics_snapshots_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" DROP CONSTRAINT "deal_model_adjustments_deal_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_notes" DROP CONSTRAINT "deal_notes_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "deal_notes" DROP CONSTRAINT "deal_notes_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_access_log" DROP CONSTRAINT "document_access_log_accessed_by_fkey";
--> statement-breakpoint
ALTER TABLE "document_access_log" DROP CONSTRAINT "document_access_log_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_analysis_results" DROP CONSTRAINT "document_analysis_results_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "document_analysis_results" DROP CONSTRAINT "document_analysis_results_file_upload_event_id_fkey";
--> statement-breakpoint
ALTER TABLE "file_upload_events" DROP CONSTRAINT "file_upload_events_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "file_upload_events" DROP CONSTRAINT "file_upload_events_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "file_upload_events" DROP CONSTRAINT "file_upload_events_uploaded_by_fkey";
--> statement-breakpoint
ALTER TABLE "document_stage_progression" DROP CONSTRAINT "document_stage_progression_stage_1_completed_by_fkey";
--> statement-breakpoint
ALTER TABLE "document_stage_progression" DROP CONSTRAINT "document_stage_progression_stage_2_completed_by_fkey";
--> statement-breakpoint
ALTER TABLE "document_stage_progression" DROP CONSTRAINT "document_stage_progression_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" DROP CONSTRAINT "ebitda_adjustments_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" DROP CONSTRAINT "ebitda_adjustments_financial_period_id_fkey";
--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" DROP CONSTRAINT "ebitda_adjustments_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "expert_analysis_results" DROP CONSTRAINT "expert_analysis_results_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "expert_analysis_results" DROP CONSTRAINT "expert_analysis_results_triggered_by_fkey";
--> statement-breakpoint
ALTER TABLE "fixed_assets_register" DROP CONSTRAINT "fixed_assets_register_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "fixed_assets_register" DROP CONSTRAINT "fixed_assets_register_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "financial_periods" DROP CONSTRAINT "financial_periods_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "financial_periods" DROP CONSTRAINT "financial_periods_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_deal_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_template_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_documents_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_model_funding_lines" DROP CONSTRAINT "deal_model_funding_lines_deal_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "funnel_events" DROP CONSTRAINT "funnel_events_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "funnel_events" DROP CONSTRAINT "funnel_events_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "issue_reports" DROP CONSTRAINT "issue_reports_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "issue_reports" DROP CONSTRAINT "issue_reports_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "loan_facilities" DROP CONSTRAINT "loan_facilities_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "loan_facilities" DROP CONSTRAINT "loan_facilities_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "magic_links" DROP CONSTRAINT "magic_links_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_user_id_fk";
--> statement-breakpoint
ALTER TABLE "platform_costs" DROP CONSTRAINT "platform_costs_created_by_fk";
--> statement-breakpoint
ALTER TABLE "portal_activity_log" DROP CONSTRAINT "portal_activity_log_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_activity_log" DROP CONSTRAINT "portal_activity_log_target_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_analytics" DROP CONSTRAINT "portal_analytics_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_analytics" DROP CONSTRAINT "portal_analytics_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_analytics" DROP CONSTRAINT "portal_analytics_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_link_campaigns" DROP CONSTRAINT "portal_link_campaigns_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "portal_link_campaigns" DROP CONSTRAINT "portal_link_campaigns_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_communications_log" DROP CONSTRAINT "portal_communications_log_campaign_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_communications_log" DROP CONSTRAINT "portal_communications_log_target_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_document_requirements" DROP CONSTRAINT "portal_document_requirements_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_email_templates" DROP CONSTRAINT "portal_email_templates_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "portal_email_templates" DROP CONSTRAINT "portal_email_templates_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_link_shares" DROP CONSTRAINT "portal_link_shares_portal_token_id_fkey";
--> statement-breakpoint
ALTER TABLE "portal_link_shares" DROP CONSTRAINT "portal_link_shares_shared_by_fkey";
--> statement-breakpoint
ALTER TABLE "staff_data" DROP CONSTRAINT "staff_data_financial_period_id_fkey";
--> statement-breakpoint
ALTER TABLE "staff_data" DROP CONSTRAINT "staff_data_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "staff_data" DROP CONSTRAINT "staff_data_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" DROP CONSTRAINT "stage1_analysis_events_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" DROP CONSTRAINT "stage1_analysis_events_triggered_by_fkey";
--> statement-breakpoint
ALTER TABLE "stage_history" DROP CONSTRAINT "stage_history_changed_by_fkey";
--> statement-breakpoint
ALTER TABLE "stage_history" DROP CONSTRAINT "stage_history_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscription_events" DROP CONSTRAINT "subscription_events_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "system_config" DROP CONSTRAINT "system_config_updated_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_notifications" DROP CONSTRAINT "team_notifications_from_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_notifications" DROP CONSTRAINT "team_notifications_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_notifications" DROP CONSTRAINT "team_notifications_target_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_notifications" DROP CONSTRAINT "team_notifications_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "token_usage" DROP CONSTRAINT "token_usage_user_company_id_fk";
--> statement-breakpoint
ALTER TABLE "token_usage" DROP CONSTRAINT "token_usage_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_company_memberships" DROP CONSTRAINT "user_company_memberships_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_company_memberships" DROP CONSTRAINT "user_company_memberships_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_deal_assignments" DROP CONSTRAINT "user_deal_assignments_assigned_by_fkey";
--> statement-breakpoint
ALTER TABLE "user_deal_assignments" DROP CONSTRAINT "user_deal_assignments_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_deal_assignments" DROP CONSTRAINT "user_deal_assignments_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "valuations" DROP CONSTRAINT "valuations_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "valuations" DROP CONSTRAINT "valuations_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "value_creation_scenarios" DROP CONSTRAINT "vc_scenarios_deal_model_id_fk";
--> statement-breakpoint
ALTER TABLE "value_creation_assumptions" DROP CONSTRAINT "vc_assumptions_scenario_id_fk";
--> statement-breakpoint
ALTER TABLE "value_creation_exit_assumptions" DROP CONSTRAINT "vc_exit_deal_model_id_fk";
--> statement-breakpoint
ALTER TABLE "value_creation_synergies" DROP CONSTRAINT "vc_synergies_scenario_id_fk";
--> statement-breakpoint
ALTER TABLE "promo_code_campaigns" DROP CONSTRAINT "promo_code_campaigns_created_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_invitations" DROP CONSTRAINT "user_invitations_invited_by_fkey";
--> statement-breakpoint
ALTER TABLE "user_invitations" DROP CONSTRAINT "user_invitations_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "deal_models" DROP CONSTRAINT "deal_models_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "deal_models" DROP CONSTRAINT "deal_models_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "financial_contributions" DROP CONSTRAINT "financial_contributions_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "financial_contributions" DROP CONSTRAINT "financial_contributions_source_document_id_fkey";
--> statement-breakpoint
ALTER TABLE "income_statements" DROP CONSTRAINT "income_statements_financial_period_id_fkey";
--> statement-breakpoint
ALTER TABLE "income_statements" DROP CONSTRAINT "income_statements_target_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "income_statements" DROP CONSTRAINT "income_statements_source_document_id_fkey";
--> statement-breakpoint
DROP INDEX "current_offers_target_company_unique";--> statement-breakpoint
DROP INDEX "idx_document_evidence_company";--> statement-breakpoint
DROP INDEX "idx_document_evidence_document";--> statement-breakpoint
DROP INDEX "idx_document_evidence_period_evidence";--> statement-breakpoint
DROP INDEX "idx_document_evidence_figure_period";--> statement-breakpoint
DROP INDEX "users_email_lower_idx";--> statement-breakpoint
DROP INDEX "marketing_consent_tokens_user_id_idx";--> statement-breakpoint
DROP INDEX "marketing_consent_tokens_waitlist_id_idx";--> statement-breakpoint
DROP INDEX "idx_documents_public_token";--> statement-breakpoint
DROP INDEX "idx_company_requirements_company";--> statement-breakpoint
DROP INDEX "idx_stage_progression_company";--> statement-breakpoint
DROP INDEX "idx_funnel_events_created_at";--> statement-breakpoint
DROP INDEX "idx_funnel_events_event";--> statement-breakpoint
DROP INDEX "idx_team_notifications_user";--> statement-breakpoint
DROP INDEX "idx_user_deal_assignments_company";--> statement-breakpoint
DROP INDEX "idx_user_deal_assignments_user";--> statement-breakpoint
DROP INDEX "idx_user_invitations_email";--> statement-breakpoint
DROP INDEX "idx_user_invitations_token";--> statement-breakpoint
DROP INDEX "waitlist_created_at_idx";--> statement-breakpoint
DROP INDEX "waitlist_status_idx";--> statement-breakpoint
DROP INDEX "nylas_grants_one_company_default_per_company";--> statement-breakpoint
DROP INDEX "nylas_grants_one_personal_default_per_user";--> statement-breakpoint
DROP INDEX "nylas_grants_user_company_idx";--> statement-breakpoint
DROP INDEX "nylas_grants_user_status_idx";--> statement-breakpoint
DROP INDEX "webhook_events_stripe_event_id_idx";--> statement-breakpoint
ALTER TABLE "addon_purchases" ALTER COLUMN "currency" SET DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ALTER COLUMN "token_purpose" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ALTER COLUMN "expires_at" SET DEFAULT (NOW() + INTERVAL '30 days');--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ALTER COLUMN "allowed_actions" SET DEFAULT '{"upload": true, "download": true, "message": true}';--> statement-breakpoint
ALTER TABLE "company_document_requirements" ALTER COLUMN "requirement_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ALTER COLUMN "requirement_description" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ALTER COLUMN "document_category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "file_path" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "file_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "document_category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "submitted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "encryption_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "external_document_submissions" ALTER COLUMN "encryption_status" SET DEFAULT 'encrypted';--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ALTER COLUMN "user_company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "document_analysis_results" ALTER COLUMN "usage_metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ALTER COLUMN "activity_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "portal_activity_log" ALTER COLUMN "activity_description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ALTER COLUMN "activity_timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "portal_activity_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "requirement_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "is_mandatory" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "accepted_file_types" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "collection_stage" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "collection_stage" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "submission_status" SET DEFAULT 'outstanding';--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "priority_level" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "priority_level" SET DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "target_company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ALTER COLUMN "min_file_size" SET DEFAULT 1024;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ALTER COLUMN "usage_metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ALTER COLUMN "detailed_analysis_status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ALTER COLUMN "detailed_analysis_status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ALTER COLUMN "detailed_analysis_usage_metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "promo_code_campaigns" ALTER COLUMN "post_free_period_coupon_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_invitations" ALTER COLUMN "expires_at" SET DEFAULT (NOW() + INTERVAL '7 days');--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "currency" SET DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE "deal_models" ALTER COLUMN "custom_fees" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_stage_updated_by_users_id_fk" FOREIGN KEY ("stage_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_initial_discussion_by_users_id_fk" FOREIGN KEY ("initial_discussion_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_deal_document_id_deal_documents_id_fk" FOREIGN KEY ("deal_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence" ADD CONSTRAINT "document_evidence_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence" ADD CONSTRAINT "document_evidence_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence" ADD CONSTRAINT "document_evidence_document_analysis_result_id_document_analysis_results_id_fk" FOREIGN KEY ("document_analysis_result_id") REFERENCES "public"."document_analysis_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence_period" ADD CONSTRAINT "document_evidence_period_document_evidence_id_document_evidence_id_fk" FOREIGN KEY ("document_evidence_id") REFERENCES "public"."document_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_evidence_figure" ADD CONSTRAINT "document_evidence_figure_document_evidence_period_id_document_evidence_period_id_fk" FOREIGN KEY ("document_evidence_period_id") REFERENCES "public"."document_evidence_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_company_id_user_companies_id_fk" FOREIGN KEY ("current_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_unsubscribes" ADD CONSTRAINT "marketing_unsubscribes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_acceptances" ADD CONSTRAINT "user_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nylas_grants" ADD CONSTRAINT "nylas_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nylas_grants" ADD CONSTRAINT "nylas_grants_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts_sent" ADD CONSTRAINT "broadcasts_sent_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_invoice_records" ADD CONSTRAINT "referral_invoice_records_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" ADD CONSTRAINT "marketing_consent_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" ADD CONSTRAINT "marketing_consent_tokens_waitlist_id_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_seller_payments" ADD CONSTRAINT "deal_model_seller_payments_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_contingent_consideration" ADD CONSTRAINT "deal_model_contingent_consideration_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_target_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_external_submission_id_external_document_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aged_debtors" ADD CONSTRAINT "aged_debtors_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aged_debtors" ADD CONSTRAINT "aged_debtors_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_sheets" ADD CONSTRAINT "balance_sheets_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_emails" ADD CONSTRAINT "chase_up_emails_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_emails" ADD CONSTRAINT "chase_up_emails_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_schedules" ADD CONSTRAINT "chase_up_schedules_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_schedules" ADD CONSTRAINT "chase_up_schedules_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chase_up_schedules" ADD CONSTRAINT "chase_up_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_submitted_document_id_external_document_submissions_id_fk" FOREIGN KEY ("submitted_document_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_submitted_by_contact_id_target_contacts_id_fk" FOREIGN KEY ("submitted_by_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_submissions" ADD CONSTRAINT "external_document_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "deal_document_responses" ADD CONSTRAINT "deal_document_responses_deal_document_id_deal_documents_id_fk" FOREIGN KEY ("deal_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_document_templates" ADD CONSTRAINT "deal_document_templates_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_metrics_snapshots" ADD CONSTRAINT "deal_metrics_snapshots_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD CONSTRAINT "deal_model_adjustments_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_adjustments" ADD CONSTRAINT "deal_model_adjustments_source_expert_result_id_expert_analysis_results_id_fk" FOREIGN KEY ("source_expert_result_id") REFERENCES "public"."expert_analysis_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_notes" ADD CONSTRAINT "deal_notes_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_notes" ADD CONSTRAINT "deal_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_log" ADD CONSTRAINT "document_access_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_log" ADD CONSTRAINT "document_access_log_accessed_by_users_id_fk" FOREIGN KEY ("accessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_analysis_results" ADD CONSTRAINT "document_analysis_results_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_analysis_results" ADD CONSTRAINT "document_analysis_results_file_upload_event_id_file_upload_events_id_fk" FOREIGN KEY ("file_upload_event_id") REFERENCES "public"."file_upload_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_upload_events" ADD CONSTRAINT "file_upload_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_upload_events" ADD CONSTRAINT "file_upload_events_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_upload_events" ADD CONSTRAINT "file_upload_events_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_stage_progression" ADD CONSTRAINT "document_stage_progression_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_stage_progression" ADD CONSTRAINT "document_stage_progression_stage_1_completed_by_users_id_fk" FOREIGN KEY ("stage_1_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_stage_progression" ADD CONSTRAINT "document_stage_progression_stage_2_completed_by_users_id_fk" FOREIGN KEY ("stage_2_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebitda_adjustments" ADD CONSTRAINT "ebitda_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_analysis_results" ADD CONSTRAINT "expert_analysis_results_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_analysis_results" ADD CONSTRAINT "expert_analysis_results_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets_register" ADD CONSTRAINT "fixed_assets_register_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets_register" ADD CONSTRAINT "fixed_assets_register_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_template_id_deal_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."deal_document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_model_funding_lines" ADD CONSTRAINT "deal_model_funding_lines_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_facilities" ADD CONSTRAINT "loan_facilities_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_costs" ADD CONSTRAINT "platform_costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ADD CONSTRAINT "portal_activity_log_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ADD CONSTRAINT "portal_activity_log_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_activity_log" ADD CONSTRAINT "portal_activity_log_related_document_id_external_document_submissions_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_analytics" ADD CONSTRAINT "portal_analytics_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_analytics" ADD CONSTRAINT "portal_analytics_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_analytics" ADD CONSTRAINT "portal_analytics_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_campaigns" ADD CONSTRAINT "portal_link_campaigns_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_campaigns" ADD CONSTRAINT "portal_link_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_communications_log" ADD CONSTRAINT "portal_communications_log_campaign_id_portal_link_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."portal_link_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_communications_log" ADD CONSTRAINT "portal_communications_log_target_contact_id_target_contacts_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."target_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ADD CONSTRAINT "portal_document_requirements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ADD CONSTRAINT "portal_document_requirements_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_document_requirements" ADD CONSTRAINT "portal_document_requirements_submitted_document_id_external_document_submissions_id_fk" FOREIGN KEY ("submitted_document_id") REFERENCES "public"."external_document_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_email_templates" ADD CONSTRAINT "portal_email_templates_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_email_templates" ADD CONSTRAINT "portal_email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_shares" ADD CONSTRAINT "portal_link_shares_portal_token_id_portal_access_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."portal_access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_link_shares" ADD CONSTRAINT "portal_link_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_data" ADD CONSTRAINT "staff_data_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ADD CONSTRAINT "stage1_analysis_events_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ADD CONSTRAINT "stage1_analysis_events_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage1_analysis_events" ADD CONSTRAINT "stage1_analysis_events_detailed_analysis_triggered_by_users_id_fk" FOREIGN KEY ("detailed_analysis_triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_memberships" ADD CONSTRAINT "user_company_memberships_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deal_assignments" ADD CONSTRAINT "user_deal_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deal_assignments" ADD CONSTRAINT "user_deal_assignments_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deal_assignments" ADD CONSTRAINT "user_deal_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_scenarios" ADD CONSTRAINT "value_creation_scenarios_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_assumptions" ADD CONSTRAINT "value_creation_assumptions_scenario_id_value_creation_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."value_creation_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_exit_assumptions" ADD CONSTRAINT "value_creation_exit_assumptions_deal_model_id_deal_models_id_fk" FOREIGN KEY ("deal_model_id") REFERENCES "public"."deal_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_creation_synergies" ADD CONSTRAINT "value_creation_synergies_scenario_id_value_creation_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."value_creation_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_campaigns" ADD CONSTRAINT "promo_code_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_company_id_user_companies_id_fk" FOREIGN KEY ("user_company_id") REFERENCES "public"."user_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_models" ADD CONSTRAINT "deal_models_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_models" ADD CONSTRAINT "deal_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_contributions" ADD CONSTRAINT "financial_contributions_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_contributions" ADD CONSTRAINT "financial_contributions_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_financial_period_id_financial_periods_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "public"."financial_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_statements" ADD CONSTRAINT "income_statements_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chase_up_emails_token_seq_unique" ON "chase_up_emails" USING btree ("portal_token_id","email_sequence_number");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "nylas_grants_one_company_default_per_company" ON "nylas_grants" USING btree ("user_company_id") WHERE "nylas_grants"."is_company_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "nylas_grants_one_personal_default_per_user" ON "nylas_grants" USING btree ("user_id") WHERE "nylas_grants"."is_personal_default" = true;--> statement-breakpoint
CREATE INDEX "nylas_grants_user_company_idx" ON "nylas_grants" USING btree ("user_company_id");--> statement-breakpoint
CREATE INDEX "nylas_grants_user_status_idx" ON "nylas_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "webhook_events_stripe_event_id_idx" ON "webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
ALTER TABLE "target_companies" DROP COLUMN "company_number";--> statement-breakpoint
ALTER TABLE "deal_documents" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "deal_model_funding_lines" DROP COLUMN "interest_as_ebitda_adjustment";--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_status_check" CHECK ("waitlist"."status" IN ('new','approved','invited','declined'));--> statement-breakpoint
ALTER TABLE "marketing_consent_tokens" ADD CONSTRAINT "marketing_consent_tokens_recipient_check" CHECK (("marketing_consent_tokens"."user_id" IS NOT NULL AND "marketing_consent_tokens"."waitlist_id" IS NULL) OR ("marketing_consent_tokens"."user_id" IS NULL AND "marketing_consent_tokens"."waitlist_id" IS NOT NULL));