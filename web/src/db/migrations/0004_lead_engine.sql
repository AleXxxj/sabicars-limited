CREATE TYPE "public"."lead_activity_kind" AS ENUM('alerted', 'claimed', 'assigned', 'status', 'contacted', 'note', 'escalated');--> statement-breakpoint
CREATE TABLE "lead_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"staff_id" uuid,
	"kind" "lead_activity_kind" NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_https" CHECK ("push_subscriptions"."endpoint" LIKE 'https://%')
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "receives_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activity_lead_idx" ON "lead_activity" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_staff_idx" ON "push_subscriptions" USING btree ("staff_id");