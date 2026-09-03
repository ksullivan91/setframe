# Story 81 — Close the session the user walked away from

**Status:** Open. **Read ADR 0014 first** — this is a deliberate
exception to ADR 0009.
**Figma:** `Log v3 · Session closed for you`.

## User story

As someone who racked the last set and put my phone away, I want
yesterday's workout to be closed and counted, so that today does not
offer to resume a workout I finished.

## Current behaviour

A session left `in_progress` makes *today* render `in-progress` (it is
first in the precedence chain), the day is never marked trained, and
`POST /v1/workout-sessions` refuses to create the next day's session
because the date already holds one.

## What to build

- On foreground, transition any `in_progress` session whose `local_date`
  is **before the device's current local date** to `completed`.
- `completedAt` = the timestamp of the **last logged set**, not the
  moment of closing. The user finished when they stopped logging.
- A session with **zero** logged sets is deleted, not completed — an
  empty workout in the record would mark the day trained.
- Log shows a card above the day's hero: *"We closed yesterday's
  workout… Everything you logged is saved — 9 sets across 3 exercises."*
  with **Review and fix it** into the logger for that session.

## Acceptance

- Two foreground events in the same second do not double-apply
  (conditional on the row still being `in_progress`).
- A session started 23:00 and still being logged at 00:30 is **not**
  closed — the boundary is the local date rolling in the session's own
  timezone, not elapsed hours.
- The closed session remains editable.
- An abandoned empty session leaves no trace.

## Why this does not violate ADR 0009

ADR 0009 forbids inventing a record the user did not ask for — an
auto-`POST` once created duplicate sessions and destroyed logged rest
days in production. This finalizes a record the user *did* create,
discards nothing, announces itself, and is reversible.
