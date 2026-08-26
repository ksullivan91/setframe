# Story 63 — Support Precise Additional-Activity Duration Entry

## User Story

As a user adding an additional activity, I want to enter duration in a clear minutes-and-seconds format so I can accurately record activities that do not land on an exact whole minute without having to mentally convert a clock duration into a single large minute value.

## Screenshot / Gym-Test Evidence

The attached mobile-web screenshots show the current **Add activity** flow using a single field labeled:

`Duration (min)`

During real use, the user attempted to enter a clock-style duration directly and entered values such as:

- `2309`
- `1437`

The intent was to record durations such as **23:09** or **14:37**, but the UI interpreted the value as a whole number of minutes.

This reveals two separate UX problems:

1. The field does not make it obvious that it accepts only whole minutes.
2. The model does not support seconds, so users cannot accurately represent short activities or durations that do not end on a full minute.

Minutes should remain the primary mental model, including for activities longer than one hour, but users need a way to include seconds.

## Problem Statement

Additional Activity currently stores/collects duration with minute-level precision only.

That is too coarse for real activity data.

Examples:

- 14 min 37 sec walk
- 23 min 09 sec cycle
- 8 min 45 sec mobility
- 1 hr 12 min 30 sec yoga

A user should not have to:

- round the activity,
- convert an entire duration into decimal minutes,
- type `2309` and hope it is interpreted as 23:09,
- or lose seconds entirely.

The current field also creates an input affordance problem: a plain numeric input visually looks compatible with any integer, even though `2309` becomes an absurd duration when interpreted as minutes.

## UX / Product Intent

### Recommended interaction

Use two explicit duration inputs:

- **Minutes**
- **Seconds**

Example:

| Minutes | Seconds |
| --- | --- |
| 23 | 09 |

The field group should be labeled **Duration**.

Recommended mobile layout:

```text
Duration
[ 23 ] min   [ 09 ] sec
```

or, if horizontal space is constrained:

```text
Duration
Minutes       Seconds
[ 23 ]        [ 09 ]
```

The first option is preferred if it remains readable and touch-friendly at narrow mobile widths.

### Why not Hours / Minutes / Seconds?

Do **not** introduce an Hours input in this story.

The user explicitly prefers minutes as the primary representation even for activities over one hour.

Examples:

- 75 min 20 sec
- 92 min 05 sec

This keeps data entry consistent across short and long additional activities.

### Input behavior

#### Minutes

- integer
- minimum `0`
- no practical UI maximum imposed for normal use
- numeric keyboard on mobile
- allow values greater than 59

#### Seconds

- integer
- valid range `0–59`
- numeric keyboard on mobile
- normalize reasonable input where safe

Examples:

- `7` may display/store as `07`
- `59` is valid
- `60` must not silently remain `60 seconds`

Preferred behavior for `60+` seconds:
- normalize into minutes if implementation can do so predictably

Examples:

- `1 min 60 sec` → `2 min 00 sec`
- `14 min 75 sec` → `15 min 15 sec`

If automatic normalization creates complexity or ambiguity, validation may instead prevent values above `59`.

Do not silently truncate.

### Empty values

- Minutes may be `0` when seconds are present.
- Seconds may be empty/`0` when only whole minutes are entered.
- Duration is valid if total duration is greater than zero.
- `0 min 0 sec` must not create an activity with a zero duration unless zero-duration activities are explicitly supported elsewhere.

### Display after save

Saved additional activity should display human-readable duration.

Examples:

- `14 min`
- `14 min 37 sec`
- `75 min`
- `75 min 20 sec`

Avoid displaying:
- raw seconds,
- decimal minutes,
- `0:14:37` unless the surrounding product adopts clock formatting consistently.

### Existing quick-add behavior

If Quick Add currently creates suggestions such as:

`Walk · 14 min`

preserve that pattern.

If synced/source data includes seconds, the more precise duration may be shown where appropriate:

`Walk · 14 min 37 sec`

Do not make Quick Add noisier when only whole-minute precision exists.

## Data / Domain Requirements

Duration should have a canonical storage representation that supports second-level precision.

Preferred:

```ts
durationSeconds: number
```

rather than storing separate minute and second values in persistence.

The UI may use separate fields, but the domain should normalize to total seconds.

Examples:

```ts
23 min 9 sec  -> 1389 seconds
14 min 37 sec -> 877 seconds
75 min 20 sec -> 4520 seconds
```

If the existing domain stores minutes, introduce a backward-compatible migration/adapter.

Do not use floating-point decimal minutes as the primary persisted format.

### Backward compatibility

Existing records stored as whole minutes must remain valid.

For example:

```text
14 minutes -> 840 seconds
```

Existing activity history should continue to render correctly.

## Acceptance Criteria

