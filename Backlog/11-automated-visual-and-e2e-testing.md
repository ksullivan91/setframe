# Story 11 — Automated Visual / End-to-End Testing

> **Status:** Deferred / holstered. Captured so it is not lost. Not part of the
> current active phase — do not start without explicit sign-off.

## User Story

As a maintainer, I want automated end-to-end and visual-regression coverage so
that UI changes can be verified against real rendered output instead of being
reasoned about from source, and so visual regressions are caught before they
reach production.

## Motivation

Today the only automated coverage is unit/component level:

| App | Runner | Scope |
| --- | --- | --- |
| `apps/web` | Vitest + Testing Library | component behavior, jsdom only |
| `apps/mobile` | Jest + RN Testing Library | component behavior, no renderer |
| `apps/api` | Vitest | route/handler level |
| `packages/domain` | Vitest | pure functions |

None of these render real pixels. Layout, spacing, contrast, overflow, and
theming regressions are therefore only caught by a human opening the app —
which is exactly how the "Workout complete" card regression was found. During
that fix, a four-digit volume value (`8005 lb`) at `pageTitle` size was found
to overflow a third-width stat tile on a 420px viewport purely by manual
arithmetic. A screenshot test would have caught it automatically.

## Desired Outcome

1. **End-to-end browser tests** (Playwright is the assumed tool) driving the
   real web app against a seeded API: sign in, create a program, run a workout
   session, log sets, complete the workout.
2. **Visual regression snapshots** at a small set of representative viewports
   (at minimum ~375px, ~768px, ~1280px) for the highest-traffic surfaces:
   Today, Training, Program editor, Active session, Workout review.
3. **Contrast / a11y assertions** — an automated axe pass on those same
   surfaces, so issues like the 2.26:1 white-on-`#00C48C` check are caught
   rather than hand-computed.
4. **CI integration** — runs on PRs against `main`, with snapshot diffs
   surfaced as artifacts.
5. **Mobile** — investigate the equivalent (Expo + Maestro, or Detox) so the
   mobile app is not left as the only unverified surface. Mobile currently has
   no EAS/TestFlight pipeline either, so this is coupled to that gap.

## Open Questions

- Where does the seeded/ephemeral API + database for E2E runs live? (Neon
  branch per PR? Local Postgres in CI?)
- Are snapshots committed to the repo, or stored as CI artifacts with a hosted
  baseline? Committed PNGs will bloat history quickly.
- How is the browser binary cached in CI so runs stay fast? (A local attempt to
  install Chromium during development was slow enough to abandon.)
- Does visual regression run on every PR, or only on a label/schedule, given
  the flakiness cost?

## Acceptance Criteria

- [ ] An E2E runner is installed, configured, and documented in `docs/`.
- [ ] At least one full happy-path E2E test passes locally and in CI.
- [ ] Visual snapshots exist for the surfaces listed above at the listed
      viewports.
- [ ] An automated accessibility pass runs against those surfaces.
- [ ] The commands are documented alongside the existing per-app test commands.
- [ ] A decision on the mobile equivalent is recorded (either implemented or
      written up as an ADR with a rationale for deferring).
