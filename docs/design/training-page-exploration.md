# Training Page — Redesign Exploration

**Status:** Exploration. **Not signed off, not scheduled.**
**Figma:** section `🔬 Exploration — Training page redesign` on the 📱 Mobile page
**Builds on:** `docs/design/exercise-examples-exploration.md`, the Hevy
teardown (`Backlog/research/`), and ADR 0011's table-logging language.
**Flows off this:** `docs/design/training-flow-build-your-own.md` — the first
of the three routes off step 1, drawn screen by screen in its own section.

| # | Frame | Node |
|---|---|---|
| 1 | `Training 1 · No plan yet` | `148:708` |
| 2 | `Training 2 · A plan, nothing in it` | `158:708` |
| 3 | `Training 3 · Build a workout` | `147:708` |
| 4 | `Training 4 · Set an exercise's targets` | `152:708` |
| 5 | `Training 5 · Plan the week` | `150:708` |
| 6 | `Training 6 · Assign a day` | `156:708` |
| 7 | `Training 7 · Set up, and training` | `146:709` |
| 8 | `Training 8 · Later — switch plans` | `151:708` |
| — | `Training — Recommendations and interactions` | `149:708` |
| — | `Training — Empty states` | `152:824` |

**The frames are laid out left to right as a walkthrough**, in the order a
fresh user actually moves through them, and the step number is in each frame
name so the sequence survives someone dragging a frame on the canvas. The two
reference boards sit after the journey rather than inside it.

Steps 1–7 are one continuous path: no plan → a plan with nothing in it →
build a workout → set its targets → plan the week → assign a day → training.
Step 8 is a separate, later journey — switching plans is not part of setup.

**Step 2 is a bridge that was missing.** Without it the walkthrough jumped
from "no plan" straight to a fully populated overview, with nothing showing
what the page looks like in the state a user is actually in for the first ten
minutes. It also puts two of the catalogued empty states where they are
really met, rather than only as cards on a spec board — and it orders them
**workouts before schedule**, because there is nothing to schedule until a
workout exists.

Together these cover every path the overview offers: the three tabs it
replaces, the editor it pushes to, the sheet that edits a prescription, and
the three empty states that had no design at all.

---

## 1. What is wrong today

Measured, not asserted. `apps/mobile/app/(tabs)/training.tsx` is **1,143
lines**, three tabs, six nested `Card`s — and **there is no Figma frame for
mobile Training anywhere in the file**. It was built, never designed.

**The tabs are table names.** Programs / Workouts / Schedule map one-to-one
onto `training_program`, `day_type` and `program_schedule_slot`. The user
picks which part of *our data model* they want before they can act — the
textbook case of naming things by how the system is built.

**Master and detail are stacked.** Selecting a workout *appends* its editor
below the list rather than pushing a screen, so on a phone you scroll past
the list you just used to reach what you selected. Two of the six cards
exist only in that appended state.

**The plan is invisible.** Nothing shows where you are *in* the program —
week 3 of 8, what is next, what you already did this week. The data exists;
the page never says it.

**The blank page is a wall.** The teardown's biggest structural finding,
verbatim: *"Setframe requires a program before Today has anything to offer.
Our novice journey currently lands on 'Set up your training' — correct, and
a wall."*

---

## 2. Recommendations

In build order. The first two change how the page feels; the rest follow.

### 2.1 Delete the tabs

One scrollable page answering three questions in the order people ask them:
**what am I following**, **what is this week**, **what is in it**. Tabs cost
a decision before any action and hide two thirds of the page.

The overview adds a block-progress bar (`Week 3 of 8`) and a week strip —
both from data we already have and neither currently shown.

### 2.2 Fix the blank page

Three routes out, **ordered by how soon the user gets to train** rather than
by how complete the resulting data is:

1. **Just start training** — primary. Log now, pick exercises as you go.
2. **Start from a template** — Upper/Lower, PPL, Full Body 3-day, with real
   exercises and targets already filled in.
3. **Build your own** — guided setup, for people who know what they want.

### 2.3 Push the editor, don't append it

