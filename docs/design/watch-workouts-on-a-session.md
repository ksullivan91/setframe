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

## Detection is free. Live logging is not.

Two different things sit behind Hevy's prompt, and only one is expensive.
Their dialog reads: *"Enabling Apple Watch Live Sync will allow you to
seamlessly log your workout on your watch and phone at the same time."*

**Detecting the Watch needs no watch app.** Every HealthKit sample carries
`device` (`model: "Watch"`, hardware version) and
`sourceRevision.productType`, so we can tell that an Apple Watch wrote a
workout and name which one. The "Apple Watch detected" prompt in frame 1 is
buildable today.

**Logging *on* the watch is the expensive half.** Putting sets on the wrist
needs a UI on the wrist: a watchOS target, its own build and submission, and
`WatchConnectivity` between them. That is a project, not a story.
`startWatchApp(workoutConfiguration)` exists in our library but launches
*your* watch app, so it has nothing to launch until one is built. And
`enableBackgroundDelivery` is batched and delayed by design — a freshness
optimization, exactly as `docs/architecture.md` §5 already says.

**Neither of which this feature needs.** Heart rate, average heart rate,
workout time, active and total calories, collected onto the session — every
metric requested comes from the *finished* workout, read through
`WorkoutProxy.getStatistic()`. Liveness is the only thing a watch target
buys, and it was not the request.

### Where this is inference

That Hevy ships a watchOS app is read off their own copy — "log your workout
on your watch" — not verified. It does not change what we build either way.
What must stay true is frame 1's last line: *"Setframe reads these after a
workout ends, not live during it."* Promising live and delivering
after-the-fact is how trust goes.

A watchOS companion remains a real option later, and it is the only path to
a heart rate mid-set.

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