- [ ] Additional Activity no longer relies on a single ambiguous `Duration (min)` field.
- [ ] The UI exposes explicit Minutes and Seconds inputs under a common Duration label.
- [ ] Minutes may exceed 59.
- [ ] Seconds support values from 0–59.
- [ ] Mobile numeric keyboard is used for both inputs.
- [ ] A user can successfully save `14 min 37 sec`.
- [ ] A user can successfully save `23 min 09 sec`.
- [ ] A user can successfully save durations greater than one hour using minutes, e.g. `75 min 20 sec`.
- [ ] `0 min 30 sec` is valid.
- [ ] `0 min 0 sec` is rejected unless zero-duration activities are intentionally supported.
- [ ] Invalid seconds are normalized or clearly validated; they are never silently truncated.
- [ ] Saved additional activities display duration in a human-readable format.
- [ ] Existing whole-minute activity data remains correct after the change.
- [ ] Quick Add remains compatible with whole-minute and second-level source data.
- [ ] No horizontal overflow is introduced on narrow mobile screens.
- [ ] Input focus does not trigger the previously fixed mobile zoom/sticky-nav regression.
- [ ] Web and mobile app use equivalent duration semantics and validation.
- [ ] Behavioral tests cover second-level duration, >59-minute duration, validation, normalization, and legacy records.

## Product-wide Definition of Done

Every Setframe story must satisfy the standing product rules:

- Implement **mobile-first responsive web**.
- Implement equivalent user-facing behavior in the **mobile application**.
- Compare **mobile web vs mobile app** side-by-side before completion.
- Run the **GitHub reviewer** for implementation/code quality.
- Run the **Figma reviewer** for visual/design parity.
- Handle loading, empty, success, disabled, validation, retry, and error states where applicable.
- Verify keyboard, focus, touch-target, VoiceOver/screen-reader, reduced-motion, and color-contrast behavior.
- Add behavioral tests for important user-visible behavior; do not rely only on snapshots.
- Typecheck, lint, relevant unit/integration/E2E tests, and production build must pass.
- No unrelated redesign/refactor may be bundled into the story.
- Validate at representative mobile widths and at least one desktop/full-width layout.
- Explicitly test for horizontal overflow, sticky-navigation regressions, and iOS Safari input behavior.

## Copilot / Claude Steering Document

### Product intent

This is not simply “add a seconds field.”

The existing UX caused the user to enter clock-looking values into a whole-minute input because the affordance was ambiguous.

The new design must make the model obvious without requiring explanation.

A user should immediately understand:

> “I am entering minutes here and seconds here.”

### Recommended component model

Prefer a reusable duration control instead of hand-building this only inside Additional Activity.

Conceptually:

```tsx
<DurationInput
  minutes={minutes}
  seconds={seconds}
  onChange={...}
  required
/>
```

The component should own:

- numeric parsing,
- seconds validation/normalization,
- accessibility labels,
- conversion to/from total seconds,
- mobile input modes.

This may later be reused for:

- duration-based workout prescriptions,
- timed sets,
- walks,
- mobility,
- cycling,
- yoga,
- manually entered Apple Health activities.

Do not immediately refactor every duration field in the app in this story, but design the control so reuse is straightforward.

### Canonical conversion helpers

Prefer pure tested utilities:

```ts
function durationPartsToSeconds(minutes: number, seconds: number): number
function secondsToDurationParts(totalSeconds: number): {
  minutes: number
  seconds: number
}
function formatDuration(totalSeconds: number): string
```

Example tests:

```ts
durationPartsToSeconds(23, 9) === 1389
durationPartsToSeconds(75, 20) === 4520

secondsToDurationParts(877)
// { minutes: 14, seconds: 37 }
```

### Server/API compatibility

Inspect the current Additional Activity API and persistence model before changing the UI.

If it currently accepts:

```json
{ "durationMinutes": 14 }
```

prefer extending toward second-level canonical precision rather than posting a decimal minute such as:

```json
{ "durationMinutes": 14.6166667 }
```

Decimal minute persistence will create rounding and display inconsistencies.

### Avoid ambiguous parsing

Do **not** infer that:

`1437`

means `14:37`.

That seems clever but is dangerous and inconsistent.

Use explicit fields.

### Accessibility

The two inputs must be unambiguous to assistive technology.

Good:

- `Duration minutes`
- `Duration seconds`

Avoid two controls both announced only as `Duration`.

### iOS Safari

Explicitly validate the flow shown in the screenshots:

1. Open Add Activity sheet/modal.
2. Focus Minutes.
3. Enter value.
4. Move to Seconds using keyboard navigation / Next.
5. Enter seconds.
6. Dismiss keyboard.
7. Confirm sheet remains correctly positioned.
8. Confirm sticky app navigation and modal boundaries are unaffected.
9. Confirm viewport does not horizontally scroll or remain zoomed.

### Future-compatible behavior

Apple Health frequently provides second-level or finer duration data.

Using total seconds now gives Setframe a clean path for future Apple Health sync and avoids throwing precision away when an imported activity lasts, for example, `23:09`.

### Out of scope

Do not:

- add hours as a separate input,
- redesign the entire Additional Activity modal,
- change distance entry,
- add live timers,
- change unrelated workout duration fields,
- alter historical activity semantics beyond the required migration/adapter.
