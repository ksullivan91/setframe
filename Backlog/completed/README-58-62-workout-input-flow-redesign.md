# Setframe — Today's Workout Input Flow Rebuild

## Why this feature family exists

The current exercise-level quick-entry concept is directionally correct, but the implementation is still making the user do too much work.

The latest gym test shows four important problems:

1. **The exercise header does not visually read as a quick-entry control.** The accordion header, bulk inputs, Add set action, overflow menu, completion count, and individual set cards all compete for attention.
2. **The bulk action does not actually complete the job.** Applying weight/reps to all sets populates fields but still requires the user to open the exercise and save each set individually.
3. **Saving is serialized by the network.** A user cannot comfortably move through sets because one mutation has to finish before the next one can be saved.
4. **Completion is functionally correct but emotionally flat.** Completing an exercise should create momentum. Right now it adds another label into an already dense header.

The product goal is not simply “fewer taps.” The goal is to make logging feel fast enough that the user can stay mentally inside the workout instead of managing a form.

## North-star interaction

For **Barbell Bench Press — 3 × 8**:

1. User sees a compact exercise card.
2. The card clearly communicates exercise name, planned prescription, progress, and only the quick-entry fields relevant to that exercise type.
3. User enters **weight** once.
4. Planned **reps** are already present from the template.
5. User performs one explicit action such as **Log all 3 sets**.
6. Set rows are updated and persisted optimistically.
7. If all required set data is valid, the exercise becomes complete.
8. The expanded exercise collapses automatically.
9. The collapsed completed card becomes visually rewarding and clearly different from an incomplete exercise.
10. User naturally moves to the next exercise.

If the user needs exceptions, they expand the exercise and edit individual sets.

## Critical product principle

**The exercise-level controls are a fast path, not a second copy of the set editor.**

For `sets + reps`, Quick Log should normally expose:
- Weight, when relevant
- Reps

**RPE should not be a bulk-header field by default.** It is optional and commonly set-specific.

Representation-aware examples:
- Weighted sets + reps → Weight + Reps
- Bodyweight reps → Reps only
- Duration → Duration
- Distance → Distance + unit
- Distance + duration → Distance + Duration + unit

Do not render irrelevant fields simply because the underlying set model supports them.

## Story order

*(Renumbered on intake: the pack arrived as 52-56, which collide with the
already-shipped mobile parity audit stories 52-56. Content is unchanged.)*

58. Redesign the exercise logging card and quick-entry hierarchy  
59. Make bulk quick-entry persist/log all applicable sets atomically  
60. Introduce optimistic workout logging and non-blocking mutation behavior  
61. Create an automatic, celebratory exercise-completion experience  
62. Add workout-flow focus behavior and preserve granular overrides

## Dependencies

- **58** establishes the UX structure.
- **59** depends on the quick-entry semantics from 58.
- **60** is required for 59 to feel genuinely fast.
- **61** depends on reliable completion state from 59/60.
- **62** ties the interaction together and protects detailed-edit behavior.

## Benefits beyond the immediate fixes

### Lower logging friction
A four-set exercise should not require entering the same weight four times and waiting for four saves.

### Keeps attention on training
Users should think about the lift, not API state.

### Reduces accidental inconsistency
One bulk operation creates a consistent baseline while still allowing individual exceptions.

### Fewer network round trips
A batch/session mutation can replace several sequential writes.

### Better poor-network behavior
An optimistic mutation layer is foundational for gyms with weak cellular/Wi-Fi.

### Reusable interaction model
The same model can later support Apple Watch logging, voice entry, repeat-last-set, previous-session weight suggestions, plate-calculator shortcuts, rest timers, and keyboard shortcuts.

### Makes completion psychologically meaningful
A clear reward loop emerges: **log → finish → visible progress → next exercise**.

### Cleaner future analytics
Explicit exercise completion supports more trustworthy adherence, skipped-exercise, planned-vs-actual, and future coaching analytics.

## Product-wide Definition of Done

Every story in this pack must satisfy the standing Setframe rules:
- Mobile-first responsive web.
- Equivalent behavior in the mobile application.
- Mobile web vs mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, empty, success, disabled, degraded-data, retry, and error states handled where applicable.
- Keyboard, focus, touch-target, VoiceOver/screen-reader, reduced-motion, and color-contrast behavior verified.
- Behavioral tests cover important user-visible behavior.
- Session-only edits remain session-only unless the user explicitly updates the template.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.
- Validate narrow mobile widths and desktop/full-width layouts.
- Explicitly test horizontal overflow, sticky-navigation regressions, and iOS Safari input behavior.

## Non-negotiable instruction to Claude

Do not solve this by adding more labels, more buttons, or more fields into the existing header.

This is an interaction redesign. First model:
- what belongs at exercise level,
- what belongs at set level,
- what action actually persists data,
- what constitutes complete,
- what happens while requests are in flight,
- what visual state communicates completion.

Do not preserve a poor component structure merely because it already exists.
