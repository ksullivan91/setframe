# ADR 0012: Store the Heart-Rate Series for an Attached Workout, as Arrays

Status: Proposed (design agreed; implementation not started).
Date: 2026-09-01. Revised the same day — see "How this changed".

## Context

`docs/architecture.md` §4 has said since Phase 0:

> Imported health metrics (steps, HR, weight if imported, activity rings) —
> DB stores normalized snapshot + provenance, **not raw samples**.

That rule exists for a good reason, and for daily metrics it stays. Today's
step count is a *rolling* value: re-read on every foreground, re-reconciled,
UPSERTed by `(user_id, local_date)`. Storing raw samples there would make our
database a mirror of HealthKit and hand us the job of reconciling every edit
and deletion the user makes in Health.

Story 45 asks for something the rule did not anticipate: the heart-rate curve
of a *finished* workout, and enough resolution to compute time-in-zone. The
stated goal is "feature progression and scorecard features" — analysis not yet
designed.

Two facts settle whether to keep the samples at all.

**HealthKit stores no heart-rate zone type.** The only `Zone` identifier in
its entire surface is `HKTimeZone`. Apple Watch computes zones for display in
the Workout app and never persists them. Zones can therefore only be
*derived*, and deriving them requires the samples.

**A finished workout is not a rolling snapshot.** ADR 0005 already establishes
that fact rows are snapshotted at session time and never re-derived — a past
session must render the same way forever. A heart-rate curve for a completed
workout is exactly that kind of fact. It is evidence, not a cache.

## Decision

**Keep every heart-rate sample for an attached workout, stored as one row per
series rather than one row per sample.**

```sql
session_watch_series (
  session_watch_workout_id  uuid     not null references session_watch_workout(id) on delete cascade,
  user_id                   uuid     not null,   -- ADR 0002 scoping, as everywhere
  kind                      smallint not null,   -- heart_rate | (future kinds)
  offsets                   int4[]   not null,   -- seconds from the workout's start
  values                    int2[]   not null,   -- scaled per kind; bpm for heart_rate
  primary key (session_watch_workout_id, kind)
)
```

`offsets[i]` and `values[i]` are parallel: the *i*-th reading happened
`offsets[i]` seconds after `session_watch_workout.started_at` and had value
`values[i]`. Absolute timestamps are recovered by addition, so the series does
not repeat an 8-byte timestamp 720 times to say "five seconds later".

The rule in §4 stands **unchanged for daily metrics**. This is a narrow
exception for immutable evidence attached to a completed session.

### Active energy is stored as a summary only

Its curve is cumulative and monotonic — it carries far less information than
heart rate, and the total is already a column on the workout. Energy
expenditure can be approximated from heart rate if it is ever wanted. This is
the one series where "every data point" buys the least, and it is not kept.

### Heart-rate zones are computed, never stored

Zones are a *view* of the curve, derived on read from inputs already
collected:

- **Age** from `HKCharacteristicTypeIdentifierDateOfBirth`.
- **Resting heart rate** from `HKQuantityTypeIdentifierRestingHeartRate`,
  which enables heart-rate-**reserve** (Karvonen) zones rather than the cruder
  percentage-of-max.
- **Maximum** heart rate: Tanaka estimate (`208 − 0.7 × age`, more accurate
  than `220 − age`) or the observed maximum across the user's own history —
  still an open call.

Time-in-zone is the summed interval between consecutive samples in each band.
Because the samples are kept and the zones are not, changing the zone model
later **re-labels all history** instead of stranding it.

## Consequences

**Storage is a rounding error.** A 60-minute workout is about 720 heart-rate
samples — roughly **4 KB**. Five sessions a week is about **1.1 MB per user
per year**; a thousand users is **1.1 GB a year**. There is no partitioning
conversation at any scale this product will plausibly reach.

**A new sample kind is a new row, not a migration.** This is why the series
lives in its own table keyed by `(workout, kind)` rather than as array columns
on the workout itself. Adding a distance or pace curve later inserts rows; it
does not alter a table.

**Still queryable, without a per-sample index.** `unnest(offsets, values)`
expands a series in plain SQL, so time-in-zone, curve rendering and
cross-session aggregates are all ordinary queries:

```sql
select w.session_id, s.offset_s, s.bpm
from session_watch_series ss
join session_watch_workout w on w.id = ss.session_watch_workout_id
cross join lateral unnest(ss.offsets, ss.values) as s(offset_s, bpm)
where ss.kind = 1;
```

What is given up is indexing an individual sample. "Every moment across all
users where bpm exceeded 180" is a scan rather than a lookup. Every analysis
described for this feature is per-workout or per-session, where that does not
apply — and if population-wide sample search is ever needed, a derived table
is the answer, not row-per-sample everywhere.

**Written once, never resent.** A series is inserted at attach time, keyed by
the workout's HealthKit UUID, and is not part of the daily reconcile payload.

**The security invariant gets sharper.** This is heart rate at five-second
resolution. `user_id` sits on the row and every query scopes by
`request.userId` (ADR 0002). This is the least forgiving place to forget it.

**Our copy outlives HealthKit.** If the user deletes the workout in Health,
the snapshot remains — deliberate, and consistent with ADR 0005. It follows
that detach must actually delete, so there is a way back out. The FK is
`on delete cascade` for exactly that.

## Alternatives rejected

**Summary statistics only** (average, peak, min). Cheapest, and what the first
draft of story 45 proposed. Rejected: it cannot produce a curve, cannot
produce time-in-zone, and cannot answer a question posed after the fact —
which is the stated reason for wanting the data.

**A downsampled series**, perhaps 60 points per workout. Rejected for the same
reason at lower resolution: it forecloses analysis to save an amount of
storage that turns out not to matter.

**Row per sample.** The obvious shape, and the one this ADR originally
specified. Rejected on arithmetic. A heart rate is 2 bytes; a naive row wraps
it in a uuid primary key, a uuid foreign key, a `timestamptz`, a text unit
column and two index entries — about 190 bytes of bookkeeping per 2 bytes of
signal, or **69 MB per user per year** with both series. Tightening the row
(composite key, integer offset, `smallint` value) reaches 31 MB; arrays reach
1.1 MB. **63× smaller, with no data point lost.**

**Array columns on the workout row** (`hr_offsets`, `hr_values`). Same
compactness, but every new kind needs another column pair and therefore a
migration. The keyed table gets the size win without the schema churn.

## How this changed

The first version of this ADR specified row-per-sample and described the
volume as "real but not alarming", citing rows rather than bytes. Asked to
justify it, the arithmetic showed 69 MB per user per year and roughly 7 GB at
a hundred users — which is not a later problem on a small Neon plan. The unit
was the error: rows hid the fact that almost all of the cost was per-row
overhead rather than data. The decision to keep every sample was right; the
shape holding them was not.
