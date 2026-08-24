# Story 32 — Redesign Body Weight Progress Around Clear Historical Context

## User Story

As a user tracking body weight, I want the Progress page to show a clear interactive weight trend with start, current, change, date context, and selectable time ranges so that I can understand my trajectory without mentally decoding isolated dots.

## Screenshot / Product-Test Evidence

The current Setframe Body weight card shows:
- current/headline weight,
- a few plotted dots,
- a short trend-availability message,
- an average/range summary.

The graph is functional but sparse, and the summary can feel disconnected from the points shown.

The user's preferred MyFitnessPal reference makes the key story immediately obvious:
- Start,
- Current with date,
- Change,
- a simple line graph.

The Apple Health references add:
- time-range selector,
- selected point marker,
- exact date/value callout,
- clear axes.

## Problem Statement

Weight is one of Setframe's core longitudinal signals. The current graph provides data, but not enough context.

Users primarily want to answer:
- Where did I start?
- Where am I now?
- How much have I changed?
- What happened over the selected period?
- Is the underlying direction stable despite daily noise?

A weekly range alone is not sufficient when the graph spans a different period.

## UX / Product Intent

Redesign Body weight around trajectory and context.

### Card summary

For the selected range show:

- **Start** — first valid check-in in range.
- **Current** — latest valid check-in, with date.
- **Change** — signed difference between start and current.

Example:

`Start      168.2 lb`
`Current    167.4 lb · Aug 24`
`Change     ↓ 0.8 lb`

Direction should be neutral; downward is not inherently “good.”

### Chart

Use a simple line/scatter chart:
- raw logged check-ins as points,
- connect points where appropriate,
- optional smoothed trend only after sufficient data,
- clearly distinguish raw readings from trend if both are shown.

### Point interaction

Tap/drag a point to show:
- exact weight,
- exact date,
- selected marker/crosshair.

Selected detail should remain inside the card/viewport.

### Time ranges

Coordinate with Story 31.

Suggested useful ranges:
- W
- M
- 3M
- 6M
- Y

### Sparse data

With 1 point:
- show the point/latest value,
- no misleading change/trend.

With 2 points:
- show start/current/change,
- no fabricated smoothed trend.

With sufficient history:
- show raw points plus optional trend.

Demote or remove `range` if it does not answer a useful question for the selected period.

## Acceptance Criteria

- [ ] Body weight card shows Start, Current, and Change for the selected range when enough data exists.
- [ ] Current includes the date of the latest check-in.
- [ ] Graph uses the same visible period as the summary.
- [ ] Tapping a point shows exact date and weight.
- [ ] Selected-point detail remains fully inside the card/viewport.
- [ ] One-point state does not show misleading change/trend.
- [ ] Two-point state can show change but does not fabricate smoothing.
- [ ] Smoothed trend appears only after the documented minimum data threshold.
- [ ] If raw points and trend are both shown, their visual distinction is explained.
- [ ] Units respect lb/kg settings.
- [ ] Changing time range recalculates Start, Current, Change, axes, and plotted data together.
- [ ] Y-axis uses a sensible data domain that reveals variation without exaggerating tiny changes.
- [ ] No horizontal overflow occurs on mobile.
- [ ] Screen-reader users can access a textual summary of the same values.
- [ ] Mobile web and mobile app provide equivalent weight-trend interactions.

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

Build this on Story 31's time-range model.

For a selected period:
- Start = earliest valid check-in in range.
- Current = latest valid check-in in range.
- Change = Current - Start.

Do not use the prior period's last value unless explicitly labeled.

If Setframe already has a smoothing/trend algorithm, preserve one authoritative implementation.

Avoid a fixed zero-based y-axis for body weight.

Prefer a padded data-domain appropriate for visible values, while avoiding exaggerated visual changes.

For mobile interaction, prefer an in-chart selected label or compact detail row beneath the chart rather than a free-floating tooltip that can overflow.

Use the supplied MyFitnessPal/Apple Health screenshots as interaction inspiration, not a pixel-copy target.

### Scope boundary

Do not add nutrition features.
Do not change morning-weight entry.
Do not modify historical weight records.
