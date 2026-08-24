# Setframe Product Backlog — Today Workout Action Hierarchy

## Purpose

This story addresses the action hierarchy inside Today's workout card.

The current card offers four actions with competing emphasis:

- Start workout
- Preview
- Change today's workout
- Rest day

The Rest Day feature is valuable, but it should feel like an intentional recovery choice rather than a second primary CTA competing with Start Workout.

## Story

27. [Clarify Today Workout Actions and Give Rest Day Its Own Intent](./27-today-workout-action-hierarchy-and-rest-day.md)

## Product Recommendation

Use one clear primary action:

**Start workout**

Group:
- Preview
- Change today's workout

Then separate Rest Day into a small explanatory recovery section.

Suggested mobile structure:

Start workout

Preview | Change

---

Need a day off?

Skip today's workout without changing your program.

Take a rest day

## Color Guidance

Do not add another generic button color hierarchy.

Keep:
- purple for primary actions,
- neutral/outlined for supporting actions,
- green for semantic recovery/success/status.

## Important Dependency

Before writing final Rest Day copy, verify how the backend currently treats:
- skipped days,
- streaks,
- consistency,
- history,
- recurring schedules.

The UI must not promise “no penalty” unless the underlying calculations actually honor that behavior.
