# ADR 0009: Mobile Navigation Shape — Tabs Are Places, Sessions Are Routes

Status: Accepted. Date: 2026-08-25.

## Context

Mobile's information architecture had drifted into the inverse of web's,
and the drift caused production data loss.

| | Web | Mobile (before) |
|---|---|---|
| Training | `/training` → `ProgramEditorPage`, fully editable | `(tabs)/training` → the active workout **logger** |
| Workout logger | `/workout/:sessionId`, a route you are sent to | a **tab** you browse to |
| Program editor | `/training` | `app/program-editor.tsx` — read-only, not a tab |

Two consequences followed.

**There was no way to build a training program on mobile.** The screen
that should have done it was a read-only preview whose own copy read
"Edit on web for reorder, prescriptions, schedule changes, and planning or
correcting rest days." Mobile could *create* a program once, through the
onboarding wizard, and never change it afterwards —
`app/program-wizard.tsx` carried 13 mutations while the editor carried
one (`activate`).

**A session-scoped screen in a tab had to invent its own subject.** A tab
must render something when tapped. The logger, tapped with no active
session, had nothing — and the implemented answer was to `POST
/v1/workout-sessions` from a mount effect. Merely opening the Training tab
created a workout pre-populated with the day's template sets, with no user
action and no way to decline. Observed in production on 2026-08-25: a day
that already held a finished workout gained a second, empty `in_progress`
session that shadowed it, and had to be deleted from the database by hand.
Because that endpoint deletes the date's `rest_day` so a day cannot claim
both training and rest, the same path silently destroyed logged rest days.

Removing the mount effect alone was not sufficient. It converted the
duplicate into a dead end: Today pushed to the tab with no session id, and
the logger — no longer inventing one — landed on an empty state.

### This was never a decision

No ADR covered the read-only limitation, and
`github-copilot-fitness-app-master-prompt.md` does not mandate it. It was
an implementation shortcut that a code comment hardened into apparent
policy: each new web capability (stories 24, 25, 26) had no obvious mobile
counterpart to update, because the file described itself as "a lighter,
read-only mobile view". Nobody ran the mobile app, so nothing forced the
question.

## Decision

**A tab is a place. A screen about one record is a route keyed by that
record's id.**

- The Training tab is the program editor: programs, workouts, exercises
  and the weekly schedule, all editable, matching what web offers.
- The workout logger is `app/workout/[sessionId].tsx`. It requires a
  session id, has no dashboard query and no create mutation, and treats a
  missing id as an error rather than an invitation.
- Callers pass the id explicitly. `Today`'s "Start workout" creates the
  session and pushes with its id, mirroring web's
  `navigate('/workout/${session.id}')`.
- Training's only relationship to a live session is a banner offering a
  way back to it — never a way to start or log one.

## Consequences

- The auto-create class of bug is structurally impossible rather than
  merely patched. There is no longer a question for "create one" to be the
  answer to.
- Screens that create a record own the cache refresh for the list that
  record appears in. Today invalidates `['today', localDate]` before
  navigating, because its own dedup guard reads that cache and a stale copy
  lets a second press create a duplicate.
- One key per view. The logger previously kept a second, independent copy
  of "today" under `['dashboard-today-mobile-workout']` while Today read
  `['today', localDate]`; the two silently diverging is what made a
  just-created session invisible to the screen meant to display it. That
  key is gone.
- Mobile program editing reuses the wizard's existing mutations and the
  existing `WeekScheduleEditor`, `AddExercisePicker` and
  `ExerciseEditSheet` components. No new API surface was required —
  every endpoint already existed.
- ADR 0005's intent/fact separation is unaffected: program editing touches
  only `day_type`, `day_type_exercise` and `program_schedule_slot`, never
  a `workout_session`.

### Still web-only

Per-set planned overrides (`day_type_exercise_planned_set`) are not
editable on mobile. Exercise reordering within a workout is not exposed
either — the endpoint exists
(`POST /day-types/:id/exercises/reorder`) but drag-reorder needs an
interaction this screen does not yet have.

## Alternatives considered

**Keep the logger in a tab and guard the auto-create.** Rejected: it
treats the symptom. A tab still has to render something, so the next
person to touch the empty state faces the same pressure that produced the
original bug.

**Leave program editing on web and keep the read-only preview.** Rejected
by the product owner's explicit statement of intent — Training is where
you build programs, add workouts and exercises, and schedule program days.
It is also not a defensible boundary: mobile already contained every
mutation needed, locked inside a flow reachable exactly once.
