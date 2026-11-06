ALTER TABLE "partners" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pin_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pin_failed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pin_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pin_reset_hash" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pin_reset_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_pin_format" CHECK ("partners"."pin_hash" IS NULL OR "partners"."pin_hash" LIKE 'scrypt$%');--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_pin_set_together" CHECK (("partners"."pin_hash" IS NULL) = ("partners"."pin_set_at" IS NULL));--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_pin_failures" CHECK ("partners"."pin_failed_count" >= 0);--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_pin_reset_together" CHECK (("partners"."pin_reset_hash" IS NULL) = ("partners"."pin_reset_expires_at" IS NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "partners_pin_reset_idx" ON "partners" USING btree ("pin_reset_hash") WHERE "partners"."pin_reset_hash" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "partner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "partner_sessions_expiry" CHECK ("partner_sessions"."expires_at" > "partner_sessions"."created_at")
);--> statement-breakpoint
ALTER TABLE "partner_sessions" ADD CONSTRAINT "partner_sessions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_sessions_token_idx" ON "partner_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "partner_sessions_partner_idx" ON "partner_sessions" USING btree ("partner_id");
