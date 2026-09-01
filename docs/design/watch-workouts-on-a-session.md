# Apple Watch workouts attached to a session

Figma: ❤️ Apple Health → `🔬 Exploring — Apple Watch workouts attached to a
session (not signed off)`, five 390×844 frames plus a spec board
(`node-id=229-166`).

Status: **designed, not built, not signed off.**

## The idea

A training block is rarely one workout — a lift, then a run, then the walk
home. The Watch recorded each of them with heart rate and real calories.
Collect them onto the Setframe session so the numbers describe the block
rather than a fragment of it.

## How a Watch session finds its Setframe session

Both sides already carry what is needed to match them: a start and an end. A
Setframe session has `startedAt` and `completedAt`; a HealthKit workout has
`startDate`, `endDate` and its own UUID. Matching is a time comparison, and
the UUID is what stops it happening twice.

**The match.** On finish — and again on foreground, for sessions closed
earlier — query the Watch workouts around the session and offer any that
overlap it or begin shortly after. Overlap covers the lift; the window
covers the run and the walk home. Confirmed by the user, never attached
silently.

**What each attached workout carries.** `WorkoutProxy.getStatistic()`
returns per-workout statistics, so each one brings its own average and peak
heart rate, active energy, duration and distance — scoped to that workout
rather than smeared across the day. That is what makes a collection worth
more than a single number.

**Detecting the Watch** needs no watch app. Every sample carries `device`
(`model: "Watch"`, hardware version) and `sourceRevision.productType`, so
frame 1's prompt can name the actual watch that wrote the workouts.

### A watch app is a later feature

Logging sets on the wrist is wanted eventually and is out of scope here: it
needs a watchOS target, its own build and submission, and
`WatchConnectivity`. Nothing in this feature blocks it, and this feature
does not need it — every metric requested comes from the finished workout.

## Detecting a Watch workout while it is still running

Partly possible, and the boundary is exact.

**The workout object does not exist until it ends.** `HKWorkout` is written
on finish, and no phone-side API observes another app's in-progress
`HKWorkoutSession`. So there is nothing to *attach* mid-workout.

**But the samples arrive throughout.** The Watch writes heart-rate and
active-energy samples to HealthKit continuously while it records, and those
we can read. That is enough for a live-ish strip on the logger.

| | |
|---|---|
| How we know it is recording | **Cadence, not presence.** A Watch samples heart rate every few seconds during a workout and only every several minutes at rest, so a run of closely-spaced samples is the signal. `subscribeToChanges('HKQuantityTypeIdentifierHeartRate')` fires as they land; polling recent samples while the logger is open is simpler and enough. |
| What the strip shows | Current heart rate, running average, elapsed, active calories so far — all from samples, all real (frame A1). |
| The honest latency | Samples travel wrist → phone → HealthKit. Usually seconds, longer if the phone is locked and away. Not a mirrored session, and the copy says "a few seconds behind" rather than implying otherwise. |
| Attach as each one ends | The workout object appears at finish. Attaching *then* — mid-session, not only at Finish Workout — means several Watch workouts across one session each land as they complete (frame A3). |
| Cost of being wrong | A heuristic will occasionally read "recording" when the user walked upstairs. The strip therefore states what it sees and starts nothing, and nothing is attached without a workout object behind it. |
| Still needs a watch app | A heart rate with no lag, and logging sets on the wrist. Neither is this feature. |

## Where the collection lives

**Not `additional_activity`.** That entity is a standalone thing the user
did, keyed to a date. These are evidence *about* a session, and listing them
as separate activities is precisely the double-count story 44 suppresses.

