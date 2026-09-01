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

So `session_watch_sample` stores row-per-sample — `kind`, `recorded_at`,
`value`, `unit` — keyed to the attached workout. Row-per-sample rather than
a JSONB blob because the stated purpose is analysis, and a blob answers
exactly one question well.

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
- ~~Whether a curve is stored.~~ **Settled:** store every sample. See ADR
  0012 for the volume maths (~1,400 rows and 60 KB per hour-long workout,
  ~375k rows per user per year) and the three rejected alternatives.
- **Which maximum heart rate defines the zones** — Tanaka estimate from age,
  or the observed maximum across the user's own history. The estimate works
  on day one; the observed value gets better and can move under the user.
- **Retro-attaching.** Only new sessions, or a backfill over recent ones?
  The Watch data is already in HealthKit for past weeks.
