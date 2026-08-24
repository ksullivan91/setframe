# Story 41 — Add an Additional Activity Section to Today

## User Story
As a user moving throughout my day, I want the Today page to show supplemental movement separately from my scheduled workout so that I can quickly log and review walks, yoga, mobility, foam rolling, and other activity without confusing them with my primary training session.

## Product Intent
Today should answer:
1. What did I plan to do today?
2. What else did I actually do?

Recommended hierarchy:

### Planned training
**Today's workout**  
Recovery Day A  
Scheduled · 7:00 AM  
✓ Complete

### Additional activity
`+ Add activity`

After entries exist:
- Walk · 18 min · 12:45 PM
- Walk · 14 min · 6:20 PM
- Foam rolling · 12 min · 8:10 PM

The scheduled workout remains visually primary.

## UX Requirements
Empty state:
**Additional activity**  
`Add walks, mobility, yoga, or anything else you do outside today's planned workout.`  
`+ Add activity`

Populated rows should show:
- type/title
- duration
- distance when relevant
- time
- source indicator when useful

Support review, edit, and delete.

Additional Activity remains available on training days, recovery days, rest days, and days with no scheduled program.

## Acceptance Criteria
- [ ] Today contains a distinct Additional activity section.
- [ ] Scheduled workout remains visually primary.
- [ ] Empty state explains what the section is for.
- [ ] User can launch Add Activity from Today.
- [ ] Multiple activities can appear on one day.
- [ ] Rows show type, duration, time, and distance where relevant.
- [ ] Manual and synced sources can both appear.
- [ ] Activities can be edited/deleted.
- [ ] Activities do not alter scheduled-workout completion.
- [ ] Section works on rest/no-program days.
- [ ] No horizontal overflow is introduced.
- [ ] Mobile web and mobile app have equivalent hierarchy.

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
Do not clone the Today's Workout card. Additional Activity should have lighter visual weight.

Suggested components:
- `TodayAdditionalActivitySection`
- `AdditionalActivityRow`

Sort chronologically by actual start time when known.

Use section-level loading/error states so a failed activity request never blocks the scheduled workout.

Do not change the morning-routine completion count in this story unless explicitly required.
