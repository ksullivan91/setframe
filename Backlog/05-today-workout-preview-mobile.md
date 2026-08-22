# Story 05 — Improve Today Workout Preview on Mobile

## User Story

As a user previewing today's workout at the gym, I want a mobile-friendly preview that is easy to scan and dismiss so that I can quickly review the plan without fighting a long modal.

## Screenshot / Gym-Test Evidence

Screenshot 5 shows the workout preview as a tall modal with a long scrolling list, a close icon at the top, and a large full-width Close button at the bottom. On mobile Safari the sheet competes with browser chrome and requires awkward internal scrolling.

## Problem Statement

The preview contains useful information, but the container and dismissal pattern make it feel heavy. Two close controls are redundant, and a long modal is not ideal for reviewing a workout list on a phone.

## UX / Product Intent

Redesign the preview as a responsive detail surface.

Recommended mobile approach:
- use a bottom sheet or near-full-screen sheet designed for mobile
- sticky header with workout name and one accessible close control
- scroll only the exercise content
- optional sticky primary action such as `Start workout` when the workout has not started
- remove the redundant bottom `Close` button if the header close control is sufficient
- preserve clear `Planned: 3 × 8` information
- ensure Safari viewport/browser chrome does not hide important controls

Desktop can remain a centered dialog if that is the better pattern.

## Acceptance Criteria

- [ ] Mobile preview has one clear dismissal pattern rather than duplicate Close actions.
- [ ] Header/close control remains reachable while scrolling.
- [ ] Exercise content scrolls cleanly without the entire modal fighting browser chrome.
- [ ] Long workout lists are readable at narrow widths.
- [ ] If `Start workout` is exposed in preview, it reflects current workout state and cannot start a completed session.
- [ ] Focus is trapped/restored correctly for dialog/sheet behavior.
- [ ] Escape/back behavior works appropriately on supported platforms.
- [ ] Mobile web and mobile app preview experiences are visually and behaviorally aligned.


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

Audit the existing preview modal component and determine whether the mobile app already has a sheet primitive that can be mirrored on web.

Do not simply shrink fonts or remove padding. Fix the container behavior.

Use one close mechanism unless platform conventions require an additional gesture. Ensure the design reviewer compares the mobile web sheet and mobile app equivalent.
