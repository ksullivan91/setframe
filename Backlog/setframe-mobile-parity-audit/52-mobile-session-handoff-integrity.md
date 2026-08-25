# Story 52 — Make the Today → Training Session Handoff Deterministic

## User Story

As a user starting a workout from Today on my phone, I want to land in the
session I just started so that tapping "Start workout" reliably opens that
workout instead of an empty screen or a second, duplicate session.

## Problem Statement

The two screens agree on *nothing* about which session is active. Today
creates one and navigates away; Training independently guesses which session
that was, from its own separately-cached copy of the day.

`apps/mobile/app/(tabs)/today.tsx:320-333`:

```ts
const startWorkoutMutation = useMutation({
  mutationFn: async () => {
    const activeSession = todayQuery.data?.sessions.find((s) => s.status === 'in_progress');
    if (activeSession?.id) return { id: activeSession.id };
    return api.post<{ id: string }>('/workout-sessions', { ... });
  },
  onSuccess: () => {
    router.push('/(tabs)/training');   // ← no session id
  },
});
```

Three separate defects compound here:

1. **The session id is not passed.** The route carries no parameter, so the
   id that was just created is discarded at the moment of navigation.
2. **Training's cache is never invalidated.** Today's queries are keyed
   `['today', localDate]`; Training's are keyed
   `['dashboard-today-mobile-workout']` — a different key that Today never
   touches. Training therefore re-derives the session from data that predates
   the session's creation.
3. **No `onError`.** If the POST fails, nothing is shown and nothing
   navigates. See story 53.

**Web does not have this problem**, because it never asks a second screen to
guess: `apps/web/src/pages/TodayPage.tsx:692` is
`onSuccess: (session) => navigate(`/workout/${session.id}`)`. The id travels
in the URL, and `WorkoutSessionPage` reads it from the route.

### This is very likely the mechanism behind the duplicate session

The duplicate `in_progress` session found in production on 2026-08-25 was
attributed to the Training tab's mount effect auto-creating a session. That
effect was the *trigger*, but this handoff is what armed it:

1. User taps "Start workout" on Today → a session is created.
2. `router.push('/(tabs)/training')` — the id is dropped.
3. Training's `dashboard-today-mobile-workout` query is stale and does not
   contain the session that was just created.
4. `resolvedSessionId` resolves to `undefined`.
5. The mount effect fired → **a second session was created.**

Removing the auto-create (already done) prevents the duplicate, but it does
not repair the handoff — it converts the bug into a dead end. Step 5 now
renders the "no session yet" empty state instead, so a user who just tapped
"Start workout" is told no workout is in progress. **That regression is live
until this story lands.**

**Story 54 removes the need for the guess entirely**, by making the logger a
session-keyed route rather than a browsable tab — a screen that cannot be
opened without a session never has to derive one. That is the structural
fix and it supersedes this one. This story is still worth doing first: 54 is
a much larger restructure, and the empty-state regression is live now.

## UX / Product Intent

Starting a workout should open that workout. The screen that created the
session already knows its id; that id should travel with the navigation
rather than being rediscovered.

`app/(tabs)/training.tsx` already accepts `?sessionId=` via
`useLocalSearchParams` and prefers it over any derived value
(`routeSessionId ?? ...`), so the receiving half of this contract exists and
is unused by the only caller that matters.

## Acceptance Criteria

- [ ] Starting a workout from Today navigates to that exact session id.
- [ ] Resuming an in-progress workout from Today navigates to that session id.
- [ ] Training never creates a session as a side effect of rendering.
- [ ] A cold open of the Training tab (no id, no prior navigation) still
      resolves the day's in-progress session if one exists.
- [ ] Today invalidates any cache Training depends on, or Training is made
      not to depend on a cache Today can invalidate — the two must not hold
      independent, divergent copies of "today's sessions".
- [ ] A failed session create surfaces an error and does not navigate.
- [ ] Two rapid taps of "Start workout" cannot produce two sessions.
- [ ] A regression test covers: start from Today → assert the navigation
      carries the created session's id.
- [ ] A regression test covers: Today and Training do not disagree about the
      active session after a start.

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

Treat this as a **state-ownership** problem, not a navigation tweak.

The underlying fault is that two screens each own a copy of "today's
sessions" under different query keys and never reconcile. Passing the id
fixes the observed symptom; deciding which screen owns that state fixes the
class. Prefer the latter if it can be done without a broad refactor — a
single shared query key for the day's dashboard would remove the divergence
entirely, and both screens already fetch the same `/dashboard/today` endpoint.

Do **not** solve this by having Training poll or refetch on focus. That
re-guesses rather than removing the guess, and it reintroduces the race under
a slow network.

### Server-side context worth reading first

`POST /v1/workout-sessions` (`apps/api/src/routes/workout-sessions.ts`) is
not a pure create — it deletes that date's `rest_day` so a day cannot claim
both rest and training. Any client path that can reach it without deliberate
user intent is a data-loss bug, which is why the criteria above forbid
render-triggered creation rather than merely discouraging it.

Check whether the endpoint is idempotent for a day that already has an
`in_progress` session. If it is not, the "two rapid taps" criterion needs a
client-side guard, and that guard belongs in one place rather than in each
caller.

### Testing note

`apps/mobile/src/__tests__/TrainingScreen.test.tsx` already exists and mocks
the api client; extend it rather than starting a new harness. The existing
`mockPatch` in that file rebuilds its payload immutably on purpose — a
mutation in place leaves query data referentially unchanged and any `useMemo`
keyed on it stale. Follow that pattern.
