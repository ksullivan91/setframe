# Story 76 — The day view: a week strip, and past dates

**Status:** Shipped 2026-09-03. Depends on 75.
**Design:** `docs/design/log-dashboard.md` §1–2. ADR 0013.
**Figma:** `Log v3 · Today, scheduled`, `Log v3 · Today, completed`.

## User story

As someone who trained yesterday and forgot to mark it, I want to move
to that day and see what happened, so that my record is right without
me having to remember on the day.

## What to build

- A seven-day strip under the header. Marks: filled ✓ trained, filled —
  rest, empty ring otherwise; accent **ring** = selected date; accent
  **dot above the letter** = today. These are two different marks and
  must stay so.
- Tapping a day selects it and re-reads the screen for that date.
- **No new API.** `GET /v1/dashboard/today` already requires
  `localDate` and scopes all seven of its queries by it. Pass a
  different date.
- Past dates are **read-only**, with one exception: mark / clear rest,
  via the existing `POST`/`DELETE /v1/rest-days/:localDate`.
- Each day column is its own ≥44pt tap target.

## Acceptance

- Selecting a past date shows that date's session, signals and entries.
- A past date offers rest toggling and nothing else mutable.
- Today and a selected past date are visually distinguishable at a
  glance — verified by looking at the two states side by side.
- The query key includes the date; selecting a day never shows another
  day's cached data.

## Explicitly out of scope

Back-filling a workout onto a past date. PR flags are computed on write
against the sets that exist at that moment, so a back-dated heavy set
invalidates PRs already awarded to later sessions. That needs a
recompute pass — a separate story if it is ever wanted.
