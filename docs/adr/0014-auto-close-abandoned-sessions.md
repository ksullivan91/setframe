# ADR 0014: Closing a Session the User Walked Away From

Status: Accepted. Date: 2026-09-03.
Amends: ADR 0009 (whose whole point was that sessions are never created
or mutated without user action).

## Context

A `workout_session` goes to `in_progress` when started and only reaches
`completed` when the user taps Finish. People do not reliably tap Finish
— they rack the last set and put the phone in a bag.

The consequences compound. `today.tsx` derives `in-progress` ahead of
every other state, so a session left open yesterday makes *today* render
as "Resume workout" for a workout that ended eighteen hours ago. The week
strip cannot mark that day trained, because nothing completed it. And
`POST /v1/workout-sessions` refuses to create a second session for a date
that already holds one, so the stale row blocks the next day's training
until it is resolved by hand.

Doing nothing means the record is wrong in a way the user cannot see or
fix. Prompting on the next launch ("did you finish this?") was considered
and rejected: it interrupts someone who has opened the app to train now,
in order to ask about a workout they consider finished.

## Decision

**A session left `in_progress` past its day is closed on the next
foreground, keeping everything logged, and stays editable.**

- On foreground, any `in_progress` session whose `local_date` is before
  the device's current local date is transitioned to `completed`.
- `completedAt` is set to the timestamp of the **last logged set**, not
  the moment of closing. The user finished when they stopped logging;
  recording 09:00 the next morning would be a fabrication.
- Nothing is discarded. Every `workout_set` stays exactly as written.
- Log surfaces this on the day it happens, above the current day's hero:
  *"We closed yesterday's workout. It was still open when you left.
  Everything you logged is saved — 9 sets across 3 exercises."* with
  **Review and fix it** leading into the logger for that session.
- The user can edit or re-open it from there. This is a correction, not
  a verdict.

## Consequences

- This is a real exception to ADR 0009, which exists because an
  auto-`POST` from a mount effect once created duplicate sessions and
  destroyed logged rest days in production. The distinction: ADR 0009
  forbids **inventing a record the user did not ask for**. This
  **finalizes a record the user did create**, discards nothing, announces
  itself, and is reversible. The dangerous shape was silent creation; the
  safe shape is announced completion.
- It must be idempotent. Two foreground events in the same second must
  not double-apply, so the transition is conditional on the row still
  being `in_progress`.
- The cutoff is *the calendar day boundary in the session's own
  timezone*, not elapsed hours. A session started 22:00 and abandoned is
  closed the next day; one started 23:00 and still being logged at 00:30
  is not, because it is still that session's day until the local date
  rolls. Daily records already store `local_date` plus the `timezone`
  that defined it precisely so this comparison is possible across DST
  and travel.
- A session with **zero** logged sets is deleted rather than completed.
  Closing an empty session would put a workout in the record that
  contains no work, and would mark the day trained in the week strip.

## Alternatives considered

**Prompt on next launch.** Rejected — interrupts the user's actual intent
to ask about something they consider finished, and leaves the record
wrong until they answer.

**Close after N hours.** Rejected — an arbitrary constant that is wrong
for anyone whose session legitimately spans a boundary, and it ignores
the timezone machinery the data model already carries.
