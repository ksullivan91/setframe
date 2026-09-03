# Story 79 — Session shapes: not every workout has sets

**Status:** Open. Depends on 78. **Domain change first.**
**Design:** `docs/design/log-dashboard.md` §4.
**Figma:** `Session shapes — flexible stats` (`392:180`).

## User story

As someone whose recovery day was a 40-minute treadmill walk, I want the
summary to describe what I actually did, so that it does not report my
session as zero.

## Current behaviour — the bug

A duration-only session renders **`1 set · 0 volume lb · 0 PRs`**.
`buildCompletedSessionReadout` computes only `totalVolume`,
`loggedSetCount` and `personalRecordCount`, and
`formatSessionTotalSuffix` returns the literal string `'lb total'`.

There are **eight** prescription kinds in `packages/schemas` and every
consumer assumed the first.

## What to build

1. **`packages/domain/src/completed-session.ts` first.** Make the readout
   kind-aware — it should report what the session measured, not always
   volume. Unit-test each kind in isolation; this is exactly the maths
   the package exists to hold.
2. Then the hero stat row picks its three stats from `prescription.kind`:

| Kind | Stats |
|---|---|
| `sets_reps`, `top_set_backoff`, `per_side` | sets · volume lb · PRs |
| `bodyweight_reps` | sets · total reps · PRs |
| `duration`, `timed` | duration · distance · avg bpm |
| `distance`, `distanceDuration` | distance · duration · pace |

3. A field appears only when something measured it. Where distance or
   heart rate came from the Watch, say so.

## Acceptance

- A duration-only session shows duration, never `0 lb`.
- A bodyweight session shows total reps, never `0 lb`.
- Existing strength sessions are unchanged — regression-check a real one.
- `formatSessionTotalSuffix` no longer returns a hardcoded unit.
