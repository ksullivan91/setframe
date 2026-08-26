# Story 66 — Migrate all existing Setframe mobile-web modals to the new modal system

## User Story

**As a** Setframe mobile-web user  
**I want** every modal across the application to behave consistently  
**So that** I do not have to relearn scrolling, dismissal, action placement, or keyboard behavior from feature to feature.

## Screenshot / Gym-Test Evidence

The `Barbell Back Squat` add-to-workout modal is the immediate visible defect, but the scope of this story is intentionally broader.

The product has experienced recurring mobile-web modal issues in multiple workflows, so leaving legacy implementations in place would preserve the same systemic risk.

## Problem Statement

After Stories 64–65 define and implement the standard, all existing mobile-web dialogs need to migrate to that shared system.

If only the currently broken modal is migrated:
- UX inconsistency remains,
- future defects remain likely,
- maintenance remains fragmented,
- users continue encountering different dialog behaviors across Training, Today, Progress, Settings, and workout flows.

## UX / Product Intent

Make the modal experience feel like a product-level interaction pattern.

A user should learn once that:

- complex task = focused full-screen mobile dialog,
- short decision = compact dialog,
- short contextual choices = action sheet,
- close/back location is predictable,
- content scrolls predictably,
- primary actions are predictably placed,
- browser keyboard never destroys the layout.

## Acceptance Criteria

### Migration completeness
- [ ] Every modal found in Story 64's inventory is either:
  - migrated to the new primitive, or
  - explicitly documented as intentionally not migrated with reviewer approval.
- [ ] No legacy bottom-drawer form implementation remains for mobile-web multi-field tasks.
- [ ] Feature-specific dialog wrappers that only reproduce generic modal behavior are removed where safe.
- [ ] Duplicate overlay/focus/scroll-lock utilities are consolidated where safe.

### Immediate add-exercise defect
- [ ] Opening `Barbell Back Squat` while adding an exercise to a workout produces one coherent modal.
- [ ] No blank secondary sheet appears at the top of the viewport.
- [ ] `Prescription`, `Sets`, `Reps`, `Back`, and `Add to workout` remain visible/reachable through normal dialog scrolling.
- [ ] The modal is stable with and without the keyboard displayed.
- [ ] Dismissing returns the user to the workout editor at the prior scroll position.

### Required modal categories to verify
At minimum, migrate and test examples of:
- [ ] exercise selection,
- [ ] add/edit exercise,
- [ ] workout create/edit,
- [ ] additional activity add/edit,
- [ ] workout preview/review dialogs where modal,
- [ ] schedule/program dialogs where modal,
- [ ] destructive confirmations,
- [ ] contextual overflow/action dialogs,
- [ ] settings dialogs,
- [ ] any Progress modal/dialog.

### Behavior consistency
- [ ] Equivalent modal types use equivalent header structure.
- [ ] Equivalent modal types use equivalent dismissal placement.
- [ ] Equivalent modal types use equivalent primary/secondary action hierarchy.
- [ ] Long forms do not hide primary completion actions underneath browser or app chrome.
- [ ] Modal close/cancel does not silently lose user-entered data when confirmation is warranted.
- [ ] No migrated modal introduces horizontal scrolling.

### Native app exclusion
- [ ] No native mobile application UI/components are changed in this migration.
- [ ] Any shared business logic touched by the web migration is verified not to regress native behavior.

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

### Migration method

Do not convert every modal mechanically to `full-screen`.

Use Story 64's classification.

For each modal:

1. identify the user's actual task,
2. select the correct presentation type,
3. migrate to the shared primitive,
4. preserve business logic,
5. simplify duplicated presentation code,
6. validate at mobile + desktop widths,
7. capture before/after evidence.

### Preserve workflow behavior

This story is primarily a presentation/interaction-system migration.

Do not casually redesign unrelated feature logic such as:
- exercise data models,
- workout template behavior,
- scheduling rules,
- additional-activity semantics,
- progress calculations.

If a modal exposes another UX problem, record it separately unless it blocks a safe migration.

### Important migration checks

Search specifically for:
- nested portals,
- modal rendered inside another modal,
- modal state retained after close,
- forms that depend on parent scroll,
- fixed-position buttons,
- `position: sticky` inside nested scroll containers,
- legacy `vh` calculations,
- document-level `overflow: hidden`,
- bottom-nav z-index assumptions,
- duplicated backdrops.

### Figma review expectation

Do not ask Figma review to approve a single giant universal modal mockup.

Provide examples for:
- mobile full-screen task dialog,
- mobile compact confirmation,
- mobile short action sheet,
- desktop task dialog.

Review consistency of:
- spacing,
- header,
- close/back,
- primary/secondary actions,
- destructive actions,
- safe-area behavior,
- keyboard state.

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

