ALTER TABLE "daily_manual_entry" ADD COLUMN "mood" integer;--> statement-breakpoint
ALTER TABLE "daily_manual_entry" ADD COLUMN "pre_workout_meal_logged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "training_program" ALTER COLUMN "cycle_length_weeks" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_session" DROP CONSTRAINT "workout_session_template_id_workout_template_id_fk";--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_template_id_day_type_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."day_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercise" RENAME TO "day_type_exercise";--> statement-breakpoint
ALTER TABLE "workout_template" RENAME TO "day_type";--> statement-breakpoint
ALTER TABLE "day_type" RENAME COLUMN "program_version_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "day_type_exercise" RENAME COLUMN "template_id" TO "day_type_id";--> statement-breakpoint
ALTER TABLE "day_type" DROP COLUMN "day_label";--> statement-breakpoint
ALTER TABLE "day_type" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "day_type" DROP CONSTRAINT IF EXISTS "workout_template_program_version_id_program_version_id_fk";--> statement-breakpoint
ALTER TABLE "day_type" ADD CONSTRAINT "day_type_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_type_exercise" DROP CONSTRAINT IF EXISTS "workout_template_exercise_template_id_workout_template_id_fk";--> statement-breakpoint
ALTER TABLE "day_type_exercise" ADD CONSTRAINT "day_type_exercise_day_type_id_day_type_id_fk" FOREIGN KEY ("day_type_id") REFERENCES "public"."day_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "workout_template_exercise_template_id_workout_template_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "program_schedule_slot";--> statement-breakpoint
CREATE TABLE "program_schedule_slot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "program_version_id" uuid NOT NULL,
  "day_type_id" uuid NOT NULL,
  "week_number" integer,
  "day_index" integer NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "program_schedule_slot" ADD CONSTRAINT "program_schedule_slot_program_version_id_program_version_id_fk" FOREIGN KEY ("program_version_id") REFERENCES "public"."program_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_slot" ADD CONSTRAINT "program_schedule_slot_day_type_id_day_type_id_fk" FOREIGN KEY ("day_type_id") REFERENCES "public"."day_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_schedule_slot_program_version_id_idx" ON "program_schedule_slot" USING btree ("program_version_id");--> statement-breakpoint
CREATE INDEX "program_schedule_slot_day_type_id_idx" ON "program_schedule_slot" USING btree ("day_type_id");--> statement-breakpoint
DROP TABLE IF EXISTS "schedule_override";--> statement-breakpoint
CREATE TABLE "schedule_override" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "day_type_id" uuid NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "schedule_override" ADD CONSTRAINT "schedule_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_override" ADD CONSTRAINT "schedule_override_day_type_id_day_type_id_fk" FOREIGN KEY ("day_type_id") REFERENCES "public"."day_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_override_user_id_date_key" ON "schedule_override" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "schedule_override_day_type_id_idx" ON "schedule_override" USING btree ("day_type_id");--> statement-breakpoint
CREATE INDEX "day_type_user_id_idx" ON "day_type" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "day_type_exercise_day_type_id_sort_order_idx" ON "day_type_exercise" USING btree ("day_type_id","sort_order");--> statement-breakpoint
