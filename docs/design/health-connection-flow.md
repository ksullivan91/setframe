# Apple Health connection flow

Figma: 📱 Mobile → `🔬 Exploration — Apple Health connection (not signed off)`
(five 390×844 frames plus a spec board, `node-id=193-896`).

Status: **built** (mobile only). See `apps/mobile/src/components/AppleHealthCard.tsx`,
`src/screens/HealthAccessScreen.tsx`, `src/healthkit/useHealthConnection.ts`
and the rewritten `src/healthkit/HealthKitAdapter.ts`.

## Why this needed designing rather than just building

The user's report was "there's no way to sync them up" — multiple *Health
access needed* warnings on Today and a whole Apple Health card, none of which
can be acted on. That reads like a missing button. It isn't, quite: the
button is missing *and* the data behind it was never wired.

Two separate gaps, in `apps/mobile/src/healthkit/HealthKitAdapter.ts`:

1. **`requestAuthorization()` exists and is correct — nothing calls it.**
   Read-only, four types. Grepping for callers outside the adapter itself
   returns nothing. This is the whole of the visible problem.
2. **`getTodayMetrics()` is a stub that always returns all-nulls.** Its own
   comment defers the real queries to "Phase 7 once a physical-device spike
   confirms the exact query shape." Granting permission therefore changes
   nothing on screen until these are written. This is the larger half of
   the work, and it is invisible from the outside.

The adapter's header used to say the user "hasn't enrolled in the Apple
Developer Program yet, so entitlements can't be configured or tested" — long
out of date, and exactly the kind of stale note that makes the next reader
re-derive a blocker that no longer exists. Corrected.

While rewriting it, one more thing surfaced: the adapter loaded its native
module with `await import(...)`, which jest's CJS runtime cannot execute. The
import failed silently, `load()` returned null, and **every adapter test
would have passed against a null module** — green, and testing nothing. It
now uses a guarded `require`, which Metro bundles identically.

## The constraint the whole flow is shaped by

iOS grants an app **one** authorization prompt per data type, for the
lifetime of the install. Decline it and the app can never ask again — it can
only route the user to the Health app.

**And it cannot learn that it was declined.** This is the finding that
changed the design after it was drawn. `HKAuthorizationStatus`
(`sharingAuthorized` / `sharingDenied`) describes *write* permission only,
and Setframe never writes, so it tells us nothing. Apple documents read
permission as deliberately opaque: a refused type behaves exactly as if the
store were empty, because knowing that a user refused is itself a disclosure
about their health.

The only signal available is `getRequestStatusForAuthorization`, which
answers "would the sheet appear?" — separating *never asked* from *already
asked*, and nothing more.

So the honest state model has four states, not five:

| State | How we know | What it means |
|---|---|---|
| `unavailable` | no HealthKit / not iOS | render nothing |
| `not_connected` | `shouldRequest` | we have never asked; Connect will work |
| `connected` | `unnecessary` + data arrived | show the numbers |
| `no_data` | `unnecessary` + nothing arrived | **ambiguous** — refused, or nothing recorded |

That last row is the whole point. The original design had a *Declined*
screen asserting "Apple Health access is turned off", and a *Some metrics
off* screen labelling individual metrics `Off`. Both claim knowledge the OS
refuses to hand over. They were replaced with **Partial data** and **No data
yet**, which report only what is observable — nothing arrived — and still
offer the route into the Health app, because that route is useful whichever
of the two is true.

Three consequences, and each one is a screen:

| Consequence | Screen |
|---|---|
| Ask once, so ask well | **2 · Why we are asking** exists purely to earn the prompt. A generic "allow health access" is what gets declined. |
| Partial grants are normal *and invisible* | Apple's sheet is per metric, everything off by default. **4 · Partial data** shows an em dash, never "Off". |
| A refusal is undetectable | **5 · No data yet** cannot say access is off. It says nothing arrived, and offers Settings anyway. |

## The screens

1. **Not connected** — a real `Connect Apple Health` button, the read-only
   promise, and the four empty metric tiles kept visible so the value of
   connecting is *shown*. The button pushes screen 2; it does **not** prompt.
   Prompting straight from here would spend the single ask with no
   explanation, which is the one mistake this flow exists to avoid.
2. **Why we are asking** — each metric with a specific reason in the user's
   own terms, plus the two promises that matter: read-only, and revocable.
   `Continue` is what finally calls `requestAuthorization()`.
