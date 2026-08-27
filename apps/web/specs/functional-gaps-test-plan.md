# Setframe Functional Gaps Test Plan

## Application Overview

Setframe is a fitness training web app (React/Vite SPA) served at http://localhost:5199 against MSW mocks (`dev:mock`), authenticated via a programmatic Clerk sign-in (`signInAs`, see `apps/web/e2e/ux/auth.ts`) that lands on `/today`. This plan targets the four primary destinations (`/today`, `/training`, `/progress`, `/settings`) and the workout session reached from Today's "Start workout", and deliberately covers only what `apps/web/e2e/functional/core-flows.spec.ts` does NOT already cover (navigation, the auth gate, Today's base action set, the no-program state, starting a workout, Quick Log persisting sets, the completed-workout review surface, Training listing workouts, and Progress's metrics/overflow/explainer). It focuses on: per-set edits and corrections in an active session, adding an ad hoc exercise, rest days, program/workout management on Training, and Settings preferences, plus numeric validation and a couple of concrete defects found while exploring.

Environment ground truth discovered while exploring (read this before writing or running these tests):

1. **Several mutations in `dev:mock` have no MSW handler and silently fall through to a real network call to `http://localhost:3000`.** Confirmed for: `POST /v1/day-types` (create workout), `PATCH /v1/programs/:programId` (rename program), `POST /v1/day-types/:id/exercises/reorder` (reorder exercises), and `PATCH /v1/me` (update units). Each of these returned a real `400 VALIDATION_ERROR` (e.g. `"params/programId Invalid UUID"`) because the mock fixtures use pseudo-UUIDs like `20000000-0000-0000-0000-000000000001` that are not valid per strict UUID validation (the version/variant nibbles are `0`, not `1-5`/`8-b`). `apps/web/src/mocks/handlers.ts` line ~524 still has a dead handler at the pre-rename path `POST /v1/programs/:programId/workouts` (see the comment at line 510 documenting the earlier GET-side version of this same class of bug) — the working handler for the new `/v1/day-types` path was never added. This means: (a) these mutations can silently write to whatever real server happens to be listening on port 3000 during a test run rather than staying isolated, and (b) "create workout", "rename program", and "reorder exercises" cannot currently be verified end-to-end against `dev:mock`. The app itself degrades gracefully (inline retryable error / toast, input preserved) so scenarios below test that resilience rather than a happy path these mocks cannot support.
2. **`GET /v1/dashboard/today` and `GET /v1/workout-sessions/:sessionId` are static fixtures that never reflect a prior mutation.** Taking/undoing a rest day, editing a set (PATCH), deleting a set, adding a set, and adding an exercise all fire the correct request and (mostly) show a success toast, but a refetch after invalidation returns the same unchanged fixture — so, unlike a real backend, the screen never visually settles into the new state. `TodayPage.tsx`'s "Undo rest day" button is therefore unreachable in this environment: it only renders when `data.restDay` is present, and the mock's `dashboard/today` handler never returns a `restDay` field for any persona. Scenarios below assert the request/toast contract (same style `core-flows.spec.ts` already uses for Quick Log), not a full round trip.
3. **Genuine-looking product defect, independent of the above:** on the Training → Workouts tab, each exercise row in a workout renders `exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exerciseId` (`ProgramEditorPage.tsx` ~line 1085). The day-type-exercise fixtures use `exerciseId`s in the `20000000-...` namespace, but `GET /v1/exercises` (the list this lookup searches) only returns `10000000-...` ids — so the lookup always misses and every exercise in every workout renders its raw UUID (e.g. `20000000-0000-0000-0000-000000000001`) instead of a name like "Barbell Bench Press", even though the correctly-named exercise is embedded right there in the day-type fixture. A scenario below asserts on the human-readable name and will fail today, which is the point: it is pinned to a real, reproducible defect, not a guess.

Scenarios assume a fresh sign-in per test (via the `lifter` persona unless noted) and are independent/order-agnostic. Use `signInAs(page, 'lifter'|'analyst'|'novice', path)` from `../ux/auth` exactly as `core-flows.spec.ts` does.

## Test Scenarios

