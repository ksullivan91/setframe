# Story 67 — Add mobile-web modal regression and Safari viewport coverage

## User Story

**As a** Setframe product team  
**I want** automated coverage for our mobile-web modal system  
**So that** split sheets, horizontal scroll, keyboard breakage, focus leaks, and hidden actions are caught before users encounter them.

## Screenshot / Gym-Test Evidence

The attached screenshot demonstrates a defect that is easy to miss in desktop development:

- the dialog is being used in iPhone Safari,
- browser chrome materially reduces usable height,
- the visual modal surface is split,
- a desktop-only test would likely not reproduce the same rendering.

This class of defect requires explicit WebKit/mobile regression coverage.

## Problem Statement

Setframe has repeatedly discovered mobile-web issues manually during real gym use.

Without automated modal-specific coverage, future refactors can reintroduce:

- split dialog surfaces,
- wrong viewport height,
- nested scrolling,
- background scroll,
- horizontal overflow,
- sticky-navigation interference,
- keyboard overlap,
- broken focus restoration.

## UX / Product Intent

Treat mobile Safari/WebKit as a first-class runtime for Setframe's web product.

The goal is not to assert exact pixels everywhere. The goal is to protect the interaction contract.

## Acceptance Criteria

### Automated modal contract tests
- [ ] Shared Playwright tests open representative dialogs for each presentation type.
- [ ] Tests run in WebKit for mobile-web regression coverage.
- [ ] Tests assert the document does not horizontally overflow while each modal is open.
- [ ] Tests assert the underlying page cannot scroll while a task/compact modal is open.
- [ ] Tests assert only one active dialog surface exists for one modal.
- [ ] Tests assert background controls cannot receive focus.
- [ ] Tests assert focus returns to the trigger on dismissal.
- [ ] Tests assert Escape dismissal on desktop where applicable.
- [ ] Tests assert close/back controls are accessible by role/name.
- [ ] Tests assert no console errors/unhandled promise rejections occur during open/close.

### Viewport coverage
- [ ] 375×667 WebKit.
- [ ] 390×844 WebKit.
- [ ] 430×932 WebKit.
- [ ] 768×1024.
- [ ] 1440×900 desktop baseline.
- [ ] At least one landscape compact-height case for long task dialogs.

### Keyboard/input coverage
For at least two input-heavy task dialogs:
- [ ] focus the first input,
- [ ] enter data,
- [ ] advance between fields,
- [ ] scroll content while keyboard-sized viewport pressure is simulated where tooling permits,
- [ ] close keyboard/focus,
- [ ] confirm no horizontal overflow,
- [ ] confirm primary action remains reachable,
- [ ] confirm the dialog remains one coherent surface.

### Visual evidence
- [ ] Add screenshot snapshots for representative:
  - full-screen mobile task dialog,
  - compact confirmation,
  - short action sheet.
- [ ] Snapshot expectations focus on major structural regressions, not brittle text antialiasing.

### Add-exercise scenario
- [ ] Regression test creates/selects a workout.
- [ ] Opens add-exercise flow.
- [ ] Selects `Barbell Back Squat`.
- [ ] Opens prescription configuration.
- [ ] Confirms the modal remains coherent.
- [ ] Enters sets/reps.
- [ ] Adds the exercise.
- [ ] Verifies returned workflow state.

## Product-wide Definition of Done

This story is not complete until all applicable requirements below are satisfied.

### Functional
- [ ] Acceptance criteria are satisfied.
- [ ] Relevant unit/integration tests pass.
- [ ] Relevant Playwright regression tests pass.
- [ ] Loading, error, empty, and cancellation states are intentionally handled.
- [ ] No unrelated behavior is changed.

### Responsive Web
- [ ] Implement mobile-first.
- [ ] Validate at minimum at 375×667, 390×844, 430×932, 768×1024, and 1440×900.
- [ ] Validate both portrait and landscape where modal height/keyboard behavior can change.
- [ ] No unintended horizontal overflow is introduced.
- [ ] No modal content is clipped behind browser chrome, the Setframe bottom navigation, or safe-area insets.
- [ ] Virtual-keyboard interaction has been tested on input-heavy modals.

