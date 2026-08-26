# Story 57 — Movement pattern coverage

## Why

Training composition (shipped 2026-08-25) groups volume by
`exercise.movement_pattern`. Against the **live production database** the
chart currently shows less than half of what the user actually lifted:

| | Sets | Volume |
|---|---|---|
| **Ungrouped** (no `movement_pattern`) | 37 | **15,725 lb** |
| hinge | 12 | 11,275 lb |
| horizontal-push | 3 | 2,610 lb |
| horizontal-pull | 1 | 680 lb |
| isolation-shoulder | 3 | 420 lb |

The ungrouped bucket is larger than every named group combined. The chart is
honest about it — it discloses the figure below the plot rather than hiding
it — but a breakdown that omits the majority of the work is not yet earning
its place on the screen.

22 of the exercises in the library carry no pattern. Every one that has real
logged volume is trivially classifiable:

| Exercise | Volume | Pattern |
|---|---|---|
| Dumbbell incline press | 2,700 | `horizontal-push` |
| RDLs | 2,690 | `hinge` |
| Back / Glute Extension | 2,240 | `hinge` |
| Hip Abductions | 2,060 | `isolation-leg` |
| Leg Extensions | 1,680 | `isolation-leg` |
| Hip Adductions | 1,460 | `isolation-leg` |
| Leg Curls | 1,440 | `isolation-leg` |
| Farmer's Carry | 900 | `carry` |
| Sumo Squats | 480 | `squat` |
| Waiter's carry | 75 | `carry` |
| Outdoor Cycle | 0 | `cardio` |
| Leg Raises | 0 | `core` |

Backfilling these moves 15,725 lb from "not shown" onto the chart, roughly
doubling what it can display.

## The second half of the problem

`movement_pattern` is **not editable anywhere in the product**. No exercise
route reads or writes it, and no screen exposes it. So a user who notices
their volume is ungrouped has no way to fix it, and no way to classify an
exercise they create themselves — which means coverage decays as the library
grows.

The composition section's copy was corrected on ship so it does not instruct
an action the app cannot perform, but that is a patch over the gap, not a
fix for it.

## Scope

1. ~~**Backfill** the exercises above.~~ **Done** 2026-08-25 —
   `packages/database/drizzle/0008_movement_pattern_backfill.sql`, written by
   hand per `docs/handoff.md` §2 and applied to production. Ungrouped volume
   went from 15,725 lb to **0**; 21 of 22 exercises are now classified.
   "Mobility" is deliberately left NULL — it is not a loading pattern, and
   inventing one would be the same category error as reporting cardio as 0 lb
   of volume. The two judgement calls are recorded in the migration's own
   header: incline presses are `horizontal-push` (only overhead work is
   `vertical-push`), and dips are `vertical-push`.
2. ~~**Expose the field**~~ **Done** 2026-08-26 — a Movement pattern select
   on the exercise history screen, web and mobile. It appears only for the
   user's own custom exercises: the API rejects edits to system exercises
   (all of which are already classified), and a control that always fails is
   worse than none. "Not set" is a real option, and the help text says so.
3. **Default it on creation** — *deliberately not done.* The obvious
   implementation is name-matching ("RDLs" → hinge), and that silently
   misfiles anything it guesses wrong. This repo's own migration comment
   states the principle: a wrong pattern is worse than an honest unknown,
   because an unset one is openly reported as ungrouped while a wrong one
   corrupts every chart that groups by it. Coverage can now decay, but it is
   *fixable* from inside the product, which is the property that matters.
   Revisit only with a confident source (an exercise library with real
   taxonomy data), not a heuristic.

## Not in scope

Muscle-group mapping (`exercise_muscle` / `muscle_group`). Those tables exist
and are unused; a muscle-level breakdown is a separate, richer view and
should not be bundled into fixing pattern coverage.

## Definition of done

- ~~Every exercise with logged volume in production carries a movement
  pattern.~~ Done — see above.
- ~~A user can set or change an exercise's movement pattern in the app, on
  both web and mobile.~~ Done.
- ~~The composition chart's ungrouped disclosure reads as an exception rather
  than as the largest number on the card.~~ Done — ungrouped volume in
  production is 0.
- ~~The corrected "not editable in the app today" copy is updated once it
  is.~~ Done — both platforms now describe where patterns come from and how
  to set one.
