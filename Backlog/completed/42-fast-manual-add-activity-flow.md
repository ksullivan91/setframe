# Story 42 — Build a Fast Manual Add Activity Flow

## User Story
As a user who just finished a short walk, yoga session, or recovery activity, I want to log it in a few seconds with only relevant inputs so that capturing movement does not feel like building a workout.

## UX / Product Intent
`+ Add activity` opens a focused flow.

### Choose activity
- Walk
- Yoga
- Mobility
- Foam rolling
- Outdoor cycle
- Indoor cycle
- Run
- Stretching
- Other

### Relevant fields only
Walk:
- Duration
- optional distance
- optional start time
- optional notes

Yoga / Mobility / Foam rolling / Stretching:
- Duration
- optional start time
- optional notes

Outdoor/Indoor cycle:
- Duration
- optional distance
- optional start time
- optional notes

Other:
- Activity name
- Duration
- optional distance
- optional notes

Do not expose weight, sets, reps, or RPE for ordinary Additional Activity types.

Defaults:
- date = today
- units = user preference
- start time may default to now or remain optional

After save, close the flow, update Today immediately, and show a confirmation such as `Walk added.`

## Acceptance Criteria
- [ ] Add Activity is reachable from Today.
- [ ] Activity choices are understandable without workout-builder knowledge.
- [ ] Only activity-relevant fields are shown.
- [ ] Weight/sets/reps are absent for ordinary activities.
- [ ] Date defaults to Today.
- [ ] Units respect user settings.
- [ ] Required fields are minimal.
- [ ] Loading/error/cancel states are handled.
- [ ] Saved activity appears immediately on Today.
- [ ] Keyboard behavior does not cause zoom/viewport issues.
- [ ] Modal/sheet does not cause horizontal overflow.
- [ ] Web/mobile flows are equivalent.

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
Optimize for seconds, not configuration.

Drive fields from activity type with a shared configuration/representation mapping rather than duplicated forms.

Be conservative with required fields; duration may be sufficient for many activities.

Manual entry must remain valid even when Apple Health is not connected.

Do not build recurring routines or workout-set logic here.
