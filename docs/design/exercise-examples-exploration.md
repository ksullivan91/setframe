# Exercise Examples — Exploration

**Status:** Exploration. **Not signed off, not scheduled, nothing agreed.**
**Scope:** Additive only — nothing in the agreed table-logging design changes.
**Figma:** section `🔬 Exploration — Exercise examples` on the 📱 Mobile page
**Related:** `docs/design/workout-logging-table.md`, `docs/design/workout-logging-interactions.md`
**Consumed by:** `docs/design/training-page-exploration.md` — the Training
redesign uses this picker as its single add-exercise surface, and reuses the
illustration tile in the workout editor.

Prompted by Hevy's treatment: every exercise row in their picker and their
routine builder carries a small line drawing and a primary-muscle
subtitle, and each exercise has a "How to" tab. The competitive teardown
marked this **Adopt**, with the reasoning that our text-only list makes
"Sumo Squat" versus "Sumo Squat (Barbell)" a guess.

> **The illustrations in these frames are schematic placeholders** drawn
> to occupy the slot and let the layout be judged. They are not proposed
> artwork. The asset question is §5.

---

## 1. Figma frames

| Frame | Node |
|---|---|
| `Explore/Mobile/ExercisePicker` | `129:513` |
| `Explore/Mobile/ExerciseDetail` | `130:512` |
| `Explore/Mobile/WorkoutLoggerV2 + thumbnails` | `131:512` |
| `Explore/Spec/ExerciseExamples` | `132:574` |

---

## 2. Where examples earn their space

The teardown's complaint is a **choosing** problem, not a **doing**
problem. That ranks the four candidate surfaces:

| Surface | Value | Note |
|---|---|---|
| Exercise picker | **Highest** | Thumbnail + muscle/equipment subtitle turns a wall of similar names into something scannable. This is where the complaint actually lives. |
| Replace exercise | High | Same picker, and you are choosing under time pressure mid-session. |
| Exercise detail | Medium | The "how to" surface — worth having for an unfamiliar movement, and the natural home for cues and muscle detail. |
| Active logger | **Lowest** | Mid-set you know what you are doing; you are looking at the numbers. |

### 2.1 The picker (`129:513`)

Rows carry a 44px illustration tile, the name, and a
`muscle · equipment` subtitle — `Chest · Barbell`, `Glutes · Barbell`.
That subtitle alone disambiguates most of the library, and it is drawn
from data we already model.

The picker also picks up the teardown's other Adopt: **multi-select with
a running count**. Rows toggle, and the primary action reads
`Add 2 exercises`. Today's picker adds one and closes, so building a day
means reopening the sheet per exercise.

### 2.2 The detail screen (`130:512`)

Hero illustration, muscle chips (`Chest · primary`, then secondaries),
a `How to / History / Records` segmented control, four numbered cues, and
a **"How to log this"** callout.

That last block is the piece a generic exercise database cannot supply,
because it is about *our* logging model: "Record the total weight on the
bar, including the bar. Warm-up sets are logged the same way but do not
count toward your completed sets." It ties the exercise content back to
the prescription kind and the completed-set rule.

### 2.3 The logger, with thumbnails (`131:512`)

Measured, not guessed:

| | Height |
|---|---:|
| Exercise card today | 264px |
| With a 36px thumbnail | **272px** |
| Delta per card | +8px |
| Delta across six exercises | +48px |

Affordable. The honest case for it is **not** decoration — it is a
one-tap route to the cues without opening a menu. The case against is
that it spends density on the moment that needs it least.

---

## 3. How the user gets there

Every path leads to the same detail screen, so there is one thing to
build and one place the content lives.

| Path | Behaviour |
|---|---|
| Picker · tap the row | **Selects** the exercise. Does not navigate — multi-select is the point, and a detour per row would destroy it. |
| Picker · tap the thumbnail | Opens the detail screen. Splitting the row this way keeps select fast while making learn-more available without a second control. |
| Logger · `⋯` → "How to perform" | New row in the exercise actions sheet, above "View history". Works whether or not thumbnails ship in the logger. |
| Logger · tap the thumbnail | Only exists if thumbnails ship in the logger — the strongest argument for them. |
| Program editor | Same picker, so it comes along for free. |
| Detail · "Add to workout" | Shown **only** when the detail screen was reached from a picker. Reached from the logger, the exercise is already in the workout. |

