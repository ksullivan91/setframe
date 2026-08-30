# Story 74 — Adding an Exercise Mid-Session

**Priority: P0.** `+ Add exercise` sits in a sticky bottom bar on both
platforms and has **no handler at all** — not a stub, no `onClick`. It is the
most prominent dead control in v2.

Found by diffing v1's mutations against v2's: v1 has nine, v2 has three.

## What is missing

| v1 mutation | Endpoint | Status in v2 |
|---|---|---|
| `addExercise` | `POST /workout-sessions/:sessionId/exercises` | **absent** |
| `createExercise` | `POST /exercises` | **absent** |
| `restoreExercise` | `PATCH /workout-exercise-logs/:id { skipped: false }` | **absent** |

All three exist server-side. This is client work only.

## 1. Add an exercise

`+ Add exercise` opens the picker. Choosing one appends a
`workout_exercise_log` to the session with the exercise's default prescription
for its kind, and the new card renders at the end of the list.

Use the picker design from the exercise-examples exploration
(`Explore/Mobile/ExercisePicker`, `129:513`) **if that exploration has been
signed off**; otherwise wire the existing `AddExercisePicker` component, which
both v1 screens already use. Do not build a third picker.

If the picker's multi-select lands, adding several in one action appends them
in order.

## 2. Create an exercise that does not exist

The catalog is **33 system exercises**. Creating a movement mid-session is not
an edge case, it is the common path — and it is currently impossible.

The picker needs a "create" affordance that `POST`s to `/exercises` and adds
the result to the session in one flow, as v1's `createExerciseMutation` did.

> Sequencing note: `Backlog/68-exercise-catalog-cache-policy.md` requires every
> custom-exercise create to go through **one shared helper** that invalidates
> `['exercises']`. Build this on that helper, or build the helper here — do not
> add a fourth ad-hoc create path.

## 3. Restore a removed exercise

`removeExercise` is a **soft delete** — it sets `skipped: true`, and
`visibleSessionExercises` filters those out. v1 paired it with a restore.

Without restore, an exercise removed in v1 is **invisible in v2 with no way
back**, and the same becomes true of anything removed once story 69 ships the
actions sheet.

Offer undo on removal, matching the pattern story 70 specifies for sets. A
longer-lived path — a "removed from this session" affordance — is worth
considering but is not required by parity.

## Not parity: reordering

Story 69's actions sheet lists **Reorder exercises**. v1's session screen has
no reordering at all (`grep -c "reorder\|sortOrder"` returns 0). That is new
functionality, not a restoration — build it only if it is wanted, and do not
let it block the parity items above.

## Acceptance criteria

1. `+ Add exercise` opens a picker on both platforms.
2. Choosing an exercise appends it to the session with its kind's default
   prescription, and the card renders without a refetch flash.
3. An exercise absent from the catalog can be created and added in one flow.
4. Every create path goes through the shared helper from story 68.
5. Removing an exercise offers undo, and undo restores it with its sets.
6. Verified by screenshot on web and mobile.
