# Story 46 — Rebuild Contextual Help / Tooltip Positioning and Interaction

## User Story
As a user learning what Setframe's Progress metrics mean, I want help content to open beside the control I tapped, remain fully readable inside the viewport, and switch immediately when I choose a different metric so that contextual help feels intentional rather than disruptive.

## Screenshot / Gym-Test Evidence
The latest screenshots show regressions:
- Body Weight help floats over unrelated cards.
- Sessions This Week help is visually disconnected from its `?` trigger.
- Tooltip position changes unpredictably with scroll position.
- Tooltips can appear near the top of the document when the trigger is much farther down.
- Switching from one help icon to another can require two taps.

## Problem Statement
The current implementation appears to have solved viewport overflow by decoupling the popover from its anchor. That creates a technically in-bounds overlay but a poor interaction.

Contextual help should behave like a positioned overlay, not like document content.

## UX / Product Intent

When the user taps a `?` trigger:
1. Read the trigger's current viewport coordinates.
2. Prefer placement near the trigger.
3. Flip above/below when vertical space requires it.
4. Shift/clamp horizontally to remain inside safe viewport margins.
5. Keep a clear visual relationship to the trigger.
6. Render through an overlay/portal so the tooltip never changes document width.

### Switching help
If Tooltip A is open and the user taps Tooltip B:
- close A,
- open B,
- do both on the same tap.

### Scrolling
Preferred: recalculate anchored position as viewport/scroll state changes.
Acceptable mobile fallback: close the tooltip on meaningful scroll.

Never leave a tooltip stranded at stale coordinates.

### Very small screens
If long help content cannot reasonably fit as an anchored popover, use a deliberate mobile help sheet/bottom sheet. Do not create horizontal scroll.

## Acceptance Criteria
- [ ] Every help trigger opens content visually anchored to that trigger.
- [ ] Popovers never increase document width.
- [ ] Popovers remain within left/right viewport margins.
- [ ] Placement flips above/below as needed.
- [ ] Horizontal shifting preserves trigger association.
- [ ] Position is based on current viewport geometry.
- [ ] Tapping a second trigger switches content in one tap.
- [ ] Escape closes help on keyboard-capable platforms.
- [ ] Tapping outside closes it.
- [ ] Accessible labels/expanded state/relationships are present.
- [ ] Long help remains readable without horizontal overflow.
- [ ] Mobile Safari scroll does not strand the tooltip elsewhere on the page.
- [ ] Automated test covers A → B switching.
- [ ] E2E test asserts no horizontal overflow at narrow widths.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Matching user-facing behavior in the mobile application.
- Mobile web and mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, empty, success, disabled, degraded-data, and error states handled where applicable.
- Keyboard, focus, touch-target, VoiceOver/screen-reader, reduced-motion, and color-contrast behavior considered.
- Behavioral tests cover important user-visible outcomes.
- Existing historical data and metric semantics are preserved unless explicitly changed.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.
- Validate narrow mobile widths and desktop/full-width layouts.
- Explicitly test horizontal overflow and sticky-navigation regressions on mobile Safari.


## Copilot / Claude Steering Document

Do not hand-roll naive absolute positioning if the application already has a mature overlay primitive.

Prefer a positioning system with collision detection, flipping, shifting, portal rendering, and focus management.

Use one controlled active-help state instead of independent booleans per card if that is what causes two-tap switching.

Suggested conceptual state:

```ts
type ActiveHelp = {
  metricId: MetricHelpId;
  anchor: HTMLElement;
} | null;
```

Test:
- left edge,
- right edge,
- deeply scrolled trigger,
- long content,
- direct A → B switching,
- landscape/narrow viewport.

### Completion evidence
Claude must include screenshots/video of:
1. left-edge trigger,
2. right-edge trigger,
3. deeply-scrolled trigger,
4. tooltip-to-tooltip switching.

Do not mark complete without the evidence.
