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
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_status_check" CHECK ("waitlist"."status" IN ('new','approved','invited','declined'))
);
--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");