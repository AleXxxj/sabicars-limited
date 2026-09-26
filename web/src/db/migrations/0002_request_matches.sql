CREATE TYPE "public"."match_status" AS ENUM('pending', 'sent', 'failed', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'sourcing' BEFORE 'matched';--> statement-breakpoint
CREATE TABLE "request_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"channel" text,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_matches_sent_has_date" CHECK ("request_matches"."status" <> 'sent' OR "request_matches"."sent_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "vehicle_requests" ADD COLUMN "staff_note" text;--> statement-breakpoint
ALTER TABLE "request_matches" ADD CONSTRAINT "request_matches_request_id_vehicle_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."vehicle_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_matches" ADD CONSTRAINT "request_matches_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "request_matches_pair_idx" ON "request_matches" USING btree ("request_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "request_matches_status_idx" ON "request_matches" USING btree ("status","created_at");