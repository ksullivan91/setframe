# Progress visualization — direction

Written 2026-08-25, after the Progress rebuild (stories 46–51) shipped and
was judged "barely better than what we had before."

## The critique, accepted

The pack README listed, as a *problem to fix*:

> The new charts largely retained the old information architecture.

Stories 48–50 did it again. They delivered real machinery — calendar-aware
windows, per-range bucketing, scrub, a stationary readout, honest partial
periods — and hung all of it on **the same three cards**: sessions per
week, weekly volume, body weight. Three single scalars over time, with a
range picker added.

That machinery was necessary and is not wasted. But it answered north-star
questions 1–3 (*what is changing, over what period, versus my baseline*)
and left 4 and 5 — **what caused the change**, and **what should I pay
attention to next** — essentially untouched. A chart cannot answer "what
caused this" if each chart shows exactly one number and no chart shares an
axis with any other.

## What the data actually supports

Taken from the live schema and verified against the live database, not
assumed:

| Signal | Source | Populated today |
|---|---|---|
| Movement pattern (squat, hinge, vertical/horizontal push+pull, isolation, cardio) | `exercise.movement_pattern` | 33 of 55 exercises |
| Muscle mapping | `exercise_muscle` → `muscle_group` | table exists |
| Personal records | `workout_set.is_pr_weight` / `is_pr_reps` | **18 flags** across 89 sets |
| Set role | `workout_set.set_type` | working 82, warmup 6, backoff 1 |
| Perceived effort | `workout_set.rpe` / `rir` | 3 sets / 0 sets — capability, not yet data |
| Planned work | `day_type_exercise_planned_set`, `program_schedule_slot` | present |
| Rest and overrides | `rest_day`, `schedule_override` | present |
| Recovery / activity | `daily_activity_summary` (resting HR, steps, rings, exercise minutes) | present |
| Nutrition | `daily_nutrition_snapshot` (kcal) | present |
| Subjective | `daily_manual_entry.mood`, BP | mood on all 5 entries |
| Session shape | `workout_session.started_at` / `completed_at` | present |

**None of the first ten are used by any chart.** Estimated 1RM is computed
in `packages/domain` and shown only inside per-exercise history, not on
Progress.

## Principles this direction commits to

