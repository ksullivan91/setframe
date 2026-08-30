# Training Flow — "Build your own"

**Status:** Exploration. **Not signed off.**
**Figma:** section `🔬 Exploration — Training flow: "Build your own"` on the 📱 Mobile page
**Parent:** `docs/design/training-page-exploration.md` — this is one of the
three routes off `Training 1 · No plan yet`.

The reference walkthrough above shows *what the pages are*. This shows *what
happens when someone actually sets one up*, screen by screen, and the
existing exploration is untouched.

| # | Frame | Node |
|---|---|---|
| 1 | `Build 1 · Name your plan` | `161:708` |
| 2 | `Build 2 · Plan, no workouts` | `161:743` |
| 3 | `Build 3 · Name the workout` | `162:708` |
| 4 | `Build 4 · Workout, no exercises` | `162:750` |
| 5 | `Build 5 · Search and pick exercises` | `163:708` |
| 6 | `Build 6 · Choose the days` | `164:708` |
| 7 | `Build 7 · One workout in, keep going` | `164:747` |
| — | `Build your own — flow notes` | `165:708` |

Four steps — **Name it · Add a workout · Pick exercises · Choose days** —
shown on every screen. A setup that does not say how many steps remain is the
one people abandon halfway.

---

## The gap in the brief

**Step 1 was missing.** The sequence went from tapping "Build your own"
straight to a plan existing, but something has to name it. It is also the
right place to explain what a plan *is* — that hierarchy is exactly what beta
testers misread in stories 17–20.

---

## Screen notes

**2 · Plan, no workouts.** Scheduling is **absent**, not disabled. There is
nothing to schedule yet, so offering it would be a dead end.

**3 · Name the workout.** Defines a workout as "one training day you repeat",
offers six concrete names as chips, and warns against naming it after a date
— the specific mistake the hierarchy confusion produces.

**4 · Workout, no exercises.** Says targets are optional *here*, because story
19 made planned values optional and nothing in the product tells the user.

**5 · Search and pick.** Search is shown mid-query with filtered results, not
as an empty box over a full catalogue. Multi-select shows an **order number**
rather than a tick: order is what the workout gets built in, and it is the
only feedback that says a second pick did not replace the first.

**6 · Choose the days.** A day-of-week multi-select, **not** the full schedule
editor. At this point exactly one workout exists, so "which days is Upper A
on" is the whole question. The full editor is for later, when several workouts
compete for days.

**7 · One workout in.** A one-line acknowledgement, not a celebration — the
reward hierarchy reserves anything bigger for finishing a session. "Add
another" and "Done" sit side by side, because one workout is genuinely enough
to train.

---

## Decisions taken in the drawing

| | |
|---|---|
| No workout editor in this flow | Per the brief. Step 5 returns straight to step 6. The editor still exists for **later** editing — it is step 3 of the reference walkthrough — but stopping to admire the workout mid-setup breaks the momentum the flow is for. |
| Targets are never asked for | Story 19 made planned values optional, so the flow never blocks on sets and reps. |
| Scheduling can be skipped | Step 6 offers "Skip for now" and states the consequence: the workout is startable from Training whenever you like. **An unscheduled workout is a legitimate state, not an incomplete one.** |
| Every step is escapable | Cancel on 1, back arrows throughout, skip on 6. Nothing in setup is a trap, because everything it produces can be changed afterwards. |

---

## Gaps — what is still missing

Found by drawing the flow rather than by reasoning about it.

1. **The other two routes.** "Just start training" and "Start from a template"
   both come off step 1 of the reference walkthrough and neither is drawn.
   Template also has **no data behind it** — starter plans do not exist as
   records.
2. **Creating an exercise that is not in the catalogue.** The picker has a
   "New" affordance in the corner and no screen behind it. With **33 system
   exercises** this is the common path, not an edge case — and it is the same
   gap story 74 flags in the logger.
3. **Adding a second workout.** Step 7 offers it; the loop back to step 3 is
   assumed rather than drawn. The interesting part is **step 6 the second time
   round**: two workouts now compete for days, which is where the full
   schedule editor starts to earn its place.
4. **What Today shows the moment setup finishes.** The flow ends on Training,
   but the user's next move is almost certainly Today, and whether it says
   "Upper A, tomorrow" or something else is undesigned.
