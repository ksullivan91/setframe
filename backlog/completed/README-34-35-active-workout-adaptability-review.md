# Setframe Product Backlog — Active Workout Session Adaptability + Mobile Overflow

## Stories

34. [Allow Removing an Exercise From the Current Workout Session Only](./34-remove-exercise-from-current-session-only.md)
35. [Investigate and Eliminate Horizontal Scrolling on the Active Workout Page](./35-investigate-active-workout-horizontal-overflow.md)

## Why these are separate stories

These came from the same gym-test pass but represent different concerns.

### Story 34 — session adaptability

The active workout already allows the user to diverge from the plan in several ways. Removing a planned exercise for one session is a natural extension of that model.

The important domain rule is:

**Today's session can change without mutating the reusable workout template.**

This supports real-world cases such as:
- weather,
- equipment availability,
- pain/fatigue,
- time constraints,
- intentionally skipping a movement.

### Story 35 — horizontal overflow

The screenshot confirms the active workout page can become wider than the mobile viewport, but does not prove which component causes it.

This is therefore written as an investigative bug story.

Copilot is explicitly instructed to:
- reproduce,
- identify the actual overflow source,
- fix intrinsic sizing,
- avoid masking the issue with a blanket `overflow-x: hidden`,
- add regression protection.

## Recommended Order

These stories are independent.

Story 35 is the higher-priority UX bug because horizontal viewport instability can affect every interaction on the workout page.

Story 34 can be implemented independently once session/template ownership semantics are confirmed.