Master/detail on a phone is a push, not an accordion.

### 2.4 Reuse the picker everywhere

The picker from the exercise-examples exploration becomes the single
add-exercise surface — session, workout editor, program wizard — with
**multi-select and a running count**. A teardown *Adopt*: today's picker
adds one and closes, so building a day means reopening it per exercise.

### 2.5 Show the illustration tile in the editor

The editor is a **choosing** surface, which is where the teardown said the
tile earns its space. Same 36px tile and `muscle · equipment` subtitle as
the picker, so a workout reads the same way wherever you meet it.

---

## 3. "Just start training" — the one that needs a decision

Taken from the teardown's **Adapt**, not its Adopt, and the wording matters:

> *"Worth having, but not as 'Start Empty Workout'. Our whole model
> separates intent from fact; an unplanned session should still be a
> first-class session that can later be turned into a day type. That is a
> design question, not a button."*

| | |
|---|---|
| What it creates | A real `workout_session` with no `templateId` — which the schema already permits, since `templateId` is nullable. Not a special mode, not a scratchpad. |
| How exercises get in | The picker, mid-session, exactly as in a planned session. Nothing new to build. |
| Afterwards | "Save as a workout" offers to create a `day_type` from what was performed. **Intent authored from fact** — the reverse of the usual direction, and the reason this is a design question. |
| What it must not do | Write back to an existing `day_type`, or turn the session into a template implicitly. ADR 0005 keeps intent and fact separate; this creates *new* intent on request and never mutates existing intent. |
| **Open question** | Whether an unplanned session counts toward streaks and `weeksTrained`. It is a real session, so probably yes — but that is a product call with consequences in `packages/domain/src/training-trends.ts`. |

---

## 4. Interaction details

| Control | Behaviour |
|---|---|
| Program card · **Change** | Opens the program list. Switching does not delete the old program or its history — programs are versioned (`program_version`), so switching is a pointer move. |
| Week strip · a day | Past opens its logged session (still editable, per ADR 0011); today opens the logger; future previews the plan. Rest days toggle from here — the endpoint story 21 built. |
| Week strip · state | Done is a success tint, today solid accent, upcoming neutral, rest neutral with the word *Rest*. **State never rides on colour alone** — the label under each chip carries it. |
| Workout row · tap | Pushes the editor. The whole row is the target, not just the chevron. |
| Workout row · **Next up** | Marks the next *scheduled* workout, derived from the schedule and today's date. A readout, not a control. |
| Editor · drag handle | Reorders within the workout, writing `sortOrder` on `day_type_exercise`. Never touches a logged session — session rows snapshot their prescription at start (ADR 0005). |
| Editor · exercise `⋯` | Edit prescription, replace, remove. Removal offers undo, matching the program editor's existing pattern. |
| Editor · **+ Add exercise** | Opens the picker with multi-select. Returning appends every selection in order, each with its kind's default prescription. |
| Editor · hint line | *"Editing this workout changes the plan, not any workout you have already logged."* ADR 0005's separation stated where someone might doubt it, rather than in a doc they will not read. |
| Empty states | A program with no workouts, a workout with no exercises, a week with nothing scheduled. **None exist today; all three are reachable in normal use.** |

---

## 4a. Schedule (`150:708`)

Replaces the Schedule tab. Two things live here that the product has never
surfaced:

**Repeat mode.** `cycle_length_weeks` is real in the schema — set means a
block, null means it repeats every week — and nothing has ever shown it.
Switching to a block asks for a length; switching away keeps the pattern
and drops the end date.

**Per-date changes.** Story 21's overrides, surfaced where they are made
rather than on Today only. Each row states what changed and offers Undo,
under the line users most often get wrong: *swapping one date does not
change the weekly pattern.*

A day row opens the assignment sheet (§4a.1). Nothing here touches a logged
session — rescheduling changes intent, and sessions snapshot their
prescription at start (ADR 0005).

### 4a.1 Assigning a day (`156:708`)

What the chevron opens. It was specified and never drawn, and drawing it
turned up a schema affordance the design would otherwise have quietly
removed.

