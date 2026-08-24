# Setframe Product Backlog — Faster Active Workout Logging

## Assessment

Yes — this is worth adding to the backlog.

The direction solves a real gym-use problem: Setframe currently gives strong per-set control, but makes repetitive sets unnecessarily repetitive to log.

## Two important refinements

### Preserve individual overrides

Bulk values must not silently overwrite a set the user intentionally changed.

Either track inherited vs manual values or require an explicit `Apply to all sets` action once overrides exist.

### Use active-exercise behavior, not raw blur

Do not collapse an exercise every time an input blurs. That would be irritating while moving between weight, reps, RPE, and buttons in the same section.

Instead:
- interaction stays within exercise → keep open,
- user moves to another exercise → collapse previous, expand next.

Completion is derived from valid required data, not caused by blur.

## Stories

37. Add Collapsible Exercise Sections With Quick-Entry Defaults
38. Add Exercise-Level Completion State Based on Required Set Data
39. Use Single-Active Exercise Accordion Behavior During Workout Logging

## Recommended order

**37 → 38 → 39**

## Related stories

- 34 — Remove exercise from current session only
- 35 — Active workout horizontal overflow
- 36 — Persistent session actions

Together these form a coherent active-workout UX:
- session controls always reachable,
- exercises compact,
- common values entered once,
- detailed overrides available,
- completion clearly visible,
- no viewport instability.
