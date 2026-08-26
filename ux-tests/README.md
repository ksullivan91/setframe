# UX review

Autonomous UX review of the running application. Not a regression suite — see
`apps/web/e2e/*.spec.ts` for that.

```bash
npm run ux:review --workspace=@setframe/web   # 390px and 1440px
```

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

## Known limits

- **Mock data, not production data.** Anything odd about the *values* is
  usually the fixture. The reviewer is told to say which it believes.
- **Web only.** The native app has no equivalent harness; mobile parity is
  still checked by hand.
- **There is no CI**, so nothing runs this automatically.
