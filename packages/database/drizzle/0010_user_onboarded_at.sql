-- Stories 87-89 — onboarding runs once.
--
-- Without this there is no way to know the flow has run. Inferring it from
-- existing data does not work: someone who legitimately skipped every step
-- is indistinguishable from a brand-new account, so they would be walked
-- through setup again on every launch — which is the exact behaviour the
-- run-once rule exists to prevent.
--
-- Nullable, and set when onboarding is COMPLETED OR SKIPPED. Skipping is a
-- decision the user made, not an absence of one.
--
-- Every existing user is backfilled to their creation time: they have been
-- using the app for weeks and must not be shown a first-run flow.

ALTER TABLE "user" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint

UPDATE "user" SET "onboarded_at" = "created_at" WHERE "onboarded_at" IS NULL;
