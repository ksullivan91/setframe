# ADR 0011: Set Logging Interaction Model — Table Rows, Autosave on Blur

Status: Proposed (design agreed in Figma; implementation not started).
Date: 2026-08-29.

## Context

Logging a set is the single most repeated interaction in the product. A
lifter performs it 10–30 times per session, one-handed, between sets,
while out of breath. Everything else in Setframe is used a few times a
week; this is used every ninety seconds.

Today's Workout currently models an exercise as a **form**. Each set is a
labelled field group — Set / Weight / Reps / Type / RPE — laid out
vertically, with a Save control per set and a separate "Previous session"
card stacked above the sets. At 390px this gives one set roughly the
vertical space a table gives five, so a three-set exercise does not fit
on screen. Two consequences follow, and both were reported by the user
after a side-by-side session against Hevy:

1. **You cannot see the exercise you are doing.** Scrolling is required
   within a single exercise, so there is no moment where the whole unit
   of work is visible.
2. **Completion is disorienting.** Because the completed card is a
   different height from the active one, finishing an exercise reflows
   the page and moves the next exercise under the thumb. The user's
   words: "it's hard to register what has happened and where you're at
   now."

The competitive teardown (`Backlog/research/`, 24 screens) found that
Hevy's advantage over Setframe reduces almost entirely to one screen. It
logs a set as a **row in a table** rather than a form, which buys density,
and it puts **last session in the row you are about to overwrite** rather
than on a separate card, which removes the need to remember or navigate
to beat it.

A first reading of Hevy's model recorded the tick as the control that
*saves* a set. That was wrong, and the correction matters to this
decision: Hevy **saves optimistically when focus leaves the row**, once
the row holds enough to be meaningful. The tick reports that the write
happened. It is feedback, not an action.

## Decision

Rework Today's Workout set logging as a table, on both web and mobile,
with four rules.

### 1. A set is a row, not a form

Columns are `SET · PREVIOUS · PR slot · <value columns> · result mark`.
The first three and the mark are constant — the PR slot is reserved in
every row, empty unless the set beat a record, so a PR never shifts the
columns beside it. The value columns are chosen from
`prescriptionDefinitions[kind].fields` in
`packages/domain/src/prescription-fields.ts`, so a run never renders an
LB column and a plank never renders REPS. RPE becomes an optional extra
column, off by default, rather than a permanent one.

Set **type** moves into the `SET` chip: tapping the set number opens the
type sheet. This reclaims a whole column the table cannot spare, and set
type is changed rarely enough that hiding it behind a tap is the right
trade.

### 2. Previous is a column, per set

`workout_exercise_log.previousSession.sets[index]` is already fetched and
already rendered — as a separate card above the sets. Moving it into the
row is a layout change over data we hold, requiring no API work. Tapping
the cell copies last session's values into the row.

### 3. The row writes itself on blur; there is no Save control

A row is written when focus leaves it and every field its prescription
marks as required holds a value. A half-filled row is simply not written
— nothing is lost, and nothing is nagged. The result mark on the right
reports the outcome of that write; it is deliberately a ring-and-check
achievement mark rather than a checkbox, so it does not read as a control
that must be pressed.

Editing a saved row therefore costs exactly one tap: select the field,
change it, move on. This is what makes corrections after completion free,
which the user asked for explicitly.

A failed write keeps the values on screen and turns the mark into a
retry. This is the rule the current optimistic-update code already
follows and must keep: a silent save and a silent failure must never look
the same.

### 4. Completion is derived, and changes nothing about the layout

An exercise is complete when every planned row is written; warm-up sets
do not count toward it (story 42.8). Completion does **not** collapse the
card, insert a summary block, or move anything. It swaps the plan pill
for a result pill in the same slot, tints the rows, and tints the card
border. The card's height and position are byte-identical before and
after — verified in Figma: both states measure 264px.

The result pill reports **total volume and its delta against last
session** (`+80 lb`, `Matched last session`, `−140 lb`, `First time`),
never a set or rep count. An extra set at lower reps is not progress, and
volume is the only figure that survives that.

PRs are marked with a solid accent-purple badge in the row. An earlier
pass used amber, on the reasoning that purple means planned and green
means done so an achievement needs a third colour. That reasoning was
sound and the colour was not: `Status/Caution` measured **1.63:1**
against a completed row, nowhere near AA. Purple is reused instead, but
in a different *form* — a solid badge (6.10:1) against the plan pill's
subtle tint — so the two never look alike even though they share a hue.