Drawn from the sources the pack itself names (Apple's *Design an effective
chart*, the HIG's charts guidance) plus the standard visualization
literature they rest on.

**A chart earns its place by answering one question.** Not by displaying a
column that exists. "Weekly volume" is a number, not a question.

**Position encodes best, then length, then angle and area; colour is
worst.** (Cleveland–McGill.) Anything load-bearing goes in position or
length. Colour may reinforce, never carry — the same rule Story 33 already
enforced for the current-period marker.

**Superpose to compare, juxtapose to survey.** Planned versus actual share
a scale and belong on one axis. Different metrics with different units do
**not** — a dual-axis chart invents correlations. Use small multiples with
a shared time axis instead, which is also how you compare six lifts
without six unrelated cards.

**Composition beats a total.** One "weekly volume" figure destroys the
thing a lifter actually asks: *what did I train?* Volume split by movement
pattern answers balance and neglect; the total is recoverable from it, the
reverse is not.

**Annotate the timeline.** A PR, a deload, a program switch, a rest day —
these turn a line into a narrative and are precisely "what caused the
change." We already compute PRs server-side and show them nowhere.

**One temporal lens governs the page.** Stories 48–50 gave each card its
own range selector. That makes cross-reading dishonest — two charts can
silently show different periods. Range belongs to the page.

**Sparse data is a state, not a failure.** Most of these views need history
to be worth drawing. Each must degrade to something truthful and say what
it is waiting for, rather than rendering an empty axis.

## Proposed information architecture

Organised by the question asked, not by the table queried.

### 1. Am I getting stronger?
Per-lift estimated 1RM as **small multiples** sharing one time axis —
compact sparklines, direct-labelled, ordered by recency of training. PRs
marked on the line. This is the single most-asked question in a training
app and Progress currently cannot answer it at all.

### 2. Am I training the way I planned?
Planned versus completed sessions, **superposed** on one axis, with rest
days distinguished from missed days. This answers "what caused the change"
more often than anything else: volume fell because two planned days were
missed, not because effort dropped.

### 3. What am I actually training?
Weekly volume **split by movement pattern** — the composition the current
single total hides. Surfaces neglect (no hinge in five weeks) which no
aggregate can.

### 4. How is my body responding?
Body weight with its trend, kept as story 49 built it, but placed with its
context: intake where nutrition exists, resting heart rate and mood where
they exist. Correlation shown by **shared time axis**, never a second
y-axis.

### 5. What deserves attention?
Story 51's deterministic insight contract already produces the sentences.
It should point *into* these views — an insight about volume focusing the
composition chart at the period it describes.

## Designing for the coaching layer

Progress is not meant to end as a reporting page. The intent is to build
insight and coaching on top of this data. That has a concrete architectural
consequence *now*, and getting it wrong makes the coaching layer a rewrite
rather than an addition.

**A coach does not show you a chart. A coach makes a claim and points at
the evidence.** "Your squat has stalled for three weeks" is the claim; the
e1RM line is the evidence. Today the page is built the other way around —
charts are the primary objects and Story 51's insights are a caption
underneath one of them.

So the unit of the page should be an **observation**: a statement, plus the
series and window that justify it, plus how confident we are.

```
Observation
  claim        what changed, in one sentence
  evidence     which series, over which window
  confidence   sample size and whether the signal clears noise
  disposition  informational | worth attention | actionable
```

This shape is what makes the eventual coaching layer additive:

- **Today** an observation is produced by a deterministic rule (Story 51's
  contract already does this, and must stay the floor — it is what
  guarantees we never fabricate).
- **Later** an observation can be produced by a model, or by a progression
  rule, or by a coach. The rendering, the evidence link and the confidence
  gate are already there and do not change.
- **Never** does an observation render without its evidence. That is the
  property that keeps a coaching feature honest, and it is far cheaper to
  enforce as a type today than to retrofit.

`progression_rule` already exists in the schema and is unused. It is the
natural first non-trivial observation source — "this program says add 5 lb
when you hit the top of the rep range; you did, three sessions ago."

Two constraints this puts on the work below:

- **Charts must be addressable.** An observation needs to focus a specific
  chart at a specific window. Charts therefore cannot own their range
  privately, which is the same conclusion the "one temporal lens" principle
  reached from a different direction.
- **Confidence must be computed, never implied.** Story 51 already found
  four bugs of exactly this kind — a fabricated baseline, a caveat that
  fired always, a threshold that hid a real move, a 2-day average that was
  pure water-weight noise. A coaching layer multiplies the cost of each.

## What shipped (2026-08-25)

Views 1, 2 and 3 are built on both platforms and deployed.

| View | Status |
|---|---|
| 1. Am I getting stronger? | **Shipped** — per-lift estimated 1RM as small multiples over a shared time axis, with PRs as an annotation layer. Panels sort by *proportional* change, since sorting by absolute change ranks the heaviest lift first on every render and says nothing. A lift is withheld below the metric's own `minimumSessionsForTrend`. |
| 2. Am I training as planned? | **Shipped** — planned vs completed, superposed. `plannedCount` now derives from the active program version's schedule slots, replacing a `null` that had been hardcoded since the route was written. Weeks the program never covered are omitted, never drawn as zeroes. |
| 3. What am I actually training? | **Shipped** — weekly volume by movement group. `movement_pattern` was backfilled (migration 0008), taking ungrouped volume in production from 15,725 lb to 0. |
| 4. How is my body responding? | Body weight ships as Story 49 built it. Intake, resting HR and mood remain unwired — they depend on health/nutrition sync being live. |
| 5. What deserves attention? | Story 51's insights ship and link to their chart anchors. The full observation contract below is not built. |

Two design decisions were changed by *looking at rendered pixels*, not by
reasoning:

- Composition first drew the detailed patterns and folded the tail past a
  palette-sized cap. Rendered, the grey "Other" band was one of the largest
  things on the chart. It now groups into Legs / Push / Pull / Core & carry /
  Isolation, which cannot overflow the palette.
- Small multiples first used an absolute minimum domain span. 20 lb is noise
  on a 400 lb deadlift and the entire range of a 25 lb lateral raise, so one
  number either failed to damp the heavy lift or flattened the light one. It
  is now a fraction of each lift's own median.

## Sequencing

Views 1 and 2 are the highest value and rest only on data that is already
populated and already computed. View 3 needs `movement_pattern` backfilled
for the remaining 22 exercises. View 4 depends on health/nutrition sync
being live for the user. View 5 is wiring.

Nothing here discards stories 48–51: the range model, bucketing, scrub,
stationary readout, honest partial periods and insight contract are the
foundation these views are drawn on. What changes is *what gets drawn*.

The chart math moves onto d3's headless modules (`d3-scale`, `d3-shape`,
`d3-array`, `d3-time`) inside `packages/domain` — see ADR 0010. Both SVG
renderers stay exactly as they are, so parity and the accessibility
baseline are unaffected; what changes is that stacking, band scales,
calendar ticks, `nice()` domains and curve interpolation stop being ours to
hand-roll and get wrong.
