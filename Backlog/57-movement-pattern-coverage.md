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

1. **Backfill** the exercises above (a hand-written migration, per
   `docs/handoff.md` §2 — `db:generate` is broken). Classification is a
   judgement call in a couple of cases; `Dumbbell incline press` is filed as
   `horizontal-push` by convention, and that convention should be written
   down wherever the taxonomy lives.
2. **Expose the field** so an exercise can be classified in the app —
   minimally on the exercise edit surface, as a select over the known
   patterns, with "not set" a legitimate value rather than a forced choice.
3. **Default it on creation** where the name makes it obvious, or prompt for
   it, so coverage does not decay again.

## Not in scope

Muscle-group mapping (`exercise_muscle` / `muscle_group`). Those tables exist
and are unused; a muscle-level breakdown is a separate, richer view and
should not be bundled into fixing pattern coverage.

## Definition of done

- Every exercise with logged volume in production carries a movement pattern.
- A user can set or change an exercise's movement pattern in the app, on both
  web and mobile.
- The composition chart's ungrouped disclosure reads as an exception rather
  than as the largest number on the card.
- The corrected "not editable in the app today" copy is updated once it is.
