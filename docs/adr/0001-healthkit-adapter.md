# ADR 0001: HealthKit Adapter Strategy

Status: Proposed. Date: 2026-08-20.

## Context

Setline's mobile app must read HealthKit activity, activity-summary/ring,
heart/fitness, body-weight, and MyFitnessPal-via-HealthKit nutrition data,
using Expo development builds (not Expo Go), with authorization,
statistics/collection queries, activity summary queries, provenance,
observer queries, and background delivery. The master spec requires
evaluating existing RN wrappers before committing, and owning a small Swift
module via Expo Modules API only if no wrapper meets requirements.

## Options considered

| Library | Latest (npm, checked 2026-08-20) | Maintenance | Notes |
|---|---|---|---|
| `react-native-health` (AE Studio) | 1.19.0 | ⚠️ Stalled — maintainers publicly state (per their own README) they are "currently focused" on a full Swift rewrite and are "temporarily holding off on introducing new features," accepting only critical bug-fix PRs. | Objective-C based (legacy), callback-style (not Promise-first everywhere), well-known but aging. |
| `@kingstinct/react-native-healthkit` | 14.0.2 | ✅ Active — recent releases, uses `react-native-nitro-modules` (new architecture), full TypeScript, Promise + hook APIs, explicit Expo config-plugin support (`background` delivery flag in plugin config), `subscribeToChanges` for observer-query-equivalent behavior, broad type coverage (100+ quantity types, workout types, correlation types incl. food/blood pressure). | Newer/smaller community than `react-native-health`, but architecturally the better fit for a 2026-era Expo dev-client app. |
| Custom Swift module via Expo Modules API | N/A | Full control, most effort | Reserved as fallback if the chosen wrapper is missing a specific required API (e.g., a particular activity-summary edge case) during the Phase 7 physical-device spike. |

## Decision

Adopt **`@kingstinct/react-native-healthkit`** as the primary HealthKit
binding, evaluated against the required capabilities as follows:

- Maintenance: active, TypeScript-first, built for the new RN architecture.
- Expo development builds: explicit config-plugin support documented
  (`app.json` plugin entry, including a `background: true` option for
  background-delivery entitlement wiring). Not compatible with Expo Go —
  consistent with the master spec's requirement to use development builds.
- Authorization: `requestAuthorization`/`useHealthkitAuthorization`.
- Statistics/aggregate queries: supported per package's stated 100+
  quantity-type coverage with query/save/subscribe for each.
- Activity summaries (rings): **uncertain, not confirmed from package
  documentation alone** — see open uncertainties below. Must be verified in
  the Phase 7 physical-device spike before relying on it.
- Provenance: package aims to keep "TypeScript mappings as close as
  possible to HealthKit," implying source/metadata fields are exposed,
  but exact provenance API shape needs hands-on verification.
- Observer/background delivery: `subscribeToChanges` plus the `background`
  Expo plugin flag suggest support; must be verified on a physical device
  per master spec §7 ("Real-device testing required" — simulators cannot
  validate background delivery).

Regardless of which wrapper is used, **all native HealthKit types are
normalized at the adapter boundary** per the master spec's mapping:

```text
HealthKit native -> adapter DTO -> normalized TS health model -> API reconciliation DTO
```

The `HealthDataProvider` TypeScript interface (per master spec §2, mobile
stack) is implemented once against `@kingstinct/react-native-healthkit`;
domain/UI code never imports `HKQuantity`/`HKSample`-shaped types directly.

## Uncertainties to resolve in Phase 7 (physical-device spike)

1. **Activity summary / rings query** (`HKActivitySummaryQuery` equivalent)
   — confirm the wrapper exposes this, or whether it must be added via a
   small custom Swift module layered on top of the wrapper (not a full
   replacement — Expo Modules API allows mixing).
2. **Background delivery reliability** — `enableBackgroundDelivery`
   equivalent and observer completion-handler correctness must be tested
   on a physical iPhone; iOS background execution is deliberately
   constrained and cannot be validated in a simulator.
3. **MyFitnessPal nutrition provenance** — confirm MFP-written HealthKit
   samples are actually readable with correct source metadata via this
   wrapper, and that at least one full day's calories/protein/carbs/fat/
   fiber match the Apple Health app's own UI (master spec §24 explicitly
   warns not to assume raw aggregation matches the Apple Health UI without
   testing).
4. **Limited historical access / partial authorization semantics** — verify
   how the wrapper surfaces Apple's deliberately ambiguous "no data
   returned" case (which can mean zero data or denied permission) so the
   adapter can implement the master spec's required states (`authorized +
   populated`, `authorized but no data`, `not granted`, `limited historical
   access`, `unavailable`, `error`) rather than collapsing them.
5. If any of the above are missing or unreliable in the wrapper, add a
   narrowly-scoped Expo Modules API Swift extension for just that gap
   rather than replacing the whole wrapper.

## Consequences

- Mobile HealthKit code depends on a smaller, newer library; budget spike
  time in Phase 7 to validate the four uncertainties above before writing
  production reconciliation logic against it.
- If Phase 7 finds blocking gaps, fall back to a custom Swift module for
  the specific missing capability, keeping `@kingstinct/react-native-healthkit`
  for everything else it does support, rather than a full rewrite.