**A day can hold several workouts.** `program_schedule_slot` has **no unique
constraint** on `(programVersionId, dayIndex)` and carries a `sortOrder`, so
several slots can share a day, in order. Designing this as single-select
would have ruled out two-a-days the data model already allows — so it is
**multi-select**, and the check becomes a number once more than one is
chosen.

**Rest clears the day.** `dayTypeId` is `NOT NULL`, so Rest cannot be a slot
pointing at nothing — choosing it **deletes** the day's slots. That is why it
sits below a divider and reads "Clears whatever is on this day": it is a
different kind of action from the four above it.

**Scope is the weekday**, not the date. The footer says so and points at
"Changes to specific days" for the one-date case, because confusing the two
is the mistake this screen most invites.

No Save button — selecting writes immediately and the row behind the sheet
updates. The sheet is a picker, not a form.

> **Still undrawn:** `program_schedule_slot.weekNumber` is nullable — null
> repeats every week, a number pins a slot to one week of a block. In block
> mode this sheet needs a week selector too. It is the only part of the
> schedule model still without a design.

## 4b. Plans (`151:708`)

Reached from the overview's **Change**, not from a tab. Named "Your plans"
rather than Programs — the object stays, the jargon does not.

The active plan is badged **"Driving Today"**, saying what it *does* rather
than using the word Active. Stories 24–26 built a deliberate
selected-versus-active distinction; on a phone there is no editing context
to hold, so this list only ever sets active and pushes the rest.

Switching is a **pointer move** — `program_version` keeps the history — so
it needs no confirmation and no migration. The reassurance is in the copy
rather than a dialog: *"Switching keeps everything. Your logged workouts
stay with the plan you did them on."*

> Still open, and worth recording: whether one person should have more than
> one plan at all. The multi-program model was built deliberately, not
> accidentally, so collapsing it means deciding what happens to the weeks
> already run under a plan you leave.

## 4c. Prescription sheet (`152:708`)

Opened from an exercise row's `⋯`, replacing a modal that today sits inline
in a builder panel.

**Kind is read-only**, shown as a pill with "set when added", matching the
shipped `ExerciseEditModal`. Changing kind would change what every
already-logged set *means* — the same columns read as a different
representation.

Fields follow the kind, from the same `prescriptionDefinitions` the logger's
columns use. **Blank is allowed** — story 19 made planned values optional —
and the hint says so rather than leaving it to be discovered.

## 4d. Empty states (`152:824`)

| State | Reached by |
|---|---|
| **No plan at all** | A brand-new account, and again by anyone who archives their last plan. **The outermost case** — a user here cannot reach any of the three below it. Designed as a whole screen (`148:708`) rather than a card, because it is the one empty state someone can meet before they have ever succeeded at anything, and because the teardown's biggest structural finding lives in it. |
| Plan with no workouts | Immediately after creating a plan — the most common way to meet an empty Training page. |
| Workout with no exercises | Creating a workout, **and** removing the last exercise from one. The second path matters: it is a state you fall into rather than start in. |
| Week with nothing scheduled | A plan with workouts but no slots, which guided setup can exit into. |

The last three share a shape: one sentence saying what the thing is for, then
one button naming the action. No illustration — they are transient states on
the way somewhere, not destinations worth decorating.

**The first deliberately does not share that shape.** It is not a card inside
a page; it *is* the page, and it offers three routes out rather than one
button. It gets one design, referenced from the catalogue rather than
redrawn — two designs for one state is how they drift apart.

---

## 5. Not proposed

**A public routine library.** Hevy's *Explore Routines* solves the blank
page, and the teardown marks it **Adapt**, not Adopt — our equivalent is
starter templates that fill a real `day_type` with a real prescription, not
a copied text list. Sharing routines between users is a much larger product
than a template picker, and is not what §2.2's "Start from a template"
proposes.

**Web is unchanged.** `Screen/Web/Training` already has a two-column
master/detail layout that works at 1280. The problems in §1 are phone
problems. Whether the overview model should replace the web layout too is a
separate question.