### Scope Exception — Native Mobile App
- [ ] **Do not modify the native mobile application as part of this modal rework.**
- [ ] This is an intentional exception to Setframe's normal web/mobile parity rule because the defect and redesign are scoped specifically to the mobile web modal system.
- [ ] Existing native mobile behavior must remain unchanged.

### Accessibility
- [ ] Dialog has an accessible name.
- [ ] Modal background is inert while open.
- [ ] Initial focus is intentional.
- [ ] Keyboard focus remains inside the dialog until dismissal.
- [ ] `Escape` dismisses where appropriate.
- [ ] Focus returns to the logical triggering control after dismissal.
- [ ] Close controls have accessible names and minimum touch-target sizing.
- [ ] Color is not the sole indicator of state.

### UX Review
- [ ] Run the Setframe UX Reviewer against the affected canonical workflow(s).
- [ ] Review using WebKit/iPhone-sized mobile web, not Chromium only.
- [ ] Before/after screenshots are captured for meaningful visual changes.
- [ ] No P0/P1 UX findings remain.
- [ ] Task clarity and mobile ergonomics score at least 4/5.
- [ ] Any unrelated discoveries are documented separately instead of silently fixed.

### Review
- [ ] GitHub/code reviewer validates implementation quality and regression risk.
- [ ] Figma/design reviewer validates the implemented modal patterns against the approved responsive design.
- [ ] Review explicitly compares the affected modal states across small mobile, typical mobile, tablet, and desktop web.


## Copilot / Claude Steering Document

### Testing philosophy

Do not create only component-level tests for the dialog primitive.

We need:
1. primitive tests,
2. at least one real application workflow per presentation type.

The defect occurred in a real nested workflow, so integration context matters.

### Horizontal-overflow assertion

Add a reusable helper conceptually equivalent to:

```ts
const hasHorizontalOverflow = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth
);

expect(hasHorizontalOverflow).toBe(false);
```

Also inspect the active dialog's bounds; a hidden overflow rule on the body must not be used to conceal a dialog that is actually wider than the viewport.

### Scroll-lock assertion

Record underlying page scroll position before opening the modal.

Attempt to scroll background content while modal is open.

Verify the page scroll position does not change.

Then close the modal and verify scrolling is restored.

### Focus assertion

Use role-based locators and keyboard navigation.

Do not accept “tabbing appears okay visually” as sufficient validation.

### Safari emphasis

Use Playwright WebKit for automated coverage, but record in the story/release checklist that final high-risk input/modal changes still receive a real iPhone Safari smoke test because browser-emulation engines cannot perfectly reproduce every device/browser-chrome condition.

### Do not

- do not use screenshot tests as the only validation,
- do not hide overflow globally to force tests green,
- do not skip small-height devices,
- do not test only the primitive outside the product,
- do not modify the native mobile app.

## Research Sources

The modal system should be designed from documented platform/accessibility guidance rather than from aesthetic preference alone.

1. **W3C WAI-ARIA Authoring Practices — Modal Dialog Pattern**  
   https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/  
   Relevant guidance: content behind a modal is inert; focus stays within the dialog; focus moves inside on open; Escape closes; focus returns to the invoking element.

2. **W3C WAI-ARIA Modal Dialog Example**  
   https://www.w3.org/TR/2017/NOTE-wai-aria-practices-1.1-20171214/examples/dialog-modal/dialog.html  
   Relevant mobile guidance: the example explicitly uses a 100%-screen dialog on small screens to improve readability and avoid background movement while scrolling dialog content.

3. **Apple Human Interface Guidelines — Modality**  
   https://developer.apple.com/design/human-interface-guidelines/modality  
   Relevant guidance: use modality only when beneficial; keep modal tasks focused; use full-screen presentation for complex/in-depth tasks; provide an obvious dismissal path; avoid stacking multiple modal views.

4. **Apple Human Interface Guidelines — Popovers**  
   https://developer.apple.com/design/human-interface-guidelines/popovers  
   Relevant guidance: avoid popovers in compact views and use available screen space with a full-screen modal/sheet instead.

5. **Apple Human Interface Guidelines — Action Sheets**  
   https://developer.apple.com/design/human-interface-guidelines/action-sheets  
   Relevant guidance: action sheets are for a small set of choices related to an intentional action, should be used sparingly, and should not become scrolling forms.

