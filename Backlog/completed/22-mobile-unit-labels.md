# Story 22 — Move Unit Labels Out of Numeric Inputs on Small Screens

## User Story

As a user logging workout data on a small screen, I want units such as pounds to be communicated clearly without overlapping or escaping the input field so that the form remains readable and stable at mobile widths.

## Screenshot / Gym-Test Evidence

The screenshot shows the **Weight** input for a Barbell Deadlift set on mobile web.

The `lb` unit label is visually pushed outside the right edge of the input area on a narrow screen.

This makes the field look broken and creates unnecessary horizontal pressure inside an already dense two-column mobile form.

The user suggested removing the inline unit label and including the unit in the field label/title instead.

## Problem Statement

The current numeric-input pattern attempts to place the unit inside or directly beside the input control.

At small viewport widths, the combination of:
- two-column form layout,
- input padding,
- borders,
- unit adornment,
- responsive container width,

causes the unit text to overflow or render outside the intended field boundary.

This is primarily a responsive layout problem, but it also exposes a broader design-system issue: unit presentation should be predictable across all numeric fields and breakpoints.

## UX / Product Intent

Simplify unit presentation by moving measurement units into the visible field label rather than reserving inline input space.

Preferred pattern:

`Weight (lb)`

instead of:

`Weight   [ 275             lb ]`

For metric users:

`Weight (kg)`

The input itself should contain only the editable numeric value.

Apply the same principle to other numeric fields where an inline unit creates layout pressure, for example:
- Weight (lb/kg)
- Duration (sec/min) where appropriate
- Distance (mi/km) if the unit is fixed for that field

If the unit is user-selectable, keep the selector as a separate explicit control rather than embedding a text suffix inside the numeric input.

The user should always be able to understand the unit before entering a value.

## Acceptance Criteria

- [ ] The `lb` unit no longer renders outside the Weight input at supported mobile widths.
- [ ] Weight is labeled using the user's configured unit, e.g. `Weight (lb)` or `Weight (kg)`.
- [ ] The numeric input contains only the editable number.
- [ ] The layout remains stable at narrow mobile widths.
- [ ] No horizontal overflow is introduced by numeric-input unit labels.
- [ ] Unit labels update correctly when the user changes measurement settings.
- [ ] Existing saved workout values are unchanged.
- [ ] Validation and numeric keyboard behavior remain unchanged.
- [ ] Screen readers receive the field name and unit together.
- [ ] Equivalent unit-label behavior is implemented in the mobile application.
- [ ] Figma review confirms the revised label pattern is visually consistent across mobile web and mobile app.
- [ ] Other numeric inputs using the same inline-unit component are audited for the same overflow risk.

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

Treat this as a **shared form-field / design-system fix**, not a one-off CSS override for the Deadlift screen.

### Before coding

Audit the shared numeric input component(s) used by workout logging and identify:

- how suffix/adornment text such as `lb` is rendered,
- whether the suffix uses absolute positioning,
- input padding reserved for the suffix,
- responsive grid behavior,
- min-width constraints,
- whether web and mobile use separate form-field implementations.

Search for other usages of inline units such as:
- lb
- kg
- mi
- km
- sec
- min

### Preferred implementation

For fixed/configured units, render the unit in the visible field label.

Examples:

`Weight (lb)`
`Weight (kg)`

Keep the input value itself purely numeric.

Do not solve the problem by reducing font size, shrinking the input, or absolutely positioning the unit farther right.

### Selectable units

Where the unit itself is editable, such as Distance Unit:
- keep the unit selector as its own control,
- do not duplicate it in the numeric input,
- ensure the numeric label still makes the relationship clear.

Example:

`Distance`
`[ 5.0 ]`

`Distance unit`
`[ mi ▾ ]`

### Accessibility

Ensure the accessible label includes the unit.

Do not rely only on visual placeholder text.

For example, the screen reader name should effectively communicate:

`Weight, pounds`

or equivalent based on existing accessibility conventions.

### Responsive review

Test at representative narrow widths, including the smallest currently supported mobile breakpoint.

Verify:
- no clipped unit text,
- no horizontal overflow,
- no overlap with neighboring fields,
- numeric keyboard still opens as expected,
- labels wrap gracefully if needed.

### Scope boundary

Do not redesign the workout set card.

Do not alter unit conversion behavior.

Do not change stored numeric values.

This story is about **unit-label presentation and responsive stability**.
