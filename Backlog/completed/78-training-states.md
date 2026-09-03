# Story 78 — The six training states, and splitting the seventh

**Status:** Shipped 2026-09-03. Depends on 75.
**Design:** `docs/design/log-dashboard.md` §3.
**Figma:** `Log v3 ·` In progress / No program yet / Program, no
workouts / Nothing scheduled today / Rest day.

## User story

As someone who has made a plan but not put anything in it, I want the
screen to tell me that, so that I am not offered a choice among nothing.

## What to build

The hero renders each state from `today.tsx`'s existing derivation —
**do not reorder the precedence chain, each position is load-bearing and
commented**:

`in-progress` → `completed` → `rested` → `no-program` → `scheduled` →
`unscheduled`

Then **split `unscheduled` in two**, which is new:

- `program-empty` — the active program has no `day_type` rows at all.
  *"Your plan is empty"* → **Add a workout**.
- `unscheduled` — workouts exist, none scheduled for this date.
  *"Your call today"* → pick from the user's workouts, or take a rest
  day.

`in-progress` shows set progress (`6 of 14 sets logged`) and Resume.
Every state offers a rest path except `completed` and `in-progress`.

## Acceptance

- A program with zero workouts shows "Your plan is empty", never
  "Choose workout".
- A program with workouts and an empty Wednesday lists the user's own
  workouts to pick from.
- A session in progress takes precedence over a completed one on the
  same date (the ordering that fixed Story 06).

## Trap

The current copy for `unscheduled` offers "Choose workout" in both
cases. Adding the branch without changing the copy fixes nothing.
