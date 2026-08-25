# Story 55 — Make Programs Editable on Mobile

## User Story

As a user whose program needs a change — swap an exercise, fix a
prescription, reorder a workout, adjust which day it falls on — I want to do
it on my phone so that I am not told to go and find a laptop to change one
number.

## Problem Statement

Mobile can **create** a program but cannot **edit** one.

`app/program-wizard.tsx` (813 lines) is genuinely capable: it creates
programs, creates/renames/removes day types, creates exercises, adds and
patches exercises with prescriptions, and upserts/removes schedule slots.
Guided setup works.

`app/program-editor.tsx` (328 lines) is where a user goes afterwards, and its
only mutation is `activateMutation` — switching which program is active. Its
own copy states the limitation plainly (line 265):

> Edit on web for reorder, prescriptions, schedule changes, and planning or
> correcting rest days.

Web's `ProgramEditorPage.tsx` is 1219 lines and fully editable.

So the practical shape of the product is: **you may build a program once on
your phone, and every subsequent change requires the web app.** Training
plans are not build-once artifacts — they change constantly, and typically at
the gym, which is exactly where the laptop is not.

### This boundary was never actually decided

`docs/adr/` contains seven ADRs. **None** documents a mobile read-only
boundary. There is no equivalent of ADR 0007
(*"Notification Preferences — Scope Boundary"*), which is the house precedent
for recording exactly this kind of deliberate limitation.

The constraint exists only as a comment in a component and a sentence of UI
copy. That matters for how this story is treated: **it is not a documented
decision being reversed, it is an undocumented implementation gap.** If the
team now decides mobile should stay read-only, that deserves a real ADR
stating why. If it should not, this story closes the gap. Either way the
current state — a limitation with no recorded rationale — should not persist.

## UX / Product Intent

Mobile should support the edits users actually make to a live program:

- add/remove/reorder exercises within a workout
- change a prescription (sets, reps, weight targets, duration, distance)
- rename or remove a workout
- change which day a workout falls on
- plan or correct rest days

This is a large surface. It is also the surface web already implements, so
the domain logic, schemas, and API routes all exist — this is a client
capability gap, not a new feature.

## Acceptance Criteria

- [ ] A user can add an exercise to an existing workout on mobile.
- [ ] A user can remove an exercise from an existing workout on mobile.
- [ ] A user can reorder exercises within a workout on mobile.
- [ ] A user can edit an exercise's prescription on mobile.
- [ ] A user can rename and remove a workout on mobile.
- [ ] A user can change a program's schedule (which workout on which day).
- [ ] A user can plan and correct rest days on mobile.
- [ ] Destructive edits confirm, and are undoable where web is undoable.
- [ ] Every edit surfaces failure visibly (see story 53's standard).
- [ ] The "Edit on web" copy is removed only for capabilities actually
      delivered — it must not claim parity it does not have.
- [ ] Editing an existing program never mutates historical sessions
      (ADR 0005's plan-vs-reality separation).
- [ ] Tests cover each edit path.

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

**Assess splitting this before starting.** It is the largest story in the
pack and plausibly divides along:

- **(a) exercise-level edits** within an existing workout — add, remove,
  reorder, edit prescription. Highest value, most self-contained, and the
  most common real-world edit.
- **(b) workout-level edits** — rename, remove, create outside the wizard.
- **(c) schedule + rest days** — which workout on which day, planning and
  correcting rest.

(a) alone would remove most of the "go to the web" friction. Recommend
splitting unless there is a reason to land it whole; if you split, say so
explicitly rather than silently delivering a third of the story.

### Reuse rather than rebuild

`program-wizard.tsx` already implements nearly every one of these mutations —
`addExercise`, `removeExercise`, `patchExercise`, `renameDayType`,
`removeWorkout`, `upsertSlot`, `removeSlot`, plus undo flows for several.
The wizard's components and mutations are the natural foundation; this should
be substantially a matter of surfacing existing capability in the editor, not
writing it fresh. Read that file before designing anything.

Mobile also already has `WeekScheduleEditor.tsx` and `ExerciseEditSheet.tsx`
in `src/components/` — check what they already do.

### Respect ADR 0005

Editing a program must never alter how a past session renders. Sessions
snapshot exercise name and prescription at start; the editor touches
`day_type`/`day_type_exercise` only. Any change that appears to rewrite
history is a bug, and this is the invariant most at risk in this story.

### Record the decision

Whatever is decided about scope, write it down. If mobile is to remain
partially read-only, add an ADR modelled on 0007 saying which capabilities
are deliberately web-only and why — so the next person finds a decision
rather than a comment.
