# Story 54 — Put the Right Screen in the Mobile Training Tab

## User Story

As a user tapping "Training" on my phone, I want the place where I build and
adjust my program so that Training means the same thing on my phone as it
does on the web, and so the workout logger is somewhere I am *sent* rather
than somewhere I can wander into.

## Problem Statement

The mobile tab bar has the wrong screen behind its Training tab.

| | Web | Mobile |
|---|---|---|
| **"Training"** | `/training` → `ProgramEditorPage` — build programs, add workouts and exercises, schedule program days | `(tabs)/training` → the **active workout logger** |
| **Workout logger** | `/workout/:sessionId` — a route you are *sent* to, never a nav destination | the Training **tab** |
| **Program editor** | the Training nav item | `app/program-editor.tsx`, **not a tab** — reachable only via buttons on Today |
| **History** | `/history` nav item, defaults to first exercise | **unreachable** (see below) |

The product intent for Training is explicit: *"that's where you build
programs, add workouts and exercises, and schedule your program days."* On
mobile it is the set logger.

### This IA error is the root cause of the auto-create defect

This is the important part, and the reason this story is worth doing rather
than renaming a label.

A logger is a screen *about a specific session*. Putting it in a tab makes it
browsable with no session, which forced the screen to answer a question it
should never have been asked: **"what do I render when someone taps this tab
and no workout is running?"** The answer implemented was *silently POST a new
`workout_session`*. Because `POST /v1/workout-sessions` also deletes that
date's `rest_day`, merely opening a tab could destroy logged data — and did
produce a duplicate empty session in production on 2026-08-25.

That defect has been patched by removing the mount effect. But the structure
that *demanded* the effect is still in place: the logger is still a tab, and
the empty state is still something the screen has to invent. Correcting the
IA makes that entire class of bug **structurally impossible** rather than
patched — a session-keyed route cannot be opened without a session.

Story 52 covers the handoff that made the stale-cache path reachable; this
story removes the need for the guess.

### Exercise history is unreachable

`app/exercise-history/[exerciseId].tsx` is 304 lines of working screen that
**nothing navigates to.** There is no tab entry, no `router.push` targeting
it anywhere in the codebase, and no index route — only the
`[exerciseId]` dynamic segment, so there is no landing page even by deep
link without already knowing an exercise id.

Web's `ExerciseHistoryPage` handles a missing id by defaulting to the first
exercise (`ExerciseHistoryPage.tsx:178`). Mobile has no equivalent, so
per-exercise history — a core reason to log training at all — is inaccessible
on the phone.

## UX / Product Intent

- **Training tab** → program editing. What web means by Training.
- **Workout logger** → a pushed route keyed by session id, entered from
  Today's "Start workout"/"Resume workout" or from a session in history.
  Never a tab.
- **History** → reachable, with a landing state that does not require
  already knowing an exercise id.

Mobile has four tabs today (Today, Training, Progress, Settings). Adding
History makes five, which is at the upper bound of comfortable. Decide
deliberately whether History becomes a fifth tab or is reached from Progress
— but it must be reachable.

## Acceptance Criteria

- [ ] The mobile Training tab opens program editing, not the workout logger.
- [ ] The workout logger is a route keyed by session id and cannot be opened
      without one.
- [ ] The logger cannot create a session under any code path.
- [ ] Today's start/resume actions navigate to the logger with the session id
      (coordinate with story 52 — same navigation).
- [ ] Exercise history is reachable through normal navigation.
- [ ] History without a specified exercise shows a usable landing state
      rather than an error or a blank screen.
- [ ] Back-navigation from the logger returns somewhere sensible, not to a
      dead tab.
- [ ] Deep links to a completed session still resolve.
- [ ] Tab labels mean the same thing on both platforms.
- [ ] No existing navigation entry point breaks.

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

## Claude Steering Document

**This story moves screens; story 55 makes the destination worth arriving
at.** Putting `program-editor.tsx` behind the Training tab as-is delivers a
read-only preview that tells the user to go to the web — which is honest
about a real limitation but is not the product intent. Sequence these two
deliberately and decide whether they ship together; a Training tab that
cannot edit anything may be worse than the current state, because it *looks*
like the answer.

Note the Figma style guide (§13/§14/§19) is cited in
`app/(tabs)/_layout.tsx` as specifying "the 4 fixed mobile tabs: Today,
Training, Progress, Settings (History is web-nav-only)." Read that before
adding a fifth tab — if History was deliberately excluded, this story should
either honour that and route history from Progress, or make the case for
changing it explicitly rather than quietly.

### Do not rename the file to solve this

`(tabs)/training.tsx` currently *is* the logger. Renaming files without
moving the route achieves nothing; the deliverable is that tapping Training
opens program editing and that the logger requires a session id.

### Watch for existing callers

`router.push('/(tabs)/training')` appears in `today.tsx`, and
`router.replace('/program-editor')` appears in `program-wizard.tsx`. Both
must be updated coherently, and story 52 is changing the first of them —
coordinate rather than conflicting.
