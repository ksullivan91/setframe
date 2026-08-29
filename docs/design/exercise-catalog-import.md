# Exercise Catalog — Vocabulary, Naming, and Import Plan

**Status:** Vocabulary and naming **settled**. Catalog curation not started.
**Related:** `docs/design/exercise-examples-exploration.md`,
`Backlog/68-exercise-catalog-cache-policy.md`
**Figma:** `Explore/Spec/ExerciseExamples` (`132:574`)
**Source analysed:** `yuhonas/free-exercise-db`, 876 records, **Unlicense**
(public domain). Image licensing is *not* separately stated — take the
data, leave the images.
**Tooling:** `scripts/exercise-catalog/transform-source.mjs` →
`scripts/exercise-catalog/out/worklist.md`

We have **33** system exercises today
(`packages/database/src/seed-exercises.ts`). This document settles the two
decisions that block expanding that, and records what analysing the source
dataset actually showed — including three things an earlier draft of this
plan got wrong.

---

## 1. Settled: muscle vocabulary

The source uses **exactly 17 muscle values**, and the same closed set for
both primary and secondary. We adopt it, with one change.

### 1.1 `muscle_group.name` — 19 values

```
chest          lats           middle back    lower back     traps
front delts    side delts     rear delts     biceps         triceps
forearms       abdominals     quadriceps     hamstrings     glutes
calves         adductors      abductors      neck
```

The source's single `shoulders` is **split into front / side / rear delts**.

**Why split.** Muscle granularity is only worth having where it changes
what a lifter would do differently. "You have done 22 side-delt sets and 3
rear-delt sets this month" is actionable; "25 shoulder sets" is not, and
rear-delt under-training is one of the most common real imbalances.

**Why it is affordable.** 99 records have `shoulders` as a primary muscle.
Name patterns auto-assign 46 of them; **53 need a human**, because the
source has no field that distinguishes the heads (a lateral raise is side,
an overhead press is front, a face pull is rear — none of that is in their
data). A further 123 records need only a *secondary* head resolved, which
is far lower stakes and tolerates a bulk default. And the catalog has to be
hand-curated family by family regardless (§3), so the primary assignments
are marginal work on top of work we cannot avoid.

**Direction of travel.** Splitting later is additive — new `muscle_group`
rows plus updates to specific `exercise_muscle` rows. Merging later is
destructive. When unsure, split.

### 1.2 `muscle_group.region` — 6 values

```
Chest    Back    Shoulders    Arms    Core    Legs
```

The schema already models two levels (`muscle_group` has both `name` and
`region`), which is exactly what the design needs: `region` drives the
picker's coarse filter chips, `name` drives the detail screen's muscle
chips. No schema change.

---

## 2. Settled: naming and canonicalisation

### 2.1 Word order — `Movement (Equipment)`

`Bench Press (Barbell)`, not `Barbell Bench Press`.

In a result list where six rows begin "Bench Press", the distinguishing
token sits at a consistent position rather than buried mid-string. Our
current order sorts all barbell exercises together, which is the less
useful grouping.

**The source has no canonical bench press.** The flat barbell bench press —
the most-logged exercise in strength training — exists only as
`Barbell Bench Press - Medium Grip`. There is no plain `Bench Press`. Import
their names and our catalog's most important entry is called "Medium Grip",
which is on its own a sufficient argument for authoring names rather than
inheriting them.

**This is a migration, not a rename.** `canonicalSlug` is the upsert key,
so changing `barbell-bench-press` → `bench-press-barbell` makes the seed
insert a *new* row and orphan the old one, along with any user history
pointing at it. Needs a hand-written `UPDATE` mapping old slug → new for
the existing 33 rows, applied **before** any expansion. See
`docs/handoff.md` §2 — nothing applies migrations on deploy.

### 2.2 Equipment tokens — 7, closed

```
Barbell   Dumbbell   Cable   Machine   Bodyweight   Kettlebell   Band
```

