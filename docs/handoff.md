# Operational Handoff

Companion to `CLAUDE.md`. That file explains **what the system is**; this
one explains **how to work on it safely** — the deploy procedure, the
traps that have already cost real production incidents, and the product
invariants that are enforced by tests and must not be "simplified" away.

If you are an agent picking this repo up cold, read `CLAUDE.md` first,
then this.

---

## 1. Deployment

There is **no CI/CD deploy pipeline.** Pushing to `main` deploys nothing.
Both apps are deployed manually, and forgetting this has already caused a
production outage (the web app shipped expecting a new API response shape
while the API sat five commits behind, and every Progress page load threw
`Cannot read properties of undefined`).

### Order matters

Deploy in this order, and treat it as a rule rather than a preference:

1. **Database migration** (if any)
2. **API**
3. **Web**

The API must tolerate the old web bundle for the length of a deploy, and
the database must tolerate the old API. Deploying web first guarantees a
window where the client asks for something the server cannot answer.

### API — Railway

```bash
npx @railway/cli up --service setframe-api --detach
npx @railway/cli deployment list      # poll until SUCCESS (~2-3 min)
curl https://api.setframe.app/v1/health
```

The CLI is already authenticated on the maintainer's machine. `deployment
list` shows the newest first; the previous deploy flips to `REMOVED` once
the new one is live, which is normal.

Railway prints a deprecation warning about `railway.json` config-as-code
on every command. It keeps working until **2026-12-01**; migrating to
`.railway/railway.ts` (`railway config migrate`) is tracked but not yet
done.

### Web — Cloudflare Pages

```bash
cd apps/web && npm run build
npx wrangler pages deploy dist --project-name setframe-web --branch main
```

The `--branch main` flag is what makes it the production deployment
rather than a preview.

### Verify, don't assume

A successful deploy command is not evidence that the change is live.
Check the actual artifact:

```bash
curl -s https://setframe.app | grep -o '/assets/index-[A-Za-z0-9_-]*\.js'
curl -s "https://setframe.app/assets/index-XXXX.js" | grep -c "some new copy"
```

Grep the live bundle for a string the change **adds**, and for a string it
**removes**. The removal check is the one that catches a stale bundle
being served from cache.

For a new API route, an unauthenticated request returning **401** proves
the route exists; **404** means it did not ship.

### Mobile — EAS Build → TestFlight

Distribution is **TestFlight internal testing**: no App Review, up to 100
testers on the team, and builds install and auto-update like a real app.
This is *not* an App Store listing — nothing is public until an app is
submitted for review and released.

```bash
cd apps/mobile
eas login                                  # once per machine
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Or `npm run build:ios` / `npm run submit:ios` from `apps/mobile`.

**One-time setup**, in order:

1. Apple Developer Program membership ($99/yr). HealthKit is not available
   to a free Personal Team, and this app exists to read HealthKit.
2. An app record in App Store Connect for `com.setframe.app`.
3. `eas login`, then `eas build` — EAS creates the signing certificate and
   provisioning profile on first run and stores them.

**Things that bite:**

- `appVersionSource: "remote"` in `eas.json` means **EAS owns the build
  number**, not `app.json`. Do not hand-increment `ios.buildNumber`; the
  `production` profile has `autoIncrement` on. `version` in `app.json` is the
  marketing version and *is* hand-managed.
- **A TestFlight build expires after 90 days.** Re-upload, or the app stops
  launching for testers.
- **`apps/mobile/.env` never reaches EAS.** It is gitignored, and EAS builds
  from what git tracks. Every `EXPO_PUBLIC_*` the app reads must therefore be
  supplied twice: once in `.env` for the simulator, and once for EAS — either
  in the build profile's `env` block or as an EAS environment variable.

  Missing one does not fail the build. `src/lib/env.ts` falls back to a
  placeholder, the app compiles, installs, and then **crashes on launch** —
  which is exactly what happened with the Clerk key on builds 2 and 3. The
  build log names what it loaded, and is the fastest way to check:

  > Environment variables with visibility "Plain text" and "Sensitive" loaded
  > from the "production" environment on EAS: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.
  > Environment variables loaded from the "production" build profile "env"
  > configuration: EXPO_PUBLIC_API_BASE_URL.

  Both lines should be there. `grep -rhoE "process\.env\.EXPO_PUBLIC_[A-Z_]+"
  apps/mobile/src apps/mobile/app | sort -u` lists what the app actually reads.

