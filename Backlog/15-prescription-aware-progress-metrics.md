# Story 15 — Make Progress Metrics Respect Exercise / Prescription Type

## User Story

As a user viewing progress for cardio, mobility, bodyweight, and strength exercises, I want each activity to show metrics that actually apply to it so that Progress never tells me my bike ride has a 0 lb estimated 1RM.

## Screenshot / Gym-Test Evidence

Screenshots show Outdoor Cycle rendered with `0 lb est. 1RM`, `Top set 0 × 0`, and `volume 0 lb`. These are mathematically meaningless for a distance/duration cycling activity and are a downstream symptom of the generic metric model.

## Problem Statement

Progress must use the activity representation to decide which metrics and charts are meaningful. Weighted strength can use top set, load volume, estimated 1RM, and valid PRs. Bodyweight reps can use reps/total reps. Duration can use duration/frequency. Distance can use distance. Distance + duration can use distance, duration, and potentially pace/speed when enough valid data exists.

## UX / Product Intent

Create one explicit metric mapping by prescription type. Invalid metrics should be omitted, not displayed as zero. Historical cards and charts must use activity-appropriate units and empty-state language.

## Acceptance Criteria

- [ ] Outdoor Cycle no longer displays estimated 1RM, Top set 0 × 0, or 0 lb volume.
- [ ] Every supported prescription type maps to explicit valid Progress metrics.
- [ ] Invalid metrics are omitted rather than zero-filled.
- [ ] Historical cards use correct units.
- [ ] Progress charts use activity-appropriate series.
- [ ] Strength metrics continue to work.
- [ ] Web/mobile share the same metric-definition source.
- [ ] Tests cover every prescription type.

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

Build directly on the shared prescription definition from active-workout Story 09. Do not create a Progress-only duplicate mapping. Audit estimated 1RM, top-set selection, volume aggregation, recent exercise cards, exercise-detail routes, and PR counts. Treat absent data as not applicable, not numeric zero.

