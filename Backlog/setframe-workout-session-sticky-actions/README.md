# Setframe Product Backlog — Active Workout Persistent Actions

## Story

36. [Keep Active Workout Session Actions Reachable During Long Workouts](./36-active-workout-persistent-session-actions.md)

## Product Recommendation

The current placement is fine for a short workout but does not scale to real gym use.

Both `Add exercise` and `Finish workout` are **session-level actions**, so they should remain reachable wherever the user is in the session.

### Recommended mobile hierarchy

Use a compact sticky action surface immediately above Setframe's bottom navigation:

**+ Add exercise** | **Finish workout**

- Add exercise = secondary
- Finish workout = primary

This is preferable to a floating action button because there are two important session actions, and hiding one in an overflow menu would make it less discoverable.

It is also preferable to making the entire page header sticky, because that would consume too much vertical space during a workout.

### Desktop

Use the same actions in a persistent desktop-appropriate location, likely a compact sticky header/action row.

The requirement is persistent reachability, not identical geometry.

## Related Stories

- Story 34 — Remove an exercise from today's session only
- Story 35 — Investigate active workout horizontal overflow

Story 36 should be regression-tested alongside Story 35 because any new fixed/sticky surface can accidentally reintroduce viewport-width or mobile safe-area problems.
