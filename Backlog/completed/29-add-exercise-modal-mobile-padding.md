# Story 29 — Add Safe Mobile Padding to the Add Exercise Modal

## User Story

As a mobile user adding an exercise, I want the Add Exercise modal content to have a small amount of horizontal breathing room so that search, results, and actions do not feel pressed against the edges of the screen.

## Screenshot / Product-Test Evidence

The screenshot shows the **Add exercise** modal extending almost edge-to-edge on mobile. The title, close button, search field, result cards, and `Can't find it? / Create custom exercise` footer sit very close to the horizontal viewport edges.

The current layout is usable, but visually cramped. The key constraint is that adding spacing must **not introduce horizontal scrolling**.

## Problem Statement

The modal needs slightly more internal spacing, but a naive width/padding change can cause overflow on small screens.

Potential contributors include:
- `width: 100%` plus horizontal padding,
- fixed/min widths on children,
- flex children without `min-width: 0`,
- long exercise names,
- footer actions that do not wrap,
- sheet containers already sized to the full visual viewport.

## UX / Product Intent

Add modest, consistent horizontal padding to the modal content while preserving maximum useful width.

Apply the same content inset to:
- header,
- search,
- result rows,
- empty states,
- custom exercise/footer actions.

Do not make the modal substantially narrower. This is a small breathing-room refinement.

## Acceptance Criteria

- [ ] Add Exercise modal has modest, consistent horizontal padding on mobile.
- [ ] No horizontal scrollbar appears at supported mobile widths.
- [ ] No child element extends beyond the viewport.
- [ ] Search input remains comfortably wide.
- [ ] Result cards align consistently with the content inset.
- [ ] Long exercise names wrap or truncate intentionally without overflow.
- [ ] `Create custom exercise` remains fully visible and usable on narrow screens.
- [ ] Close button remains comfortably tappable and aligned.
- [ ] Safe-area insets are respected where applicable.
- [ ] Desktop/tablet layout is not regressed.
- [ ] Equivalent spacing is applied in the mobile app where the same sheet exists.
- [ ] Figma reviewer validates mobile web/mobile app parity.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Any user-facing web change is also implemented in the mobile application.
- Mobile web and mobile app are compared for behavioral and visual parity.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates visual/design parity.
- Loading/error/empty/disabled/success states are handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior are considered.
- Existing historical data is preserved unless explicitly migrated.
- Behavioral tests cover important user-visible outcomes.
- Type checking, linting, relevant tests, and production build pass.
- No unrelated redesign/refactor is bundled into the story.

## Copilot Steering Document

Treat this as a **shared modal/sheet spacing polish story**, not a page-specific CSS hack.

Before coding, inspect:
- outer width rules,
- content wrapper padding,
- `box-sizing`,
- `overflow-x`,
- child `min-width`,
- search input width,
- result row width,
- footer/action layout,
- safe-area handling.

If the same Add Exercise sheet is reused in Guided Setup, Training, or an active workout, prefer fixing the shared primitive.

Prefer:
- `box-sizing: border-box`,
- `max-width: 100%`,
- responsive horizontal padding using existing spacing tokens,
- `min-width: 0` on flex/grid children where needed,
- wrapping/flexible footer actions.

Do not “fix” this solely with `overflow-x: hidden`, negative margins, or nested `100vw` hacks.

Verify at the smallest supported mobile width, including with the keyboard open.

Coordinate with Story 20 and Story 23 so this does not reintroduce overlay-scroll, visual-viewport, or focus-zoom issues.

### Scope boundary

Do not redesign Add Exercise.
Do not change search behavior.
Do not change modal interaction/height unless required for overflow prevention.
