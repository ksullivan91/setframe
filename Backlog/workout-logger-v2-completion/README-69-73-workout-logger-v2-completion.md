# Workout Logger v2 — Completion Pack (69–73)

## Purpose

The v2 table logger (ADR 0011) is **live on the canonical route** on web and
mobile. It is not finished. Three handlers on each platform are literal
no-ops, and several behaviours the interaction spec calls for were never
built.

This pack closes that gap and retires v1.

## The specs are the source of truth

Every story here points at an existing spec rather than restating it:

- `docs/design/workout-logging-table.md` — layout, states, measurement
- `docs/design/workout-logging-interactions.md` — per-control behaviour
- `docs/adr/0011-set-logging-interaction-model.md` — the decision

Figma frames are indexed in §1 of each doc. Build from those numbers; they
were read out of the file programmatically, not transcribed.

## What is actually broken today

Two of these are regressions against v1, not merely missing polish:

- **A set cannot be deleted.** The `SET` chip is the only path to the set-type
  sheet, which is the only path to delete. The chip does nothing.
- **An exercise cannot be removed or replaced.** The `⋯` does nothing.

Both shipped in v1. Story 69 is therefore the highest priority in the pack.

## Stories

| | | |
|---|---|---|
| 69 | The two sheets — set type and exercise actions | **P0** |
| 70 | Complete the interaction contract | **P0** |
| 71 | Sticky regions and the keyboard | P1 |
| 72 | The save lifecycle | P1 |
| 73 | Retire v1 and remove Quick Log | P1 |

Order matters only in that **69 and 70 precede 73** — v1 must not be deleted
while v2 is still missing operations v1 had.

## Quick Log is removed, not ported

Decided rather than deferred: v2 has no Quick Log and will not get one.

v2 addresses the same need differently — tapping `PREVIOUS` copies last
session into a row, and a row commits itself on blur, so the per-set cost
Quick Log existed to amortise is much lower. Story 73 removes the feature
rather than leaving a dead endpoint and 17 files of unreferenced code.

## Verification standard

`apps/web/e2e/functional/workout-v2-figma-parity.spec.ts` asserts computed
geometry against numbers read from Figma; `apps/mobile/src/__tests__/SetRowV2.test.tsx`
asserts the same numbers on the rendered host tree. Both read `workoutTable`
from `@setframe/design-tokens`, so a value can only drift in one place.

**Render it and look.** Every defect that mattered in the v2 build so far was
found by screenshotting the result, not by a green test: `PREVIOUS` wrapping
to two lines, the shared fixture carrying `previousSession: null`, a double
header on mobile, the completion banner missing entirely on mobile.

## Not in this pack

- The Training page redesign (`docs/design/training-page-exploration.md`) —
  exploration, not signed off, and it should not start until this pack lands.
- Exercise illustrations and muscle labels — separate exploration, blocked on
  an asset decision and on catalog data.
