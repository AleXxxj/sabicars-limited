ALTER TYPE "public"."lead_type" ADD VALUE 'watch';--> statement-breakpoint
CREATE TABLE "vehicle_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"known_price_minor" bigint,
	"pending_price_minor" bigint,
	"alert_status" "match_status",
	"alert_channel" text,
	"alerted_at" timestamp with time zone,
	"alert_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_watches_sent_has_date" CHECK ("vehicle_watches"."alert_status" IS DISTINCT FROM 'sent' OR "vehicle_watches"."alerted_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "autochek_url" text;--> statement-breakpoint
ALTER TABLE "vehicle_watches" ADD CONSTRAINT "vehicle_watches_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_watches" ADD CONSTRAINT "vehicle_watches_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_watches" ADD CONSTRAINT "vehicle_watches_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_watches_lead_vehicle_idx" ON "vehicle_watches" USING btree ("lead_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_watches_vehicle_idx" ON "vehicle_watches" USING btree ("vehicle_id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_autochek_https" CHECK ("vehicles"."autochek_url" IS NULL OR "vehicles"."autochek_url" LIKE 'https://%');