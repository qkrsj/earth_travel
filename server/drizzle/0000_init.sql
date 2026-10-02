CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"population" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_visits" (
	"user_id" uuid NOT NULL,
	"city_id" integer NOT NULL,
	"country_code" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_visits_user_id_city_id_pk" PRIMARY KEY("user_id","city_id")
);
--> statement-breakpoint
CREATE TABLE "country_visits" (
	"user_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"visit_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "country_visits_user_id_country_code_pk" PRIMARY KEY("user_id","country_code")
);
--> statement-breakpoint
CREATE TABLE "record_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"day" integer,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"city_id" integer NOT NULL,
	"country_code" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"trip_start" date,
	"trip_end" date,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "city_visits" ADD CONSTRAINT "city_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_visits" ADD CONSTRAINT "city_visits_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_visits" ADD CONSTRAINT "country_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_photos" ADD CONSTRAINT "record_photos_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_stops" ADD CONSTRAINT "record_stops_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cities_country_idx" ON "cities" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "city_visits_user_country_idx" ON "city_visits" USING btree ("user_id","country_code");--> statement-breakpoint
CREATE INDEX "record_photos_record_idx" ON "record_photos" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_stops_record_idx" ON "record_stops" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "records_user_city_idx" ON "records" USING btree ("user_id","city_id");--> statement-breakpoint
CREATE INDEX "records_public_city_idx" ON "records" USING btree ("visibility","city_id","created_at");--> statement-breakpoint
CREATE INDEX "records_public_country_idx" ON "records" USING btree ("visibility","country_code","created_at");