**Excluded by decision: Smith machine and EZ-bar.** Smith variants are
dropped entirely (20 records); EZ-bar exercises are dropped rather than
folded into Barbell (9 records).

### 2.3 The split rule

> **Split if the load differs materially, OR the primary muscles differ.
> Either alone is sufficient.**

| | Load | Primary muscles | |
|---|---|---|---|
| Back squat vs sumo squat | differs | quads → glutes/adductors | **split** |
| Conventional vs sumo deadlift | differs | differs | **split** |
| Flat vs incline bench | differs | + upper chest, front delt | **split** |
| Medium vs wide grip bench | ~same | ~same | merge |
| Seated vs standing DB curl | ~same | same | merge |

**There is no list of banned qualifier words.** An earlier draft of this
rule banned "grip", "stance" and "seated/standing" qualifiers outright,
which would have merged back squat with sumo squat — the exact error the
rule exists to prevent. Grip, stance, angle and position are all sometimes
decorative and sometimes fundamental. The test is always the outcome.

User-facing version of the same test: **would you be annoyed to see them
merged in one progress chart?**

### 2.4 Default qualifiers are dropped; departures face the split test

A qualifier naming the **default** form of a movement is noise. "Medium
grip" is how a bench press is gripped unless stated otherwise, so carrying
it in the name implies a variant that does not exist — and it is why the
source has no plain `Bench Press` at all (§2.1).

> **Drop the qualifier if it names the default. Keep it only if it names a
> departure AND that departure passes the split test (§2.3).**

| Qualifier | Names | Outcome |
|---|---|---|
| `- Medium Grip` on bench | the default | **drop** → `Bench Press (Barbell)` |
| `with Neutral Grip` on DB bench | a departure, same load and muscles | **merge** into the canonical |
| `Wide-Grip` on bench | a departure, same load and muscles | **merge** |
| `Close-Grip` on bench | a departure, **primary → triceps** | **split**, own row |
| `Palms-Down` on wrist curl | a departure, **flexors vs extensors** | **split**, own row |
| `Decline` on bench | a departure, different load and muscles | **split** |

Palms-down versus palms-up wrist curl is the case that shows why there can
be no blanket "drop grip qualifiers" rule — those are opposite movements
working opposing muscle groups.

### 2.5 Anti-synonym rules

- One name per **movement + equipment** pair. Nothing else earns a row.
- A closed set of equipment tokens (§2.2).
- Consistent movement verbs — Press not Push, Row not Pull, Curl not Flexion.
- **`canonicalSlug` is a pure function of the name**, never hand-written:
  lowercase, then every run of non-alphanumerics becomes a single hyphen.

> **Parentheses are separators, not content to discard.** An earlier version
> of this rule said "drop parens", which silently deleted the equipment from
> every slug: `Bench Press (Barbell)` and `Bench Press (Dumbbell)` both
> became `bench-press`. The seed upserts on `canonicalSlug` with
> `ON CONFLICT DO NOTHING`, so the second would have been skipped **without
> an error** — an entire equipment variant missing from the catalog, and
> nothing anywhere to say so. Caught by the collision check in §4.1, which
> is the argument for having one.

`Bench Press (Barbell)` → `bench-press-barbell`.

---

## 3. What the source analysis showed

### 3.1 The funnel

| Step | Records |
|---|---:|
| All records | 876 |
| `strength` + `powerlifting` only | 622 |
| …equipment we keep | 546 |
| …Smith machine dropped | **526** |

Also excluded by category: 123 stretching, 61 plyometrics, 35 olympic
weightlifting, 21 strongman, 14 cardio.

Equipment distribution of the 526: barbell 134, dumbbell 121, cable 81,
bodyweight 75, kettlebell 56, machine 39, band 20.

**405 movement families — 72 multi-variant, 333 singletons.**

The family count is an artifact of the clustering heuristic in
`scripts/exercise-catalog/transform-source.mjs`, not a fact about the data.
A first pass stripped too many qualifiers and collapsed 32 unrelated records
into a single `press` family; the heuristic now keeps movement-defining words
(incline/decline, bench/floor, front/rear/side, overhead, leg) and strips only
equipment, grip width, laterality and stance.

