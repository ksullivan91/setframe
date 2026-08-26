# Story 64 — Research and define the Setframe mobile-web modal presentation standard

## User Story

**As a** Setframe user on a mobile web browser  
**I want** modal experiences to use a consistent presentation pattern appropriate to the task I am performing  
**So that** dialogs feel predictable, readable, stable, and easy to complete without clipping, split-sheet artifacts, browser-scroll problems, or confusion about which layer I am interacting with.

## Screenshot / Gym-Test Evidence

The attached screenshot shows the current `Barbell Back Squat` add-to-workout flow opening in a visually broken state:

- the dimmed application is visible behind the modal as expected,
- a blank rounded sheet-like region appears near the top of the viewport,
- the actual `Barbell Back Squat` modal content appears as a second sheet lower in the viewport,
- the experience visually reads as two disconnected modal layers,
- the modal occupies a large amount of the already constrained mobile viewport,
- Safari browser chrome further reduces usable vertical space.

This is not being treated as an isolated `Add exercise` defect. Similar sheet/drawer behavior has already caused repeated mobile-web problems throughout Setframe, so the product needs one documented modal strategy rather than continued one-off CSS repair.

## Problem Statement

Setframe currently appears to rely heavily on a drawer/bottom-sheet style presentation for mobile-web modals. That pattern can be pleasant when the task is short and bounded, but many Setframe modals contain forms, dynamic content, virtual-keyboard interaction, lists, selectors, or multiple actions.

The current approach has created recurring failure modes:

- clipped or visually split modal containers,
- inconsistent height calculations,
- background-page movement,
- nested scrolling,
- confusion over which region should scroll,
- sticky-navigation interaction,
- virtual-keyboard pressure,
- viewport-height issues in mobile Safari,
- difficult-to-maintain modal-specific CSS fixes.

The problem is therefore architectural and UX-systemic, not merely cosmetic.

## UX / Product Intent

Create a factual, documented **Setframe Web Modal Standard** before rewriting components.

The standard should classify modal experiences by task, instead of forcing every modal into the same bottom-drawer shape.

Recommended direction to validate during implementation:

### A. Full-screen mobile dialog — default for form/task modals

Use the full mobile viewport for tasks that require meaningful interaction, including:

- add/edit exercise,
- create/edit workout,
- workout configuration,
- additional activity entry,
- multi-field forms,
- searchable selection + creation flows,
- any modal likely to require the keyboard,
- any modal whose content may grow dynamically.

This direction is supported by:
- W3C's modal example, which fills the screen on small devices to improve reading and avoid background movement,
- Apple's guidance to use full-screen modal presentation for more complex/in-depth tasks,
- Apple's guidance to avoid popover-style presentations in compact views.

A full-screen dialog does **not** mean the UI should look like an unrelated page. It should still clearly communicate modal context through its header, title, close/back treatment, and transition.

### B. Compact centered dialog — brief decisions

Use a compact dialog for:

- confirmations,
- destructive confirmation,
- short warnings,
- very small binary/ternary decisions.

These should not expand to full-screen simply because the device is mobile if the content is genuinely brief.

### C. Action sheet / bottom sheet — short action lists only

Retain a bottom/action-sheet concept only where the content is a small set of contextual choices such as:

- `Remove from today's workout`,
- simple overflow-menu actions,
- confirmation choices closely tied to an initiating action.

Do not use this pattern as a scrolling multi-field form.

### D. No nested modal stacks

A modal must generally close or transition internally before another modal layer is presented.

The product should avoid “sheet on top of sheet” experiences because they increase cognitive load and are a likely contributor to the current visual defect.

## Acceptance Criteria

- [ ] Inventory every modal/dialog/sheet currently used in the web application.
- [ ] Document each modal's:
  - route/screen,
  - trigger,
  - purpose,
  - approximate content complexity,
  - whether it uses inputs,
  - whether it invokes the virtual keyboard,
  - whether content can grow dynamically,
  - current desktop presentation,
  - current mobile-web presentation.
- [ ] Classify each existing modal into one of the approved presentation types:
  - full-screen task dialog,
  - compact dialog,
  - short action sheet.
- [ ] Create a Markdown design/engineering standard in the repository documenting when each presentation type should be used.
- [ ] Explicitly document that mobile-web form modals should not default to bottom drawers.
- [ ] Explicitly document scroll ownership: exactly one intended scroll container for each modal experience.
- [ ] Explicitly document virtual-keyboard behavior.
- [ ] Explicitly document focus management and dismissal behavior.
- [ ] Explicitly document safe-area and mobile-browser viewport behavior.
- [ ] Explicitly document header/footer expectations for long task dialogs.
- [ ] Include the research sources below in the repository standard.
- [ ] Review the standard with both the Figma reviewer and GitHub reviewer before beginning mass migration.
- [ ] Do **not** modify the native mobile application.

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

### Mission

Do not patch the attached `Barbell Back Squat` modal in isolation.

Treat this story as the product/design architecture phase of a **mobile-web modal-system rework**.

### Required discovery

Before proposing code changes:

1. Search the web codebase for every modal implementation, including:
   - `Modal`
   - `Dialog`
   - `Sheet`
   - `Drawer`
   - `BottomSheet`
   - portals
   - overlays
   - fixed-position dialog containers
   - modal-specific wrappers
2. Identify whether multiple competing primitives exist.
3. Identify any modal implementations that calculate height from:
   - `100vh`,
   - JS window height,
   - fixed pixel values,
   - nested `max-height`,
   - parent containers instead of the viewport.
4. Identify where body scroll is disabled and restored.
5. Identify where focus management is implemented.
6. Identify whether modals are mounted inside layout containers that can introduce clipping or stacking-context bugs.
7. Identify whether app bottom navigation remains mounted above/below modal layers.
8. Produce the inventory before rewriting anything.

### Architecture principle

The goal is one shared responsive modal foundation with presentation variants, not a giant component containing conditional hacks for every feature.

Prefer an API conceptually similar to:

```tsx
<AppDialog
  presentation="task" | "compact" | "actions"
  title="..."
  open=<function open at 0x7f36d99cd030>
  onClose=Ellipsis
>
  ...
</AppDialog>
```

The exact component API must fit the existing Setframe architecture; do not copy this literally if a better abstraction already exists.

### Important product constraint

This rework is **web-only**. Do not update React Native/native-mobile modal components.

### Do not

- do not solve this with `overflow-x: hidden` on the document,
- do not globally disable user zoom,
- do not hard-code iPhone pixel heights,
- do not create per-modal CSS overrides as the main solution,
- do not preserve bottom-sheet behavior for long forms simply because it already exists,
- do not stack new modal layers over existing modal layers,
- do not change unrelated workflows during inventory/research.

### Deliverables

- modal inventory,
- modal classification table,
- repository modal UX standard,
- recommended shared primitive architecture,
- migration map identifying which stories/components move in the subsequent migration story.

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

