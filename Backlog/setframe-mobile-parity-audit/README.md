# Setframe Mobile Parity Audit

## Why this audit exists

The mobile app had **never been run** on a device or simulator until
2026-08-25. Within an hour of its first boot, four defects surfaced:

1. `@clerk/clerk-expo`'s required peer dependencies (`expo-web-browser`,
   `expo-auth-session`) were never installed — the app crashed at launch on
   `Cannot find native module 'ExpoWebBrowser'`. Nothing in app code imports
   them; Clerk does, internally, so nothing surfaced the gap until runtime.
2. No Google sign-in. Web uses Clerk's stock `<SignIn/>`, which renders
   whatever the dashboard enables; mobile hand-rolls `useSignIn()` with only
   email/password. `oauth_google` had been enabled the whole time.
3. No second-factor step. `signIn.create()` resolves with a `status`, and
   every value other than `'complete'` fell through to *nothing* — no
   navigation, no error, a spinner that simply stopped. The Clerk instance
   requires `email_code`, so mobile sign-in was impossible.
4. Opening the Training tab **created a workout session**. A mount effect
   called `resumeSessionMutation.mutate()`, so navigating to a tab POSTed a
   real `workout_session`. It produced a duplicate empty session shadowing a
   genuinely completed one, and because `POST /v1/workout-sessions` deletes
   that date's `rest_day`, opening the tab could silently destroy a logged
   rest day. A spurious session was deleted from production to recover.

All four are fixed. They are recorded here because they establish the
pattern this audit set out to find the rest of.

## The pattern

**Mobile hand-rolls flows that web delegates.** Where web hands a problem to
a mature library — Clerk's `<SignIn/>`, react-router's URL params, a toast
system with retry — mobile implements the happy path by hand and omits the
rest. The failure mode is consistent: unhandled intermediate states, errors
swallowed without display, and screens that depend on state they never
requested.

Per CLAUDE.md, per-platform duplication is *deliberate* — there is no shared
UI package, and both apps implement the same screens against shared
`packages/domain`/`packages/schemas`. This audit is therefore **not** an
argument to share more code. It asks a narrower question: **where has that
intended duplication drifted into missing or dangerous behaviour?**

## Headline finding: the wrong screen is in the Training tab

The mobile tab bar has the workout logger where the program editor belongs.

| | Web | Mobile |
|---|---|---|
| **"Training"** | `ProgramEditorPage` — build programs, add workouts/exercises, schedule days | the **active workout logger** |
| **Workout logger** | `/workout/:sessionId` — a route you are *sent* to | the Training **tab** |
| **Program editor** | the Training nav item | not a tab; reachable only from Today, and **read-only** |

**This IA error is the root cause of defect 4 above.** A logger is a screen
about a *specific session*. Putting it in a tab made it browsable with no
session, forcing the screen to answer a question it should never face —
*"what do I render when tapped with no active workout?"* — and the answer
implemented was *silently POST one*. Correcting the IA makes that class of
bug **structurally impossible** rather than patched: a session-keyed route
cannot be opened without a session.

The capability gap behind it needs stating precisely, because it is narrower
than "mobile cannot build programs":

- `program-wizard.tsx` (813 lines) **can** create programs, workouts,
  exercises, prescriptions and schedule slots. Guided setup genuinely works.
- `program-editor.tsx` (328 lines) — where users go *afterwards* — has
  exactly one mutation, `activateMutation`. Everything else says *"Edit on
  web."*

So: **a program can be built once on the phone, and every later change
requires a laptop.** Training plans change constantly, usually at the gym.

**No ADR documents this.** All seven ADRs were checked; there is no
equivalent of ADR 0007 (*"Notification Preferences — Scope Boundary"*), the
house precedent for recording a deliberate limitation. The constraint lives
in a code comment and a line of UI copy. This is an undocumented gap, not a
decision being reversed — and if the team wants it to remain, that warrants a
real ADR.

## Method

Every finding was read out of the real source, not inferred from tests or
docs. Claims that could be checked were checked: peer dependencies resolved
against the installed tree, route handlers read for cascading side effects,
every `useEffect` on both platforms traced for mutations, and every
navigation target enumerated to test reachability. Where verification
required a device, that is stated.

Findings were **not** padded. Three areas were examined and found to be at
genuine parity; they are listed as such rather than given invented defects.

## Findings

| # | Severity | Finding | Story |
|---|---|---|---|
| 1 | **drift → data-integrity** | Workout logger occupies the Training tab; program editor is not a tab; exercise history is unreachable. Root cause of the auto-create defect | [54](./54-mobile-training-ia-restructure.md) |
| 2 | **missing-capability** | Programs can be created on mobile but not edited — the editor's only mutation is "activate". Undocumented; no ADR | [55](./55-mobile-program-editing-capability.md) |
| 3 | **data-integrity** | Today → Training session handoff passes no session id and never invalidates Training's cache, so the receiving screen re-derives from stale state | [52](./52-mobile-session-handoff-integrity.md) |
| 4 | **broken-flow** | The mobile workout logger has six mutations and **zero** error handling; a failed set save is indistinguishable from a successful one | [53](./53-mobile-write-failure-feedback.md) |
| 5 | **process** | Nothing detects a missing required peer dependency; the Clerk gap reached production undetected | [56](./56-dependency-integrity-guard.md) |

### At genuine parity — no action needed

- **Progress** (`app/(tabs)/progress.tsx` vs `ProgressPage.tsx`) — identical
  `MetricInfo` and `RangeSelector` usage; the two track each other.
- **Settings** (`app/(tabs)/settings.tsx` vs `SettingsPage.tsx`) — same three
  mutations, and mobile handles its errors.
- **Peer dependencies** — all 24 mobile dependencies audited; Clerk's was the
  only gap, and it is now closed. Story 56 exists because nothing would catch
  the *next* one, not because another exists today.

## Recommended delivery order

**52 → 53** first, and urgently. Both concern the active workout, the one
screen where silent failure costs real logged training. **52 is the most
time-sensitive item in this pack**: removing the auto-create fixed the data
bug but left the handoff broken, so a user who taps "Start workout" can now
land on an empty state instead of their session. That regression is live.

**56** next — small, and the only story that prevents a class of defect from
recurring rather than fixing one instance.

**54 → 55** last, and together. They are the headline finding but the largest
surface, and 54 without 55 delivers a Training tab that cannot edit anything
— arguably worse than today, because it *looks* like the answer. 55 should
be assessed for splitting along exercise / workout / schedule lines before
starting; exercise-level edits alone would remove most of the friction.

## Not verified without a device

- Whether the handoff race in story 52 reproduces on real hardware, and how
  often. The stale-cache path is provable by reading the query keys, but its
  real-world frequency depends on cache timing under a real network.
- Touch-target sizes, gesture conflicts, and VoiceOver behaviour on any
  screen. This audit read source; it did not exercise the UI.
- Whether any error state renders legibly, since none of the logger's
  failures currently render at all.
