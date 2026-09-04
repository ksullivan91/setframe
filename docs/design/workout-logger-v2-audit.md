# Workout logger v2 — interaction audit

**Status:** Findings only. Nothing here is fixed unless it says so.
**Scope:** `src/screens/WorkoutSessionScreenV2.tsx` and its components,
read against `workout-logging-interactions.md`, `workout-logging-table.md`,
ADR 0011, and the nine shipped Figma frames.
**Occasion:** the build-23 bold reskin. Redesigning the screen meant reading
every path through it, which surfaced gaps that predate the reskin.

---

## 1. RPE column — removed

The opt-in `RPE` column and its per-exercise toggle in the ⋯ sheet are gone.
A field most sets leave blank did not earn a column the 390px table cannot
spare, and the toggle was the only row in the actions sheet that changed the
table's *shape* rather than performing an action.

RPE remains a column on `workout_set`, remains in `prescriptionDefinitions`
as an optional field, and remains editable per set from the session
summary's set sheet. This removed a column, not the data.

Recorded in `workout-logging-table.md` §4, `workout-logging-interactions.md`
§8/§9.2, and ADR 0011's consequences. Guarded by
`src/__tests__/SetRowV2.test.tsx` → "the logger has no RPE column".

---

## 2. Findings

Ordered by what a user hits soonest.

### 2.1 An empty session renders nothing at all — **no design exists**

`exercises.map(...)` has no empty branch. A session with no exercise logs
draws a header, a blank canvas, and the bottom bar.

This was unreachable in practice while every session came from a template.
It is reachable now: the workout picker added in build 23 offers "Start an
empty workout", which creates a session with `templateId: null` and no
exercise logs. The first thing that flow produces is a blank screen.

Neither `workout-logging-table.md` nor the interactions spec's §11 edge-case
table covers it, and no Figma frame shows it. It needs a design, not just
code — the screen has to say what to do next, and "+ Add exercise" at the
bottom is the only affordance present.

### 2.2 Four mutations fail silently

`addSet`, `changeSetType`, `deleteSet` and `removeExercise` all roll the
optimistic cache back in `onError` and report nothing. The set reappears, or
the exercise comes back, with no statement that anything failed — which
reads as the app undoing the user's action on purpose.

The screen already has the fix imported and in use: `feedback.report(...)`
covers `addExercises`, `saveAsWorkout`, `finish` and the Watch mutations.
These four were missed. This is the same class as commit `4077d01`
("14 mutations could fail without saying anything").

### 2.3 Finishing is possible with nothing logged

`finish` posts `/complete` unconditionally. On an empty session — see 2.1 —
Finish completes a workout containing no sets, which then appears in Progress
and in the week strip's adherence marks as a trained day.

Undocumented in §11. Whether the guard belongs on the client, the API, or
neither is a product call, not a bug fix.

### 2.4 Documented edge cases that are not implemented

From `workout-logging-interactions.md` §11:

| Documented | Reality |
|---|---|
| Result pill reads **"First time"** with no history | Never rendered. `resultLabel` is `"{volume} lb"` with the comparison appended when one exists; with no history it silently drops to volume alone. |
| Four-digit weight **shrinks one step** rather than widening the column | No `adjustsFontSizeToFit` anywhere in `SetRowV2`. A four-digit value is clipped by the 70px input instead. |
| Session left open overnight — **elapsed keeps counting** | Nothing counts. See 2.5. |

### 2.5 The header shows neither the workout's name nor elapsed time

The shipped Figma frames title the header with the workout
("Upper Body — Push") and lead the meta line with elapsed
("48:20 elapsed · 5,480 lb · 3 of 11 sets"). The code renders the literal
string "Workout session" and no elapsed at all: `formatSessionDuration`
returns `null` without a `completedAt`, so it can only ever produce a
duration for a *finished* session.

The code has drifted from its own spec. Both were left alone in the reskin,
which was explicitly a restyle — flagged here because they are the two most
visible differences between the shipped design and the running app.

### 2.6 Scroll behaviour is unspecified in the reskin

ADR 0011 says the header is fixed to the top and **condenses from 76px to
48px on scroll**, and the shipped frames include a `Scrolled` state. The
header is fixed (it sits outside the `ScrollView`), but nothing condenses,
before or after the reskin. `LoggerHeader` is taller than the bar it
replaced, so this costs more vertical space than it used to.

