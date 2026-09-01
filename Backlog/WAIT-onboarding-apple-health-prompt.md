# WAIT — Prompt for Apple Health during onboarding

**Status:** deferred by request, 2026-09-01. Filed so the gap is tracked;
deliberately not started. Belongs to the onboarding feature, which does not
exist yet.

## The gap

Apple Health access is asked for only when someone happens to scroll to the
Apple Health card on Today and taps **Connect Apple Health**. Nothing in the
app's first run mentions it. A new user can reach a fully working Today
screen having never been offered the connection, and the card that would
offer it sits below the fold.

That is also why permission problems surface late and look like bugs rather
than like a choice the user was never given — see the heart-rate series
returning empty because `HKQuantityTypeIdentifierHeartRate` was never
granted, and the same risk now applies to `HKQuantityTypeIdentifierVO2Max`.

## What this should do

- Offer the Apple Health connection as a step in onboarding, by name.
  The card keeps the literal title **"Apple Health"** in every state
  precisely so onboarding, the card, and iOS's own sheet all say the same
  words.
- Skippable without penalty. The app works without Health, and the Today
  card must remain the place to connect later.
- Ask for the full read set in one prompt. iOS only prompts for
  *undetermined* types, so a partial first ask permanently strands the rest
  behind `hasUnaskedTypes()` and the "still needs access to …" nudge.
- Say what is read and that nothing is ever written — the existing card copy
  ("Read only. Setframe never writes anything to Apple Health.") is the
  wording to reuse.

## Constraints that already exist

- `ALL_READ_TYPES` / `READ_GROUPS` in `apps/mobile/src/healthkit/HealthKitAdapter.ts`
  are the single source of truth for what is requested and how a missing
  group is named to the user. Onboarding must request from those, not from
  its own list.
- Read permission is unknowable after the fact: `getRequestStatusForAuthorization`
  distinguishes only "never asked" from "asked", never "granted" from
  "denied". Onboarding must not claim a grant succeeded.
- **Never request write access.** Enforced by a source-level test.

## Not in scope

Any change to the Apple Health card's current design or copy. This adds a
second, earlier entry point to the same flow.
