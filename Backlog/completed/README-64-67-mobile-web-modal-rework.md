# Setframe Mobile-Web Modal Rework

This backlog batch responds to the mobile-web modal defect observed while adding `Barbell Back Squat` to a newly created workout.

The screenshot is treated as evidence of a **systemic modal architecture problem**, not a one-off add-exercise bug.

## Recommended story order

1. **Story 64 — Research and define the Setframe mobile-web modal presentation standard**
   - Inventory existing dialogs.
   - Classify them by task.
   - Document the evidence-based standard.

2. **Story 65 — Build a unified responsive modal primitive for Setframe web**
   - Implement the shared responsive foundation.
   - Validate it independently before mass migration.

3. **Story 66 — Migrate all existing Setframe mobile-web modals to the new modal system**
   - Convert every existing web modal according to its classification.
   - Includes the immediate `Barbell Back Squat` defect.

4. **Story 67 — Add mobile-web modal regression and Safari viewport coverage**
   - Permanently protect the interaction contract with Playwright/WebKit.

## Product decision

This is intentionally a **web-only** rework.

Do not change the native mobile application as part of these stories. This is an explicit scope exception to Setframe's normal parity rule.

## Design direction in one sentence

**On compact mobile web, long/input-heavy modal tasks should behave as focused full-screen dialogs; compact confirmations remain compact; short contextual choice lists may remain action sheets.**

This avoids treating every overlay as the same bottom drawer and aligns the component with the complexity of the user's task.

## Research basis

- W3C modal-dialog guidance: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- W3C small-screen full-screen modal example: https://www.w3.org/TR/2017/NOTE-wai-aria-practices-1.1-20171214/examples/dialog-modal/dialog.html
- Apple HIG Modality: https://developer.apple.com/design/human-interface-guidelines/modality
- Apple HIG Popovers: https://developer.apple.com/design/human-interface-guidelines/popovers
- Apple HIG Action Sheets: https://developer.apple.com/design/human-interface-guidelines/action-sheets
