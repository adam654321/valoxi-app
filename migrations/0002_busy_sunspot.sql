CREATE TABLE "canonical_figure" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_period_id" integer NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"value" numeric,
	"source_evidence_figure_id" integer,
	CONSTRAINT "canonical_figure_period_field_unique" UNIQUE("canonical_period_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "canonical_gap" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_run_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"fiscal_year" integer,
	"gap_kind" varchar(40) NOT NULL,
	"detail" jsonb,
	"unlocked_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_period" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_run_id" integer NOT NULL,
	"target_company_id" integer NOT NULL,
	"fiscal_year" integer NOT NULL,
	"statement_type" varchar(10) NOT NULL,
	"span_kind" varchar(12) NOT NULL,
	"period_start" date,
	"period_end" date,
	"months_covered" integer,
	"is_full_year_provisional" boolean DEFAULT true NOT NULL,
	"trust_state" varchar(20) NOT NULL,
	"valuation_eligible" boolean DEFAULT false NOT NULL,
	"anchor_complete" boolean DEFAULT false NOT NULL,
	"winning_evidence_id" integer,
	"winning_period_id" integer,
	"superseded_evidence_ids" integer[],
	"conflict_detail" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_period_run_company_year_stmt_span_unique" UNIQUE("canonical_run_id","target_company_id","fiscal_year","statement_type","span_kind")
);
--> statement-breakpoint
CREATE TABLE "canonical_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_company_id" integer NOT NULL,
	"resolver_version" integer NOT NULL,
	"as_of_date" date NOT NULL,
	"input_fingerprint" text NOT NULL,
	"output_fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canonical_figure" ADD CONSTRAINT "canonical_figure_canonical_period_id_canonical_period_id_fk" FOREIGN KEY ("canonical_period_id") REFERENCES "public"."canonical_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_figure" ADD CONSTRAINT "canonical_figure_source_evidence_figure_id_document_evidence_figure_id_fk" FOREIGN KEY ("source_evidence_figure_id") REFERENCES "public"."document_evidence_figure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_gap" ADD CONSTRAINT "canonical_gap_canonical_run_id_canonical_run_id_fk" FOREIGN KEY ("canonical_run_id") REFERENCES "public"."canonical_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_gap" ADD CONSTRAINT "canonical_gap_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_period" ADD CONSTRAINT "canonical_period_canonical_run_id_canonical_run_id_fk" FOREIGN KEY ("canonical_run_id") REFERENCES "public"."canonical_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_period" ADD CONSTRAINT "canonical_period_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_period" ADD CONSTRAINT "canonical_period_winning_evidence_id_document_evidence_id_fk" FOREIGN KEY ("winning_evidence_id") REFERENCES "public"."document_evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_period" ADD CONSTRAINT "canonical_period_winning_period_id_document_evidence_period_id_fk" FOREIGN KEY ("winning_period_id") REFERENCES "public"."document_evidence_period"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_run" ADD CONSTRAINT "canonical_run_target_company_id_target_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."target_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canonical_run_company_idx" ON "canonical_run" USING btree ("target_company_id","created_at");