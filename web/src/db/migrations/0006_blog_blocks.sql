ALTER TABLE "blog_posts" ALTER COLUMN "content" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "blog_comments" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "standfirst" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "cover_video_url" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "announced_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "blog_comments_post_idx" ON "blog_comments" USING btree ("post_id","is_approved");--> statement-breakpoint
-- Comments already live on the old site were published there; posts already published there were announced there.
UPDATE "blog_comments" SET "reviewed_at" = "created_at" WHERE "is_approved" AND "reviewed_at" IS NULL;--> statement-breakpoint
UPDATE "blog_posts" SET "announced_at" = "published_at" WHERE "is_published" AND "legacy_id" IS NOT NULL AND "announced_at" IS NULL;
