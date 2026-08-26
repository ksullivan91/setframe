# Story 62 — Add Workout-Flow Focus Behavior and Preserve Granular Overrides

## User Story
As a user moving through a workout, I want Setframe to keep the current exercise focused, collapse work I have completed, and still let me override individual sets when reality differs from the plan so the interface follows my workout instead of making me manage accordions.

## Product Intent
The workout page should behave like a sequence of focused work units, not a giant form.

### Focus model
- One exercise may be the primary expanded/detail-focused exercise at a time.
- Entering Quick Log does not count as expanding details.
- Explicitly opening Exercise B collapses Exercise A's detailed region.
- Before collapsing A, recalculate its completion state.
- If A is complete, show completed treatment.
- If A is incomplete, show concise progress (`2/3 logged`) without punitive styling.

### Preserve manual overrides
Quick Log establishes a baseline, not a prison.

Example:
1. Bench planned 3 × 8.
2. User Quick Logs 135 × 8 for all 3 sets.
3. User opens detailed sets.
4. Changes Set 3 to 135 × 6.
5. Only Set 3 changes.
6. Exercise remains complete if 6 reps is valid actual logged data under the representation rules.

Planned vs actual should remain visible.

### Template protection
None of these session edits modify the underlying workout template unless the user explicitly chooses a separate `Update template` action.

### Auto-focus next useful action
After an exercise completes and collapses, consider moving visual emphasis—not forced scroll—to the next incomplete exercise.

Do not unexpectedly jump the page if the user is inspecting something else.

## Acceptance Criteria
- [ ] Only one Detailed Sets region is expanded at a time by default.
- [ ] Opening another detailed exercise collapses the previously expanded one.
- [ ] Collapsing recalculates current completion state.
- [ ] Quick Log focus alone does not open Detailed Sets.
- [ ] Individual set overrides remain possible after bulk logging.
- [ ] Individual overrides do not unintentionally propagate to sibling sets.
- [ ] Actual values may differ from planned values without being treated as invalid simply because they differ.
- [ ] Session edits do not modify the template.
- [ ] Completed exercises remain editable.
- [ ] No forced scroll/jump interrupts the user after completion.
- [ ] Keyboard/focus behavior remains predictable on web.
- [ ] Mobile interaction works one-handed and without accidental accordion toggles.

## Definition of Done
Apply the product-wide Definition of Done from this pack's README.

## Copilot / Claude Steering Document

Model at least these states explicitly:
- collapsed incomplete,
- expanded incomplete,
- saving/syncing,
- collapsed complete,
- expanded complete/editing,
- sync error.

Do not infer all states from a collection of unrelated booleans if a small state model would be clearer.

### Planned vs actual
A workout plan is guidance. Actual performance is the truth of the session.

Do not enforce `actual reps === planned reps` as a completion requirement. Completion means required actual data is valid and logged, not that the user perfectly matched the prescription.

### Potential follow-up, not in scope
A future story can add `Use last set`, `Use previous session`, or progression suggestions. Keep this story focused on interaction and override correctness.
