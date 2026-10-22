CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"path" text,
	"method" text,
	"digest" text,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "incidents_kind" CHECK ("incidents"."kind" IN ('server', 'client', 'check')),
	CONSTRAINT "incidents_count_positive" CHECK ("incidents"."count" >= 1)
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_staff_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_fingerprint_idx" ON "incidents" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "incidents_last_seen_idx" ON "incidents" USING btree ("last_seen_at");