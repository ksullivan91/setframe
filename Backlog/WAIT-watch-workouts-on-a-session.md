# Story 45 — Attach Apple Watch workouts to a Setframe session

> **Status:** Designed, awaiting sign-off. Not started.
>
> Figma: ❤️ Apple Health → `🔬 Exploring — Apple Watch workouts attached to a
> session`, `node-id=229-166`. Write-up in
> `docs/design/watch-workouts-on-a-session.md`.
>
> Four open questions on the spec board need answers before building.

## User Story
As someone who wears an Apple Watch while training, I want the workouts it
recorded during and just after my session collected onto that session, so
Setframe can report the heart rate and calories of the whole training block
rather than only the sets I typed.

## Scope
- Detect that the Watch has been recording workouts, and offer to attach.
- While a Watch workout is running, show a live-ish strip on the logger —
  current and average heart rate, elapsed, calories — built from the samples
  the Watch writes throughout, since the workout object itself does not
  exist until it ends.
- At session finish, offer every Watch workout that overlaps the session or
  starts shortly after it, badged by relationship.
- Attach as a **collection** — a lift, a run and a walk are one block.
- Store a snapshot per workout: type, start/end, duration, active and total
  calories, average/peak/min heart rate, distance, device.
- Surface rolled-up Active kcal, Total kcal and Average HR on the session
  and on Today's completed card.

## Explicitly not in scope
- **A watchOS app for logging sets on the wrist.** Wanted later and tracked
  separately. Independent of this story: nothing here blocks it, and every
  metric this story needs comes from the finished Watch workout.

## Acceptance Criteria
- [ ] Heart rate and basal energy join `EXTENDED_READ_TYPES` and ride the
      existing second-sheet path.
- [ ] Watch workouts overlapping or shortly following a session are offered
      at finish, never attached silently.
- [ ] Attaching stores a snapshot; later edits in Health do not rewrite it.
- [ ] The same Watch workout cannot be attached twice, or attached to two
      sessions.
- [ ] A session with no Watch data shows no empty metric row.
- [ ] Attached active calories are never added to the day's active-energy
      figure on Today.
- [ ] Story 44's suppression becomes an attach candidate rather than a dead
      end.
- [ ] The in-session strip reports only what samples show, starts nothing,
      and never claims a workout is attached before its object exists.
- [ ] A Watch workout that ends mid-session attaches then, not only at
      Finish, so several across one session each land as they complete.
- [ ] Tests cover the attach window, dedupe, detach, the roll-up, and the
      recording heuristic's cadence threshold.
- [ ] No shared component and no shipped screen is modified; the existing
      suites for Today, the logger and Additional activity pass unchanged.

## Scope boundary (see the design doc for the full table)

**Must not be edited:** the shipped Apple Health connection and story 44
discovery designs; the Additional activity card; `Button`, `Toast`,
`IconButton`, `Card`, `MetricTile` and the design tokens; `additional_activity`
and `workout_session` and every route touching them; the exercise picker and
the logger's set rows.

**Additive only:** Today's completed card gains a second stat row *only*
when a Watch workout is attached; the logger gains the strip below its
existing header; session summary gains one card. Nothing is moved,
reordered or removed on any of them.

**The one deliberate change:** story 44's suppression becomes an attach
candidate — and must still behave as suppression when the user declines.

If building this needs a shipped frame or a shared component edited, stop
and re-scope.

## Product-wide Definition of Done
- Mobile only. Web is retired to a landing page.
- Loading, success, empty, disabled and error states handled.
- Migration hand-written and applied before the API that needs it ships.
- Typecheck, lint, tests and the production build pass.
- No unrelated scope creep.
