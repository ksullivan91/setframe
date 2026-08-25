# Story 56 — Catch Missing Peer Dependencies Before They Reach a Device

## User Story

As a developer, I want a missing required peer dependency to fail a check
rather than a launch, so that a package the app depends on transitively
cannot be absent for months without anyone noticing.

## Problem Statement

`@clerk/clerk-expo` declares `expo-web-browser` and `expo-auth-session` as
**required** peer dependencies (not marked optional in
`peerDependenciesMeta`). Neither was in `apps/mobile/package.json`.

Nothing caught it:

- Typecheck passed — no app file imports them; Clerk does, internally.
- Tests passed — the mobile suite mocks the api client and never mounts
  `ClerkProvider`'s real import graph.
- The production build passed.
- `npm install` reports peer warnings, but they scroll past among 19
  existing vulnerability warnings and are not an error.

The gap surfaced only when the app was launched on a simulator for the first
time and crashed with `Cannot find native module 'ExpoWebBrowser'`. It had
been broken for as long as mobile auth had existed, because **nobody had
ever run the app.**

An audit of all 24 mobile dependencies' peer requirements against the
installed tree found **no other missing required peers** — so this is
currently a class-of-one. The point of this story is that nothing would
detect the second instance either.

## UX / Product Intent

Developer-facing. The check should fail loudly, in CI and locally, and name
the missing package and which dependency requires it.

It must distinguish **required** peers from ones marked
`peerDependenciesMeta.optional` — `@clerk/clerk-expo` legitimately lists five
optional peers (`expo-crypto`, `expo-apple-authentication`,
`expo-local-authentication`, `expo-secure-store`, `@clerk/expo-passkeys`) and
flagging those would train everyone to ignore the check.

## Acceptance Criteria

- [ ] A check fails when a required peer dependency is not installed.
- [ ] Optional peers (`peerDependenciesMeta.optional`) do not trigger it.
- [ ] Output names the missing package, the version range, and the dependency
      that requires it.
- [ ] It runs in CI and is runnable locally with one command.
- [ ] It covers `apps/mobile` at minimum; extending to all workspaces is
      preferred if it costs little.
- [ ] It passes against the current tree (the Clerk gap is already closed).
- [ ] A deliberately removed required peer makes it fail — proven, not
      assumed.
- [ ] It is documented wherever the repo documents its checks.

## Product-wide Definition of Done

Every story in Setframe must satisfy these rules before it is considered done:

- The feature is implemented **mobile-first** and is fully responsive on web.
- Any user-facing behavior added or changed on web is also implemented in the **mobile application**.
- Mobile web and mobile app are reviewed side-by-side for behavioral and visual parity.
- The change is reviewed with the **GitHub reviewer** for implementation/code quality.
- The change is reviewed with the **Figma reviewer** for visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch target, and screen-reader behavior are considered for interactive controls.
- Existing historical user data is not mutated or lost unless the story explicitly requires a migration.
- Automated tests cover the important user-visible behavior; do not rely only on snapshots.
- Type checking, linting, relevant unit/integration tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.

*(Several of the above are not meaningful for a tooling change — that is
expected; do not manufacture UI work to satisfy them.)*

## Claude Steering Document

Keep this small. It is a guard, not a platform.

A working implementation is roughly thirty lines: read each workspace
`package.json`, resolve each dependency's own `package.json` from
`node_modules`, and for every non-optional entry in its `peerDependencies`
check that the package resolves. The audit that produced this story did
exactly that and ran in well under a second.

Prefer that over adding a dependency-checking framework. `npm ls` alone is
not sufficient — it conflates optional and required peers and its exit code
is noisy in a workspace repo.

### Consider the adjacent gap, but do not scope-creep into it

The deeper reason this went unnoticed is that **the mobile app was never
run** — not in CI, not locally, not on a device. A peer-dependency check
would have caught this particular defect, but not the four others that the
first launch surfaced. A smoke test that actually boots the app would catch
far more.

That is a materially larger piece of work (simulator in CI, or a
`react-native-web` boot check) and is already partially tracked by
`Backlog/WAIT-automated-visual-and-e2e-testing.md`. Note the connection; do
not build it here.

### Version ranges

Checking *presence* is the valuable ninety percent. Validating that the
installed version satisfies the declared range is a reasonable extension if
it stays simple, but presence alone would have caught the Clerk case — do not
let range-matching complexity sink the story.
