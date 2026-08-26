# Story 65 — Build a unified responsive modal primitive for Setframe web

## User Story

**As a** Setframe user on mobile web  
**I want** task dialogs to use the viewport reliably and behave like a focused mobile experience  
**So that** I can complete forms and selections without split sheets, clipped content, hidden controls, nested scroll traps, or browser-layout instability.

## Screenshot / Gym-Test Evidence

The attached add-exercise screenshot demonstrates a broken presentation where the modal visually separates into two white rounded regions instead of one coherent dialog.

This story fixes the shared primitive responsible for this class of problem rather than applying a one-off patch to the exercise flow.

## Problem Statement

A reusable modal foundation needs to account for modern mobile-browser constraints:

- Safari browser chrome changes usable viewport height,
- the software keyboard changes visible space,
- safe-area insets affect bottom controls,
- `100vh` can behave differently from the currently visible mobile viewport,
- fixed app navigation can overlap modal actions,
- nested body/modal scrolling can produce split or detached visual states,
- portals/stacking contexts can cause unexpected overlay behavior.

Without one shared implementation, every form modal becomes another opportunity to recreate these bugs.

## UX / Product Intent

Implement one responsive web dialog system with three modes defined in Story 64.

### Mobile task dialogs

For compact-width/mobile web:

- occupy the usable viewport as one coherent surface,
- use `100dvh`/dynamic viewport behavior or an equivalently robust implementation,
- respect safe-area insets,
- have a stable top header containing title and dismissal/navigation,
- have one scrollable content region,
- optionally provide a sticky action footer when primary actions need to remain reachable,
- keep the app underneath fully inert,
- do not expose Setframe's sticky bottom navigation above the modal,
- remain stable when the keyboard opens and closes.

### Desktop/tablet

Do not turn every desktop dialog into a full-screen page.

The same primitive should adapt by presentation type:
- centered dialog for normal task forms where space permits,
- constrained dialog with internal content scrolling when needed,
- compact dialog for confirmations,
- action presentation for short choice lists.

## Acceptance Criteria

### Shared primitive
- [ ] A single shared web modal/dialog primitive supports the approved presentation variants.
- [ ] The primitive is rendered in a portal/root layer that is not clipped by page layout containers.
- [ ] Only one modal surface is visible for a single open dialog.
- [ ] Background content is inert while the dialog is active.
- [ ] Background scroll is locked without causing layout width shift.
- [ ] Scroll position is restored after dismissal.
- [ ] Opening/closing the dialog does not move the underlying page unexpectedly.

### Mobile task dialog
- [ ] At compact mobile widths, `presentation="task"` uses one full-screen/viewport-filling modal surface.
- [ ] It does not render as a partial bottom drawer.
- [ ] Height responds correctly when mobile Safari browser chrome changes.
- [ ] Height responds correctly when the software keyboard appears.
- [ ] Content never extends horizontally beyond the viewport.
- [ ] Modal content has intentional left/right padding.
- [ ] Top header stays available while long dialog content scrolls.
- [ ] Close/back control remains reachable.
- [ ] Primary action remains reachable without fighting the Setframe bottom navigation.
- [ ] Safe-area padding is respected on iPhone-like devices.
- [ ] Exactly one container owns vertical scrolling.

### Accessibility
- [ ] Uses native `<dialog>` semantics where feasible, or `role="dialog"` + `aria-modal="true"` with equivalent behavior.
- [ ] Dialog receives an accessible name.
- [ ] Focus moves intentionally into the dialog.
- [ ] Focus cannot tab behind the modal.
- [ ] Escape closes non-blocking dialogs.
- [ ] Focus returns to the triggering control on close unless the workflow logically moves elsewhere.

### Stability
- [ ] Opening and closing the same dialog repeatedly does not accumulate scroll-lock styles.
- [ ] Route changes while a modal is open do not leave the body locked.
- [ ] Two rapid open/close events do not create duplicate overlays.
- [ ] A modal cannot visually split into separate top/bottom surfaces.

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

### Implementation priority

Build the primitive first, validate it in an isolated harness/Storybook/example page, then migrate product modals in Story 66.

Do **not** attempt to rewrite every application modal inside this foundational story.

### Mobile viewport engineering

Investigate and use the appropriate combination of:

- `100dvh`,
- `svh`/`lvh` only if justified,
- `env(safe-area-inset-top)`,
- `env(safe-area-inset-bottom)`,
- `visualViewport` only if CSS viewport units do not solve a demonstrated issue.

Do not add JavaScript viewport calculations preemptively. Prefer platform CSS behavior first.

### Scroll architecture

For a task dialog, target a structure conceptually similar to:

```text
modal viewport
├── header (non-scrolling)
├── content (the one vertical scroll owner)
└── footer/action area (optional, non-scrolling)
```

The page behind the dialog must not scroll.

Avoid:
- body scroll + dialog scroll at the same time,
- scrollable outer modal plus scrollable form,
- absolute-positioned action buttons over form content.

### Fixed navigation interaction

When a task dialog is open, the dialog owns the interaction layer.

The Setframe mobile web bottom navigation should not compete visually or interactively with it.

Do not solve this by arbitrarily increasing z-index values across the app. Establish a documented layer/z-index system if one does not exist.

### Keyboard behavior

Test with real focusable inputs using WebKit.

When the keyboard opens:
- focused field remains visible,
- header does not detach,
- footer does not cover the field,
- modal does not become two visual regions,
- browser does not create horizontal overflow.

### Motion

Keep open/close motion short and purposeful. A full-screen mobile task dialog may enter with subtle vertical motion/fade, but do not mimic a draggable bottom sheet unless the interaction genuinely supports dragging and detents.

### Test harness

Before migration, build representative examples:
1. short task form,
2. long task form,
3. searchable list,
4. form with keyboard + sticky action,
5. compact confirmation,
6. action list.

Validate all six at the required viewport matrix.

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

