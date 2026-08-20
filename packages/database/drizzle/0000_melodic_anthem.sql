CREATE TYPE "public"."distance_unit" AS ENUM('m', 'km', 'mi');--> statement-breakpoint
CREATE TYPE "public"."integration_sync_state_status" AS ENUM('ok', 'error', 'never_synced');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('apple_health');--> statement-breakpoint
CREATE TYPE "public"."load_unit" AS ENUM('lb', 'kg');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."preferred_units" AS ENUM('imperial', 'metric');--> statement-breakpoint
CREATE TYPE "public"."progression_rule_type" AS ENUM('manual', 'double_progression', 'linear');--> statement-breakpoint
CREATE TYPE "public"."set_side" AS ENUM('left', 'right', 'both');--> statement-breakpoint
CREATE TYPE "public"."set_type" AS ENUM('warmup', 'working', 'top', 'backoff', 'drop', 'failure', 'bodyweight', 'timed', 'distance');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('missing', 'partial', 'complete', 'stale', 'unavailable', 'error');--> statement-breakpoint
CREATE TYPE "public"."workout_session_status" AS ENUM('planned', 'in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"display_name" text,
	"preferred_units" "preferred_units" DEFAULT 'imperial' NOT NULL,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_reminders_enabled" boolean DEFAULT true NOT NULL,
	"weekly_summary_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"canonical_slug" text,
	"movement_pattern" text,
	"equipment" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"muscle_group_id" uuid NOT NULL,
	"role" "muscle_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muscle_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_program_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "progression_rule_type" NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"cycle_length_weeks" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_version_id" uuid NOT NULL,
	"name" text NOT NULL,
	"day_label" text,
	"sort_order" integer NOT NULL,
	"description" text,
	"estimated_duration_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_template_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"prescription" jsonb NOT NULL,
	"progression_rule_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercise_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"exercise_name_snapshot" text NOT NULL,
	"sort_order" integer NOT NULL,
	"prescription_snapshot" jsonb,
	"notes" text,
	"skipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"program_id" uuid,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" "workout_session_status" NOT NULL,
	"session_name_snapshot" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_log_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"set_type" "set_type" NOT NULL,
	"load_value" numeric,
	"load_unit" "load_unit",
	"reps" integer,
	"duration_seconds" integer,
	"distance_value" numeric,
	"distance_unit" "distance_unit",
	"rir" numeric,
	"rpe" numeric,
	"side" "set_side",
	"completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_manual_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"morning_weight_value" numeric,
	"morning_weight_unit" "load_unit",
	"systolic_bp" integer,
	"diastolic_bp" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_activity_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"sync_status" "sync_status" NOT NULL,
	"synced_through" timestamp with time zone,
	"reconciled_at" timestamp with time zone,
	"steps" integer,
	"walking_running_distance_m" numeric,
	"active_energy_kcal" numeric,
	"exercise_minutes" integer,
	"stand_minutes" integer,
	"flights_climbed" integer,
	"move_actual_kcal" numeric,
	"move_goal_kcal" numeric,
	"exercise_actual_minutes" integer,
	"exercise_goal_minutes" integer,
	"stand_actual_hours" integer,
	"stand_goal_hours" integer,
	"resting_heart_rate" numeric,
	"walking_heart_rate_avg" numeric,
	"hrv_sdnn_ms" numeric,
	"vo2_max" numeric,
	"weight_value" numeric,
	"weight_unit" "load_unit",
	"body_fat_percentage" numeric,
	"sleep_total_minutes" numeric,
	"source_provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_nutrition_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"sync_status" "sync_status" NOT NULL,
	"synced_through" timestamp with time zone,
	"reconciled_at" timestamp with time zone,
	"calories_kcal" numeric,
	"protein_g" numeric,
	"carbs_g" numeric,
	"fat_g" numeric,
	"fiber_g" numeric,
	"saturated_fat_g" numeric,
	"sugar_g" numeric,
	"sodium_mg" numeric,
	"potassium_mg" numeric,
	"cholesterol_mg" numeric,
	"source_provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"integration_type" "integration_type" NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"latest_complete_local_date" date,
	"last_foreground_reconciliation_at" timestamp with time zone,
	"last_background_reconciliation_at" timestamp with time zone,
	"status" "integration_sync_state_status" NOT NULL,
	"last_error_code" text,
	"last_error_message_redacted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle" ADD CONSTRAINT "exercise_muscle_muscle_group_id_muscle_group_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_version" ADD CONSTRAINT "program_version_training_program_id_training_program_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "public"."training_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program" ADD CONSTRAINT "training_program_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template" ADD CONSTRAINT "workout_template_program_version_id_program_version_id_fk" FOREIGN KEY ("program_version_id") REFERENCES "public"."program_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercise" ADD CONSTRAINT "workout_template_exercise_template_id_workout_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercise" ADD CONSTRAINT "workout_template_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercise" ADD CONSTRAINT "workout_template_exercise_progression_rule_id_progression_rule_id_fk" FOREIGN KEY ("progression_rule_id") REFERENCES "public"."progression_rule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise_log" ADD CONSTRAINT "workout_exercise_log_session_id_workout_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise_log" ADD CONSTRAINT "workout_exercise_log_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_template_id_workout_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_program_id_training_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_exercise_log_id_workout_exercise_log_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."workout_exercise_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_manual_entry" ADD CONSTRAINT "daily_manual_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity_summary" ADD CONSTRAINT "daily_activity_summary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_nutrition_snapshot" ADD CONSTRAINT "daily_nutrition_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_state" ADD CONSTRAINT "integration_sync_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_clerk_user_id_key" ON "user" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_preference_user_id_key" ON "user_notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_canonical_slug_key" ON "exercise" USING btree ("canonical_slug");--> statement-breakpoint
CREATE INDEX "exercise_created_by_user_id_idx" ON "exercise" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_muscle_exercise_id_muscle_group_id_key" ON "exercise_muscle" USING btree ("exercise_id","muscle_group_id");--> statement-breakpoint
CREATE INDEX "exercise_muscle_muscle_group_id_idx" ON "exercise_muscle" USING btree ("muscle_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "muscle_group_name_key" ON "muscle_group" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "program_version_training_program_id_version_number_key" ON "program_version" USING btree ("training_program_id","version_number");--> statement-breakpoint
CREATE INDEX "training_program_user_id_is_active_idx" ON "training_program" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "workout_exercise_log_session_id_idx" ON "workout_exercise_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "workout_session_user_id_local_date_idx" ON "workout_session" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "workout_session_user_id_status_idx" ON "workout_session" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_set_exercise_log_id_client_id_key" ON "workout_set" USING btree ("exercise_log_id","client_id");--> statement-breakpoint
CREATE INDEX "workout_set_exercise_log_id_sort_order_idx" ON "workout_set" USING btree ("exercise_log_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_manual_entry_user_id_local_date_key" ON "daily_manual_entry" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_activity_summary_user_id_local_date_key" ON "daily_activity_summary" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_nutrition_snapshot_user_id_local_date_key" ON "daily_nutrition_snapshot" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_sync_state_user_id_integration_type_key" ON "integration_sync_state" USING btree ("user_id","integration_type");