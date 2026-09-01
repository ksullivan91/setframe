# ADR 0012: Store the Full Sample Series for an Attached Workout

Status: Proposed (design agreed; implementation not started).
Date: 2026-09-01.

## Context

`docs/architecture.md` §4 has said since Phase 0:

> Imported health metrics (steps, HR, weight if imported, activity rings) —
> DB stores normalized snapshot + provenance, **not raw samples**.

That rule exists for a good reason. Daily metrics are a *rolling* snapshot:
today's step count is re-read on every foreground, re-reconciled, and
UPSERTed by `(user_id, local_date)`. Storing raw samples there would make
our database a mirror of HealthKit, and we would inherit the job of
reconciling every edit and deletion the user makes in Health. The rule
prevents that, and for daily metrics it stays.

Story 45 (attach Apple Watch workouts to a Setframe session) asks for
something the rule did not anticipate: the heart-rate curve of a *finished*
workout, and enough data to compute time-in-zone. The stated goal is
"feature progression and scorecard features" — analysis we have not designed
yet.

Two facts settle it.

**HealthKit stores no heart-rate zone type.** The only `Zone` identifier in
the whole surface is `HKTimeZone`. Apple Watch computes zones for display in
the Workout app and never persists them. Zones can therefore only be
*derived*, and deriving them requires the samples.

**A finished workout is not a rolling snapshot.** ADR 0005 already
establishes that fact rows are snapshotted at session time and never
re-derived — a past session must render the same way forever. A heart-rate
curve for a completed workout is exactly that kind of fact. It is evidence,
not a cache.

## Decision

**Store every sample HealthKit will give us for an attached workout**, in a
dedicated table keyed to that workout.

`session_watch_sample`: `id`, `session_watch_workout_id` (FK), `user_id`
(the scoping invariant applies as everywhere else), `kind`
(`heart_rate | active_energy | distance | ...`), `recorded_at`, `value`,
`unit`.

Row-per-sample rather than a JSONB blob, because the stated purpose is
analysis. A blob renders one chart cheaply and resists every question after
that; rows answer questions we have not thought of yet, which is the whole
point of keeping them.

The rule in §4 stands **unchanged for daily metrics**. This is a narrow,
principled exception for immutable evidence attached to a completed session.

### Heart-rate zones are computed, never stored as fact

Zones are a *view* of the curve, so they are derived on read and may be
recomputed at any time:

- Age from `HKCharacteristicTypeIdentifierDateOfBirth` (already read).
- Resting heart rate from `HKQuantityTypeIdentifierRestingHeartRate`
  (already read), which enables heart-rate-reserve (Karvonen) zones rather
  than the cruder percentage-of-max.
- Maximum heart rate: estimated (Tanaka, `208 − 0.7 × age`, which is more
  accurate than `220 − age`) or the observed maximum across the user's own
  history, whichever we settle on.

Time-in-zone is then the summed interval between consecutive samples falling
in each band. Storing the samples rather than the zones means changing the
zone model later re-labels all history instead of stranding it.

## Consequences

**Volume is real but not alarming.** An Apple Watch samples heart rate about
every five seconds during a workout, so a 60-minute session is roughly 720
heart-rate samples plus a comparable number of energy samples — call it
1,400 rows and ~60 KB of JSON. Five sessions a week is about 375,000 rows
per user per year. Neon Postgres does not notice this for one user, or for
hundreds. It becomes a partitioning conversation somewhere in the thousands,
and that is a later problem with a known answer.

**The sync payload needs batching.** 60 KB per workout is fine as one POST
and unacceptable to re-send on every reconcile. Samples are written once, at
attach time, keyed by the workout's HealthKit UUID, and never resent.

**The security invariant gets sharper.** This is heart-rate data at
per-second resolution. Every query scopes by `request.userId` as everywhere
else (ADR 0002), and this table is the least forgiving place to forget it.

**We own a copy that HealthKit can outlive.** If the user deletes the
workout in Health, our snapshot remains. That is deliberate and consistent
with ADR 0005 — a past session must not change under the user — but it means
the detach action has to actually delete, so there is a way back out.

## Alternatives rejected

**Summary statistics only** (average, peak, min). Cheapest, and what the
first draft of story 45 proposed. Rejected because it cannot produce a
curve, cannot produce time-in-zone, and cannot answer a question posed after
the fact — which is the stated reason for wanting the data.

**A downsampled series.** Perhaps 60 points per workout, enough to draw a
line. Rejected for the same reason at a lower resolution: it forecloses
analysis to save an amount of storage that does not matter at this scale.

**JSONB blob on the workout row.** Compact and fast for the one chart we
have designed. Rejected because "the more data, the better for feature
progression" is a request for queryable data, and a blob is the shape that
answers exactly one question well.