### 3.2 Three corrections

An earlier plan claimed a mechanical import would mostly work. It will not.

**Shoulder auto-assignment is 46%, not the 80% first estimated.** Of the 99
shoulder-primary records in the final pool, name patterns confidently assign
46; 53 need a human.

**Mechanical de-duplication does not work.** Only 10 rows collapse
automatically, which looks like good news and is not. The bench press
family alone:

```
Barbell Bench Press - Medium Grip      Wide-Grip Barbell Bench Press
Close-Grip Barbell Bench Press         Bench Press - Powerlifting
Bench Press with Chains                Bench Press - With Bands
Reverse Band Bench Press               Dumbbell Bench Press with Neutral Grip
Hammer Grip Incline DB Bench Press     Machine Bench Press …
```

21 records a human reduces to six or seven, and automated clustering
caught none — qualifiers appear as prefixes (`Wide-Grip …`), suffixes
(`… - Medium Grip`) and mid-string (`Hammer Grip Incline DB …`), with `DB`
abbreviated inconsistently.

**Their muscle data cannot arbitrate splits.** A previous version of this
plan proposed using matching `primaryMuscles` as a mechanical guard against
wrongly merging variants. It does not work: every barbell squat variant in
the source is primary `quadriceps` — front squat, box squat, hack squat,
Jefferson squat, identical. The labels are too coarse to separate
movements. §2.3 remains correct as a *rule*; the source data cannot
implement it.

### 3.3 The conclusion

**The dataset is a good source of muscle mappings and a poor source of
names.** So invert the workflow:

- ~~import 876 → filter → dedupe → rename → ship~~
- **author our catalog family by family → match into the source → inherit
  `primaryMuscles` / `secondaryMuscles` → hand-fill the misses**

Naming and canonicalisation are then settled *by construction*: we are not
reverse-engineering rules to clean up someone else's names, we are writing
the names we want.

---

### 3.4 The worklist validates the split rule — and finds label conflicts

Two things visible only once families rendered:

**The rule fires on real data.** In the `bench press` family,
`Close-Grip Barbell Bench Press` is primary **triceps** while
`Barbell Bench Press - Medium Grip` is primary **chest** — so close-grip
splits, exactly as §2.3 predicts. In `squat`, `Kneeling Squat` is primary
**glutes** against `Barbell Squat`'s **quadriceps**.

**The source contradicts itself on primary muscles.** The same movement
carries different primaries in different records:

| Record | Category | Primary |
|---|---|---|
| `Floor Press` | powerlifting | **triceps** |
| `Floor Press with Chains` | powerlifting | **triceps** |
| `Alternating Floor Press` | strength | **chest** |
| `One-Arm Kettlebell Floor Press` | strength | **chest** |
| `One Arm Floor Press` | strength | **triceps** |

The disagreement correlates with `category` — powerlifting entries tend to
be labelled by what *limits* the lift (lockout, triceps) rather than by the
prime mover — but it is not determined by it, as the last two rows show.

11 of the 72 multi-variant families disagree internally, covering 48
records. Some of that disagreement is **correct**: close-grip bench really
is triceps-primary, and `Kneeling Squat` really is glutes-primary against
`Barbell Squat`'s quadriceps. So this cannot be auto-resolved either.

**Treat every inherited primary as advisory, not authoritative.** Part 4 of
the generated worklist is the triage list.

### 3.5 Do not drop the `powerlifting` category

A first reaction to §3.4 was to drop `powerlifting` (38 records) and remove
the inconsistency wholesale. **That would be wrong.** The category contains
`Sumo Deadlift`, `Good Morning`, `Rack Pulls`, `Deficit Deadlift`,
`Glute Ham Raise`, `Box Squat`, `Kneeling Squat` — and `Barbell Hip
Thrust`, which we already ship in our current 33.

