ALTER TABLE "assistant_messages" DROP CONSTRAINT "assistant_messages_role";--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_role" CHECK ("assistant_messages"."role" IN ('user', 'assistant', 'staff'));--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD COLUMN "mode" text DEFAULT 'assistant' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_mode" CHECK ("assistant_conversations"."mode" IN ('assistant', 'seller'));--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD COLUMN "awaiting_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD COLUMN "last_staff_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD COLUMN "staff_alerted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "assistant_conversations_awaiting_idx" ON "assistant_conversations" USING btree ("dealer_id","awaiting_since") WHERE "assistant_conversations"."awaiting_since" IS NOT NULL;
