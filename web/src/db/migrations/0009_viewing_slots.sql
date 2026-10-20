ALTER TABLE "leads" ADD COLUMN "viewing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "viewing_reminded_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "leads_viewing_idx" ON "leads" USING btree ("dealer_id","viewing_at");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_viewing_time_only_on_viewings" CHECK ("leads"."viewing_at" IS NULL OR "leads"."type" = 'viewing');