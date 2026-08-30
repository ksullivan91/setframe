# Story 70 — Complete the Interaction Contract

**Priority: P0.** Behaviours the interaction spec calls for that were never
built. Each is small; together they are the difference between a table that
looks right and one that behaves as specified.

## 1. Copy previous (spec §2)

`onCopyPrevious` is a no-op. Tapping the `PREVIOUS` cell should copy last
session's values for that set index into the row's inputs and leave focus in
the weight field.

**It fills; it does not commit.** The row still writes itself on blur under
the normal rule. A user who taps `PREVIOUS` and then walks away has changed
nothing.

The cell is already disabled and shows `—` when there is no previous session.

## 2. Finish confirmation (spec §4)

`Finish` currently completes the session silently regardless of state. When
planned rows are unwritten it must confirm:

> **Finish with 3 sets unlogged?**
> They stay unlogged. A finished workout is still editable, so you can add
> them later.
> **Finish workout** (primary) · **Keep going** (secondary)

With every planned row written, it finishes immediately — no modal.

`Finish` stays **enabled in both cases**. An unfinished workout is an ordinary
outcome; a disabled button there is the product arguing with the gym.

Unwritten rows are **discarded, never written as zeros**. A `0 lb × 0` row
drags volume, averages and PR comparisons down while looking like real data.

## 3. Undo on delete (spec §5)

Deleting a written set shows an undo toast for 5 seconds. Undo restores the
row with its values **and its PR flags**.

Both platforms already have a `Toast` component.

## 4. The last set (spec §5)

Cannot be deleted. An exercise with zero sets is a state with no meaning and
no way back — remove the exercise instead. Enforce in the type sheet.

## 5. Haptics (spec §10, mobile only)

- Row commits → light impact. Confirms the save without looking, which is the
  point: the user is often watching the bar, not the phone.
- PR → success notification, **once per PR set**. Not repeated on a correction
  that keeps the PR.

## Acceptance criteria

1. Tapping `PREVIOUS` fills both inputs and focuses weight, without writing.
2. Leaving the row after a copy commits it exactly as typing would.
3. `Finish` with unlogged rows confirms; with none, it does not.
4. Unwritten planned rows are absent from the session afterwards, not zeroed.
5. Deleting a written set can be undone within 5s, restoring PR flags.
6. The delete option is absent when one set remains.
7. Haptics fire on mobile and are absent on web.
