CREATE TABLE "day_type_exercise_planned_set" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "day_type_exercise_id" uuid NOT NULL,
  "sort_order" integer NOT NULL,
  "set_type" "set_type" NOT NULL,
  "reps" integer,
  "reps_max" integer,
  "load_value" numeric,
  "load_unit" "load_unit",
  "duration_seconds" integer,
  "distance_value" numeric,
  "distance_unit" "distance_unit",
  "rpe" numeric,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "day_type_exercise_planned_set" ADD CONSTRAINT "day_type_exercise_planned_set_day_type_exercise_id_day_type_exercise_id_fk" FOREIGN KEY ("day_type_exercise_id") REFERENCES "public"."day_type_exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_type_exercise_planned_set_day_type_exercise_id_sort_order_idx" ON "day_type_exercise_planned_set" USING btree ("day_type_exercise_id", "sort_order");
