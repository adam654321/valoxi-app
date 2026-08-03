ALTER TABLE "canonical_figure" DROP CONSTRAINT "canonical_figure_period_field_unique";--> statement-breakpoint
ALTER TABLE "canonical_figure" ADD COLUMN "figure_path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "canonical_figure" ADD CONSTRAINT "canonical_figure_period_path_unique" UNIQUE("canonical_period_id","figure_path");