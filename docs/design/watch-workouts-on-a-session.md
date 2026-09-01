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

## "Live sync" is a watchOS app, and we do not have one

Hevy detects the Watch and offers live sync because **Hevy ships a watchOS
companion**. That app runs an `HKWorkoutSession` on the wrist and streams to
the phone. It is the only way to see a heart rate mid-set.

- `startWatchApp(workoutConfiguration)` exists in the library we use, but it
  launches *your* watch app. With no watch target it has nothing to launch.
- `enableBackgroundDelivery` wakes the phone when HealthKit changes. It is
  batched and delayed by design — a freshness optimization, exactly as
  `docs/architecture.md` §5 already says about health sync. Not live.
- **What we can do today** is read the finished Watch workout with full
  per-workout statistics via `WorkoutProxy.getStatistic()` — average and peak
  heart rate, active energy, duration, distance — and attach it.

That covers every metric in the request except liveness, with no watch
target. The copy must say so: frame 1 ends with *"Setframe reads these after
a workout ends, not live during it."*

Building a watchOS companion is a real option later. It is a separate Expo
target, its own build and submission, and `WatchConnectivity` between them —
a project, not a story.

## Where the collection lives

**Not `additional_activity`.** That entity is a standalone thing the user
did, keyed to a date. These are evidence *about* a session, and listing them
as separate activities is precisely the double-count story 44 suppresses.

**A new fact table, `session_watch_workout`:** `session_id`, `external_id`
(HealthKit's UUID, the dedupe key), activity type, start/end, duration,
active kcal, total kcal, average/peak/min HR, distance, device name.
Append-mostly and snapshotted at attach time per ADR 0005, so nothing later
changes what a past session reports.

**Summary, not samples.** `docs/architecture.md` §4: imported metrics are
stored as a normalized snapshot, never raw samples. A 60-minute workout is
hundreds of heart-rate readings. Store the statistics; if a chart needs a
curve, store a deliberately downsampled series in its own column and record
how many points it holds.

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

## Open — needs a decision

- **What belongs to a block.** Overlap is obvious for the lift. A run 40
  minutes later is a judgement call. The frames propose offering anything
  that overlaps the session or starts within a window after it, badged
  "Overlaps" or "After", with the user confirming. The window length is the
  open number — 30 minutes? 90?
- **Attach all, or choose.** Frame 2 offers both. Attach-all is one tap for
  the common case; Choose exists because a Watch workout during a session
  might be a stray auto-detected walk.
- **Whether a curve is stored.** Average and peak answer most questions. A
  heart-rate graph over the session is the reason to store a series, and the
  reason this is not free.
- **Retro-attaching.** Only new sessions, or a backfill over recent ones?
  The Watch data is already in HealthKit for past weeks.
