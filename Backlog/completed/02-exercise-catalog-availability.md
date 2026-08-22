# Story 02 — Restore and Protect the Preloaded Exercise Catalog

## User Story

As a user creating a program, I want common exercises to remain available in the exercise picker so that I do not have to recreate standard lifts as custom exercises.

## Screenshot / Gym-Test Evidence

Screenshot 2 shows the exercise dropdown containing only the placeholder rather than the expected preloaded exercise catalog. During gym testing, common lifts had to be recreated manually as custom exercises.

## Problem Statement

Missing seeded/catalog exercises creates immediate friction and can fragment historical data. If users independently create `Overhead Press`, `Barbell Overhead Press`, `OHP`, etc., progress and history may be split across multiple exercise IDs that represent the same movement.

## UX / Product Intent

Treat the canonical exercise catalog as first-class product data.

Investigate whether the disappearance is caused by seed data, environment initialization, API filtering, authentication/user scoping, migration behavior, or a failed loading state.

The picker should:
- load the canonical exercises reliably
- clearly distinguish loading, empty, and error states
- support search
- avoid encouraging custom creation until the canonical list has actually loaded
- preserve canonical exercise IDs so historical analysis remains consistent

## Acceptance Criteria

- [ ] The root cause of missing preloaded exercises is identified and documented.
- [ ] Common seeded exercises appear reliably for new and existing users.
- [ ] The UI never displays a misleading "empty catalog" state while the catalog request is still loading.
- [ ] Failed catalog loading shows an actionable error/retry state.
- [ ] Custom exercise creation remains available, but does not replace the canonical catalog.
- [ ] Existing custom exercises remain intact.
- [ ] Canonical exercise IDs remain stable across web and mobile clients.
- [ ] Tests cover successful catalog load, loading state, empty/seed failure, and API error.
- [ ] The same catalog behavior is verified on mobile web and mobile app.


## Product-wide Definition of Done

Every story in Setframe must satisfy these rules before it is considered done:

- The feature is implemented **mobile-first** and is fully responsive on web.
- Any user-facing behavior added or changed on web is also implemented in the **mobile application**.
- Mobile web and mobile app are reviewed side-by-side for behavioral and visual parity.
- The change is reviewed with the **GitHub reviewer** for implementation/code quality.
- The change is reviewed with the **Figma reviewer** for visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch target, and screen-reader behavior are considered for interactive controls.
- Existing historical user data is not mutated or lost unless the story explicitly requires a migration.
- Automated tests cover the important user-visible behavior; do not rely only on snapshots.
- Type checking, linting, relevant unit/integration tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Audit the complete exercise-loading pipeline before changing UI:
- database seed/migration
- backend endpoint
- query/filter logic
- client cache/query keys
- authenticated user scoping
- environment-specific initialization

Do not solve this by hardcoding exercise names into the frontend.

If seed repair is required, make it idempotent and safe for existing environments. If canonical exercises and custom exercises are returned together, ensure the model preserves their identity/type.

Add a regression test proving a new user can open Guided Setup and find standard exercises without manually creating them.
