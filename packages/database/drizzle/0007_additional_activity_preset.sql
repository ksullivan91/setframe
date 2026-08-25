CREATE TABLE "additional_activity_preset" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "activity_type" "additional_activity_type" NOT NULL,
  "default_duration_seconds" integer,
  "default_distance_value" numeric,
  "default_distance_unit" "distance_unit",
  "default_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "additional_activity_preset" ADD CONSTRAINT "additional_activity_preset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "additional_activity_preset_user_id_idx" ON "additional_activity_preset" USING btree ("user_id");
