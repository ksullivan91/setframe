-- Story 45 — Apple Watch workouts attached to a Setframe session.
--
-- Two tables and one column, per ADR 0012.
--
-- `session_watch_workout` is the snapshot of a finished Watch workout,
-- attached to the session it belongs to. Append-mostly and snapshotted at
-- attach time (ADR 0005), so editing anything in Health later never changes
-- how a past session reports.
--
-- `session_watch_series` holds the heart-rate curve as parallel arrays
-- rather than one row per sample: a heart rate is 2 bytes, and a naive row
-- wraps it in ~190 bytes of uuids, timestamps and index entries. One row per
-- (workout, kind) means a new sample kind is an insert, not a migration.
--
-- `workout_set.performed_at` cannot be backfilled — nothing records when a
-- past set was performed — so it lands now, before the data is worth having.

CREATE TYPE "public"."watch_series_kind" AS ENUM('heart_rate');--> statement-breakpoint

CREATE TABLE "session_watch_workout" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  -- HealthKit's own UUID. The dedupe key: a workout cannot be attached twice,
  -- nor to two sessions.
  "external_id" text NOT NULL,
  "activity_type" "additional_activity_type" NOT NULL,
  "apple_activity_type" integer NOT NULL,
  "title" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone NOT NULL,
  "duration_seconds" integer NOT NULL,
  "active_energy_kcal" numeric,
  "total_energy_kcal" numeric,
  "avg_heart_rate_bpm" integer,
  "peak_heart_rate_bpm" integer,
  "min_heart_rate_bpm" integer,
  "distance_value" numeric,
  "distance_unit" "distance_unit",
  "device_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "session_watch_series" (
  "session_watch_workout_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" "watch_series_kind" NOT NULL,
  -- Seconds from the workout's started_at. Absolute times are recovered by
  -- addition rather than stored once per sample.
  "offsets" integer[] NOT NULL,
  "values" smallint[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "session_watch_series_pkey" PRIMARY KEY ("session_watch_workout_id", "kind")
);--> statement-breakpoint

ALTER TABLE "session_watch_workout" ADD CONSTRAINT "session_watch_workout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_watch_workout" ADD CONSTRAINT "session_watch_workout_session_id_workout_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_watch_series" ADD CONSTRAINT "session_watch_series_workout_id_fk" FOREIGN KEY ("session_watch_workout_id") REFERENCES "public"."session_watch_workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_watch_series" ADD CONSTRAINT "session_watch_series_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- One Watch workout, one attachment, ever.
CREATE UNIQUE INDEX "session_watch_workout_user_id_external_id_key" ON "session_watch_workout" USING btree ("user_id", "external_id");--> statement-breakpoint
CREATE INDEX "session_watch_workout_session_id_idx" ON "session_watch_workout" USING btree ("session_id");--> statement-breakpoint

-- Set once when a set is first completed, never updated. updated_at moves
-- when a set is corrected, so it cannot say when the set happened.
ALTER TABLE "workout_set" ADD COLUMN "performed_at" timestamp with time zone;
