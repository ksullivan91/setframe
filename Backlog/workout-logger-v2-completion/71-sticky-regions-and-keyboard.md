# Story 71 — Sticky Regions and the Keyboard

**Priority: P1.** The sticky regions exist; the behaviour specified around
them does not. One item here is a real defect rather than polish.

Spec: `docs/design/workout-logging-table.md` §10. Frame: `122:294`.

## 1. Scroll-into-view must clear both fixed regions — the actual bug

**This is the item that matters.** When a row takes focus the app scrolls it
into view, and "into view" must mean *into the visible area between the fixed
regions*, not merely inside the viewport. A row scrolled flush to the bottom
edge sits behind the bottom bar, or behind the keypad.

| | Clearance |
|---|---:|
| Top | 48 (condensed header) |
| Bottom, keypad closed | 76 (bottom bar) |
| Bottom, keypad open | 280 (accessory 48 + keypad 232) |

There is precedent in this repo: `ExerciseWorkCard.tsx` carries a
`STICKY_ACTIONS_CLEARANCE_PX` constant for exactly this, and a
`scroll-margin-bottom` that was nearly deleted as an orphan during a cleanup.

## 2. Condensing header

76px → 48px on first scroll. Single row: back, title at 15px, elapsed inline,
`Finish`.

**Running volume is dropped, not shrunk** — every completed card carries its
own volume in its result pill, so it is the least load-bearing thing on the
line. That returns 28px, about a third of a set row.

The condensed header takes a soft drop shadow (`y 2, blur 8, black 8%`).
Content scrolls *under* it, so it needs a layering cue; a hard border reads as
a divider between two static regions.

## 3. Keyboard accessory bar

Spec §5.1 / §8. Above the keypad: `‹ ›` field navigation, the current context
(`Bench Press · set 3 reps`), and a primary **Next** action.

| Situation | Label and behaviour |
|---|---|
| Mid-row | Advances within the row. Nothing written — the row has not been left. |
| Last field of a row | **Next set** — leaves the row, which commits it, and focuses the next row's first field. |
| Last row of an exercise | **Next exercise** — commits, moves on, scrolls clear of both regions. |
| Last row of the session | Commits and dismisses the keypad. **Does not auto-finish.** |

**No auto-advance on commit.** Committing a row never moves focus by itself.
A phone on a bench takes stray taps; auto-advance puts the cursor somewhere
the user is not looking and the next digits land in the wrong set.

## 4. The keypad replaces the bottom bar

They never coexist. Stacked they take 124px off an 844px screen before the
keypad's own 232.

## Acceptance criteria

1. Focusing any row scrolls it fully clear of both fixed regions, with the
   keypad open and closed. Assert against the clearance table, not by eye.
2. The header condenses on scroll and restores at offset 0.
3. `Next` commits when and only when it leaves a row.
4. Reaching the last row dismisses the keypad and does not finish the session.
5. The bottom bar is absent whenever the keypad is up.
6. Safe-area insets are respected on both platforms — web via `env()`, mobile
   via `useSafeAreaInsets`, which the v2 screen already reads.