### 1. Today — rest days

**Seed:** `e2e/functional/seed.spec.ts`

#### 1.1. taking a rest day sends the expected request and confirms with a toast

**File:** `e2e/functional/rest-days.spec.ts`

**Steps:**
  1. Sign in as 'lifter' and land on /today (signInAs(page, 'lifter', '/today')). Confirm the scheduled-workout card is showing: button 'Start workout', button 'Preview', button 'Change today's workout', and under 'Need a day off?' a button named 'Take a rest day'.
    - expect: All four controls are visible on a fresh /today load
  2. Click the button named exactly 'Take a rest day', racing it against page.waitForRequest for a POST whose URL matches /\/rest-days$/
    - expect: A POST to /v1/rest-days fires with a JSON body matching { localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), timezone: expect.any(String) }
    - expect: A success toast/status region shows the text 'Rest day logged. Recovery counts.' (assert with page.getByText, not a strict role=status query — the toast is not the only element with role=status on the page)
  3. Do NOT assert that the workout card visually switches to a 'Rest day' state or that an 'Undo rest day' button appears — see plan overview point 2. GET /v1/dashboard/today is a static mock fixture that never returns `restDay`, so the card legitimately continues to show 'Today's workout' / 'Start workout' after the refetch. If this ever changes, this is the assertion to add back.
    - expect: No exception is thrown by asserting the request body and toast text; that is the full, currently-reachable contract for this action

### 2. Workout session — correcting logged data

**Seed:** `e2e/functional/seed.spec.ts`

#### 2.1. numeric validation blocks saving an invalid set

**File:** `e2e/functional/workout-session-set-edits.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/today'); click 'Start workout'; wait for URL /\/workout\//. Within the 'Barbell Bench Press' exercise's 'Set 2' block, fill the 'Reps' textbox with '-5'.
    - expect: An alert with text 'Reps cannot be negative.' appears next to the Reps field
    - expect: The 'Save' button inside that Set 2 block remains disabled
  2. In the same Set 2 block, additionally fill 'Weight (lb)' with '-10' and 'RPE' with '15'.
    - expect: An alert 'Weight cannot be negative.' appears next to Weight
    - expect: An alert 'RPE must be between 0 and 10.' appears next to RPE
    - expect: 'Save' for Set 2 is still disabled with all three alerts showing simultaneously
  3. Clear all three fields back to empty.
    - expect: The three alerts disappear and Save returns to disabled (no dirty, valid change to persist)

#### 2.2. editing a set's weight and reps saves via the expected request

**File:** `e2e/functional/workout-session-set-edits.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/today'); click 'Start workout'; wait for the workout URL. In 'Set 1' of 'Barbell Bench Press', fill 'Weight (lb)' with '135' and 'Reps' with '8'.
    - expect: Set 1's 'Save' button becomes enabled once both fields are dirty and valid
  2. Click Set 1's 'Save', racing it against page.waitForRequest for a PATCH matching /\/workout-sets\//.
    - expect: A PATCH to /v1/workout-sets/{setId} fires with request body matching { setType: 'working', weightValue: 135, weightUnit: 'lb', reps: 8 } (use request.postDataJSON())
    - expect: The response is 200 and Save returns to disabled afterwards (no pending dirty state)

#### 2.3. removing a set requires confirmation and only deletes when confirmed

