# Story 37 — Add Collapsible Exercise Sections With Quick-Entry Defaults

## User Story

As a user logging a workout, I want each exercise to have a compact quick-entry header where I can set common actual values once and apply them to all planned sets, while still being able to expand the exercise and edit individual sets when needed.

## Product / Gym-Test Context

For a common pattern like **Barbell Bench Press — 3 × 8**, entering the same weight three times is repetitive.

Desired flow:
1. Exercise header shows the planned prescription.
2. Quick-entry fields are pre-populated from the template where appropriate.
3. User enters/changes common actual values such as reps and weight.
4. Those values cascade to applicable child sets.
5. Expanding the exercise shows the current detailed set editor with those values already populated.
6. Individual sets can still be overridden.

## Problem Statement

The current model is flexible but optimized for per-set entry rather than the common case where sets share values.

The solution must preserve:
- per-set overrides,
- set types,
- representation-specific fields,
- planned vs actual separation.

## UX / Product Intent

Convert each active-session exercise into a collapsible section.

### Collapsed header

Show:
- exercise name,
- planned prescription,
- quick-entry fields appropriate to the representation,
- exercise progress/completion status,
- expand/collapse affordance.

Example:

**Barbell Bench Press**  
`Planned: 3 × 8`

`Weight (lb) [185]`   `Reps [8]`

### Template-derived defaults

If the template specifies `3 × 8`, initialize reps to `8`. Do not invent a weight if none was planned.

### Cascade behavior

A header quick-entry change should populate applicable child sets.

Critical rule: **do not silently destroy manual set overrides**.

Example:
- bulk set all weights to 185,
- user changes Set 3 to 175,
- later changes header to 190.

Preferred:
- Set 1 = 190
- Set 2 = 190
- Set 3 remains 175

If the architecture cannot safely track inherited vs overridden values, use an explicit `Apply to all sets` action after manual overrides exist.

### Planned vs actual

Template values remain planned/reference data. Prefilled values do not automatically count as logged/completed.

### Expanded section

When expanded, preserve the current set editor with cascaded values populated and editable individually.

### Representation awareness

Only show relevant quick fields:
- Sets + reps: reps, weight if applicable
- Duration: duration
- Distance: distance + unit
- Distance + duration: distance + unit + duration
- Bodyweight reps: reps
- Timed sets: required timed-set fields

## Acceptance Criteria

- [ ] Each active-workout exercise can collapse/expand.
- [ ] Header shows exercise name and planned prescription.
- [ ] Header exposes only representation-relevant quick-entry fields.
- [ ] Template values seed appropriate defaults.
- [ ] Planned values alone do not count as logged actuals.
- [ ] Header values can populate child sets.
- [ ] Expanded set editor shows cascaded values.
- [ ] Individual sets remain independently editable.
- [ ] Manual overrides are not silently overwritten.
- [ ] Supported representation types behave correctly.
- [ ] No mobile horizontal overflow is introduced.
- [ ] Session/template data remain separate.
- [ ] Mobile app and mobile web are equivalent.
- [ ] Tests cover bulk fill, expansion, override, and later bulk updates.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Matching user-facing behavior in the mobile app.
- Mobile web and mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, success, empty, disabled, and error states handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior considered.
- Existing historical data preserved unless explicitly migrated.
- Behavioral tests cover important user-visible outcomes.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.


## Copilot Steering Document

Treat this as a **session logging efficiency** feature.

Audit:
- template → session-set materialization,
- planned vs actual fields,
- local unsaved state,
- set save/log lifecycle,
- required fields by representation.

Prefer tracking inherited vs manual values. If that is too invasive, make bulk application explicit.

Do not auto-log just because fields are prefilled.

Reuse existing validation/input components so header entry and set entry cannot disagree about valid values.

### Scope boundary

Do not change workout templates, remove detailed set editing, add progression logic, or mark sets complete merely because template values exist.
