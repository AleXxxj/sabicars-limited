CREATE TYPE "public"."partner_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."request_payment" AS ENUM('cash', 'drive_plan', 'undecided');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'matched', 'fulfilled', 'closed');--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE 'sourcing';--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"reach" text,
	"status" "partner_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_code_format" CHECK ("partners"."code" ~ '^[A-Z0-9]{6}$'),
	CONSTRAINT "partners_phone_e164" CHECK ("partners"."phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "partners_name_present" CHECK (length(btrim("partners"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "vehicle_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"want" text NOT NULL,
	"year_from" integer,
	"budget_max_minor" bigint,
	"payment" "request_payment" DEFAULT 'undecided' NOT NULL,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"last_matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_requests_want_present" CHECK (length(btrim("vehicle_requests"."want")) > 1),
	CONSTRAINT "vehicle_requests_year_range" CHECK ("vehicle_requests"."year_from" IS NULL OR "vehicle_requests"."year_from" BETWEEN 1980 AND 2100),
	CONSTRAINT "vehicle_requests_budget_positive" CHECK ("vehicle_requests"."budget_max_minor" IS NULL OR "vehicle_requests"."budget_max_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_requests" ADD CONSTRAINT "vehicle_requests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_code_idx" ON "partners" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_dealer_phone_idx" ON "partners" USING btree ("dealer_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_requests_lead_idx" ON "vehicle_requests" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "vehicle_requests_open_idx" ON "vehicle_requests" USING btree ("dealer_id","status","created_at");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;