---

## 4. What it would cost to build

Three separable pieces with very different costs, and the cheapest one
carries most of the value.

### 4.1 Muscle labels — no schema work

`packages/database/src/schema/exercise.ts` **already** defines:

- `muscle_group` (name, region)
- `exercise_muscle` (exercise → muscle group, `role`)
- `muscleRoleEnum` = `['primary', 'secondary']` in `enums.ts`
- `exercise.equipment` and `exercise.movementPattern` as columns

So the subtitle and the muscle chips need **data, not migrations**.

> **They are empty, and confirmed so without production access.** Both
> tables are created in migration `0000_melodic_anthem.sql` and referenced
> nowhere else in the repo — no seed, no route, no query. Zero writers,
> zero readers. The schema work is genuinely done; the data work has not
> started, and the picker cannot show a muscle subtitle until it does.

### 4.2 Cues — small schema

One nullable `jsonb` column on `exercise`, or an `exercise_cue` table if
cues need ordering and per-locale text. The schema is trivial; the real
work is content authoring — roughly four lines per movement across the
library.

### 4.3 Illustrations — the expensive part

One nullable asset reference on `exercise`, plus an asset pipeline that
**does not exist today**: storage, sizing, and a licence that covers
redistribution. This is what the teardown meant by "requires a media
pipeline we do not have".

---

## 5. Recommendation, and what needs deciding

**Reserve the slot, ship the data.** The same move the PR badge made in
the logger: fixed space that sits empty until it is filled means
illustrations can arrive later without a redesign.

| | |
|---|---|
| **Ship first** | Muscle/equipment subtitles in the picker, and the detail screen with muscles plus cues. Zero asset cost, no new pipeline, and it fixes the actual complaint. |
| **Reserve now** | The illustration tile in the picker row and the detail hero. Empty, they read as a neutral tile; filled later, nothing around them moves. |
| **Decide — assets** | Licence a set, commission one, or ship without. Licensed sets rarely cover a full library, and the gaps look worse than no art at all; commissioning is slow but matches the line-art direction. |
| **Decide — logger thumbnails** | +8px per card is affordable, but it buys the least-needed moment. |
| **Not proposed** | Muscle heat maps and per-exercise leaderboards — both were in the teardown's "leave" column and neither has changed. |

## 5a. Catalog size and where variants split

Settled in conversation after this doc was first written, and recorded on
the Figma board:

- **The rule is "would you expect different numbers?"** If a variant
  changes load, ROM or emphasis enough that the weight would differ, it is
  a separate exercise — because PR flags and every trend in
  `packages/domain` are scoped per exercise. **The catalog's granularity is
  the granularity of progression tracking.**
- Dumbbell vs barbell incline press, cable vs dumbbell lateral raise,
  EZ-bar vs straight-bar curl all **split**. Seated vs standing curl and
  wide vs medium grip bench do **not**.
- The risk is **synonyms**, not size: three rows for one lift split one
  user's history across three ids. That comes from a sloppy catalog, not a
  large one.
- **Target 300–500**, comprehensive, with ~70 fully enriched. Cues attach
  to the movement *family*, not the row, so authoring scales with families
  rather than exercises.
- Enabling work is `Backlog/68-exercise-catalog-cache-policy.md`.

## 6. Open questions

1. What is the muscle-group controlled vocabulary? `muscle_group` is a
   free-text `name` with an optional `region`, so the list is ours to
   define — probably 15–20 entries. It needs settling before any
   `exercise_muscle` rows are written, since it is the join target.
2. Does multi-select in the picker change the `POST /v1/day-types/:id/exercises`
   contract, or does the client just loop? Looping is simpler and probably
   right, but it changes error handling when set 3 of 5 fails.
3. Do cues belong to the exercise or to the *user's* copy of it? A user
   who renames or forks a system exercise should probably keep the cues.
4. Is "How to" content something we author, or is it the first thing in
   this product that would come from a third party? That is a different
   question from artwork licensing and has its own answer.