Amber is still in the palette, in the one role it can hold legibly: the
Down result pill's background wash (`#F5A623` @ 16% under `Text/Primary`,
16.16:1). The rule that falls out of this is worth stating once — **amber
never carries text colour, only a wash under dark text.**

This keeps the existing reward hierarchy intact and correctly ordered:

```text
set saved      → the row's tint and mark        (tiny)
exercise done  → result pill and card border    (small)
workout done   → the completion banner          (strongest)
```

An earlier iteration gave completed cards a full green gradient. On the
workout-complete screen, where every card is complete, that made the page
uniformly green and flattened the hierarchy — the exercise reward became
indistinguishable from the session reward. The gradient was pulled back
to a tinted border for exactly that reason.

## Alternatives considered

**Keep the form, shrink it.** Reducing padding and font sizes buys perhaps
30% and costs legibility at arm's length, which is the one thing a gym
screen cannot trade. It does not fix the reflow-on-completion problem at
all, because the completed card would still be a different shape.

**Keep the Save button, add the table.** Density improves, but the button
occupies a column and, more importantly, keeps the wrong mental model: a
control that means "persist" rather than a mark that means "done". It
also makes correcting a saved set a two-tap operation.

**Collapse completed exercises to a summary strip.** The densest option,
and the one that most aggravates the reported problem: collapsing changes
the height of the thing the user is looking at, which is precisely the
jarring transition being fixed.

## Consequences

- Write volume rises: a row is written on every blur, including
  corrections, where today one Save covers a set. `PATCH
  /v1/workout-sets/:setId` (`apps/api/src/routes/workout-sessions.ts`) is
  already idempotent per set, so this is a throughput question rather than
  a correctness one — but it needs
  debouncing on the client and should be watched on the wire during UX
  review (`review.watch()` records API traffic precisely for this).
- The `Type` and `RPE` fields lose their permanent columns. `RPE` becomes
  an opt-in column; `setType` moves into the `SET` chip. Neither changes
  the schema — `workout_set` already carries both as nullable columns.
- The session header is **fixed to the top** and the `+ Add exercise` bar
  is **fixed to the bottom** on mobile; the header condenses from 76px to
  48px on scroll. Neither was specified by the original frames, which are
  static compositions — scroll behaviour was simply undefined. The
  load-bearing consequence is that scroll-into-view on focus must clear
  both fixed regions, not merely land inside the viewport;
  `ExerciseWorkCard.tsx`'s existing `STICKY_ACTIONS_CLEARANCE_PX` is the
  precedent. See `docs/design/workout-logging-table.md` §10.
- Both platforms must move together. `apps/web/src/pages/WorkoutSessionPage.tsx`
  and `apps/mobile/app/workout/[sessionId].tsx` are independent
  implementations of the same screen, and parity here is mandatory.
- `ExerciseWorkCard` (React Aria `Disclosure`) becomes unnecessary for
  the active session: with an exercise costing ~264px, expand/collapse no
  longer earns its complexity. It may still be wanted for a long session's
  already-finished exercises; that is a follow-up question, not part of
  this decision.
- A contrast audit of the new frames found six AA failures beyond the
  amber, four of which were in this design and are fixed: the result
  pill's white-on-green (2.26:1 → 7.98:1 with dark text), the `PREVIOUS`
  column (3.21:1 → 16.24:1), the `SET` chip glyph (3.11:1 → 15.73:1), and
  the warm-up chip (1.46:1, now an outlined chip with a legible glyph).
  Contrast is not a place to encode hierarchy; size, weight and fill are.
- Two pre-existing token pairings failed the same audit and are **not**
  changed here, because they appear across shipped screens and are a
  design-system decision rather than a decision about this one:
  `Text/Secondary` on `Surface/Sunken` (3.11:1) and `Text/Disabled` on
  `Surface/Sunken` (1.46:1). Worth a separate look.
- Story 42's `CompletedExerciseReadout` survives intact. Its metrics and
  `compareWithPreviousSession` are what the result pill renders; this ADR
  changes where that readout is drawn, not how it is computed.
- ADR 0005 is untouched. Snapshotting prescription onto
  `workout_exercise_log` at session start is what makes per-kind columns
  safe to render for old sessions.

## References

- Layout, states and Figma node IDs: `docs/design/workout-logging-table.md`
- Per-control behaviour, save lifecycle, focus order, sheets, motion and
  accessibility: `docs/design/workout-logging-interactions.md`
- Competitive teardown: `Backlog/research/` (24 screens)
- Completion rules and warm-up exclusion: `packages/domain/src/completed-exercise.ts`
- Column source of truth: `packages/domain/src/prescription-fields.ts`
