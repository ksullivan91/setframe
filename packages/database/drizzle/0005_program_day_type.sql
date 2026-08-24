CREATE TABLE "program_day_type" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "training_program_id" uuid NOT NULL,
  "day_type_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "program_day_type" ADD CONSTRAINT "program_day_type_training_program_id_training_program_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "public"."training_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_day_type" ADD CONSTRAINT "program_day_type_day_type_id_day_type_id_fk" FOREIGN KEY ("day_type_id") REFERENCES "public"."day_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "program_day_type_training_program_id_day_type_id_key" ON "program_day_type" USING btree ("training_program_id", "day_type_id");--> statement-breakpoint
CREATE INDEX "program_day_type_day_type_id_idx" ON "program_day_type" USING btree ("day_type_id");--> statement-breakpoint
-- Backfill 1: every workout already referenced by any of a program's
-- schedule slots is unambiguously "in" that program.
INSERT INTO "program_day_type" ("training_program_id", "day_type_id", "sort_order")
SELECT DISTINCT pv."training_program_id", pss."day_type_id", 0
FROM "program_schedule_slot" pss
JOIN "program_version" pv ON pv."id" = pss."program_version_id"
ON CONFLICT ("training_program_id", "day_type_id") DO NOTHING;--> statement-breakpoint
-- Backfill 2: every workout not currently scheduled anywhere (backfill 1
-- above only catches scheduled ones) implicitly belonged to the user via
-- the flat unscoped workout list this story is replacing — it would
-- otherwise silently vanish from the Workouts tab the moment this ships.
-- Not restricted to single-program users: attributes any still-orphaned
-- workout to its owner's active program (falling back to any one of
-- theirs if none is active), so a user who already has multiple programs
-- doesn't lose an unscheduled workout either.
INSERT INTO "program_day_type" ("training_program_id", "day_type_id", "sort_order")
SELECT
  COALESCE(
    (SELECT tp."id" FROM "training_program" tp WHERE tp."user_id" = dt."user_id" AND tp."is_active" = true LIMIT 1),
    (SELECT tp."id" FROM "training_program" tp WHERE tp."user_id" = dt."user_id" ORDER BY tp."created_at" LIMIT 1)
  ) AS training_program_id,
  dt."id",
  0
FROM "day_type" dt
WHERE NOT EXISTS (SELECT 1 FROM "program_day_type" pdt WHERE pdt."day_type_id" = dt."id")
  AND EXISTS (SELECT 1 FROM "training_program" tp WHERE tp."user_id" = dt."user_id")
ON CONFLICT ("training_program_id", "day_type_id") DO NOTHING;
