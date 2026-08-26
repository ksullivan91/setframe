# Story 58 — Redesign the Exercise Logging Card and Quick-Entry Hierarchy

## User Story
As a user logging a workout in the gym, I want each exercise to present a clear, compact quick-entry experience with detailed sets available only when I need them, so I can record normal exercises quickly without deciphering a dense accordion full of duplicated controls.

## Screenshot / Gym-Test Evidence
The current exercise card mixes all of these concepts in one visual region:
- collapse/expand control,
- exercise title,
- planned prescription,
- completion count,
- Add set,
- overflow menu,
- `All sets: Weight`,
- `All sets: Reps`,
- `All sets: RPE`,
- Apply to all sets,
- individual set editor immediately below.

The bulk fields do not align cleanly on mobile. The area looks like another set editor rather than an intentional quick-log workflow. Focusing the bulk controls also expands the accordion, which destroys the lightweight fast path.

## Problem Statement
There are effectively two editors stacked together:
1. exercise-level bulk inputs,
2. set-level detailed inputs.

Their relationship is not obvious. Exercise-level UI should answer: **Can I quickly log the normal case?** Detailed sets should answer: **Do I need to customize individual sets?**

## UX / Product Intent

### A. Exercise summary row
Always visible:
- exercise name,
- planned prescription,
- progress (`0/3 logged`, `2/3 logged`),
- explicit expand/collapse affordance,
- overflow menu.

Avoid cramming status labels into the title row.

### B. Quick Log region
Visible for incomplete exercises without requiring detailed-set expansion.

For `sets + reps`:
- Weight (lb)
- Reps

Planned reps should be pre-filled from the template.

RPE is excluded from the default quick path.

Primary action should describe the real outcome, for example:
- `Log all 3 sets`
- `Apply & log 3 sets`

Avoid vague `Apply to all sets` copy if the operation persists records.

### C. Detailed Sets region
Expanded only when the user explicitly chooses to inspect/customize individual sets.

Keep detailed controls here:
- set type,
- weight,
- reps,
- RPE,
- representation-specific fields,
- duplicate,
- remove,
- save/retry where applicable.

### Representation-aware Quick Log

| Representation | Quick Log fields |
| --- | --- |
| Sets + reps, weighted | Weight + Reps |
| Bodyweight reps | Reps |
| Duration | Duration |
| Timed sets | Relevant duration/count fields |
| Distance | Distance + unit |
| Distance + duration | Distance + Duration + unit |

Do not show Weight for bodyweight-only movements merely to satisfy the schema. Do not use `0 lb` as a stand-in for “not applicable.”

### Expansion behavior
Focusing/typing/selecting a Quick Log control must **not** expand detailed sets.

Expansion occurs only through the explicit expand control or a deliberate `Edit sets` affordance.

## Acceptance Criteria
- [ ] Summary, Quick Log, and Detailed Sets are visually distinct.
- [ ] RPE is removed from default exercise-level Quick Log for sets+reps.
- [ ] Quick Log fields adapt to exercise representation.
- [ ] Bodyweight exercises do not show/require meaningless `0 lb`.
- [ ] Planned values are pre-filled where appropriate.
- [ ] Focusing/typing in Quick Log does not expand Detailed Sets.
- [ ] Detailed Sets expand only through an explicit interaction.
- [ ] UI remains understandable with 1, 3, 5, and 10+ planned sets.
- [ ] Mobile field alignment is clean at narrow widths.
- [ ] No horizontal scrolling is introduced.
- [ ] Exercise-level and set-level controls have distinct accessible names.
- [ ] Empty/unprogrammed optional values are handled cleanly.
- [ ] Figma reviewer specifically validates hierarchy between summary, quick path, and detailed editing.

## Definition of Done
Apply the product-wide Definition of Done from this pack's README.

## Copilot / Claude Steering Document

Separate the concepts in component structure. Prefer something conceptually like:

```tsx
<WorkoutExerciseCard>
  <ExerciseSummary />
  <ExerciseQuickLog />
  <ExerciseSetDetails />
</WorkoutExerciseCard>
```

Do not add every set field to Quick Log. Optional or set-specific fields belong in Detailed Sets.

Editing Quick Log changes the **active workout session**, not the saved workout template.

### Visual direction
The quick area should read like a compact action panel rather than a nested form. Consider a subtle tint, explicit `Quick log` label, responsive 1–2 column fields, and one strong action.

### QA matrix
Test weighted barbell lift, dumbbell lift, bodyweight reps, duration activity, distance activity, no programmed prescription, long exercise names, and a narrow iPhone viewport.
