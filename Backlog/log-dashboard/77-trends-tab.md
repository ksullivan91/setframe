# Story 77 — Trends: what your body is doing

**Status:** Open. Depends on 75.
**Design:** `docs/design/log-dashboard.md`. ADR 0013.
**Figma:** `Trends v3 · Body, recovery, capacity`.

## User story

As someone tracking both my lifts and my health, I want them in separate
places, so that a page about my training is not half full of sleep data.

## What to build

- A Trends tab, grouped **Body / Recovery / Activity / Capacity**:
  weight; resting HR, sleep, HRV; steps, active energy; VO₂ max.
- A range control: 30 days / 90 days / 1 year.
- **Move body weight out of Progress into Trends.** Progress keeps Plan
  vs actual, Strength, By exercise, Training composition, Recent
  sessions — everything derived from logged sets.
- Charts use `packages/domain`'s existing `chart-geometry`; do not draw
  new geometry in the component.

## Backend gap — read before estimating

**There is no endpoint that serves health metrics over a range.** Verified
2026-09-03:

- `GET /v1/daily/:localDate` is single-date (`paramsSchema` is one
  `localDate`), as is `GET /v1/dashboard/today`.
- `GET /v1/progress/overview` **does** already return a `bodyWeight`
  series — that is what the current Progress chart renders — so weight
  moves for free.
- Nothing serves resting HR, sleep, HRV, steps, active energy or VO₂ max
  as a series.

So three of the four groups need a new endpoint, roughly
`GET /v1/trends?from=&to=` reading `daily_activity_summary` and
`daily_manual_entry` and returning one series per metric. That is the
bulk of this story and was not in the original estimate. Design it
alongside `packages/domain`'s existing `chart-geometry` contract so the
client does no maths.

## Acceptance

- Progress contains nothing sourced from HealthKit.
- Trends contains nothing derived from logged sets.
- Weight appears in exactly one tab.
- Each metric shows its trend direction against the selected range.

## Note on the split

The boundary is **provenance, not topic**: Progress is computed from
sets in our DB, Trends is measured about the user and authoritative from
HealthKit (`docs/architecture.md` §5). Weight is measured, so it moves —
even though a lifter reads it alongside strength.
