# Story 45 — Separate Additional Activity From Scheduled Training in History and Progress

## User Story
As a user reviewing my progress, I want supplemental movement to contribute to the right activity metrics without inflating scheduled workout counts or program streaks so that Setframe accurately reflects both training consistency and total movement.

## Product Intent
Additional Activity has value and should remain visible in history.

But:
1 scheduled Recovery Day workout + 3 walks + 1 foam-rolling session
must not equal
5 completed workouts.

## History UX
History should clearly distinguish:

### Scheduled training
Recovery Day A  
Completed · 7:00 AM

### Additional activity
Walk · 18 min · 12:45 PM  
Walk · 14 min · 6:20 PM  
Foam rolling · 12 min · 8:10 PM

Initial scope can use clear labels. Filters such as All / Workouts / Activities can come later if needed.

## Progress Semantics

### Scheduled-workout-only unless explicitly renamed
- scheduled workout completion
- program adherence
- workout streak
- Sessions per week when it means formal training sessions

### Good Additional Activity metrics for future use
- total activity minutes
- walking minutes/distance
- mobility/recovery minutes
- additional activity count
- active days

Do not overload `Sessions per week` with Additional Activities without changing the label and product meaning.

## Acceptance Criteria
- [ ] History labels Additional Activity separately from scheduled workouts.
- [ ] Multiple activities on one day remain individually visible.
- [ ] Additional Activity does not increment scheduled-workout session count.
- [ ] Additional Activity does not incorrectly extend workout streaks.
- [ ] Program adherence remains based on scheduled program behavior.
- [ ] Progress calculations explicitly document whether Additional Activity is included.
- [ ] Existing metric names remain truthful.
- [ ] Editing/deleting an activity recalculates relevant activity metrics.
- [ ] Manual and Apple Health activities are handled consistently.
- [ ] Mobile/web history and Progress semantics match.
- [ ] Tests verify 1 workout + 3 activities is not reported as 4 training sessions.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Matching user-facing behavior in the mobile app.
- Mobile web and mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, success, empty, disabled, and error states handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior considered.
- Existing historical data preserved unless explicitly migrated.
- Behavioral tests cover important user-visible outcomes.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.


## Copilot / Claude Steering Document
Audit every aggregate that reads workout/session history.

Create a metric-inclusion matrix, for example:

| Metric | Scheduled workout | Additional activity |
| --- | --- | --- |
| Program adherence | Yes | No |
| Workout streak | Yes | No |
| Sessions/week | Yes | No by default |
| Activity minutes | Yes/Maybe | Yes |
| Walking minutes | If applicable | Yes |

Do not change metric semantics casually.

If a future metric combines both, rename it so users understand what it represents.

Do not retroactively infer Additional Activities from old workout sessions.

Do not redesign the full Progress page in this story.
