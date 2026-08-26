# Story 59 — Make Quick Log Persist All Applicable Sets Atomically

## User Story
As a user performing an exercise where my planned sets use the same values, I want to enter them once and log the exercise in one action so I do not have to reopen the exercise and save every set individually.

## Screenshot / Gym-Test Evidence
The current `Apply to all sets` action copies values into set inputs but does not finish the workflow. The user still has to expand the exercise, scroll through sets, press Save on each set, and wait for requests.

## Problem Statement
The current action is a form-filling shortcut, not a logging shortcut.

For the normal case where all programmed sets share the same required values, Setframe should create/update the actual session set records in one intentional operation.

## UX / Product Intent

### Replace “Apply” semantics
The action should mean: apply Quick Log values to applicable planned sets **and persist them as logged sets**.

Recommended copy:
- `Log all 3 sets`
- `Log 3 sets`
- `Apply & log 3 sets`

### What gets applied
For each target set:
- preserve set type unless explicitly changed,
- apply only exercise-level Quick Log fields,
- preserve fields not represented by Quick Log.

### Existing individual overrides
Do not silently overwrite manual edits.

Recommended rule:
- untouched sets receive bulk values,
- individually modified sets remain unchanged.

If necessary, show compact confirmation for conflicts.

### Atomic persistence
From the user's perspective, logging all sets is one action.

Prefer a batch/transactional backend operation rather than N sequential client saves.

### Partial failure
If true transactionality is not available:
- track per-set success/failure,
- retain successful optimistic state,
- identify failed sets,
- expose `Retry failed sets`.

## Acceptance Criteria
- [ ] Quick Log primary action persists applicable sets; it does not merely populate fields.
- [ ] User does not have to open Detailed Sets for the normal uniform-exercise case.
- [ ] Planned reps are included automatically when present.
- [ ] Required representation-specific data is validated before logging.
- [ ] Optional fields do not block completion.
- [ ] Existing manual overrides are not silently overwritten.
- [ ] Batch operation has deterministic partial-failure behavior.
- [ ] Successful logging updates session summary/counts immediately.
- [ ] Successful logging contributes correct volume/metrics.
- [ ] Duplicate taps do not create duplicate sets.
- [ ] Retry is idempotent.
- [ ] Session-only bulk logging does not modify the workout template.
- [ ] Behavioral tests cover all-unmodified, partial-override, retry, duplicate-tap, and partial-failure cases.

## Definition of Done
Apply the product-wide Definition of Done from this pack's README.

## Copilot / Claude Steering Document

Investigate the API. If it only supports one set mutation at a time, add a purpose-built session service/endpoint rather than serially awaiting N requests from the UI.

Conceptually:

```ts
type LogExerciseSetsRequest = {
  sessionExerciseId: string;
  expectedVersion?: number;
  quickValues: {
    weight?: number;
    reps?: number;
    durationSeconds?: number;
    distance?: number;
    distanceUnit?: string;
  };
  targetSetIds: string[];
};
```

The exact API may differ.

### Idempotency
Gym environments create double taps, retries, app backgrounding, and weak service. The operation must be safe to retry.

### Copy must match behavior
If a button only copies fields, call it Apply. If it persists logged sets, call it Log.
