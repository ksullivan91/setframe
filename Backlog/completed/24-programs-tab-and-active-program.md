# Story 24 — Add Program Management and Active Program Selection

## User Story

As a user with more than one training program, I want to see my programs and choose which one is active so that Setframe knows which workouts and schedule should drive Today and my current training experience.

## Screenshot / Product-Test Evidence

The screenshot shows the Training page with two top-level tabs:

- Workouts
- Schedule

Setframe now supports creating multiple programs, but there is no equivalent place to:
- see those programs,
- switch between them,
- identify which program is currently active,
- manage the relationship between a selected program and the workouts/schedule shown elsewhere in Training.

The screenshot also shows the Schedule tab presenting workouts directly, but there is no visible program context above that schedule.

## Problem Statement

The Training information architecture has outgrown the original single-program assumption.

Now that multiple programs can exist, the product needs a clear hierarchy:

Program
→ contains workouts
→ has a schedule
→ one program is active at a time

Without an explicit Program surface, users may not know:
- which program they are editing,
- which schedule belongs to which program,
- which program Today is following,
- whether changing a workout affects one program or all programs.

The absence of an active-program concept also risks mixing unrelated workout libraries and schedules.

## UX / Product Intent

Add a **Programs** tab alongside **Workouts** and **Schedule**.

Recommended top-level Training navigation:

`Programs | Workouts | Schedule`

### Programs tab responsibilities

The Programs tab should:
- list all programs the user has created,
- clearly identify the active program,
- allow switching the active program,
- allow creating a new program,
- allow renaming/editing program metadata where supported,
- provide a clear route into guided setup or full editor for the selected program.

### Active program

One program should be designated as **Active**.

The active program determines:
- which program schedule is used by Today,
- which workouts are shown in the program-scoped Workouts tab,
- which schedule is shown in Schedule,
- which program is the default context when entering Training.

Do not use selection state and active state interchangeably.

A user may inspect/edit another program without automatically making it active.

Recommended semantics:

- **Selected program** = program currently being viewed/edited.
- **Active program** = program currently driving Today/scheduling.

Use an explicit action such as:
`Set as active`

Avoid changing active program merely because the user tapped a program card.

### Suggested program card content

Example:

`Strength Block A`
`Active`
`4 workouts · 5 scheduled days`

or:

`Recovery Block`
`3 workouts · Not active`

Keep the cards lightweight and scannable.

### Tab context

When a program is selected, Workouts and Schedule should reflect that program.

Consider a compact program-context control near the tab row, such as:

`Strength Block A ▾`

or a persistent active/selected-program label if needed.

Do not duplicate a large program selector on every screen if the Programs tab already makes context clear.

## Acceptance Criteria

- [ ] Training includes a Programs tab alongside Workouts and Schedule.
- [ ] Programs tab lists all user-created programs.
- [ ] The active program is visually identifiable.
- [ ] A user can explicitly set a different program as active.
- [ ] Inspecting/selecting a program does not automatically activate it.
- [ ] Today uses the active program's schedule.
- [ ] Workouts tab reflects the selected program context.
- [ ] Schedule tab reflects the selected program context.
- [ ] Creating a new program does not silently replace the active program unless the user explicitly chooses that behavior.
- [ ] Program switching has clear loading/success/error states.
- [ ] If no program is active, Today presents an intentional setup/select-program state.
- [ ] Mobile web and mobile app implement the same active-program semantics.
- [ ] Figma reviewer validates that program context remains obvious without adding excessive chrome.

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

Before coding, audit the current program model and determine:
- whether multiple programs already exist as first-class entities,
- whether there is already an `activeProgramId`,
- how Today resolves its scheduled workout,
- how Training chooses which schedule/workouts to display,
- whether current selection state is stored locally or persisted.

Do not derive "active" from the last program visited.

If the backend lacks an explicit active-program relationship, add the smallest durable model needed.

Preferred state model:

- user has many programs,
- one may be active,
- UI may separately hold selected/editing program.

Keep activation idempotent and explicit.

Add regression tests for:
1. create Program A,
2. make Program A active,
3. create Program B,
4. inspect Program B without activation,
5. verify Today still follows Program A,
6. set Program B active,
7. verify Today/schedule context updates accordingly.
