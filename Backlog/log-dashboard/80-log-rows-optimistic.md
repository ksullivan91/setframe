# Story 80 — Weight, activity and journal, saved optimistically

**Status:** Open. Depends on 75.
**Design:** `docs/design/log-dashboard.md` §6.
**Figma:** `Sheet ·` Log weight / Journal entry / Review Apple Health
activity; `Log v3 · Saving (optimistic)`; `Log v3 · Save failed`;
`Spec/Optimistic saving`.

## User story

As someone logging my weight before coffee, I want the number to be
there the moment I tap Save, so that I am never watching a spinner to
find out whether a number I just typed was accepted.

## What to build

Three rows under **YOUR LOG**, each showing its value or an invitation:

- **Morning weight** — value + lb/kg, into `daily_manual_entry`. The
  sheet states source precedence in plain words when HealthKit also has
  a value for the date: *"Apple Health has 168.9 lb for today. Yours is
  kept and shown first; neither overwrites the other."*
- **Activity** — additional activity, plus the Apple Health suggestion
  inline when workouts were found. Review opens a sheet with per-item
  add / dismiss.
- **Journal** — free text plus the 5-point mood scale.
  `daily_manual_entry.mood` is a real column nothing currently writes.

**Blood pressure is deliberately dropped** from this surface. The column
stays; the row goes.

### Optimistic contract

Follow `WorkoutSessionScreenV2` exactly — `onMutate` writes to the cache
and returns `previous`, `onError` restores it, `onSuccess` clears the
flag. Three row states: pending (muted dot, no spinner, sheet already
closed) · settled (nothing announces success) · error (previous
restored, said in place, Retry).

## Acceptance

- Saving a weight closes the sheet immediately and the row shows the new
  value before the request resolves.
- A failed weight save restores the server's value and offers Retry.
- **A failed journal save keeps the typed text** — see the trap.
- Mood persists and round-trips.

## Traps

- **The journal must not roll back.** A set row can roll back because the
  number is still in the input beside it. A journal entry is prose typed
  into a sheet that has already closed; discarding it destroys the only
  copy. Keep the text, mark it unsent, retry.
- Do not use `status.error` for the error text — 2.85:1, fails AA. Colour
  in a dot, meaning in words.
