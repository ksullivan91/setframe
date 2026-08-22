# Story 07 — Investigate Morning Weight Completion Carryover

## User Story

As a user logging a morning weigh-in, I want the Today check-in to represent the current local date only so that yesterday's weight never marks today's task as complete.

## Screenshot / Gym-Test Evidence

During gym testing on Saturday, August 22, Morning Weight appeared already completed even though the observed value had been logged the previous day. The issue may already have been fixed or may have been stale client state, but it needs a dedicated regression investigation.

## Problem Statement

If Yesterday's entry is treated as Today's completion, the daily ritual and progress history become unreliable. This may stem from date normalization, timezone handling, query caching, stale state, or an API query that returns the most recent entry rather than an entry for the current local day.

## UX / Product Intent

Investigate the complete path used to derive `Morning weight complete`.

The correct rule should be based on the user's configured/local calendar date, not simply "latest weight exists."

Explicitly review:
- client local date
- configured timezone
- server UTC storage
- date serialization
- query cache keys
- optimistic state
- page navigation/reload
- entries around midnight/timezone boundaries

## Acceptance Criteria

- [ ] Yesterday's weight entry never marks today's Morning Weight step complete.
- [ ] Today's existing weight does correctly restore completion after reload.
- [ ] The displayed value belongs to the same local calendar day represented by the Today page.
- [ ] Changing timezone/date boundaries is covered by tests.
- [ ] Query caching cannot leak the prior day's completion state into a new day.
- [ ] The fix does not duplicate historical weight entries.
- [ ] Web and mobile app derive daily completion using the same date semantics.
- [ ] Root cause and whether the bug was reproducible are documented even if no code change is ultimately required.


## Product-wide Definition of Done

Every story in Setframe must satisfy these rules before it is considered done:

- The feature is implemented **mobile-first** and is fully responsive on web.
- Any user-facing behavior added or changed on web is also implemented in the **mobile application**.
- Mobile web and mobile app are reviewed side-by-side for behavioral and visual parity.
- The change is reviewed with the **GitHub reviewer** for implementation/code quality.
- The change is reviewed with the **Figma reviewer** for visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch target, and screen-reader behavior are considered for interactive controls.
- Existing historical user data is not mutated or lost unless the story explicitly requires a migration.
- Automated tests cover the important user-visible behavior; do not rely only on snapshots.
- Type checking, linting, relevant unit/integration tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Do not assume the bug is already fixed.

Create a reproducible test fixture:
1. create weight entry on Day 1
2. advance local date to Day 2
3. load Today
4. verify Morning Weight is incomplete and input is not pre-completed from Day 1

Then create a Day 2 entry and verify completion survives refresh.

Prefer shared date utilities over duplicated web/mobile date logic. Be explicit about whether `Today` means device-local time or the user's configured timezone and use that rule consistently.
