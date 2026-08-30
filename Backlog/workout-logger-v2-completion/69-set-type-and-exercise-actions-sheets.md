# Story 69 — The Two Sheets: Set Type and Exercise Actions

**Priority: P0.** Two operations that shipped in v1 are impossible in v2.

## Problem

`onOpenSetType` and `onOpenActions` are `() => undefined` on both platforms.
The consequences are not cosmetic:

- The `SET` chip is the **only** path to changing a set's type, and the
  **only** path to deleting a set. Neither is possible.
- The exercise `⋯` is the only path to removing or replacing an exercise, or
  to turning on the RPE column. None is possible.

## Designs

| Sheet | Figma | Spec |
|---|---|---|
| Set type | `123:377` | `workout-logging-interactions.md` §9.1 |
| Exercise actions | `124:439` | §9.2 |

## Set type sheet

Opens from the `SET` chip. Header names the set and exercise ("Set 3 · Bench
Press"). Six options, each with its chip glyph and a one-line explanation:
Working set, Warm-up, Top set, Backoff, Drop set, Failure. Current type is
checked and tinted. **"Delete set n"** sits below a divider.

Selecting a type applies it immediately and closes — no confirm step for a
reversible single-field change.

Chip treatments are specified in `workout-logging-table.md` §4.1, including
the contrast numbers. Every glyph is `Text/Primary` except Top set. Warm-up
is an **outlined** chip rather than dimmed text: `Text/Disabled` on
`Surface/Sunken` measures 1.46:1.

## Exercise actions sheet

Opens from `⋯`. Header names the exercise and its context ("3 sets planned ·
last done 20 Aug").

| Action | Note |
|---|---|
| View history | Existing exercise-history screen. |
| Add a note | Kept with **this session**, never written back to the template. |
| Show RPE column | Toggle. Adds the optional RPE field to every set in this exercise. |
| Replace exercise | Swap the movement, keeping logged sets. |
| Reorder exercises | Enters reorder mode for the session. |
| Remove exercise | Destructive, below a divider. **Soft delete** — sets `skipped: true`, which `visibleSessionExercises` filters out. It must be paired with the restore in story 74, or removal becomes one-way. |

"Add a note" writing to the session and never the template is ADR 0005 in
miniature.

## RPE column

`visibleFields()` in both v2 screens currently filters `rpe` out
unconditionally. This story makes that per-exercise state driven by the
toggle. **The filter governs the column only** — `commit` already writes
every field the prescription supports, so an RPE captured while the column
was visible is never dropped when it is hidden again.

## Acceptance criteria

1. A set's type can be changed from the `SET` chip, and the chip glyph
   updates (`W` for warm-up, number otherwise).
2. Changing a set to or from warm-up **renumbers** the sets below it, and
   changes the completed-set count (story 42.8).
3. A set can be deleted from the type sheet. The last remaining set cannot be
   deleted — remove the exercise instead.
4. An exercise can be removed and replaced from `⋯`.
5. Turning on RPE adds a column to that exercise only, and the row still sums
   to `workoutTable.rowWidth` with the extra column present.
6. Removing an exercise is undoable — see story 74, which owns the restore
   mutation. Do not ship removal without it.
7. Web and mobile offer identical operations, verified by screenshot.

## Notes

Mobile already has a shared `Sheet` primitive from story 20
(`apps/mobile/src/components/Sheet.tsx`) with keyboard avoidance and safe-area
insets; use it rather than a new RN `Modal`. Web has `Modal.tsx` with the
scroll-lock and `dvh` handling from the same story.
