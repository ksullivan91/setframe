# Story 20 — Fix Mobile Overlay, Keyboard, and Scroll Position Stability

## User Story

As a mobile web user interacting with search menus, selectors, modals, and bottom sheets, I want overlays and the keyboard to open without unexpected page scrolling so that I do not lose my place.

## Screenshot / Beta-Test Evidence

Screenshots 2 and 3 show the **Add exercise** overlay while searching on mobile web.

The beta tester reported that opening/interacting with this menu often caused scrolling issues. Similar behavior appears elsewhere in the application.

The screenshots combine:
- a modal/bottom sheet,
- focused search input,
- iOS software keyboard,
- underlying page content,
- Safari browser chrome.

## Problem Statement

This appears to be an application-wide mobile interaction bug rather than a single Guided Setup styling issue.

Likely contributors include background scroll not being locked, nested scroll containers, viewport resizing, focus-induced scrolling, portal positioning, or iOS Safari keyboard behavior.

## UX / Product Intent

Establish a consistent mobile overlay standard:

- lock background scrolling for blocking overlays,
- preserve underlying page scroll position,
- allow only intended overlay content to scroll,
- account for the iOS visual viewport and keyboard,
- keep focused inputs visible without moving unrelated content,
- restore prior position on close,
- respect safe-area insets,
- prevent bottom navigation/browser chrome from obscuring controls.

For large searchable pickers, prefer a mobile sheet/full-screen picker over desktop-style floating popovers when more stable.

## Acceptance Criteria

- [ ] Opening Add Exercise on iOS Safari does not unexpectedly scroll the underlying page.
- [ ] Typing keeps the input/results visible without moving unrelated content.
- [ ] Background scrolling is blocked while a blocking overlay is open.
- [ ] Overlay content scrolls correctly when taller than the viewport.
- [ ] Closing restores prior page scroll position.
- [ ] Keyboard open/close does not leave the page shifted.
- [ ] Bottom navigation and browser chrome do not obscure primary controls.
- [ ] The fix is applied to shared overlay primitives, not only Guided Setup.
- [ ] Representative dialogs/search selects/bottom sheets are regression-tested.
- [ ] Mobile app behavior is visually/behaviorally aligned where native primitives differ.
- [ ] Desktop overlay behavior is not regressed.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Any user-facing web change is also implemented in the mobile application.
- Mobile web and mobile app are compared for behavioral and visual parity.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior are considered.
- Existing historical user data is preserved unless a migration is explicitly required.
- Behavioral tests cover the important user-visible outcomes; do not rely only on snapshots.
- Type checking, linting, relevant tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Start with a shared-component audit. Identify modal/popover/sheet/select primitives and whether they share:
- portal/root implementation,
- scroll-lock utility,
- focus management,
- viewport sizing,
- keyboard handling.

Reproduce on iOS Safari or the closest available device test setup before changing behavior.

Investigate:
- `position: fixed` body locking,
- scroll offset preservation,
- `dvh/svh`,
- `window.visualViewport`,
- safe-area CSS env values,
- autofocus,
- manual `scrollIntoView`,
- nested `overflow: auto`.

Avoid arbitrary timeout-based scroll hacks unless a browser-specific reason is documented.

Prefer fixing shared overlay foundations. Include manual-device verification in completion notes.
