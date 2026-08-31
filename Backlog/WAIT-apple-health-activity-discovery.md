# Story 44 — Detect Apple Health Workouts and Suggest Adding Them as Additional Activity

> **Status:** Unblocked, awaiting sign-off. Still not started.
>
> It was holstered for one reason: "the mobile app isn't deployed to a real
> device/TestFlight yet, so there's no way to exercise a live HealthKit
> connection." **That blocker is gone.** The app is on TestFlight, HealthKit
> is provisioned, and the permission flow, the real metric queries, and the
> read-only adapter all shipped — see `docs/design/health-connection-flow.md`.
>
> Stories 40–42/45 (the `AdditionalActivity` entity, Today section, manual add
> flow, metric separation) remain shipped and unaffected.
>
> **One thing this story needs that does not exist yet:** workouts are a
> separate HealthKit permission. `HEALTH_READ_TYPES` in `HealthKitAdapter.ts`
> covers activity, nutrition, recovery, body and characteristics — it does
> *not* include `HKWorkoutTypeIdentifier`, and `queryWorkoutSamples` is never
> called. Adding it means another authorization sheet for existing users; the
> adapter's `hasUnaskedTypes()` / "Add sleep, heart and body data" affordance
> already exists to carry exactly that, so wire the new type through
> `EXTENDED_READ_TYPES` rather than inventing a second prompt path.
>
> Per CLAUDE.md, do not start without explicit sign-off.

## User Story
As a user whose Apple Watch or Apple Health already captured a walk, yoga session, cycle, or other workout, I want Setframe to recognize it and offer to add it to my day so that I do not manually duplicate data my devices already recorded.

## Product Context and Intent
This is a high-value Additional Activity workflow.

Apple Health may already know:
- workout type
- start/end time
- duration
- distance
- energy data

Setframe should use that data to reduce manual effort.

The initial experience should be **detect → suggest → user confirms**, not silent automatic importing.

Example:

**Activity found**  
Apple Health recorded an Outdoor Walk at 12:42 PM.  
`17 min · 0.8 mi`

`Add to today`   `Dismiss`

## Detection and Mapping
When Health sync is available and authorized, inspect relevant workout records for the current/recent day.

Map supported Health workout types to Setframe Additional Activity types, for example:
- Walking → Walk
- Yoga → Yoga
- Cycling → Outdoor/Indoor cycle where distinguishable
- Running → Run
- flexibility/recovery types → best supported mapping or Other

Unknown types should degrade gracefully and preserve source metadata where useful.

## Suggestion Flow
Show a compact Today suggestion containing:
- Apple Health source
- activity type
- start time
- duration
- distance if available

Actions:
- Add to today
- Dismiss

For first implementation, prefer opening the Add Activity form prefilled so the user can confirm/edit the mapping.

## Dedupe
Never import the same Apple Health workout twice.

Store a stable external workout identifier/dedupe key.

Previously imported workouts must not be re-suggested.

Dismissed suggestions should not repeatedly nag the user in the same context.

If a similar manual activity already exists, exact external-id dedupe is required now; fuzzy time/type matching can be a later enhancement.

## Acceptance Criteria
- [ ] Discovery only runs with relevant Health permissions.
- [ ] Supported Health workouts map to Additional Activity types.
- [ ] Found activity can surface as a Today suggestion.
- [ ] Suggestion shows type, time, duration, and distance when available.
- [ ] User can Add or Dismiss.
- [ ] Add prefills/saves an Additional Activity with source `apple_health`.
- [ ] Imported activity stores a stable external identifier.
- [ ] Same Health workout cannot be imported twice.
- [ ] Imported workouts are not re-suggested.
- [ ] Dismissed suggestions do not continuously reappear.
- [ ] Sync failures do not block Today or workout logging.
- [ ] Privacy/permission state is respected.
- [ ] Native/mobile implementation follows actual Apple Health platform capabilities.
- [ ] Web clearly reflects when Apple Health data is unavailable.
- [ ] Tests cover mapping, dedupe, dismissal, and import.

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
This is suggested import, not background auto-logging.

Audit the existing Apple Health integration before implementing:
- connection state
- permissions
- device/native-only constraints
- current sync architecture
- server vs device data ownership

Do not invent browser access to Apple Health if the platform cannot provide it.

Create one explicit mapping layer for Apple workout types.

Use external workout id as the authoritative exact dedupe mechanism.

Model suggestion lifecycle conceptually as:
- detected
- suggested
- accepted/imported
- dismissed

Do not spam after dismissal.

Do not make Apple Health required for the Additional Activity feature.
