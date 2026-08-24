# Story 35 — Investigate and Eliminate Horizontal Scrolling on the Active Workout Page

## User Story

As a mobile web user logging a workout, I want the active workout page to remain constrained to the viewport width so that I never accidentally pan sideways, lose content alignment, or destabilize the sticky navigation.

## Screenshot / Gym-Test Evidence

The third screenshot shows the active **Workout session** page horizontally shifted.

Visible symptoms include:

- the left side of the page content is clipped,
- `Workout session` and other content begin partially offscreen,
- the page can be horizontally panned,
- the main content width appears larger than the device viewport,
- the sticky bottom navigation remains viewport-aligned while page content is shifted, making the problem especially obvious.

The exact offending element has not yet been identified.

This issue appears on the active workout page and should be investigated rather than patched blindly.

## Problem Statement

Some element or layout rule on the active workout screen is increasing document width beyond the mobile viewport.

Common causes that should be investigated include:

- child width greater than `100%`,
- `width: 100vw` inside a padded container,
- fixed/min-width form controls,
- flex/grid children without `min-width: 0`,
- long unbroken text,
- absolute-positioned elements extending beyond their containing block,
- inline unit labels,
- transforms,
- negative margins,
- toast/overlay geometry,
- sticky/fixed navigation interactions,
- safe-area calculations,
- chart/popover/shared components leaking width,
- browser focus/viewport restoration.

Because this is an active workout screen with many reusable components, a superficial `overflow-x: hidden` fix could hide real content or mask bugs elsewhere.

## UX / Product Intent

The active workout page should have exactly one vertical scrolling axis on normal mobile use.

At every supported mobile width:

- page content remains within the visual viewport,
- cards fit their container,
- buttons and inputs remain visible,
- sticky navigation stays aligned,
- no element can create a wider document,
- opening/closing modals, toasts, keyboards, dropdowns, or tooltips does not introduce persistent horizontal overflow.

The fix should identify the actual source(s) of overflow.

## Acceptance Criteria

- [ ] The active workout page does not horizontally scroll at supported mobile widths.
- [ ] `document.documentElement.scrollWidth <= document.documentElement.clientWidth` under normal page states, allowing only documented browser rounding tolerance.
- [ ] Workout header remains fully visible and aligned.
- [ ] Session summary remains within the viewport.
- [ ] Exercise cards remain within the viewport.
- [ ] Set cards remain within the viewport.
- [ ] Add Exercise and Finish Workout controls do not overflow.
- [ ] Inputs, unit labels, action icons, and planned-value pills do not create overflow.
- [ ] Success/error toasts do not create overflow.
- [ ] Open dropdowns/popovers/modals do not permanently expand document width.
- [ ] Keyboard focus/blur does not reintroduce horizontal scrolling.
- [ ] Sticky bottom navigation remains aligned with the viewport throughout.
- [ ] Fix does not clip legitimate content.
- [ ] Fix does not rely solely on global `overflow-x: hidden`.
- [ ] Other pages using the same corrected shared component are regression-tested.
- [ ] Mobile app layout is reviewed for equivalent spacing/alignment issues.
- [ ] A behavioral/regression test or development assertion is added where practical to catch future horizontal overflow.

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

This is intentionally an **investigative bug story**.

Do not assume the cause from the screenshot.

### Reproduce first

Use a narrow mobile viewport matching the screenshot as closely as practical.

Reproduce with:

1. active workout loaded,
2. multiple exercise cards,
3. duration-only exercise,
4. distance + duration exercise,
5. sets/reps exercise,
6. toast visible,
7. dropdown/menu open,
8. keyboard focus and blur where applicable.

### Find the offending element

Use browser devtools/script to identify elements wider than the viewport.

Useful diagnostic approach:

```js
[...document.querySelectorAll('*')]
  .filter((el) => {
    const r = el.getBoundingClientRect();
    return r.right > window.innerWidth + 1 || r.left < -1;
  })
  .map((el) => ({
    el,
    rect: el.getBoundingClientRect(),
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
```

Also inspect:
- `document.documentElement.scrollWidth`
- `document.body.scrollWidth`

Temporarily outline offenders in development if useful.

### High-probability suspects

Audit:
- page shell/container width,
- session summary card,
- set grid,
- `planned` pills,
- unit suffix rendering,
- toast container,
- bottom nav,
- Add Exercise modal trigger,
- any `100vw`,
- fixed pixel widths,
- transforms,
- negative margins.

### CSS principles

Prefer fixing intrinsic sizing:
- `box-sizing: border-box`,
- `max-width: 100%`,
- `min-width: 0` on flex/grid children,
- `width: 100%` rather than nested `100vw`,
- wrapping/truncating long text intentionally,
- responsive grid collapse.

Avoid using `overflow-x: hidden` as the primary solution.

It may be appropriate as a final defensive guard only after all real overflow sources are fixed and only if it does not clip legitimate overlays/content.

### Shared-component impact

If the root cause is a shared SetCard/Input/Button/Toast/PageShell component:
- fix the primitive,
- regression-test every route using it.

Coordinate with:
- Story 23 — mobile input zoom/viewport stability,
- Story 29 — modal spacing,
- Story 30 — tooltip viewport containment.

### Add a regression check

Where practical, add an automated mobile-layout test that asserts page scroll width does not exceed viewport width.

At minimum cover the active workout route in its populated state.

### Scope boundary

Do not redesign the workout page.
Do not remove useful content to make the width fit.
Do not hide the issue without identifying the root cause.

The output of this story should be both:
1. a root-cause fix,
2. a regression mechanism preventing the same class of bug from returning.
