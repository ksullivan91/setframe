# Story 28 — Prevent Persistent Mobile Zoom After Input Focus

(Numbered 28, not 23 — 23 was already taken by the completed
edit-logged-sets-from-completed-workout-review story; renumbered on
import to avoid collision.)

## User Story

As a mobile web user entering workout or program data, I want focusing and blurring an input to preserve the page's intended scale and layout so that I do not lose context, hide content, or break sticky navigation after typing.

## Screenshot / Beta-Test Evidence

The screenshot shows the Training page after focusing and then blurring the **Workout name** input on mobile Safari.

The page remains visibly zoomed after the field loses focus:
- content is enlarged,
- the viewport no longer matches the intended responsive layout,
- sticky/fixed navigation appears misaligned or partially obscured,
- surrounding controls become harder to see,
- the user may need to manually pinch-zoom back out.

The user noted that the zoom itself is tolerable while typing, but the persistent post-blur zoom is disruptive.

## Problem Statement

This is a fixable mobile-web issue, not something Setframe should simply accept.

On iOS Safari, form controls with an effective font size below roughly 16 CSS px can trigger automatic viewport zoom when focused. Additional instability can occur when:
- sticky/fixed UI is positioned against the layout viewport while Safari is using the visual viewport,
- the software keyboard changes viewport height,
- the app manually scrolls focused inputs into view,
- overlay/body-scroll code restores the wrong scroll/zoom state,
- CSS transforms create containing blocks for fixed elements.

## UX / Product Intent

Desired flow:

1. Tap a field.
2. Keyboard opens.
3. Field remains readable.
4. Enter data.
5. Press Done / blur.
6. Page returns to the expected responsive layout automatically.

Prefer preventing unnecessary browser auto-zoom rather than trying to undo it after the fact.

### Primary fix direction

Ensure interactive form controls on mobile web use an effective font size of at least **16 CSS px**:
- text inputs,
- numeric inputs,
- textareas,
- selects,
- searchable combobox inputs,
- other styled form controls.

Keep smaller typography for labels/helper text if desired.

### Do not disable user zoom

Do **not** use:
- `maximum-scale=1`
- `user-scalable=no`

Users must retain pinch-to-zoom accessibility.

### Sticky navigation stability

Also verify bottom navigation and other sticky/fixed controls against iOS Safari visual-viewport changes.

After keyboard close / blur:
- nav returns to the intended position,
- safe-area padding is correct,
- no gap/overlap remains,
- page is not horizontally or vertically shifted.

## Acceptance Criteria

- [ ] Focusing a text or numeric input on iOS Safari does not trigger unnecessary browser zoom at supported mobile widths.
- [ ] Blurring an input returns the page to the intended responsive layout without manual pinch-to-zoom.
- [ ] Shared form controls use at least a 16px effective input font size on iOS/mobile web where needed.
- [ ] Labels/helper text may remain smaller.
- [ ] Bottom sticky navigation remains correctly positioned during keyboard open and after keyboard close.
- [ ] No sticky/fixed element remains clipped or offset after blur.
- [ ] Browser/user pinch-to-zoom remains enabled.
- [ ] The fix does not use `maximum-scale=1` or `user-scalable=no`.
- [ ] Numeric inputs still invoke the appropriate numeric keyboard.
- [ ] Desktop typography is not regressed.
- [ ] Shared inputs are audited across Today, Training, Guided Setup, active workout logging, Settings, and Progress where applicable.
- [ ] Mobile app remains visually aligned even though native apps do not share Safari's viewport behavior.
- [ ] Manual validation is completed on a real iPhone/iOS Safari device or equivalent device environment.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Any user-facing web change is also implemented in the mobile application.
- Mobile web and mobile app are compared for behavioral and visual parity.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates visual/design parity.
- Loading/error/empty/disabled/success states are handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior are considered.
- Existing historical user data is preserved unless a migration is explicitly required.
- Behavioral tests cover important user-visible outcomes.
- Type checking, linting, relevant tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Treat this as a **shared mobile-web form/viewport issue**, not a one-off Workout Name bug.

### First investigation

Audit shared input styles and computed font sizes on mobile.

Search for:
- `font-size` below 16px on inputs,
- textarea/select styles,
- combobox/search input styles,
- responsive typography overrides,
- CSS transforms on parent containers,
- viewport meta configuration,
- manual `scrollIntoView`,
- `window.visualViewport`,
- fixed/sticky bottom navigation,
- `100vh` near keyboard-sensitive screens.

Reproduce before changing code.

### Likely first fix

On iOS/mobile web, ensure form controls render at a computed font size >= 16px.

Example direction:

```css
input,
textarea,
select {
  font-size: 16px;
}
```

Prefer implementing through existing design-system tokens/shared primitives rather than a blunt page-level override.

Do not shrink the control with CSS transforms afterward.

### Viewport meta

Preferred baseline:

`width=device-width, initial-scale=1, viewport-fit=cover`

Do not add:
- `maximum-scale=1`
- `user-scalable=no`

### Sticky navigation / visual viewport

Validate nav behavior during:
- focus,
- keyboard open,
- keyboard close,
- blur,
- scrolled page state.

Prefer robust CSS/safe-area handling before adding JS viewport listeners.

If JS is required, centralize it in a shared mobile viewport utility.

### Coordination

Coordinate with **Story 20 — Fix Mobile Overlay, Keyboard, and Scroll Position Stability**. Both may touch shared viewport/form primitives.

### Regression coverage

Manually verify:
- Guided Setup text input,
- Training workout-name input,
- active workout numeric Weight input,
- Morning Weight input,
- journal textarea,
- searchable exercise input.

For each:
1. load at normal scale,
2. tap input,
3. type,
4. press Done / blur,
5. verify scale/layout/nav are normal,
6. repeat after scrolling partway down the page.

### Scope boundary

Do not redesign sticky navigation.
Do not change input data semantics.
Do not globally disable zoom.

This story is specifically about **mobile Safari input-focus zoom prevention and post-focus viewport stability**.
