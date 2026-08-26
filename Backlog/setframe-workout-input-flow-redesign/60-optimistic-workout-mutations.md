# Story 60 — Introduce Optimistic Workout Logging and Non-Blocking Mutation Behavior

## User Story
As a user logging sets during a workout, I want saves to feel immediate and I want to continue logging other sets/exercises while requests synchronize in the background so network latency never interrupts the rhythm of my workout.

## Screenshot / Gym-Test Evidence
Current behavior serializes interaction around API completion. Saving one set can prevent the user from saving the next until the previous mutation finishes.

## Problem Statement
The UI treats server acknowledgement as a prerequisite for continuing interaction. That is a poor fit for workout logging.

The client already knows the user's intended state. It should update immediately and reconcile asynchronously.

## Product Intent
Introduce optimistic mutations for the **workout logging domain first**.

### Desired behavior
When Save / Log is pressed:
1. local UI updates immediately,
2. set/exercise progress updates immediately,
3. user can interact with another set/exercise immediately,
4. request runs in background,
5. success silently confirms state,
6. failure marks the affected record for retry without discarding entered values.

### Never globally block workout interaction
One set syncing must not disable another set's Save, exercise expansion, another exercise's Quick Log, scrolling, adding an exercise, or unrelated input.

### Mutation states
Use per-record states such as:
- `idle`
- `dirty`
- `saving`
- `saved`
- `error`

Avoid one page-wide `isSaving` boolean.

### Error behavior
On failure:
- retain input,
- show concise inline sync state,
- allow retry,
- avoid intrusive modal unless integrity is at risk.

## Acceptance Criteria
- [ ] Saving one set does not disable saves on other sets.
- [ ] Logging one exercise does not block another exercise.
- [ ] Local UI reflects intended values immediately.
- [ ] Progress counts update optimistically.
- [ ] Failed mutation preserves values.
- [ ] Failed mutation can be retried.
- [ ] Server response reconciles optimistic state correctly.
- [ ] Stale responses do not overwrite newer edits.
- [ ] Duplicate requests do not create duplicate logical records.
- [ ] No page-level saving overlay is used for normal set mutations.
- [ ] User can continue interaction during network latency.
- [ ] Mutation state is scoped per record/entity.
- [ ] Tests simulate latency and out-of-order responses.
- [ ] Mobile app uses equivalent optimistic behavior.

## Definition of Done
Apply the product-wide Definition of Done from this pack's README.

## Copilot / Claude Steering Document

If Setframe already uses React Query/TanStack Query or an equivalent cache, use its optimistic mutation primitives rather than creating a parallel custom cache.

Typical pattern:

```ts
onMutate  -> snapshot + optimistic write
onError   -> reconcile/mark failure
onSuccess -> merge canonical server response
```

Do not blindly roll back newer user edits when an older request fails.

### Explicit concurrency test
1. Save Set 1.
2. Immediately save Set 2.
3. Set 2 response returns first.
4. Set 1 response returns later.
5. Both remain correct.

Also test editing a field again while its previous save is in flight, Quick Log followed by set-specific override, and Finish Workout while required mutations are still synchronizing.

### Finish Workout
Define how pending mutations are reconciled before session completion so input is never silently lost.

### Rollout
After this domain is stable, create a separate technical backlog item to audit other high-frequency write flows. Do not expand this story to the entire application.
