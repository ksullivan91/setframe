# Setframe Product Backlog — Additional Activity Feature

## Product Vision

Additional Activity exists because a user's movement does not fit neatly into a single scheduled workout.

A normal day can contain:
- one planned training session,
- several short walks,
- yoga,
- mobility,
- foam rolling,
- an easy ride,
- other supplemental movement.

Setframe should capture all of that **without pretending every activity is another scheduled workout**.

The core question is:

> What did I plan to do today, and what else did I actually do?

## Core Product Model

### Scheduled workout
Comes from the active program and drives program adherence, scheduled-session completion, and workout streaks.

### Additional activity
Movement outside the formal schedule, such as a post-meal walk, yoga, mobility, foam rolling, or light cycling. It is meaningful history but does not count as another scheduled workout by default.

### Ad hoc workout
A substantial unscheduled training session that the user intentionally wants treated like a workout, such as an unexpected second lifting session.

This pack intentionally does not fully design ad hoc workouts yet. The distinction is preserved so Additional Activity does not become overloaded.

## Stories

40. Introduce the Additional Activity Domain Model
41. Add an Additional Activity Section to Today
42. Build a Fast Manual Add Activity Flow
43. Add Reusable Quick Activity Shortcuts
44. Detect Apple Health Workouts and Suggest Adding Them
45. Separate Additional Activity From Scheduled Training in History and Progress

## Recommended Delivery Order

### Phase 1 — Foundation + usable MVP
**40 → 41 → 42 → 45**

This creates the domain, Today placement, manual logging, and correct history/progress semantics.

### Phase 2 — Friction reduction
**43**

Quick/recent presets become more useful once real activity usage exists.

### Phase 3 — Device intelligence
**44**

Apple Health discovery is safest once the Additional Activity entity and dedupe behavior already exist.

## Product Guardrails

### Do not treat every activity as a workout
A recovery day with 1 scheduled Recovery Day workout, 3 walks, and 1 foam-rolling session must not become `5 workouts`.

### Do not require program changes
Additional Activity is day-level history. Logging a walk today does not alter future schedules.

### Do not require workout-builder complexity
A walk should take seconds to log. No sets/reps/weight UI unless the activity genuinely requires it.

### Do not silently import Apple Health
Initial Health behavior is:
**detect → suggest → user confirms**

### Preserve Today's hierarchy
The planned workout remains visually primary. Additional Activity should complement it, not compete with it.

## Future Opportunities — Not Part of This Pack

This foundation leaves room for:
- true scheduled two-a-day programs
- ad hoc full workout sessions
- recurring activity reminders
- automatic Health matching with confidence scoring
- recovery/movement Progress graphs
- contextual suggestions such as “You often walk after lunch”

Those should build on this model rather than being prematurely folded into the MVP.