3. **Connected** — real numbers *with provenance*. `docs/architecture.md` §4
   makes HealthKit authoritative for these and our DB a snapshot, so the card
   says where they came from rather than presenting them as ours.
4. **Partial data** — metrics with data show values; the rest show an em
   dash, plus a count and the route into Health.
5. **No data yet** — says only what is true, and names neither cause.

## What is read

Grouped deliberately, because the groups drive the permission strategy.

| Group | Types | Why |
|---|---|---|
| Activity | steps, active energy, exercise minutes | Today and Progress reflect what you did, not only what you logged |
| Nutrition | dietary energy, protein, carbs, fat | Macros are the half of training a set log cannot see |
| Recovery | sleep analysis, HRV (SDNN), resting HR | Whether today should be heavy or easy |
| Body | body mass, height, body fat % | Reads progress against you, not an average |
| Characteristics | biological sex, date of birth | Interprets everything above |

### Nutrition is vendor-neutral

Setframe has no MyFitnessPal integration and never had one — the master
prompt ruled one out from the start. The UI used to say otherwise: a tile
labelled `Calories (MFP)` and a checkbox reading "Done in MyFitnessPal",
which told anyone using Cronometer, Lose It! or MacroFactor that their
tracker would not work. It always would have.

The tile is now `Calories eaten`, the checkbox is "Logged in my nutrition
app" (both platforms), and the **actual writer is read from the sample's own
source metadata** and named in the provenance line — "nutrition via
Cronometer". That is strictly better than a hardcoded vendor: it is true
whoever wrote the data, and it tells the user which of their apps Setframe
actually found.

### Permission strategy for the extended types

`CORE_READ_TYPES` (the four activity/calorie metrics) drive connection
state. `EXTENDED_READ_TYPES` are everything else. They are kept apart for a
specific reason: **iOS computes `shouldRequest` across whatever set you ask
about**, so folding the new types into the core check would have flipped
every already-connected user back to "Not connected" — a false alarm about a
permission they had already granted.

Instead, `hasUnaskedTypes()` reports when a shorter second sheet is
available, and the card offers *Add sleep, heart and body data*. iOS only
lists undetermined types, so a returning user sees just the new ones. Without
this, anyone who connected before these types existed would have watched
empty sleep and HRV tiles forever with no way to fix it — we cannot
distinguish a refusal from an absence, so nothing else would have hinted.

### Two traps worth remembering

- **Body fat comes back as a fraction under the `%` unit.** `0.142` means
  14.2%. Rendered raw, a lean athlete reads as 0.1% body fat.
- **Sleep straddles midnight**, so the window runs 18:00 yesterday → now, not
  midnight → now. And overlapping samples from phone + watch + a sleep app are
  *merged*, not summed, or an 8-hour night is reported as 16. `inBed` and
  `awake` are excluded — counting them tells an exhausted person they are
  well rested.

## Parity with the built screens

`apps/mobile/src/__tests__/HealthFigmaParity.test.tsx` pins each frame's copy
to the rendered component. The strings in it were read out of the Figma
nodes, not retyped, so drift on either side fails the suite.

That test covers **copy and state, not pixels**. Spacing, colour and layout
were not verified against a running app: `react-native-web` is not installed,
and the iOS app cannot be driven from this machine.

## Open questions

- **Verification.** The Simulator has no real health data, so the queries can
  only be confirmed on the physical device. The four `cumulativeSum` queries
  are tested against a mocked native module — units, local-midnight bounds,
  and per-metric isolation — but nothing here has read a real HealthKit
  store. Expect a round trip or two.
- **Entry point.** Screen 2 is drawn as a pushed screen because the content
  scrolls and deserves a back affordance. A sheet from the card would work
  too.
- **Re-priming.** The card currently offers the Health route every time
  nothing arrives. Since we cannot tell a refusal from a quiet day, going
  quiet after a dismissal risks hiding it from someone who did refuse — but
  showing it forever nags someone who simply has not moved yet.
- **Backfill on first connect.** Whether connecting pulls history or starts
  from today. The reconciliation model already re-reads a rolling window
  (`docs/architecture.md` §5), so history is technically available — this is
  a product call.

## Parity note

Apple Health is **mobile-only by design** — web never touches HealthKit
(`CLAUDE.md`, architecture §4). These five screens have no web counterpart,
and that is the one place the standing parity rule does not apply.
