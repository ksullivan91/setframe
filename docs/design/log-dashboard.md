# The Log dashboard

**Status:** Designed, not built. Signed off 2026-09-03.
**Figma:** `Dashboard v3 — bolder` (`388:357`) on the 🏠 Today page —
14 frames, 41 prototype connections, five flow entry points.
Supporting: `Session shapes — flexible stats` (`392:180`),
`Spec/Health states` , `Spec/Optimistic saving`.
**Decisions:** ADR 0013 (day view, tab shape), ADR 0014 (auto-close).
**Stories:** `Backlog/log-dashboard/` — 75–83.

This is the reasoning behind the frames. The frames are the spec for
*what* to build; this is the record of *why*, and of the traps found
while designing that will not be visible in a screenshot.

---

## 1 · What the screen is

One day, browsable. `Today` is the default date, not the screen's
identity. The order is fixed and means something:

```
header        date control (Today ▾) + avatar → account
week strip    seven days, adherence state, tap to travel
[streak]      only when there is one
hero          the day's single decision, dark, unmistakable
ALSO TODAY    four body signals → Trends
YOUR LOG      weight · activity · journal
tab bar       Log · Training · Progress · Trends
```

The hero is the only thing on the screen with a primary button. That is
the fix for "a bunch of random stuff": everything below the hero is the
record of the day, and everything about depth lives in Trends.

## 2 · The week strip encodes adherence, not volume

An earlier pass drew bar heights from each day's training volume. It was
rejected in review, correctly: **volume-as-height says taller is better,
which is false inside a program.** A light accessory day is supposed to
be light; a short bar would read as failure on a day executed perfectly.

The encoding is what the day *was*:

| Mark | Meaning |
|---|---|
| filled ✓ | trained |
| filled — | rest |
| empty ring | not trained (past) or not yet (future) |
| accent ring around the mark | the selected date |
| accent dot above the letter | today |

Today and selected are **different marks**, because the moment you
browse to another date they are different days. An early pass used one
treatment for both and broke the instant you navigated.

## 3 · The six training states, and the one that is really two

`today.tsx` derives these in strict precedence order. Do not reorder
them; each position is load-bearing and commented in the source.

1. `in-progress` — an active session exists. Wins over everything.
2. `completed` — a completed session for the date.
3. `rested` — a rest day is logged.
4. `no-program` — no active program.
5. `scheduled` — a `dayTypeId` resolved for the date.
6. `unscheduled` — active program, nothing lands on this date.

**`unscheduled` conflates two different situations** and the copy is
wrong for one of them. A program with *no workouts built at all* and a
program *whose schedule has nothing on Wednesday* both land here, so the
screen offers "Choose workout" when there may be none to choose. Split
it: `program-empty` ("Your plan is empty" → Add a workout) and
`unscheduled` ("Your call today" → pick one of your workouts, or rest).

## 4 · Session shapes: not everything has sets

There are **eight** prescription kinds in `packages/schemas`
(`sets_reps`, `top_set_backoff`, `per_side`, `timed`, `distance`,
`duration`, `distanceDuration`, `bodyweight_reps`), and every screen
downstream of them assumed the first. A treadmill walk currently renders
as `1 set · 0 volume lb · 0 PRs`.

The hero's stat row reads `prescription.kind`:

| Kind | Stats |
|---|---|
| `sets_reps`, `top_set_backoff`, `per_side` | sets · volume lb · PRs |
| `bodyweight_reps` | sets · total reps · PRs |
| `duration`, `timed` | duration · distance · avg bpm |
| `distance`, `distanceDuration` | distance · duration · pace |

**The domain must change first.** `buildCompletedSessionReadout` computes
only volume, set count and PRs, and `formatSessionTotalSuffix` returns
the string literal `'lb total'`. Making the UI adaptive without fixing
the readout just moves the wrong number.

Fields appear only when something measured them — distance and heart
rate on a walk come from the Watch, and the card says so rather than
implying we tracked them.

## 5 · Health: "declined" is not a state we can detect

iOS never reports read-permission denial.
`getRequestStatusForAuthorization` returns only `not_asked` or `asked`,
so a refusal and a granted-but-empty day are **indistinguishable to us**.
`useHealthConnection` already folds both into `no_data`, with a comment
saying so.

Four states, therefore, not five:

| State | Treatment |
|---|---|
| `connected` | the four-metric strip, linking into Trends |
| `not_connected` | an offer, not an error — nothing is broken, they have not been asked |
| `no_data` | *"No health data yet — if you meant to share it, check Setframe in the Health app."* Correct whether they declined or simply have not synced |
| `unavailable` | the section is not rendered. An offer that cannot be accepted is worse than silence |

Any copy that says "you declined" is a guess that is wrong half the time.

## 6 · Optimistic saving

`WorkoutSessionScreenV2` already establishes the contract: `onMutate`
writes the value into the cache and returns `previous`, `onError`
restores `previous`, `onSuccess` clears the flag. The Log rows follow it
exactly.

- **pending** — the value is on screen the instant Save is tapped, with a
  muted dot. No spinner, no disabled control, sheet already dismissed.
- **settled** — the flag clears. Nothing announces success; the value
  being there is the success.
- **error** — `previous` is restored and the row says so *in place*, with
  Retry. A toast covers the network case, because a row can scroll away.

Two rules that are not obvious:

**The journal does not roll back.** Rolling a set row back is safe — the
number is still in the input beside it. A journal entry is prose typed
into a sheet that has already closed; discarding it to match the server
destroys the only copy. Keep the text, mark it unsent, retry.

**Not everything can be optimistic.** Start workout must wait: the route
is `/workout/[sessionId]` and only the server can mint that id. Rest day,
weight, journal and activity can all be optimistic — the client already
knows the entire result.

## 7 · Palette gaps this design ran into

Three, all pre-existing, none introduced here:

- `text.disabled` (`#a9a9bc`, **2.31:1** on white) is used as ordinary
  text — eyebrows, field labels, notes, a CTA label — in **43 shipped
  call sites**. AA wants 4.5:1. The new screens use `text.secondary`
  (`#65658b`, 7.0:1).
- `status.error` (`#FF647C`, **2.85:1**) fails as text. The delete button
  already ships this. Error rows here put the colour in a dot and the
  meaning in words at `#A11133` (7.1:1), so state never depends on colour
  alone. **The error ramp has no text-safe step; it needs one.**
- The `Setline/Spacing` variable collection is 4/8/12/16/24/32/40/48 and
  matches `packages/design-tokens` exactly, but the frames had drifted
  off it. All 88 mobile frames were re-bound on 2026-09-03 (280 → 4,098
  bound). **A value measured off a frame is not authority — check it
  against the scale before porting it into code.**

## 8 · Deliberately not designed

Named so nobody assumes they were missed: a failed-sync / offline day; a
*partial* HealthKit day where `completeness` is not `complete`; travel
and DST shifting `local_date` under a rendered week; nutrition anywhere
in Trends; and the fold — every frame is 1000–1400pt of scroll content,
so where content lands on a real device is unverified.
