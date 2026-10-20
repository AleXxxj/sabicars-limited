CREATE TYPE "public"."history_title" AS ENUM('clean', 'salvage', 'rebuilt', 'flood', 'other', 'no_record');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('draft', 'published', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "inspection_status" DEFAULT 'draft' NOT NULL,
	"inspected_at" timestamp with time zone,
	"inspector_name" text,
	"odometer_km" integer,
	"vin" text,
	"summary" text,
	"items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"history_source" text,
	"history_checked_at" timestamp with time zone,
	"history_title" "history_title",
	"history_accidents" integer,
	"history_last_odometer_km" integer,
	"history_notes" text,
	"created_by" uuid,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "inspections_code_format" CHECK ("inspections"."code" ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),
	CONSTRAINT "inspections_odometer_range" CHECK ("inspections"."odometer_km" IS NULL OR "inspections"."odometer_km" BETWEEN 0 AND 2000000),
	CONSTRAINT "inspections_history_odometer_range" CHECK ("inspections"."history_last_odometer_km" IS NULL OR "inspections"."history_last_odometer_km" BETWEEN 0 AND 2000000),
	CONSTRAINT "inspections_history_accidents_range" CHECK ("inspections"."history_accidents" IS NULL OR "inspections"."history_accidents" BETWEEN 0 AND 50),
	CONSTRAINT "inspections_published_complete" CHECK ("inspections"."status" IN ('draft', 'withdrawn') OR ("inspections"."inspected_at" IS NOT NULL AND "inspections"."inspector_name" IS NOT NULL AND length(btrim("inspections"."inspector_name")) > 0 AND "inspections"."odometer_km" IS NOT NULL AND "inspections"."published_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_published_by_staff_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inspections_code_idx" ON "inspections" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "inspections_one_published_idx" ON "inspections" USING btree ("vehicle_id") WHERE "inspections"."status" = 'published';--> statement-breakpoint
CREATE INDEX "inspections_vehicle_idx" ON "inspections" USING btree ("vehicle_id","created_at");