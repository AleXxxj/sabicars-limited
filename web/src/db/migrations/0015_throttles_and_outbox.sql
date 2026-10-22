CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"reply_to" text,
	"headers" jsonb,
	"dedupe_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"last_error" text,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_status" CHECK ("email_outbox"."status" IN ('pending', 'sending', 'sent', 'failed', 'expired')),
	CONSTRAINT "email_outbox_sent_has_date" CHECK ("email_outbox"."status" <> 'sent' OR "email_outbox"."sent_at" IS NOT NULL),
	CONSTRAINT "email_outbox_attempts_range" CHECK ("email_outbox"."attempts" BETWEEN 0 AND 50)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_bucket_key_hash_window_start_pk" PRIMARY KEY("bucket","key_hash","window_start"),
	CONSTRAINT "rate_limits_count_positive" CHECK ("rate_limits"."count" >= 1),
	CONSTRAINT "rate_limits_key_hash_format" CHECK ("rate_limits"."key_hash" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedupe_idx" ON "email_outbox" USING btree ("dedupe_key") WHERE "email_outbox"."dedupe_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "email_outbox_due_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");