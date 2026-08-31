# Mutation feedback audit (2026-08-31)

Prompted by repeated reports of controls that "do nothing". Every
`useMutation` in `apps/mobile` was inspected for three things: an error
path, a pending state, and an optimistic update.

## What was found

**66 mutations. 14 had no error path and no pending state**, so a failed
request produced nothing at all — indistinguishable from a control that was
never wired up. Three defects reported from the device were exactly this
shape:

- "clicking add to today DOES NOTHING" — the request succeeded but the
  suggestion never cleared
- "Use this plan doesn't do anything" — a 400, silently swallowed
- "Could not remove activity" — the rare one that *did* say something

The silent fourteen: Finish workout, Start workout, Just start training, Add
exercises (session and editor), Save prescription, Remove exercise, Assign
day, Save as workout, Change units, and three in the program wizard.

## What changed

`src/lib/useActionFeedback.tsx` makes the correct thing a one-liner:

```tsx
const feedback = useActionFeedback();
useMutation({ ..., onError: feedback.report('Could not save.') });
{feedback.node}
```

Deliberately **not** a global toast host: a failure belongs on the screen
that caused it, and a screen that forgets to render `node` should be
visibly missing its errors rather than quietly posting them somewhere else.
`TrainingScreenV2` has three early returns and renders it in all three — a
screen with several exits needs the surface on each.

`Finish` also gained a pending state. It is a real round trip that then
navigates away; without one, a second tap fired a second complete while the
first was in flight.

## Guards

`src/__tests__/mutationFeedback.test.ts` fails if any mutation has no
`onError` (with a named, reasoned exception list), and if any screen calls
`useActionFeedback` without rendering `feedback.node`. Source-level, because
the failure is structural — a rendered test would have to drive all 66
mutations to find the silent ones.

## Still open, ranked

Pending states, for mutations that are neither optimistic nor instant. Not
bugs today, but each one is a window where a second tap does something
unintended:

1. **Destructive, double-tap creates a 404 or a duplicate** —
   `deleteMutation` / `deletePresetMutation` (additional activity),
   `deleteDayType`, `removeFromProgram`, `removeSlot`.
2. **Slow enough to look dead** — `assignDay` (schedule), `savePrescription`
   and `removeExercise` (workout editor), `upsertSlot`.
3. **Fine as they are** — the five optimistic session mutations (`saveSet`,
   `addSet`, `changeSetType`, `deleteSet`, `removeExercise`). A spinner
   there would be wrong: the UI has already updated, and showing pending
   would undo the point of the optimism.
4. `saveMutation` on Today drives its own `SaveFeedback` status and needs
   nothing.

## Optimistic updates

Six mutations are optimistic, all in the v2 session logger, and that is the
right set: they are the ones a user fires repeatedly mid-workout where a
round trip would be felt. Nothing else in the app is in that position — the
rest are one-off actions where a pending state is the honest signal.
