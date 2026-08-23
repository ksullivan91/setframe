# Setframe Product Backlog — Guided Setup Beta-Test Review

## Purpose

This pack converts novice-user beta feedback into scoped stories.

The main product finding is that Guided Setup is functionally capable but still assumes users understand Setframe's hierarchy before the product has taught it.

Observed novice interpretation:
- Program = today's leg day
- Workout = exercises to do today
- Exercises = repeated entry

Desired model:
Program
→ contains reusable workouts
→ each workout contains exercises
→ schedule decides when workouts happen

## Stories

17. Clarify the Program → Workout → Exercise mental model
18. Make workout creation and correction obvious
19. Make planned prescription values optional
20. Fix mobile overlay, keyboard, and scroll stability

## Suggested Order

### Guided Setup comprehension track
17 → 18 → 19

Teach the hierarchy first, then make creation/recovery obvious, then reduce premature programming requirements.

### Mobile platform track
20 can run independently and should be fixed at the shared overlay foundation.

## Standing Delivery Rules

- Mobile-first responsive web.
- Matching mobile-app behavior.
- Mobile web/mobile app parity review.
- GitHub reviewer.
- Figma reviewer.
- Loading/error/accessibility states.
- Behavioral tests.
- No unrelated scope creep.
