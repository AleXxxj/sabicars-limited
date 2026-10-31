CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'held', 'expired', 'completed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"lead_id" uuid,
	"buyer_name" text NOT NULL,
	"buyer_phone" text NOT NULL,
	"buyer_email" text,
	"amount_minor" bigint NOT NULL,
	"price_minor" bigint NOT NULL,
	"hold_days" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"reference" text NOT NULL,
	"source" text DEFAULT 'online' NOT NULL,
	"channel" text,
	"fee_minor" bigint,
	"paid_at" timestamp with time zone,
	"holds_until" timestamp with time zone,
	"refund_minor" bigint,
	"refunded_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_source" CHECK ("reservations"."source" IN ('online', 'showroom')),
	CONSTRAINT "reservations_amount_positive" CHECK ("reservations"."amount_minor" > 0),
	CONSTRAINT "reservations_amount_within_price" CHECK ("reservations"."amount_minor" <= "reservations"."price_minor"),
	CONSTRAINT "reservations_hold_days" CHECK ("reservations"."hold_days" BETWEEN 1 AND 31),
	CONSTRAINT "reservations_held_has_dates" CHECK ("reservations"."status" NOT IN ('held', 'completed', 'expired', 'refunded') OR ("reservations"."paid_at" IS NOT NULL AND "reservations"."holds_until" IS NOT NULL)),
	CONSTRAINT "reservations_refund_has_amount" CHECK ("reservations"."status" <> 'refunded' OR ("reservations"."refunded_at" IS NOT NULL AND "reservations"."refund_minor" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_reference_idx" ON "reservations" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_one_per_vehicle_idx" ON "reservations" USING btree ("vehicle_id") WHERE "reservations"."status" IN ('pending', 'held');--> statement-breakpoint
CREATE INDEX "reservations_dealer_status_idx" ON "reservations" USING btree ("dealer_id","status","created_at");