**A new fact table, `session_watch_workout`:** `session_id`, `external_id`
(HealthKit's UUID, the dedupe key), activity type, start/end, duration,
active kcal, total kcal, average/peak/min HR, distance, device name.
Append-mostly and snapshotted at attach time per ADR 0005, so nothing later
changes what a past session reports.

**Every sample, not a summary.** Reversed after discussion, and written up
as **ADR 0012**. `docs/architecture.md` §4 said imported metrics are stored
as a snapshot, never raw samples — that rule stands for *daily* metrics,
which are a rolling cache re-reconciled on every foreground. A finished
workout is not a cache: ADR 0005 already says fact rows are snapshotted and
never re-derived, so its heart-rate curve is evidence.

So `session_watch_series` holds one row per `(workout, kind)` with parallel
`int4[]` offsets and `int2[]` values — about **4 KB per hour-long workout**,
**1.1 MB per user per year**. Not row-per-sample: a heart rate is 2 bytes, and
a naive row wraps it in ~190 bytes of uuids, timestamps and index entries.
Arrays are 63× smaller with no data point lost, and a new kind is a new row
rather than a migration.

**Active energy is a summary only.** Its curve is cumulative and monotonic,
its total is already a column, and expenditure can be approximated from heart
rate. It is the one series where "every data point" buys the least.

### This supersedes the suppression rule

Story 44 hides the Watch's record of your own lift so it is not offered as
"additional" activity. That was right while there was nowhere to put it.
There is now: the same workout becomes the session's heart-rate and calorie
source. The suppressed row in `workout-discovery.ts` becomes an *attach*
candidate rather than a dead end.

## Cost

**New:** the table and a hand-written migration (`db:generate` is broken),
one endpoint to attach and detach, per-workout statistics reads, and the
attach UI.

**Already there:** `queryWorkoutSamples`, the workout-type mapping, dedupe
and dismissal all shipped with story 44. The new permissions — heart rate,
and basal energy for a true total-calorie figure — ride the existing
`hasUnaskedTypes()` second-sheet path.

**Watch out:** do not add the attached active calories to the day's
HealthKit active-energy figure on Today. They are the same joules counted
twice — the session's number is a *subset* of the day's, not an addition.

## Heart-rate zones are computed, never stored

**HealthKit has no zone type.** The only `Zone` identifier in its entire
surface is `HKTimeZone`. Apple Watch computes zones for display in the
Workout app and never persists them, so zones can only be *derived* — which
is the sharpest argument for keeping every sample.

Derived from inputs we already read:

- **Age** from `HKCharacteristicTypeIdentifierDateOfBirth`.
- **Resting heart rate** from `HKQuantityTypeIdentifierRestingHeartRate`,
  which enables heart-rate-**reserve** (Karvonen) zones rather than the
  cruder percentage-of-max.
- **Maximum** heart rate: estimated by Tanaka (`208 − 0.7 × age`, more
  accurate than `220 − age`), or the observed maximum across the user's own
  history — an open call.

Time-in-zone is the summed interval between consecutive samples in each
band. Because the samples are kept and the zones are not, changing the zone
model later **re-labels all history** instead of stranding it. Frame 6 says
which model produced the numbers, for exactly that reason.

## What the data can be charted into

Frames 6–8 are the three worth building first. Everything else is ranked
below with what it costs.

| Frame | Chart | Why it earns the space |
|---|---|---|
| 6 | Heart-rate curve + time in zone | The curve is the reason to keep every sample. Set markers along the axis are the join between our data and theirs. |
| 7 | **Effort by exercise** | Average and peak heart rate per lift. Cannot exist in Apple Health (no set log) or in a lifting app alone (no heart rate) — the clearest thing this feature buys. |
| 8 | The whole block | Lift, run and walk on one clock, with the gaps drawn. The only frame that shows why a *collection* is a better object than one workout. |

### One column gates half of the rest

`workout_set` has `created_at` and `updated_at` but **no `performed_at`**.
`updated_at` moves when a set is corrected — and correcting after completion
is a flow this app deliberately supports — so it cannot say when a set
actually happened.

Add `performed_at`, set once when a set is first marked complete and never
updated. One nullable column, and **no backfill is possible**: you cannot
recover when a past set was performed, so every day without it is a day of
charts that can never exist.

It unlocks every chart that puts sets and heart rate on one clock — set
markers, effort by exercise, rest quality, recovery between sets. Without
it, the heart-rate curve is just a curve.

### Ranked, beyond the three

1. **Recovery between sets** ★ — how fast heart rate drops in each rest,
   trended within the session. A real fitness marker no lifting app shows,
   because none hold both halves. Needs `performed_at`.
2. **Cardiac drift** — first third against last third at matched intensity.
   Free from the curve alone.
3. **Calories by activity** — how the block's energy split. Free; the totals
   are already per workout.
4. **Zone mix over weeks** — whether you train the range you think you do.
   Needs history, then free.
5. **Same-workout trend** — is Upper A getting easier? Needs repeats.
6. **Effort per unit of work** — volume ÷ average heart rate. Worth a spike
   first; may be too noisy at set resolution to mean anything.
7. **Heart rate against load** — tempting, probably noise. Heart rate lags
   effort by tens of seconds, so a 20-second set ends before its peak
   arrives.

### Why none of these use a rainbow

The first zone chart did. Five zones meant five categorical hues that also
had to read as ordered — the standard fitness-app chart, which the palette
validator fails and colour-blind readers cannot use at all.

What replaced it: the trace is **one series** in `action.primary`, which
passes every check. Zones became recessive background bands named at the
edge, and time-in-zone a single-hue stacked bar with each segment directly
labelled beneath. Position and text carry identity; colour carries nothing
it cannot afford to lose.

Separately: **`chart.series` in design-tokens currently fails validation** —
the caution amber is outside the lightness band, and two of five fall under
3:1 contrast on surface. Worth fixing before anything reaches for it.

## Scope boundary — what this must not change

This feature composes with what already ships; it does not rework it.
Recent work has churned shared primitives — `Button`, `Toast`, `IconButton`
— and each time the blast radius reached screens nobody was thinking about.
Written down so the boundary is a contract rather than an intention.

### Untouched — no edits at all

| | |
|---|---|
| Shipped Health designs | The Apple Health connection section and the story 44 discovery section stay exactly as they are. This feature adds frames; it does not revise theirs. |
| Additional activity card | Its layout, ordering, badge and actions are settled. Attached Watch workouts do **not** appear there — that is the whole reason for a separate table. |
| Shared primitives | `Button`, `Toast`, `IconButton`, `Card`, `MetricTile` and the design tokens are consumed, not modified. If something new is needed, it is a new component beside them. |
| Existing endpoints and tables | No change to `additional_activity`, `workout_session`, or any route touching them. One new table, one new endpoint. |
| Picker and logger rows | Set logging, prescriptions and the exercise picker are untouched. The logger gains a strip above them and nothing else. |

### Additive only — gains something conditional, loses nothing

| | |
|---|---|
| Today's completed card | Gains a second stat row (Active kcal, Total kcal, Avg HR) **only** when a Watch workout is attached. The existing Exercises / Sets / Volume row keeps its position and values. Frame 5 is the no-Watch day: no second row, no empty tiles. |
| The v2 logger | Gains the Watch strip below the sticky header, only while recording or after one attaches. Nothing is moved to make room — it is the first item in the existing scroll body. |
| Session summary | Gains the attached collection as a new card. Existing cards keep their order. |

### Deliberately changed — the one exception

Story 44's suppression. The Watch's record of your own lift currently reads
*"Not offered — this is your Upper A session"*. It becomes an **attach
candidate** instead. This is intended and is the point of the feature — and
it must keep working as suppression whenever the user declines to attach.

> If building this requires editing a shipped frame or a shared component,
> that is a signal to stop and re-scope rather than proceed — the same rule
> that kept story 44 from ever writing to Apple Health.

## Open — needs a decision

- **What belongs to a block.** Overlap is obvious for the lift. A run 40
  minutes later is a judgement call. The frames propose offering anything
  that overlaps the session or starts within a window after it, badged
  "Overlaps" or "After", with the user confirming. The window length is the
  open number — 30 minutes? 90?
- **Attach all, or choose.** Frame 2 offers both. Attach-all is one tap for
  the common case; Choose exists because a Watch workout during a session
  might be a stray auto-detected walk.
- ~~Whether a curve is stored.~~ **Settled:** keep every heart-rate sample,
  as arrays keyed by (workout, kind). ~4 KB per workout, 1.1 MB per user per
  year. Active energy is kept as its summary total only. See ADR 0012.
- **Which maximum heart rate defines the zones** — Tanaka estimate from age,
  or the observed maximum across the user's own history. The estimate works
  on day one; the observed value gets better and can move under the user.
- **Retro-attaching.** Only new sessions, or a backfill over recent ones?
  The Watch data is already in HealthKit for past weeks.
