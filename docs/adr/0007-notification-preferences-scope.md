# ADR 0007: Notification Preferences — Scope Boundary

Status: Accepted (preferences only). Date: 2026-08-20.

## Context

The Settings screen (Figma style guide §19) added a "Notifications"
section with two toggles: "Workout reminders" and "Weekly progress
summary". `github-copilot-fitness-app-master-prompt.md` does not mention
push notifications, reminders, or any notification infrastructure
anywhere — this is new scope introduced by the UI design work, not
something Phase 0 originally accounted for.

We need the Settings screen to be backed by real data (not purely
decorative UI) without prematurely committing to a push-delivery
mechanism (Expo push service vs. direct APNs, background scheduling,
device token management) before mobile implementation (Phase 7+) begins.

## Decision

Split the concern in two:

1. **Preferences (in scope now)**: a minimal `user_notification_preference`
   table (`docs/data-model.md` §6.1) and `GET`/`PATCH
   /v1/me/notification-preferences` endpoints (`docs/api.md`). This lets
   the Settings toggles persist real user intent starting in Phase 2+
   (API/data model build-out), independent of whether push delivery
   exists yet.
2. **Delivery (explicitly deferred)**: no push token storage, scheduling
   logic, or delivery provider (Expo push / APNs) is decided or built
   now. `expo-notifications` is intentionally **not** added to
   `docs/dependencies.md` yet. This will require its own follow-up ADR
   once mobile push delivery is actually implemented, likely bundled
   with Phase 7 HealthKit/mobile work since both need a physical device
   and Apple Developer Program enrollment (see `docs/data-model.md` §9).

## Consequences

- Toggling a preference has no observable effect (no notification will
  actually fire) until delivery infrastructure is built — this should be
  treated as expected/documented behavior, not a bug, if reached before
  Phase 7.
- No new architecture/hosting changes are required for Phase 0-6 as a
  result of this ADR.
