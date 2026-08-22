# Setframe — Proposed Dependency Set (Phase 0 Draft → Confirmed at Phase 1-2)

Status: Confirmed for `apps/api`, `apps/web`, `apps/mobile` scaffolds
(Phase 1-2 implementation, 2026-08-20). Versions below reflect what
actually installed cleanly via `npm install` and passed `tsc --noEmit` /
boot verification, not just what was checked live against npm registry
metadata — see "Confirmed deviations" at the end of this doc for where
reality diverged from the original Phase 0 proposal.

## Repository tooling
- `turbo` — `2.10.11`
- TypeScript strict mode across all workspaces
- npm workspaces (no Yarn/pnpm per spec)

## Web (`apps/web`)
- `react` / `react-dom` — `19.2.8`
- `react-router-dom` — `7.18.2`
- `@tanstack/react-query` — `5.101.4`
- `vite` — `8.2.2`
- `styled-components` — `6.5.3`
- `react-hook-form` — `7.85.0`
- `zod` — `4.4.3`
- `@clerk/clerk-react` — `5.61.3`
- `vitest` — `4.1.11`, Testing Library, MSW

## Mobile (`apps/mobile`)
- `expo` / `expo-router` — `57.0.15`
- `react-native` — **`0.86.2`** (confirmed installed; see deviation #1
  below — this is what Expo SDK 57.0.15 actually bundles/requires, not
  `0.87.0` as originally proposed)
- `@tanstack/react-query`, `react-hook-form`, `zod` (shared versions above)
- `@clerk/clerk-expo` — `2.20.0`
- `expo-secure-store` — `57.0.1`
- `@kingstinct/react-native-healthkit` — `14.0.2` (see ADR 0001) +
  `react-native-nitro-modules` — `0.37.0` (peer dependency)
- `lucide-react-native` — `1.33.0`
- `react-native-gesture-handler` `3.2.1`, `react-native-safe-area-context`
  `5.9.1`, `react-native-screens` `4.27.0`, `react-native-svg` `15.15.5`
  (expo-router navigation peer dependencies, not called out individually
  in the original Phase 0 proposal)
- `react-native-reanimated` — **not installed** (see deviation #2)
- `expo-notifications` — **deferred, not yet added**. The Settings
  screen's reminder toggles (Figma style guide §19) only need the
  preference-storage endpoints in `docs/api.md` for now; actual push
  delivery (and this dependency) is out of scope until a dedicated
  notifications ADR is written, likely alongside Phase 7 mobile work.

## Backend (`apps/api`)
- `fastify` — `5.12.1`
- `fastify-type-provider-zod` — `7.0.0`
- `@fastify/cors` — `11.3.0`
- `@fastify/helmet` — `13.1.1`
- `zod` — `4.4.3`
- `pino` — `10.3.1` (Fastify's built-in logger ecosystem)
- `drizzle-orm` — `0.45.2`
- `drizzle-kit` — `0.31.10`
- `@neondatabase/serverless` — `1.1.0`
- `@clerk/backend` — `3.16.9`

## Shared packages
- `zod` — schema source of truth (`packages/schemas`)
- `openapi-typescript` — `7.13.0` (or current-recommended equivalent,
  reconfirm at Phase 5) for `packages/api-client` generation

## Testing / CI
- `vitest` — `4.1.11` (domain, API, web unit/integration tests)
- Playwright (added later, Phase 11 critical-flow E2E) — version to be
  checked when that phase starts
- GitHub Actions (no specific version pin beyond referencing current
  `actions/checkout`, `actions/setup-node` major versions at
  implementation time)

## Explicitly excluded per master spec

No Redis, Kafka, Elasticsearch, event sourcing/CQRS framework,
Kubernetes, GraphQL, or tRPC packages — Postgres + one Fastify service is
sufficient for MVP scale (spec §34).

## Decided (2026-08-20)

`react-native-health` (AE Studio) was evaluated and rejected in favor of
`@kingstinct/react-native-healthkit` — see ADR 0001. Confirmed, no
objection — this is the working HealthKit dependency for Phase 6/7.

**Blocker to track**: the user has not yet enrolled in the Apple Developer
Program. This doesn't block npm dependency work in Phases 1–6, but must be
resolved before Phase 7 (HealthKit entitlements require a paid Apple
Developer account) and Phase 11 (TestFlight/App Store distribution).
Recommend starting enrollment now, in parallel with earlier phases, since
Apple's approval isn't instant.

## Confirmed deviations from the original Phase 0 proposal (2026-08-20, Phase 1-2 build-out)

Found while actually scaffolding `apps/api`/`apps/web`/`apps/mobile` and
running `npm install` + `tsc --noEmit` + dev-server boot checks against
real npm registry state (rather than the point-in-time version check done
during Phase 0). None of these required a design decision — all are
mechanical version/package corrections:

1. **`react-native` is `0.86.2`, not `0.87.0`.** Expo SDK `57.0.15` (the
   version pinned in this doc) bundles/requires React Native `0.86.2` as
   its actual peer version — `0.87.0` was never a valid pairing for that
   Expo SDK. No functional impact; Expo's managed workflow enforces this
   pairing automatically via `expo install`.
2. **`react-native-reanimated` is not installed.** It was never actually
   required by any built screen/component/navigator (expo-router's
   default stack/tabs navigators don't require it, and no gesture-driven
   animation exists yet). Installing it now would only add a peer-version
   conflict without present value — add it later only if/when a specific
   screen needs Reanimated-driven animation.
3. **No local `@types/react` in `apps/mobile`.** Deliberately omitted to
   avoid a duplicate/conflicting `@types/react` install alongside the one
   already resolved via `apps/web`'s workspace hoisting — Expo's own
   TypeScript config resolves React types correctly without it.
4. Additional expo-router peer dependencies not itemized in the original
   Phase 0 list, now pinned: `react-native-gesture-handler` `3.2.1`,
   `react-native-safe-area-context` `5.9.1`, `react-native-screens`
   `4.27.0`, `react-native-svg` `15.15.5`, `lucide-react-native` `1.33.0`.

**Corporate npm registry note**: this development machine's global
`.npmrc` points `registry` at a local corporate Nexus mirror
(`nexus-tools.swacorp.com`). Every `npm install` run during this project
has regenerated `package-lock.json` with `resolved` URLs pointing at that
internal mirror instead of `registry.npmjs.org`. Each time, these were
manually rewritten back to the public registry before committing, to
avoid leaking an internal hostname and to keep the lockfile portable for
any contributor without VPN/network access to that mirror. **Anyone
running `npm install` on a machine with a similar registry override will
regenerate the same drift** — re-run the same substitution
(`s#https://nexus-tools\.swacorp\.com/repository/npm(-releases)?/#https://registry.npmjs.org/#g`)
on `package-lock.json` before committing if this happens again, or
configure a project-local `.npmrc` pointing at the public registry to
prevent it at the source.