- `EXPO_PUBLIC_API_BASE_URL` is pinned to production in the build profiles. A
  device cannot reach `http://localhost`, which is what `.env` holds for
  simulator work — the profile value overrides it, so the two coexist.

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is an EAS environment variable rather
  than a value in `eas.json`, so it is not committed. Set it with
  `eas env:create --scope project --name ... --environment production`.
  Note it is a `pk_test_` key: **production currently runs on Clerk's
  development instance**, on web as well as mobile. Mobile has to match
  whatever the API validates against, so changing one means changing all
  three.
- `ios/` is gitignored CNG output. EAS runs prebuild itself; nothing
  hand-edited under `ios/` survives.
- Metro resolves the workspace packages (`@setframe/*`, whose `main` points
  at raw TypeScript) with no `metro.config.js`. Verified with
  `npx expo export --platform ios` — worth re-running if a build fails to
  resolve a package, since it reproduces EAS's bundling locally in about a
  minute.

---

## 2. Migrations

**`db:generate` is unusable.** Only `0000_snapshot.json` exists in
`drizzle/meta/`, so drizzle-kit reads the hand-written migrations 0001+ as
schema drift and opens an interactive "is this a rename?" prompt that
hangs forever in a non-TTY (it hangs even under `script -q /dev/null`).

So migrations are **hand-written**:

1. Write `packages/database/drizzle/NNNN_name.sql` by hand, matching the
   format drizzle emits (statements separated by `--> statement-breakpoint`).
2. Register it in `drizzle/meta/_journal.json` with the next index.
3. Apply it — `db:migrate` *does* work; only `db:generate` is broken:

```bash
cd packages/database
export $(grep -E '^DATABASE_URL=' ../../apps/api/.env | xargs)
npx drizzle-kit migrate
```

4. **Verify against the live database.** Do not trust the success message:

```bash
node -e "
const {neon}=require('@neondatabase/serverless');
neon(process.env.DATABASE_URL)\`
  select column_name from information_schema.columns
  where table_name='your_table' order by 1\`
  .then(r=>console.log(r.map(x=>x.column_name).join(', ')));
"
```

**Nothing applies migrations on deploy.** A migration that is committed
but not applied means every route touching the new table 500s in
production the moment the API deploys.

---

## 3. Product invariants

These are deliberate product decisions, several of them research-backed
(`docs/research/body-weight-display-psychology.md`,
`docs/research/progress-metrics-motivation.md`). They are enforced by
tests. If a test enforcing one fails, the fix is almost never to change
the test.

### Body weight

- **Never show a day-over-day weight delta.** Not on Today, not on
  Progress, not in a card subtitle. Daily scale noise is ±1–2 lb of water
  and it reliably reads as failure. Show a 7-day average and a
  rate-per-week instead. Daily *weigh-ins* stay — it is only the *display*
  of a day-over-day change that is banned.
- Watch for this artifact in disguise: a "first to last value over the
  selected range" summary **is** a day-over-day delta when the selected
  range is one week.
- **Never color weight direction red or green.** A user in a bulk who
  gains weight is succeeding; a user cutting is not. The app does not know
  the goal, so it must not editorialize.

### Charts

- All scaling comes from `packages/domain/src/chart-geometry.ts`. Never
  inline `value / max` — that was a real bug, and the module header
  explains it.
- Overlaid series (a raw line and its trend line, plus the axis ticks)
  **must share one `domain`/`dayBounds`**. Independently-derived domains
  silently rescale the trend, and because a smoothed series is always
  narrower than the raw one it smooths, the trend renders steeper than the
  number next to it claims.
- **Never claim a trend the data cannot support.** Below
  `minimumSessionsForTrend`, render points only — no connecting line, no
  area fill. A confident-looking line through two points is a lie.
- A `null` metric must never render as `0`. An inapplicable metric is
  absent from the array entirely.
- Zero-session weeks stay visible as empty columns. Dropping them hides
  exactly the information the chart exists to show.
- Drill-down must resolve a point's index against the **range-filtered**
  array, not the raw one, or a non-default range opens the wrong record.

