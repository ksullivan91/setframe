# Story 75 — Navigation shell: Log, Trends, and the account avatar

**Status:** Shipped 2026-09-03. Shell story — 76–82 build on it.
**Design:** `docs/design/log-dashboard.md` §1. ADR 0013.
**Figma:** `Log v3 · Today, scheduled` (`388:357` section).

## User story

As someone opening the app for the first time, I want the tab I land on
to be named for something I recognise, so that I know what the screen is
before I have learned the product.

## What to build

- Rename the `today` tab to **Log**. The route file moves
  `app/(tabs)/today.tsx` → `app/(tabs)/log.tsx`; every `router.push`
  and `replace` targeting `/(tabs)/today` moves with it (there are
  several, including the post-onboarding hand-off).
- Replace the page title with a **date control**: `Today ▾` when the
  selected date is today, otherwise `Sat 30 Aug ▾`, with the full date
  as a secondary line.
- **Settings leaves the tab bar.** Add a 44×44 avatar top-right that
  routes to the settings stack. Remove the Settings tab.
- Add the **Trends** tab (story 77 fills it; ship a stub route here).
- Tab bar is four equal-width items: Log · Training · Progress · Trends.

## Acceptance

- Tapping the avatar reaches Settings; no Settings tab remains.
- Nothing routes to `/(tabs)/today` any more — a grep for it returns
  nothing outside git history.
- Tab items and the avatar are ≥44pt.
- Onboarding's completion hand-off lands on Log, not a dead route.

## Traps

- The onboarding gate lives in `app/index.tsx` and several auth screens
  `replace()` into the tab shell. Story 5's bug — Today flashing before
  onboarding — was caused by exactly these call sites being missed.
