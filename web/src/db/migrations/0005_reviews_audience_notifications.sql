ALTER TYPE "public"."lead_activity_kind" ADD VALUE 'review_requested';--> statement-breakpoint
ALTER TYPE "public"."lead_activity_kind" ADD VALUE 'reviewed';--> statement-breakpoint
CREATE TABLE "newsletter_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period_key" text,
	"subject" text NOT NULL,
	"body" text,
	"vehicle_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "newsletter_sends_kind" CHECK ("newsletter_sends"."kind" IN ('digest', 'article', 'broadcast')),
	CONSTRAINT "newsletter_sends_status" CHECK ("newsletter_sends"."status" IN ('sending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "review_token" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "event_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "push_recipients" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "push_error" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "newsletter_sends" ADD CONSTRAINT "newsletter_sends_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_sends" ADD CONSTRAINT "newsletter_sends_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_sends_period_idx" ON "newsletter_sends" USING btree ("dealer_id","period_key");--> statement-breakpoint
CREATE INDEX "newsletter_sends_recent_idx" ON "newsletter_sends" USING btree ("dealer_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewed_by_staff_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_review_token_idx" ON "leads" USING btree ("review_token");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_idx" ON "notifications" USING btree ("dealer_id","event_key");--> statement-breakpoint
CREATE INDEX "notifications_vehicle_idx" ON "notifications" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_lead_idx" ON "reviews" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "reviews_published_idx" ON "reviews" USING btree ("dealer_id","is_approved","created_at");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_message_present" CHECK (length(btrim("reviews"."message")) > 0);--> statement-breakpoint
-- Reviews already live on the old site were published there; they are not waiting for anyone.
UPDATE "reviews" SET "reviewed_at" = "created_at" WHERE "is_approved" AND "reviewed_at" IS NULL;--> statement-breakpoint
UPDATE "subscribers" SET "source" = 'legacy' WHERE "legacy_id" IS NOT NULL AND "source" IS NULL;