### 2.7 States with no gallery or Figma frame

Present in code and in the shipped Figma set, absent from the build-23
reskin: **Scrolled**, **Correcting after completion**, **After the
correction**, the **add-exercise picker**, and **SaveAsWorkoutCard**.

The four Apple Watch cards were excluded from the first pass on the grounds
that they have their own gallery. That was wrong twice over: a component
having its own gallery says nothing about whether it belongs to this
screen's flow, and `/dev-watch-gallery` in fact leads with onboarding frames
rather than the Watch cards. They render inside the logger's own
post-completion block — the offer to attach the Watch's record of the
session, what attaching it buys, the heart-rate trace and effort per
exercise — and are now in the logger gallery, in render order.

### 2.8 The heart-rate zone ramp is validated against a light ground

`HeartRateCard` keeps the light `Card` while the other three Watch cards
went dark. Its zone ramp is accent 300 → 900, chosen because lightness falls
monotonically so the ordering survives any colour vision; the token file
records that 192 candidate ramps were tested against the palette validator
before this one passed.

On a dark ground that reasoning inverts. Zone 5 is the darkest step, so the
highest-effort bars — and their legend swatches — all but vanish against
`inverse.surface`. Flipping the ramp by hand would discard the validation,
so the card keeps the ground its colours were checked on.

Making it dark is a real piece of work: derive a dark-ground sequential ramp,
re-run `scripts/validate_palette.js` against the dark surface, and confirm
the monotonic lightness still holds. Worth doing, not worth guessing at.

---

### 2.9 The logger v2 screen had no rendered test

Every guard on `WorkoutSessionScreenV2` was source-level — reading the file
and matching strings. Nothing mounted it.

That is not a theoretical weakness. Removing the RPE column, an entire
feature, broke no test. And while building §3's confirmation sheet it was
first wired *inside* the exercise picker's `Modal`, so it could only ever
have appeared while the picker was open — a full green suite, and a Finish
button that would do nothing.

**Still open.** An attempt to add one is not in the tree: mounting the screen
hangs the runner. `useFocusEffect` drives the Watch hooks to read, which sets
state, which re-renders, which reads again. Mocking `HealthKitAdapter` is not
enough — the loop is above it. What a working harness needs is stubs at the
hook boundary the screen actually consumes:
`useSessionWatchWorkouts`, `useWatchSessionInsights` and
`useHealthConnection`, with `useFocusEffect` a no-op. That is worth doing
properly rather than landing a test that hangs the suite.

---

## 3. Fixed while auditing

- **The bottom bar was not reskinned.** `+ Add exercise` kept
  `surface.raised` / `action.primary`, putting a white bar beneath a dark
  header with dark cards between them. Now `inverse.surface`.

- **§2.2 — the four silent mutations.** `addSet`, `changeSetType`,
  `deleteSet` and `removeExercise` now pair their rollback with
  `feedback.report(...)`, like the four beside them already did. Guarded
  per-mutation in `SetRowV2.test.tsx`, so a ninth silent one fails.

- **§2.1 — the empty session.** `EmptySessionCard` renders when a session
  has no exercises and is not complete. It repeats the bottom bar's action
  rather than inventing a second one; the bar is easy to miss at the foot of
  an otherwise blank screen.

- **§2.3 — finishing with nothing logged.** Not by disabling `Finish`:
  interaction spec §4 is explicit that it is *never* disabled, because "a
  disabled button in that moment is the product arguing with the gym". A
  first attempt did disable it and was backed out. `FinishConfirmSheet`
  implements what §4 actually specifies — "Finish with 3 sets unlogged?",
  with **Finish workout** and **Keep going** — and takes the empty session
  as its own wording. Unwritten rows are still discarded, never zeroed.

- **The remaining light surfaces.** The exercise picker, `SaveAsWorkoutCard`,
  the set-type sheet and the exercise-actions sheet were still light inside a
  dark screen. `Sheet` gained a `tone`, as `Card` did. The picker is shared
  with the *light* workout editor and the *dark* guided setup, so it resolves
  a palette from a `tone` prop rather than being converted outright — and
  guided setup now gets the dark one it should always have had.

Everything else above is left as found.
