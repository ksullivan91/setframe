CREATE TYPE "public"."additional_activity_type" AS ENUM('walk', 'yoga', 'mobility', 'foam_rolling', 'outdoor_cycle', 'indoor_cycle', 'run', 'stretching', 'other');--> statement-breakpoint
CREATE TYPE "public"."additional_activity_source" AS ENUM('manual', 'apple_health');--> statement-breakpoint
CREATE TABLE "additional_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "local_date" date NOT NULL,
  "timezone" text NOT NULL,
  "started_at" timestamp with time zone,
  "duration_seconds" integer,
  "activity_type" "additional_activity_type" NOT NULL,
  "source" "additional_activity_source" DEFAULT 'manual' NOT NULL,
  "title" text,
  "distance_value" numeric,
  "distance_unit" "distance_unit",
  "calories_kcal" numeric,
  "notes" text,
  "external_source_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "additional_activity" ADD CONSTRAINT "additional_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "additional_activity_user_id_source_external_id_key" ON "additional_activity" USING btree ("user_id", "source", "external_source_id");--> statement-breakpoint
CREATE INDEX "additional_activity_user_id_local_date_idx" ON "additional_activity" USING btree ("user_id", "local_date");