**File:** `e2e/functional/workout-session-set-edits.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/today'); click 'Start workout'; wait for the workout URL. Click 'Delete set 3' on the Barbell Bench Press exercise.
    - expect: A dialog opens with heading 'Remove set?' and body text starting 'This deletes the set from the workout session.'
    - expect: The dialog shows the set label 'Set 3' and buttons 'Cancel' and 'Remove set'
  2. Click 'Cancel' in that dialog.
    - expect: The dialog closes
    - expect: 'Set 1', 'Set 2', and 'Set 3' headings are all still present — nothing was deleted, and no DELETE request was sent (assert via page.waitForRequest with a short timeout that rejects, or by checking browser_network_requests shows no DELETE to /workout-sets)
  3. Re-open the same dialog (click 'Delete set 3' again) and this time click 'Remove set', racing it against page.waitForRequest for a DELETE matching /\/workout-sets\//.
    - expect: A DELETE to /v1/workout-sets/{setId} fires and returns 204
    - expect: A confirmation toast/status text 'Set removed.' appears (query broadly, e.g. page.getByText('Set removed.'))
    - expect: Do not assert that 'Set 3' disappears from the DOM — GET /v1/workout-sessions/:sessionId is a static fixture (plan overview point 2) and will keep returning all three sets on refetch; this is a known mock limitation, not something to assert against

#### 2.4. adding an ad hoc set to an exercise

**File:** `e2e/functional/workout-session-set-edits.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/today'); click 'Start workout'; wait for the workout URL. Within 'Barbell Bench Press', click the 'Add set' button next to the 'Detailed sets' label.
    - expect: A POST to /v1/workout-exercise-logs/{exerciseLogId}/sets fires (assert via page.waitForRequest matching /\/sets$/ and method POST)
    - expect: A confirmation toast/status text 'Set added.' appears

#### 2.5. adding an ad hoc exercise to today's session

**File:** `e2e/functional/workout-session-add-exercise.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/today'); click 'Start workout'; wait for the workout URL. Click the 'Add exercise' button in the 'Workout session actions' region (not the per-exercise 'Add exercise' inside a card, if any — the top-level one is inside the region named 'Workout session actions').
    - expect: A dialog opens with heading 'Add exercise', a 'Search exercises' textbox (placeholder 'Barbell Back Squat…'), a list of exercise option buttons (e.g. 'Barbell Bench Press', 'Overhead Press', 'Triceps Pushdown'), and a 'Create custom exercise' button
  2. Click the option button containing the text 'Overhead Press'.
    - expect: The dialog advances to a second step: heading 'Overhead Press', a 'Prescription' combobox defaulted to 'Sets + reps', and 'Sets'/'Reps' textboxes prefilled with '3' and '8'
    - expect: Buttons 'Back' and 'Add to workout' are present
  3. Click 'Add to workout', racing it against page.waitForRequest for a POST matching /\/exercises$/ under a workout-sessions path.
    - expect: A POST to /v1/workout-sessions/{sessionId}/exercises fires with body matching { exerciseId: expect.any(String), prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 } }
    - expect: The response is 201 and the dialog closes (no 'Add exercise' dialog remains open)

### 3. Training — program and workout management

**Seed:** `e2e/functional/seed.spec.ts`

#### 3.1. the Workouts tab shows exercise names, not raw ids (regression for a real defect)

**File:** `e2e/functional/training-management.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/training'). The 'Workouts' tab is selected by default. Click the workout button named exactly 'Day 1 — Push ~50 min' to select it.
    - expect: The detail panel shows heading 'Day 1 — Push' and two exercise rows
  2. Read the <strong> label of each exercise row in the Day 1 — Push detail panel.
    - expect: Each label is a human-readable exercise name (e.g. matches /^[A-Za-z].*[A-Za-z]$/ and does NOT match a UUID pattern /^[0-9a-f-]{36}$/) — this is expected to currently FAIL, since both rows render '20000000-0000-0000-0000-000000000001' / '...002' verbatim (see plan overview point 3, and apps/web/src/pages/ProgramEditorPage.tsx ~line 1085). Recording this failure is the goal: it pins a real, reproducible defect.

#### 3.2. creating a new workout requires a name and preserves it through a failed submission

