# Mobile ↔ Web Parity Audit

Date: 2026-08-25. Scope: every mobile screen **except** Training
(`app/(tabs)/training.tsx`) and the workout logger
(`app/workout/[sessionId].tsx`), which were being rebuilt concurrently.

## Why this audit exists

The mobile app had never been run on a device or simulator until this
week. A prior attempt at the Training screen was designed without
reference to the web implementation and rejected on sight. This audit
therefore takes the web app **rendered at 390px** as the specification,
not a description of it.

Method, in order:

1. Ran `npm run dev:mock` and screenshotted every web screen at a 390px
   viewport in real Chrome via Playwright.
2. Read each web page's source — section order, shared components,
   loading/empty/error states.
3. Screenshotted the same screen on the iOS Simulator (iPhone 17 Pro,
   iOS 26.5) and **looked at it**.
4. Diffed structure → hierarchy → type/spacing → states.
5. Fixed mobile to match, in native idiom.

Two things had to be worked around to get there, both worth recording:
`.env` is gitignored, so a fresh worktree has no Clerk key and
`ClerkProvider` throws, blanking the whole web tree — the symptom looks
like a routing failure. And Metro serves one checkout at a time, so
verifying a worktree's changes on the simulator means pointing Metro at
that worktree.

## Findings

| # | Screen | Severity | Divergence | Status |
|---|---|---|---|---|
| 1 | **App-wide** | High | No screen reserved the status bar / Dynamic Island | **Fixed** |
| 2 | Settings | Medium | No page title; section headings inside cards; sections grouped differently from web; switches stated their value only in colour | **Fixed** |
| 3 | Progress | Low | Mobile adds a subtitle web does not have | Kept — see below |
| 4 | Today | Low | Body copy wraps one line earlier than web | Not a defect — see below |

### 1. Safe-area insets absent app-wide — fixed

`app/(tabs)/_layout.tsx` sets `headerShown: false`, and no screen called
`useSafeAreaInsets`. `react-native-safe-area-context` was already a
dependency and already mounted (`app/_layout.tsx` provides it,
`Sheet.tsx` consumes it) — no screen had ever read the insets.

On an iPhone 17 Pro this put content underneath the status bar and the
Dynamic Island. On Today, the date eyebrow rendered *behind the clock*
and the sync-status chip was clipped to "ealth access needed".

Before: `/tmp/parity/mobile-today.png` · After:
`/tmp/parity/mobile-today-after.png`

Fixed by `src/lib/useScreenInsets.ts` (`useScreenTopPadding` /
`useScreenBottomPadding`), applied to every screen whose navigator does
**not** already reserve the space. The distinction matters and is why
this is not a blanket change:

- **Needed it** — `(tabs)/today`, `(tabs)/progress`, `(tabs)/settings`
  (tab shell runs `headerShown: false`), and `program-wizard`
  (inherits `headerShown: false` from the root Stack).
- **Already correct** — `session-summary`, `exercise-history/[exerciseId]`
  and `workout/[sessionId]` are registered with `headerShown: true`, so
  their header reserves the inset.
- **Correct by construction** — `sign-in` / `sign-up` centre their
  content vertically (`flex: 1, justifyContent: 'center'`), so they
  never reach the notch.

Bottom padding applies **only** to `program-wizard`. A first pass added
it to the tab screens too, which was wrong and caught in review:
`BottomTabBar` already applies `paddingBottom: insets.bottom` itself and
is not absolutely positioned, so tab content already ends above both the
bar and the home indicator. Adding the inset again produced roughly 50pt
of dead space. The hook is named `useStackBottomPadding` to make the
applicable case explicit.

**Not covered at the time:** `(tabs)/training.tsx` and
`app/workout/[sessionId].tsx` were owned by a concurrent worktree.
Training was confirmed to have the same defect and should adopt the same
hook. Training has since adopted `useScreenTopPadding` as part of its
rebuild (top only — it is a tab screen). `app/workout/[sessionId].tsx`
is still outstanding.

Training's three early-return states (loading, error, no-program) do not
take the padding: they are `flex: 1` + `justifyContent: 'center'`, so
their content is centred in the viewport and never reaches the island.
The hook belongs on top-aligned scroll content, not on every screen root.

### 2. Settings restructured to match web — fixed

