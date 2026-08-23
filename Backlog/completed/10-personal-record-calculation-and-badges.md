# Story 10 — Correct Personal Record Detection and PR Badge State

## User Story

As a user logging sets, I want PR badges to appear only when a set truly establishes a new personal record so that PR feedback is trustworthy and meaningful.

## Screenshot / Gym-Test Evidence

Screenshots 3, 6, 7, and 8 show **Weight PR** and **Rep PR** badges appearing on multiple sets that cannot all simultaneously represent the current record.

Gym test sequence:
- first warm-up: 85 × 6, which may legitimately become the initial record when no prior history exists
- next set: 105 × 6, which then also showed Weight PR and Rep PR
- earlier set continued displaying its PR badges
- final test set used an intentionally tiny value (approximately 1 lb / 1 rep), and it also received both PR labels

This indicates the badge logic is likely treating each newly saved set as a record because of missing comparison data, incorrect query scope, stale state, or a boolean that means "has record metadata" rather than "this set broke a record." 

## Problem Statement

PR feedback is emotionally high-value but only if users trust it.

A PR badge should represent a specific achievement relative to the correct comparison baseline. It should not be permanently attached to every set merely because the exercise lacks history or because earlier sets were momentarily records.

The product also needs explicit definitions for different record types.

## UX / Product Intent

Define PR semantics before adjusting the UI.

Recommended definitions:

### Weight PR
The set uses a greater external load than any qualifying historical set for the same exercise, subject to any minimum validity rules.

### Rep PR
Do not define this merely as `highest reps ever` without context if that would produce misleading results.

Choose and document the intended model, for example:
- most reps at the same weight, or
- a rep-max record at a defined load, or
- another explicit strength-record rule

### Session PR vs All-time PR
Decide whether badges compare against:
- completed historical sessions only, or
- historical sessions + earlier qualifying sets in the current active session

Recommended behavior:
- compare against the all-time baseline existing before the session
- allow later sets in the same session to supersede earlier provisional achievements
- at completion, only sets that truly represent a new record should retain the appropriate record marker

Avoid showing a PR on an intentionally worse set such as 1 lb × 1 simply because it is newly saved.

## Acceptance Criteria

- [ ] PR rules for Weight PR and Rep PR are explicitly documented in code/tests.
- [ ] A set is never marked as a PR merely because it is the first/current saved set in UI state.
- [ ] 105 × 6 correctly supersedes 85 × 6 as a weight record when appropriate.
- [ ] A lower subsequent set such as 1 × 1 does not receive Weight PR or Rep PR when a higher qualifying record exists.
- [ ] Prior non-record sets do not continue displaying stale PR badges after being superseded unless the product intentionally shows `PR at time of set`, which must be explicitly designed and labeled differently.
- [ ] PR comparisons use the correct exercise identity.
- [ ] Warm-up vs working-set inclusion is explicitly decided and tested.
- [ ] Deleted/edited sets cause PR state to recalculate correctly.
- [ ] Existing historical sessions are included in the comparison baseline.
- [ ] Lack of historical data has intentional behavior: either first qualifying performance establishes a baseline/PR or badges are withheld until a comparison exists; the chosen rule is documented.
- [ ] PR state persists correctly after reload and completed-session review.
- [ ] Web and mobile app use the same PR calculation source of truth.
- [ ] Tests cover first-history case, same-weight higher-rep case, higher-weight same-rep case, lower subsequent set, editing, deletion, and session completion.


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

Treat this primarily as a domain/calculation bug, not a badge-rendering bug.

Before coding, identify:
- where PRs are calculated
- whether calculations happen client-side or server-side
- whether incomplete current-session sets are included
- whether query cache/stale historical data is involved
- whether badges are stored persistently or derived
- how warm-up sets are treated
- how exercise identity is resolved

Do not simply hide duplicate badges.

Prefer a deterministic PR service/domain function that accepts:
- exercise ID
- historical completed sets
- current-session sets
- set type
- weight/reps
- record definition

and returns explicit achievements.

If PR badges are derived state, calculate them from current authoritative data. If PR achievements are persisted for history, persist only after the underlying record logic is valid.

Add regression tests using the exact gym sequence:
1. no prior history
2. save 85 × 6
3. save 105 × 6
4. save a much lower set such as 1 × 1
5. assert only the correct record state remains

Also test with pre-existing historical records so the first set of a new session is not automatically treated as a PR.