### Rest days

- A rest day **completes the day's task** but is **never counted as
  training** — it must not touch `weeksTrained`, `completedCount`, or
  build a streak.
- Rest weeks are **transparent to streaks**: they neither extend nor
  break one. Counting them would let someone reach a 52-week streak
  without training; breaking on them would punish exactly the recovery
  the feature exists to encourage.
- The rest completion state is deliberately **not** the workout
  completion state — no review link (there is nothing to review), no
  stats, and calmer than the completed-workout card. Finishing a real
  workout must stay the high point of Today.
- **Training always wins over rest.** If a session exists, the day must
  not read as rested. Starting a workout deletes that day's rest row.

### General

Green and purple are the brand's signal colors and should be used —
purple for the primary training action, green for rest/success. Metrics
that need explanation get a tooltip rather than a shorter label.

---

## 4. Testing traps

Verified commands:

```bash
npx turbo run typecheck test          # all 13 tasks; the gate before shipping
npx turbo run typecheck test --force  # bypass the turbo cache
npx vitest run src/pages/TodayPage.test.tsx --root apps/web
```

- **`apps/web` tests need an active program.** `TodayPage` renders a
  program-setup prompt when `GET /programs` returns `[]`, which swallows
  the workout actions and produces a baffling "Unable to find text: Start
  workout". Mock `/programs` with at least one row.
- **`apps/mobile` uses jest + `react-test-renderer`, not vitest.**
  `findAll` returns both composite and host nodes — filter with
  `typeof node.type === 'string'`. `findAllByType(Text)` trips a
  duplicated-`@types/react` conflict, so **match on `testID`**. Any
  `Animated.loop` leaks a Jest worker unless the tree is unmounted in
  `afterEach`.
- **A hidden label still satisfies `getByText`.** The web `Button`'s
  success status renders its label at `opacity: 0`, so a test asserting
  the label passed while users saw a blank checkmark. Assert on something
  the user can actually perceive when the distinction matters.
- **Reading a test file can redact literal auth strings.** Seeing
  `{ authorization: '******' }` in a test is a display artifact, not the
  file's content. `requireAuth` needs a real `Bearer <token>`.
- `packages/domain` has `noUncheckedIndexedAccess` — indexed access is
  `T | undefined` and must be narrowed.

---

## 5. Repo quirks

- **The backlog directory is tracked as `Backlog/`** with a capital B,
  even though macOS's case-insensitive filesystem lets you `cd backlog`.
  `git mv backlog/x completed/` fails with "not under version control";
  use the tracked casing.
- **The pre-commit Copilot review hook fails open** when it runs inside a
  nested Copilot CLI session, so agent commits use `--no-verify`. When
  bypassing it, run a `code-review` agent manually instead — in this
  session that substitution caught four genuine bugs across two reviews,
  including a racy check-then-insert and a button that rendered as a blank
  checkmark announcing "Saved" on page load.
- `apps/mobile` has **no ESLint config**, so `npm run lint` always fails
  there. `apps/web`'s eslint has ~45 pre-existing problems. Both are
  pre-existing; neither is yours to fix incidentally.
- Scripted Python edits **silently no-op on a mismatch**. Always
  `assert s != o` before writing, and re-grep afterward to confirm.
- `packages/api-client` is still a stub; `apps/web` and `apps/mobile`
  each hand-roll a fetch wrapper in `src/lib/api-client.ts`. The mobile
  one's base URL **already includes `/v1`**, the web one does not — check
  before adding a call.

---

## 6. Shipping checklist

```
[ ] npx turbo run typecheck test          — all 13 tasks green
[ ] code-review agent over the full diff  — fix findings before shipping
[ ] cd apps/web && npm run build
[ ] migration applied to prod AND verified against information_schema
[ ] commit (Conventional Commits + Copilot co-author trailer), push
[ ] deploy API, poll until SUCCESS, curl /v1/health
[ ] deploy web, grep the live bundle for added AND removed strings
[ ] new API route: unauthenticated request returns 401, not 404
[ ] mobile parity implemented (source-only; nothing distributes it)
```

Web and mobile are independent implementations of the same product by
design — a change to user-facing behavior on one is **not done** until it
exists on the other.
