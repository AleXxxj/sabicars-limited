CREATE TYPE "public"."dealer_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."drivetrain_type" AS ENUM('fwd', 'rwd', 'awd', '4wd');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'hybrid', 'electric', 'cng', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_channel" AS ENUM('web_form', 'assistant', 'phone', 'walk_in', 'whatsapp', 'legacy_import');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('question', 'viewing', 'reservation', 'drive_plan', 'fleet', 'contact');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'video');--> statement-breakpoint
CREATE TYPE "public"."owner_kind" AS ENUM('dealer', 'consignor');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'manager', 'sales');--> statement-breakpoint
CREATE TYPE "public"."transmission_type" AS ENUM('automatic', 'manual', 'other');--> statement-breakpoint
CREATE TYPE "public"."vehicle_badge" AS ENUM('hot', 'premium', 'fleet_supply');--> statement-breakpoint
CREATE TYPE "public"."vehicle_body" AS ENUM('sedan', 'suv', 'bus', 'van', 'pickup', 'truck', 'coupe', 'hatchback', 'wagon', 'convertible', 'other');--> statement-breakpoint
CREATE TYPE "public"."vehicle_condition" AS ENUM('foreign_used', 'nigerian_used', 'brand_new');--> statement-breakpoint
CREATE TYPE "public"."vehicle_segment" AS ENUM('standard', 'luxury', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('draft', 'available', 'reserved', 'sold', 'unlisted');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid,
	"actor_id" uuid,
	"actor_email" text,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"legacy_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"cover_image_url" text,
	"author" text DEFAULT 'Sabicars Team' NOT NULL,
	"read_minutes" integer,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"reactions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_published_has_date" CHECK (NOT "blog_posts"."is_published" OR "blog_posts"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "consignors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"country" text,
	"commission_bps" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consignors_commission_range" CHECK ("consignors"."commission_bps" IS NULL OR "consignors"."commission_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"rc_number" text,
	"status" "dealer_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dealers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"legacy_id" text,
	"type" "lead_type" NOT NULL,
	"channel" "lead_channel" NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"vehicle_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"message" text,
	"preferred_contact" text,
	"landing_path" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"partner_id" uuid,
	"assigned_to" uuid,
	"first_response_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"lost_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_reachable" CHECK ("leads"."phone" IS NOT NULL OR "leads"."email" IS NOT NULL),
	CONSTRAINT "leads_name_present" CHECK (length(btrim("leads"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text,
	"phone" text,
	"hours" jsonb,
	"latitude" text,
	"longitude" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"kind" text DEFAULT 'system' NOT NULL,
	"link" text,
	"vehicle_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"location" text,
	"rating" integer NOT NULL,
	"message" text NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"dealer_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dealer_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"phone" text,
	"role" "staff_role" DEFAULT 'sales' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"legacy_id" text,
	"email" text NOT NULL,
	"name" text,
	"topics" jsonb DEFAULT '["cars","blog","offers"]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "media_kind" DEFAULT 'photo' NOT NULL,
	"url" text NOT NULL,
	"cloudinary_public_id" text,
	"position" integer NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_media_position_nonnegative" CHECK ("vehicle_media"."position" >= 0),
	CONSTRAINT "vehicle_media_https" CHECK ("vehicle_media"."url" ~ '^https://')
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"legacy_id" text,
	"owner_kind" "owner_kind" DEFAULT 'dealer' NOT NULL,
	"consignor_id" uuid,
	"custodian_staff_id" uuid,
	"location_id" uuid,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"trim" text,
	"year" integer NOT NULL,
	"body" "vehicle_body",
	"segment" "vehicle_segment" DEFAULT 'standard' NOT NULL,
	"condition" "vehicle_condition" NOT NULL,
	"chassis_no" text,
	"mileage_km" integer,
	"fuel" "fuel_type",
	"transmission" "transmission_type",
	"transmission_detail" text,
	"drivetrain" "drivetrain_type",
	"engine" text,
	"horsepower" integer,
	"exterior_colour" text,
	"interior_colour" text,
	"seats" integer,
	"price_minor" bigint,
	"was_price_minor" bigint,
	"status" "vehicle_status" DEFAULT 'draft' NOT NULL,
	"badge" "vehicle_badge",
	"is_featured" boolean DEFAULT false NOT NULL,
	"in_hero" boolean DEFAULT false NOT NULL,
	"slug" text NOT NULL,
	"headline" text,
	"description" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	CONSTRAINT "vehicles_year_range" CHECK ("vehicles"."year" BETWEEN 1950 AND 2100),
	CONSTRAINT "vehicles_price_positive" CHECK ("vehicles"."price_minor" IS NULL OR "vehicles"."price_minor" > 0),
	CONSTRAINT "vehicles_was_price_higher" CHECK ("vehicles"."was_price_minor" IS NULL OR ("vehicles"."price_minor" IS NOT NULL AND "vehicles"."was_price_minor" > "vehicles"."price_minor")),
	CONSTRAINT "vehicles_mileage_range" CHECK ("vehicles"."mileage_km" IS NULL OR "vehicles"."mileage_km" BETWEEN 0 AND 2000000),
	CONSTRAINT "vehicles_seats_range" CHECK ("vehicles"."seats" IS NULL OR "vehicles"."seats" BETWEEN 1 AND 80),
	CONSTRAINT "vehicles_horsepower_range" CHECK ("vehicles"."horsepower" IS NULL OR "vehicles"."horsepower" BETWEEN 20 AND 2500),
	CONSTRAINT "vehicles_consignor_matches_owner" CHECK (("vehicles"."owner_kind" = 'consignor') = ("vehicles"."consignor_id" IS NOT NULL)),
	CONSTRAINT "vehicles_sold_has_date" CHECK ("vehicles"."status" <> 'sold' OR "vehicles"."sold_at" IS NOT NULL),
	CONSTRAINT "vehicles_slug_format" CHECK ("vehicles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignors" ADD CONSTRAINT "consignors_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_staff_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_media" ADD CONSTRAINT "vehicle_media_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_consignor_id_consignors_id_fk" FOREIGN KEY ("consignor_id") REFERENCES "public"."consignors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_custodian_staff_id_staff_id_fk" FOREIGN KEY ("custodian_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_comments_legacy_idx" ON "blog_comments" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_dealer_slug_idx" ON "blog_posts" USING btree ("dealer_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_legacy_idx" ON "blog_posts" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "consignors_dealer_idx" ON "consignors" USING btree ("dealer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_legacy_idx" ON "leads" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "leads_dealer_status_idx" ON "leads" USING btree ("dealer_id","status","created_at");--> statement-breakpoint
CREATE INDEX "leads_assigned_idx" ON "leads" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE INDEX "locations_dealer_idx" ON "locations" USING btree ("dealer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_legacy_idx" ON "notifications" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "notifications_recent_idx" ON "notifications" USING btree ("dealer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_legacy_idx" ON "reviews" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_dealer_key_idx" ON "settings" USING btree ("dealer_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_idx" ON "staff" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "staff_dealer_idx" ON "staff" USING btree ("dealer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_dealer_email_idx" ON "subscribers" USING btree ("dealer_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_legacy_idx" ON "subscribers" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_token_idx" ON "subscribers" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_media_position_idx" ON "vehicle_media" USING btree ("vehicle_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_dealer_slug_idx" ON "vehicles" USING btree ("dealer_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_legacy_idx" ON "vehicles" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "vehicles_dealer_status_idx" ON "vehicles" USING btree ("dealer_id","status");--> statement-breakpoint
CREATE INDEX "vehicles_make_model_idx" ON "vehicles" USING btree ("make","model");--> statement-breakpoint
CREATE INDEX "vehicles_price_idx" ON "vehicles" USING btree ("price_minor");