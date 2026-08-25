# Setframe Product Backlog

Work items live in this folder. Anything in the root is open; anything in
`completed/` has shipped to production.

Each batch of stories arrives with its own README describing the review it
came from and the delivery standards that apply. Those READMEs are archived
alongside their stories, named `README-{range}-{review}.md`.

## Open

- `setframe-workout-quick-entry-accordion-stories/` — stories 37–39, a
  collapsible single-active-exercise accordion with cascading quick-entry
  values and derived completion state.
- `setframe-additional-activity-feature/` — stories 43–44 remain (40–42,
  45 shipped): reusable quick-add shortcuts for repeated activities, and
  Apple Health detect-and-suggest discovery (safest now that the entity
  and dedupe behavior already exist).
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
- `completed/34-remove-exercise-from-current-session-only.md` — story 34,
  session-only exercise removal, reusing the existing `skipped` flag on
  `workout_exercise_log` so the workout template and program are never
  touched and undo is trivial.
- `completed/35-investigate-active-workout-horizontal-overflow.md` — story
  35, root-caused to `<input>`'s intrinsic minimum content width overriding
  `flex: 1` inside the SetGrid at narrow viewports, plus defensive width
  caps on the toast stack.
- `completed/README-34-35-active-workout-adaptability-review.md` — the
  original pack README for stories 34–35, archived once both shipped
  (their own story files are the individual entries above).
- `completed/30-progress-tooltip-viewport-containment.md` — story 30, a
  measured, viewport-clamped tooltip (`position: fixed`, flips above the
  trigger, centers below tablet width) replacing an absolutely-positioned
  panel that could overflow past a narrow viewport.
- `completed/31-progress-time-range-controls-and-period-semantics.md` —
  story 31, shared `formatWeekRange`/`formatDateRangeLabel` domain
  helpers labeling each chart's active period, plus the week-boundary
  standard documented in `docs/data-model.md`. A user-facing range
  *selector* on the already-windowed weekly bar charts was deliberately
  deferred — noted in its own commit, not part of this story's scope.
- `completed/32-body-weight-progress-chart-redesign.md` — story 32, a
  Start/Current/Change summary row computed from the range-filtered raw
  series, kept separate from the existing (untouched) smoothed trend line.
- `completed/33-progress-chart-detail-and-interaction-system.md` — story
  33, making the "current week" chart marker accessible (semantic, not
  color-only) on both platforms.
- `completed/README-30-33-progress-graph-enhancements-review.md` — the
  original pack README for stories 30–33, archived once all four shipped.
- `completed/36-active-workout-persistent-session-actions.md` — story 36,
  a sticky session-action surface (mobile: compact bar above bottom nav;
  desktop: persistent header row) keeping Add exercise/Finish workout
  reachable during long workouts.
- `completed/README-36-active-workout-persistent-actions-review.md` — the
  original pack README for story 36, archived once shipped.
- `completed/40-additional-activity-domain-model.md` — story 40, the new
  `AdditionalActivity` entity (day-scoped, source + external-id dedupe
  columns, never touches a program/workout template).
- `completed/41-today-additional-activity-section.md` — story 41, a
  visually-secondary Additional Activity section on Today, below the
  scheduled-workout card, with its own section-level loading/error state.
- `completed/42-fast-manual-add-activity-flow.md` — story 42, a few-second
  add flow driven entirely by activity type (no full workout-builder UI).
- `completed/45-history-progress-activity-semantics.md` — story 45,
  confirming (and pinning with a new regression test) that scheduled-
  workout metrics — adherence, streaks, weeksTrained, sessions/week —
  never fold in Additional Activity, since `progress.ts` never queries it
  at all.
