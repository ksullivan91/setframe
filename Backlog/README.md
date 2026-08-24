# Setframe Product Backlog

Work items live in this folder. Anything in the root is open; anything in
`completed/` has shipped to production.

Each batch of stories arrives with its own README describing the review it
came from and the delivery standards that apply. Those READMEs are archived
alongside their stories, named `README-{range}-{review}.md`.

## Open

- `setframe-todays-workout-session-updates/` — stories 34–35, session-only
  exercise removal and an investigative fix for horizontal overflow on the
  active workout page.
- `setframe-workout-session-sticky-actions/` — story 36, keeping Add
  Exercise/Finish Workout reachable during long workouts.
- `setframe-workout-quick-entry-accordion-stories/` — stories 37–39, a
  collapsible single-active-exercise accordion with cascading quick-entry
  values and derived completion state.
- `setframe-progress-graph-enhancements/` — stories 30–33, viewport-safe
  Progress tooltips, real time-range controls with consistent week
  boundaries, a reusable chart-detail interaction pattern, and a Body
  Weight redesign built on both.
- `WAIT-automated-visual-and-e2e-testing.md` — deferred by request. Filed so the
  gap is tracked, deliberately not started.
- `WAIT-figma-accentsubtle-token-fix.md` — deferred by request. Fixes
  `Semantic/Action/AccentSubtle` and other `Semantic/*` alias mismatches
  found during the 2026-08-23 color-token reconciliation (see
  `docs/design/setframe-figma-style-guide.md` §23).

## Shipped

- `completed/README-01-07-gym-ux-review.md` — stories 01–07.
- `completed/README-08-10-active-workout-ux-review.md` — stories 08–10.
- `completed/README-11-16-progress-experience-review.md` — stories 11–16.
- `completed/README-17-20-guided-setup-beta-test-review.md` — stories 17–20.
- `completed/21-schedule-rest-days-in-training.md` — schedule rest days
  from Training, not just Today.
- `completed/README-22-mobile-unit-label-review.md` — story 22.
- `completed/README-23-completed-workout-edit-review.md` — story 23,
  correcting a logged set after a workout is already completed, with
  derived metrics (volume, e1RM, PRs) recalculating. (Numbered 23, not the
  original 21 — see its own README.)
- `completed/README-28-mobile-input-zoom-review.md` — story 28, preventing
  iOS Safari's persistent post-blur zoom on form inputs. (Numbered 28, not
  the original 23 — see its own README.)
- `completed/README-27-today-action-hierarchy-review.md` — story 27,
  restructuring Today's workout actions into primary/supporting/rest
  tiers and explaining what Rest Day actually does.
- `completed/24-programs-tab-and-active-program.md` — story 24 (from the
  `setframe-program-management-stories/` pack), a Programs tab with
  explicit active-program selection.
- `completed/25-program-scoped-workouts.md` — story 25, an explicit
  program-to-workout membership model (`program_day_type`) so the
  Workouts tab and every downstream picker only offer the selected
  program's own workouts.
- `completed/README-24-26-multi-program-management-review.md` — the
  original pack README for stories 24–26, archived once all three
  shipped (their own story files are the individual entries above/below).
- `completed/26-program-aware-schedule.md` — story 26, verifying (and
  closing two gaps found along the way) that Schedule only ever offers
  the selected program's own workouts and never leaks UI state across a
  program switch — the multi-program management pack is now fully
  shipped.
- `completed/README-29-add-exercise-modal-spacing-review.md` — story 29,
  restoring mobile horizontal padding in the shared modal/sheet primitive.