**File:** `e2e/functional/training-management.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/training'), on the 'Workouts' tab. Click 'New workout'.
    - expect: An inline form appears with a 'Workout name' textbox (placeholder 'e.g. Lower C'), helper text 'Enter a workout name to create it.', a disabled 'Create workout' button, and a 'Cancel' button
  2. Fill 'Workout name' with 'Day 4 — Arms'.
    - expect: 'Create workout' becomes enabled
  3. Click 'Create workout'.
    - expect: Per plan overview point 1, POST /v1/day-types has no MSW handler in this environment and currently 400s against a real server. The form surfaces this gracefully: an inline alert reading "Couldn't create this workout. Try again." appears, the 'Workout name' textbox still contains 'Day 4 — Arms', and 'Create workout'/'Cancel' remain available for another attempt. Assert exactly this — the form does not lose the user's input on a failed save. If the missing mock handler is later added, this assertion should be replaced with: the dialog closes and 'Day 4 — Arms' appears in the workout list.

#### 3.3. removing a workout from a program requires confirmation

**File:** `e2e/functional/training-management.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/training'), on the 'Workouts' tab. Click the button named 'Actions for Day 1 — Push'.
    - expect: A menu opens with items 'Remove from this program' and 'Delete permanently'
  2. Click 'Remove from this program'.
    - expect: A dialog opens with heading 'Remove Day 1 — Push from this program?' and body text starting 'The workout itself is kept, along with any other program using it.'
    - expect: Buttons 'Cancel' and 'Remove' are present
  3. Click 'Cancel'.
    - expect: The dialog closes
    - expect: 'Day 1 — Push' is still listed among the workouts (button 'Day 1 — Push ~50 min' is still visible) and no DELETE-style request was sent

#### 3.4. reordering exercises within a workout sends the new order

**File:** `e2e/functional/training-management.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/training'), on the 'Workouts' tab. Click the workout button named exactly 'Day 1 — Push ~50 min'. Confirm the first exercise row has 'Move exercise up' disabled and 'Move exercise down' enabled, and the second row is the reverse (boundary buttons are disabled).
    - expect: Move-up is disabled on the first row and move-down is disabled on the last row, matching a 2-item list
  2. Click 'Move exercise down' on the first exercise row, racing it against page.waitForRequest for a POST matching /\/exercises\/reorder$/.
    - expect: A POST to /v1/day-types/{dayTypeId}/exercises/reorder fires with body { exerciseIdsInOrder: [<second exercise's id>, <first exercise's id>] } — the two ids swapped
    - expect: Per plan overview point 1 this currently 400s against a real, unmocked endpoint and the on-screen order does not visually update afterward (GET /v1/day-types/:id is also a static fixture) — do not assert a visual reorder, only the outgoing request shape

### 4. Settings — preferences

**Seed:** `e2e/functional/seed.spec.ts`

#### 4.1. toggling a notification preference updates immediately

**File:** `e2e/functional/settings.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/settings'). Locate the switch named 'Workout reminders' under 'Apple Health & notifications' and confirm it is checked with adjacent text 'On'.
    - expect: The switch is checked and its status label reads 'On'
  2. Click the 'Workout reminders' switch, racing it against page.waitForRequest for a PATCH matching /\/notification-preferences$/.
    - expect: A PATCH to /v1/me/notification-preferences fires with body { workoutRemindersEnabled: false }
    - expect: The switch immediately shows unchecked and its adjacent label reads 'Off' — this mutation IS properly mocked (mocks/handlers.ts echoes the patched body), so, unlike other scenarios in this plan, the UI is expected to visibly update without a page reload
  3. Click the 'Weekly progress summary' switch as well.
    - expect: It also flips from 'On' to 'Off' immediately, independently of the first switch

#### 4.2. toggling units sends the expected preference change (visual state is a known mock gap)

**File:** `e2e/functional/settings.spec.ts`

**Steps:**
  1. signInAs(page, 'lifter', '/settings'). Confirm the 'Units' row reads 'Imperial (lb) ›'.
    - expect: Units button text is exactly 'Units Imperial (lb) ›'
  2. Click the 'Units' button, racing it against page.waitForRequest for a PATCH matching /\/v1\/me$/.
    - expect: A PATCH to /v1/me fires with a body containing { preferredUnits: 'metric' }
  3. Do not assert that the row updates to read 'Metric (kg)'. Per plan overview point 1, PATCH /v1/me has no MSW handler and falls through to a real, unmocked server, while GET /v1/me is a static mock fixture that always returns preferredUnits: 'imperial' on the next refetch — so the label is expected to keep reading 'Imperial (lb) ›' regardless of how many times this is clicked. This test exists to pin the request contract, not the (currently unreachable) visual outcome.
    - expect: Asserting only the request body keeps this test stable; asserting the label would make it flaky/misleading given the known gap
