# Story 30 — Keep Progress Tooltips Inside the Mobile Viewport

## User Story

As a mobile user exploring Progress metrics, I want explanatory tooltips to stay fully inside the visible screen so that I can read them without horizontal scrolling or causing the page layout to shift.

## Screenshot / Product-Test Evidence

The first four Setframe screenshots show the detailed `?` tooltips on Progress.

The tooltip content itself is strong and should be preserved. Examples include explanations for Body weight trend, Heaviest set, Total reps, Estimated 1RM, and Sessions per week.

However, on narrow mobile screens, the tooltip extends beyond the right edge of the viewport, increasing the effective page width and introducing horizontal scrolling. This can destabilize sticky navigation and the overall viewport.

## Problem Statement

The tooltip component appears to position relative to its trigger without fully accounting for viewport edges, available width, mobile safe areas, sticky bottom navigation, and long explanatory content.

The problem is not the amount of copy. The copy is valuable. The problem is that the overlay geometry behaves too much like a desktop popover on a constrained mobile viewport.

## UX / Product Intent

Preserve the detailed educational content while making tooltip placement adaptive.

### Wider layouts
- Continue using a contextual anchored popover.
- Flip left/right/up/down as needed.
- Keep the popover visually connected to the `?` trigger.

### Mobile / constrained widths
- Constrain the tooltip to the viewport.
- Prefer a centered floating card, sheet, or bottom-sheet treatment when an anchored popover cannot fit cleanly.
- Use a max width based on viewport width minus safe spacing.
- Allow vertical scrolling within the tooltip only if content is taller than the available viewport.

The tooltip must never expand the document width.

Do not reduce the tooltip copy merely to make it fit.

### Dismissal
Support:
- tapping the trigger again,
- tapping outside,
- explicit close affordance if sheet-like,
- Escape/keyboard dismissal on web.

Only one metric tooltip should be open at a time.

## Acceptance Criteria

- [ ] Progress tooltips never increase document width on supported mobile viewports.
- [ ] No horizontal scrollbar appears when a tooltip is open.
- [ ] Tooltip content is fully readable without clipping offscreen.
- [ ] Tooltip placement flips/repositions when near viewport edges on desktop/tablet.
- [ ] On constrained mobile widths, the component may use a centered card or bottom-sheet presentation.
- [ ] Tooltip width respects mobile safe-area spacing.
- [ ] Long tooltip content scrolls vertically only when necessary.
- [ ] Opening a tooltip does not shift the underlying chart/card layout.
- [ ] Sticky bottom navigation remains stable while a tooltip is open and after it closes.
- [ ] Only one tooltip can be open at once.
- [ ] Tooltip triggers remain keyboard accessible and have meaningful accessible names.
- [ ] Tooltip content is associated with the triggering metric for screen readers.
- [ ] Mobile web and mobile app use equivalent explanatory content and interaction intent.
- [ ] Figma reviewer validates responsive tooltip presentation at narrow mobile widths.

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

Treat this as a **shared popover/tooltip positioning fix**, not a one-off Progress CSS patch.

Audit the shared tooltip/popover primitive:
- portal strategy,
- collision detection,
- max width,
- absolute/fixed positioning,
- viewport calculations,
- transform origin,
- mobile breakpoint behavior,
- safe-area handling.

If using a positioning library, enable its collision/flip/shift capabilities rather than reinventing them.

Strong requirement: page `scrollWidth` must not exceed viewport width merely because a tooltip is open.

Do not hide the symptom with global `overflow-x: hidden` unless the overlay itself is also fixed correctly.

Coordinate with Story 20 and Story 23 because this touches the same mobile viewport foundation.

Regression-test:
- leftmost metric,
- center metric,
- rightmost metric,
- cards near bottom navigation,
- long tooltip content,
- portrait mobile and wider layouts.

### Scope boundary

Do not rewrite tooltip educational content.
Do not redesign Progress cards.
Do not remove help icons.

This story is about viewport-safe positioning and stable mobile interaction.