**Settled: drop accommodating resistance** — the `with Chains`,
`with Bands` and `Reverse Band` variants of barbell lifts. Setup-specific
rather than distinct movements, and where the mislabelling concentrates.
This is different from genuine band exercises (`Band Good Morning`), which
keep the `band` equipment token and stay.

Four of the six name collisions in §4.1 are these variants, so dropping
them resolves most of the merge work as a side effect.

## 4. The curation worklist

Bounded, and it is judgement work rather than engineering:

1. **72 multi-variant families** — rule on each (bench press → 9 candidates;
   shoulder press → 7; squat → 5).
2. **333 singletons** — keep/drop scan. This is where the obscure entries
   live: `Tate Press`, `Jefferson Squats`, `Standing Dumbbell Straight-Arm
   Front Delt Raise Above Head`.
3. **53 primary delt assignments** — do them while curating the family, not
   as a separate pass. A further 123 secondary-only assignments can take a
   bulk default.

Generated worklist: `scripts/exercise-catalog/out/worklist.md`.

### 4.1 The collision check

The transform proposes a mechanical first-draft name for every record —
default qualifiers dropped, equipment moved into a `(suffix)` — and then
reports where two records reduce to the same slug. **A collision is a merge
decision surfaced for confirmation, not a bug.**

Six survive today, and all six are correct:

| Proposed | Source records | Verdict |
|---|---|---|
| `Bench Press (Barbell)` | `Barbell Bench Press - Medium Grip` + `Bench Press - Powerlifting` | merge; keep the chest-primary label |
| `Bench Press (Dumbbell)` | `Dumbbell Bench Press` + `… with Neutral Grip` | merge |
| `Deadlift (Barbell)` | `Barbell Deadlift` + `Deadlift with Bands` | accommodating resistance, dropped |
| `Squat (Barbell)` | `Barbell Squat` + `Squat with Bands` | accommodating resistance, dropped |
| `Box Squat (Barbell)` | `Box Squat` + `Box Squat with Bands` | accommodating resistance, dropped |
| `Sumo Deadlift (Barbell)` | `Sumo Deadlift` + `Sumo Deadlift with Bands` | accommodating resistance, dropped |

The proposed names are a **draft to review, never the answer** — curation
overrides them. Their job is to make collisions visible.

Expected output in the 300–500 range, matching the target in
`exercise-examples-exploration.md` §5a.

---

## 5. Seeding mechanism — a scaling problem

`seedSystemExercises` runs **fire-and-forget on every API boot**
(`apps/api/src/index.ts:38`) as one multi-row
`INSERT … ON CONFLICT DO NOTHING`. At 33 rows this is invisible. At ~400
exercises plus ~1,200 `exercise_muscle` rows it is a large statement on the
Neon HTTP driver at every Railway restart — every deploy, every crash,
every scale event — to insert nothing almost every time.

A migration is the obvious fix, but nothing applies migrations on deploy,
and the boot seed exists precisely *because* story 02 found a recreated
database silently had zero system exercises. So **keep the boot seed and
guard it with a catalog version**: store a version marker, compare, skip.
Preserves the self-healing property at a fraction of the cost.

Seeding also becomes two-pass — `muscle_group` first, then `exercise`, then
`exercise_muscle` needs both ids. All three must stay idempotent.

---

## 6. Still open

1. **Cues.** Not in scope here. The source's `instructions` are five long
   paragraphs (*"Lie back on a flat bench. Using a medium width grip (a grip
   that creates a 90-degree angle…)"*) — not readable between sets. Our
   cues are four short lines and we write them ourselves.
2. **Illustrations.** Source images have no stated licence. The slot stays
   reserved and empty — see `exercise-examples-exploration.md` §5.
3. **`movementPattern`.** The source has `force` (push/pull) and `mechanic`
   (compound/isolation), which narrow but do not determine our value — we
   distinguish `horizontal-push` from `vertical-push`. Needs a mapping pass
   or derivation from the curated names.
