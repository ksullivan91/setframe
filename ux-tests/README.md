# UX review

Autonomous UX review of the running application. Not a regression suite — see
`apps/web/e2e/*.spec.ts` for that.

```bash
npm run ux:review --workspace=@setframe/web         # headless, both viewports
npm run ux:review:watch --workspace=@setframe/web   # watch a real browser do it
npm run ux:review:ui --workspace=@setframe/web      # step through it, time-travel
npm run ux:report --workspace=@setframe/web         # open the last run's evidence
```

No environment setup: the Clerk keys and the review password are read from the
apps' own gitignored `.env` files, and the dev server starts itself.

- **`ux:review`** — headless, both viewports, ~17s. What you want normally.
- **`ux:review:watch`** — opens a visible browser at phone size and drives it
  in front of you, one worker so two runs are not racing on screen.
- **`ux:review:ui`** — Playwright's UI mode. Every step is a row you can click
  to see the DOM before and after; re-run a single journey without restarting.
- **`ux:report`** — renders the newest reports and their screenshots into one
  page and opens it. Markdown beside PNGs is the right thing to diff and the
  wrong thing to read.

Output lands in `reports/<journey>/<viewport>/`: numbered screenshots plus a
`report.md` with ranked findings and a measured interaction count.

## How it works

Journeys live in `apps/web/e2e/ux/*.ux.spec.ts` and run against `dev:mock`, so
every run starts from the same data. A review whose findings change with
whatever happens to be in the database is a report nobody can act on.

Sign-in is programmatic (`apps/web/e2e/ux/auth.ts`), one Clerk account per
persona, provisioned by `scripts/provision-ux-review-users.mjs`. Development
instance only — the helper refuses to run against a live key.

## Journeys are reviews, not assertions

A journey walks the whole flow and records what it sees. It fails only on
genuine breakage — a route that will not load, a control that does not exist.
Everything else becomes a ranked finding, because a hard assertion halfway
through hides everything behind it, which is exactly what a review must not do.

## Reports are not committed

`reports/` holds generated artefacts and is gitignored apart from its
`.gitkeep`. Re-run the review rather than reading a stale report; a screenshot
of a version nobody is running is worse than none.

## Personas have different products (phase 2)

Each journey signs in as one persona and selects that persona's seeded state
via `?ux-persona=`, read once at boot by `apps/web/src/mocks/persona-state.ts`.

| Persona   | Program | History  | Today          |
|-----------|---------|----------|----------------|
| `novice`  | none    | none     | guided setup   |
| `lifter`  | active  | 3 weeks  | ready to start |
| `analyst` | active  | 12 weeks | already trained|

Phase 1 gave every persona its own account and then served all three the same
fixture, which made the personas cosmetic — a "novice" arrived to a configured
program, so the one journey that matters for them could not be reviewed at all.

## Playwright agents (phase 3)

`npx playwright init-agents --loop=claude` has been run, adding planner,
generator and healer agent definitions under `apps/web/.claude/agents/` plus an
`.mcp.json`. They cover *functional* coverage — exploring the app, generating
specs, repairing broken ones. The UX reviewer sits on top of them and is a
separate thing: it judges experience, which no generator can do for you.

## Scores and the gate

Each report ends with a nine-dimension scorecard and a pass/fail gate, derived
from the findings rather than typed in. Dimensions no automated check can
honestly judge report as *not assessed* instead of taking a default.

## Network review

`review.watch()` records API traffic alongside console errors, so defects that
never appear on screen still surface: failed mutations, repeated mutations,
saves serialised behind one another, slow writes with no optimistic path.

## Known limits

- **Mock data, not production data.** Anything odd about the *values* is
  usually the fixture. The reviewer is told to say which it believes.
- **Web only.** The native app has no equivalent harness; mobile parity is
  still checked by hand.
- **There is no CI**, so nothing runs this automatically.
