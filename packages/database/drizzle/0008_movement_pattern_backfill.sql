-- Story 57 — backfill `exercise.movement_pattern`.
--
-- The Training composition chart groups volume by movement pattern. Before
-- this migration, 22 of the exercises in the library carried none, and the
-- ungrouped bucket was larger than every named group combined — 15,725 lb
-- across 37 sets against 14,985 lb classified. A breakdown that omits the
-- majority of the work is not earning its place on the screen.
--
-- Matched on exact name and scoped to `movement_pattern IS NULL`, so this is
-- idempotent and cannot overwrite a classification anyone has since made.
-- Names are matched case-insensitively and whitespace-trimmed because the
-- library mixes conventions ("Dumbbell incline press" vs "Barbell Incline
-- Press"); the curly apostrophes in "Farmer’s Carry" and "Waiter’s carry" are
-- the real stored characters, not typos.
--
-- Two judgement calls worth recording, since neither is forced by the name:
--   * Incline presses are filed as `horizontal-push`. An incline is between
--     the horizontal and vertical planes; the convention here is that only
--     overhead work is `vertical-push`.
--   * Dips are `vertical-push`, since the torso travels vertically against
--     the load even though the arm path resembles a decline press.
--
-- "Mobility" is deliberately left NULL. It is not a loading pattern, and
-- inventing one for it would be a category error — the same reason cardio
-- carries no volume rather than a zero. If weighted mobility work is ever
-- logged it will show up in the chart's ungrouped disclosure, which is the
-- honest outcome.
--
-- To reverse: set `movement_pattern = NULL` for exactly these names.

UPDATE "exercise" AS e
SET "movement_pattern" = v.pattern,
    "updated_at" = now()
FROM (
  VALUES
    ('back / glute extension', 'hinge'),
    ('barbell incline press', 'horizontal-push'),
    ('chest fly', 'horizontal-push'),
    ('dips', 'vertical-push'),
    ('dumbbell lateral raises', 'isolation-shoulder'),
    ('dumbbell incline press', 'horizontal-push'),
    ('farmer’s carry', 'carry'),
    ('hip abductions', 'isolation-leg'),
    ('hip adductions', 'isolation-leg'),
    ('indoor walk', 'cardio'),
    ('leg curls', 'isolation-leg'),
    ('leg extensions', 'isolation-leg'),
    ('leg raises', 'core'),
    ('low row', 'horizontal-pull'),
    ('neutral grip pull-ups', 'vertical-pull'),
    ('outdoor cycle', 'cardio'),
    ('overhead press', 'vertical-push'),
    ('rdls', 'hinge'),
    ('sumo squats', 'squat'),
    ('waiter’s carry', 'carry'),
    ('walk (treadmill)', 'cardio')
) AS v(name, pattern)
WHERE lower(btrim(e."name")) = v.name
  AND e."movement_pattern" IS NULL;
