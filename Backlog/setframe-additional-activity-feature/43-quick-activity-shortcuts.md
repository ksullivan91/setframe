# Story 43 — Add Reusable Quick Activity Shortcuts

## User Story
As a user who repeats the same supplemental activities frequently, I want quick shortcuts for common activities so that I can log them with minimal effort rather than filling out the same form every day.

## Product Context and Intent
Some Additional Activities repeat often but should not become formal scheduled workouts.

Examples:
- Post-meal walk · 15 min
- Mobility · 10 min
- Foam rolling · 12 min
- Evening yoga · 20 min

The product should support repetition without turning Additional Activity into a calendar or adherence system.

## UX / Product Intent
Add a **Quick add / Recent** area to the Add Activity flow.

Examples:
- Post-meal walk · 15 min
- Mobility · 10 min
- Foam rolling · 12 min

For initial scope, tapping a shortcut should prefill the normal Add Activity form for review before saving.

Allow users to explicitly save useful combinations as quick activities and remove saved shortcuts later.

## Acceptance Criteria
- [ ] Add Activity can show recent/saved quick shortcuts.
- [ ] Shortcut communicates type/title and core default such as duration.
- [ ] Selecting a shortcut prefills the Add Activity form.
- [ ] User can modify values before save.
- [ ] Shortcut use does not create/modify workout templates.
- [ ] User can remove saved shortcuts.
- [ ] New-user state does not show meaningless placeholders.
- [ ] Mobile web and mobile app provide equivalent behavior.
- [ ] Tests verify shortcut defaults do not overwrite unrelated fields.

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
Start simple:
- Recent activities
- Save as quick activity

Do not build recurrence rules, reminders, notifications, or scheduled activity templates.

A quick preset stores defaults, not a reference to historical activity itself.

Possible fields:
- title
- activity type
- default duration
- default distance/unit
- default notes
