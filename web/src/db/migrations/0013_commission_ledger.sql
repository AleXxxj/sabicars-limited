CREATE TYPE "public"."commission_status" AS ENUM('pending', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed', 'reversed');--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"lead_id" uuid,
	"source" text NOT NULL,
	"sale_price_minor" bigint NOT NULL,
	"rate_bps" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"earned_at" timestamp with time zone NOT NULL,
	"payable_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_source" CHECK ("commissions"."source" IN ('link', 'manual')),
	CONSTRAINT "commissions_sale_positive" CHECK ("commissions"."sale_price_minor" > 0),
	CONSTRAINT "commissions_amount_positive" CHECK ("commissions"."amount_minor" > 0),
	CONSTRAINT "commissions_rate_range" CHECK ("commissions"."rate_bps" BETWEEN 1 AND 2000),
	CONSTRAINT "commissions_cooling_off" CHECK ("commissions"."payable_at" >= "commissions"."earned_at"),
	CONSTRAINT "commissions_paid_has_date" CHECK ("commissions"."status" <> 'paid' OR "commissions"."paid_at" IS NOT NULL),
	CONSTRAINT "commissions_void_has_reason" CHECK ("commissions"."status" <> 'void' OR ("commissions"."voided_at" IS NOT NULL AND "commissions"."void_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"commission_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"method" text NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"reference" text NOT NULL,
	"transfer_code" text,
	"fee_minor" bigint,
	"bank_reference" text,
	"bank_name" text,
	"account_number" text,
	"account_name" text,
	"failure_reason" text,
	"paid_at" timestamp with time zone,
	"recorded_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_method" CHECK ("payouts"."method" IN ('paystack', 'bank_transfer')),
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount_minor" > 0),
	CONSTRAINT "payouts_reference_format" CHECK ("payouts"."reference" ~ '^scp_[a-z0-9]{8}_[a-z0-9]{8}$'),
	CONSTRAINT "payouts_paid_has_date" CHECK ("payouts"."status" <> 'paid' OR "payouts"."paid_at" IS NOT NULL),
	CONSTRAINT "payouts_manual_has_bank_reference" CHECK ("payouts"."method" <> 'bank_transfer' OR "payouts"."bank_reference" IS NOT NULL),
	CONSTRAINT "payouts_failed_has_reason" CHECK ("payouts"."status" NOT IN ('failed', 'reversed') OR "payouts"."failure_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "access_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "bank_code" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "account_name" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "account_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "account_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "paystack_recipient_code" text;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recorded_by_staff_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commissions_one_per_vehicle_idx" ON "commissions" USING btree ("vehicle_id") WHERE "commissions"."status" <> 'void';--> statement-breakpoint
CREATE INDEX "commissions_partner_idx" ON "commissions" USING btree ("partner_id","created_at");--> statement-breakpoint
CREATE INDEX "commissions_dealer_status_idx" ON "commissions" USING btree ("dealer_id","status","payable_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_reference_idx" ON "payouts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_transfer_code_idx" ON "payouts" USING btree ("transfer_code") WHERE "payouts"."transfer_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_one_live_per_commission_idx" ON "payouts" USING btree ("commission_id") WHERE "payouts"."status" IN ('pending', 'processing', 'paid');--> statement-breakpoint
CREATE INDEX "payouts_partner_idx" ON "payouts" USING btree ("partner_id","created_at");--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_account_verified_by_staff_id_fk" FOREIGN KEY ("account_verified_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_access_token_idx" ON "partners" USING btree ("access_token");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_recipient_idx" ON "partners" USING btree ("paystack_recipient_code") WHERE "partners"."paystack_recipient_code" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_account_nuban" CHECK ("partners"."account_number" IS NULL OR "partners"."account_number" ~ '^[0-9]{10}$');--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_account_complete" CHECK (("partners"."account_number" IS NULL AND "partners"."bank_code" IS NULL AND "partners"."account_verified_at" IS NULL AND "partners"."paystack_recipient_code" IS NULL) OR ("partners"."account_number" IS NOT NULL AND "partners"."bank_code" IS NOT NULL AND "partners"."bank_name" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_recipient_needs_verification" CHECK ("partners"."paystack_recipient_code" IS NULL OR "partners"."account_verified_at" IS NOT NULL);