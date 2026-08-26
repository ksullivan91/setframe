# Setframe Product Backlog

Work items live in this folder. Anything in the root is open; anything in
`completed/` has shipped to production.

Each batch of stories arrives with its own README describing the review it
came from and the delivery standards that apply. Those READMEs are archived
alongside their stories, named `README-{range}-{review}.md`.

## Open

- `57-movement-pattern-coverage.md` — story 57, found while shipping the
  composition chart: ungrouped volume is larger than every named group
  combined in production, and `movement_pattern` is not editable anywhere in
  the product, so a user cannot fix it.
- `WAIT-automated-visual-and-e2e-testing.md` — deferred by request. Filed so the
  gap is tracked, deliberately not started.
- `WAIT-figma-accentsubtle-token-fix.md` — deferred by request. Fixes
  `Semantic/Action/AccentSubtle` and other `Semantic/*` alias mismatches
  found during the 2026-08-23 color-token reconciliation (see
  `docs/design/setframe-figma-style-guide.md` §23).
- `WAIT-apple-health-activity-discovery.md` — story 44, deferred by
  request: the mobile app isn't deployed to a real device/TestFlight yet,
  so there's no way to exercise a live HealthKit connection. Revisit once
  the mobile app has an actual deployment.

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
- `completed/43-quick-activity-shortcuts.md` — story 43, saved presets
  (new `additional_activity_preset` table) plus recency-deduped
  suggestions, tap-to-prefill only — never auto-logs.
- `completed/46-progress-contextual-help-popovers.md` — story 46,
  contextual help re-anchored to its trigger at every width on web (via
  Floating UI — collision detection, flip, shift and portalling, which
  Story 30 hand-rolled and shipped four regressions attempting). The
  full-viewport backdrop that was intercepting taps — the cause of
  two-tap tooltip switching — is gone. Mobile keeps its bottom `Sheet`
  deliberately: that is this story's own sanctioned escalation for narrow
  screens, and the reported breakage was mobile *web*, which is what got
  anchored.
- `completed/50-training-frequency-volume-charts.md` — story 50, Training
  Frequency and Weekly Volume on story 49's grammar, with encodings that
  differ because the metrics do: a count and an additive workload both get
  zero baselines where body weight gets a dynamic one. Volume counts
  `weight x reps` over completed sets of weighted work only — cardio stays
  `null` rather than reading as `0 lb`, and the chart is withheld entirely
  from a user with no weighted work, since an all-zero axis reads as a
  verdict rather than an inapplicable metric. Partial weeks say
  "2 so far" in text, never colour alone. Three defects were found by
  looking at rendered pixels with a green suite: ALL drew 181 daily bars
  at 390px, the y-axis read "0, 1, 1" because 0.5 rounds to 1, and both
  clients requested 12 weeks while offering 6M/Y/ALL — so every long range
  silently showed a quarter of what it claimed, invisible because the MSW
  fixture ignores the `weeks` param.
- `completed/README-46-51-progress-experience-rebuild.md` — the pack
  README for stories 46-51, archived once all six shipped.
- `completed/48-progress-time-range-interaction-foundation.md` — story 48,
  the temporal model. A range now carries a *window* and a *bucket*, not
  just a trailing day count: `filterByRange` trimmed and stopped, so every
  range rendered the same bucket size and `ALL` drew 383 daily marks that
  buried a real 9.4 lb decline. Bucketing targets 7-30 marks per range,
  windows are calendar-anchored, and `W` is the current Monday-Sunday week
  because the product's own copy says "since Monday". `filterByRange` is
  retired so two range models cannot coexist.
- `completed/49-body-weight-reference-chart.md` — story 49, Body Weight as
  the reference chart the others inherit their interaction grammar from.
  Its sharpest fix: bucketed marks were rendering a week's mean under a
  single date, telling the user they weighed that on a morning they may
  never have logged — marks now name their span and sample count. Also
  made the trend line exist for screen readers, and withholds the
  week-over-week comparison in the two cases where it would lie.
- `completed/51-insight-ready-progress-metrics.md` — story 51, a
  deterministic insight contract (no AI calls). Both platforms render
  byte-identical sentences from one domain function, and nothing is shown
  when sample size or semantics do not support it. Rendering it caught
  four bugs that reasoning had not: a fabricated "compared with 0 last
  week" baseline predating the user's first observation, a caveat that
  fired on every weekly metric, a flat percentage threshold that hid a
  real 1 lb move, and a 2-day weight average that is exactly the
  water-weight noise `body-weight-display-psychology.md` exists to
  suppress.
- `completed/47-charting-technology-spike.md` — story 47, the charting
  decision spike. Outcome: **keep the hand-rolled SVG architecture and
  extend it** (ADR 0008). Scrub — the capability that looked like it
  justified a rewrite — was demonstrated over the existing shared geometry
  with zero new dependencies, while the remaining gaps (per-range
  aggregation, calendar-week semantics) are domain problems no vendor
  would fix. Victory Native XL forfeits web/mobile parity by construction;
  both alternatives regress accessibility from today's baseline. Evidence
  and prototypes in `docs/spikes/047-charting/`.
- `completed/README-40-45-additional-activity-feature-review.md` — the
  original pack README for stories 40–45, archived once 40, 41, 42, 43,
  and 45 shipped (44 was deferred — see
  `Backlog/WAIT-apple-health-activity-discovery.md`).
- `completed/37-collapsible-exercise-quick-entry.md` — story 37,
  collapsible exercise sections with a quick-entry header that applies
  only the specific field(s) the user actually touched to every set
  (fixed a real bug a review pass caught: the first pass bundled every
  quick-entry field together, silently overwriting sets' untouched values).
- `completed/38-exercise-completion-state.md` — story 38, exercise-level
  completion derived from valid required set data.
- `completed/39-single-active-exercise-accordion.md` — story 39,
  single-active-exercise accordion behavior (expand on entering an
  exercise, collapse on moving to another — never on blur within one).
- `completed/README-37-39-quick-entry-accordion-review.md` — the original
  pack README for stories 37–39, archived once all three shipped.