Web's `SettingsPage.tsx` opens with an `<h1>`, places each section
heading *above* the card it labels, and groups differently from mobile.
Mobile opened straight into an unlabelled Account card.

| | Web | Mobile (before) |
|---|---|---|
| Page title | `<h1>Settings</h1>` | none |
| Section headings | above each card | inside each card |
| Account section | Email, Manage account, **Units, Timezone** | Email + Manage account only |
| Preferences | *(none — folded into Account)* | separate section |
| Health / notifications | one combined section | two separate cards |
| Switch state | "On" beside the switch | colour and position only |
| Danger zone | "This cannot be undone" | button only |

All six corrected. Before: `/tmp/parity/mobile-settings.png` · After:
`/tmp/parity/mobile-settings-after.png` · Web:
`/tmp/parity/web-settings.png`.

**Deliberately kept different:** Units stays a native `Select` rather
than web's row-with-chevron. Choosing between two values is what a
picker is for on iOS, and the row-then-modal pattern exists on web
because the platform has no equivalent. Functionally identical.

### 3. Progress — structurally aligned

Web's summary grid is `repeat(2, 1fr)` at mobile width and becomes four
columns only at `mq.tablet`; mobile renders the same 2-up grid. Section
order matches. Error copy is correctly platform-adapted ("Refresh the
page" on web, "Pull to refresh" on mobile).

One divergence kept: mobile adds the subtitle "How your training,
strength and weight are actually moving." under the title; web has only
`<h1>Progress</h1>`. Mobile is the better of the two and removing copy
that orients the user is not an improvement — flagged for web to adopt
rather than for mobile to drop.

**Verified against the mobile screenshot only.** Web's Progress renders
its *error* state under MSW because `/progress/overview` is not mocked
(`/tmp/parity/web-progress.png`), so the loaded-state comparison is from
source, not pixels.

### 4. Today — type difference is font metrics, not a defect

Mobile's subtitle wraps to three lines where web takes two, which reads
as "mobile type is too big". It is not:

- Both platforms consume the **same** `typeScale` tokens from
  `packages/design-tokens` (`pageTitle` 24, `body` 14, `label` 12) and
  apply them identically.
- The simulator's `UIPreferredContentSizeCategoryName` is unset, so
  Dynamic Type is at 1.0×.
- Mobile is *wider* (402pt vs 390px), so it should wrap later, not
  sooner.

What remains is San Francisco's metrics against the web font stack.
Hard-coding smaller sizes to force identical wrapping would break the
token system and disable Dynamic Type — both worse than a line break.
Section order and hierarchy match web.

## Verified visually vs. read only

| Screen | Verified |
|---|---|
| Today | **Visually**, before and after |
| Progress | **Visually** (mobile); web from source |
| Settings | **Visually**, before and after, against web screenshot |
| session-summary | Source only |
| exercise-history | Source only |
| program-wizard | Source only |
| sign-in / sign-up | Source only |

The four source-only screens could not be reached: the simulator has no
tap automation available (System Events clicking requires Accessibility
permission this environment does not grant), and `simctl openurl` raises
a system "Open in Setframe?" dialog that then cannot be dismissed. The
three verified screens were reached by temporarily retargeting
`app/index.tsx`'s redirect — restored afterwards.

Their safe-area status was determined from the navigator configuration
in `app/_layout.tsx` rather than by eye, which is reliable for that
specific question but is not a substitute for looking at them.

## Recommended follow-ups

1. ~~Apply `useScreenTopPadding` to `(tabs)/training.tsx` once the
   concurrent rebuild lands~~ — done as part of that rebuild. The workout
   logger (`app/workout/[sessionId].tsx`) is a Stack route, not a tab
   screen, so it is the one place `useStackBottomPadding` may also apply.
2. Reach the four unverified screens. Either grant Accessibility
   permission for tap automation, or add a debug-only initial-route
   override so any screen can be launched directly. **Strongly
   recommended** — the Training rebuild independently lost significant
   time to exactly this and still could not capture the screen it
   changed. Every workaround fails: `simctl` has no tap primitive,
   `osascript` needs Accessibility, deep links raise an undismissable
   "Open in …?" dialog, and `initialRouteName` / entry-route redirects
   are all overridden by expo-router's restored navigation state. A
   debug-only override is the only reliable fix.
3. Consider adopting Progress's subtitle on web.
