# Today's Workout — Table Logging Design Spec

**Status:** Design agreed in Figma, awaiting sign-off. Not implemented.
**Decision record:** `docs/adr/0011-set-logging-interaction-model.md`
**Companion:** `docs/design/workout-logging-interactions.md` — every control's behaviour
**Figma file:** `Setline` — key `pb64t99w7Um3FTeFiJ1riz`
**Inputs:** Hevy competitive teardown (`Backlog/research/`, 24 screens);
side-by-side session logging the same workout in both apps.

This document is the buildable spec for **layout and state**: measurements,
row states, colour and the rules a renderer needs. The *why* lives in ADR
0011. What each control **does when touched** — hit targets, the save
lifecycle, focus order, the sheets, motion, haptics, accessibility and
edge cases — is in `docs/design/workout-logging-interactions.md`.

---

## 1. Figma frames

All frames are built from the design system's `Semantic/*`, `Spacing/*`
and `Radius/*` variables, in Inter, matching the rest of the file.

| Frame | Page | Node |
|---|---|---|
| `SetRow/Mobile` (component set, 5 variants) | 📱 Mobile | `96:57` |
| `Screen/Mobile/WorkoutLoggerV2 — Active` | 📱 Mobile | `99:2` |
| `Screen/Mobile/WorkoutLoggerV2 — Logging` (keypad up) | 📱 Mobile | `107:179` |
| `Screen/Mobile/WorkoutLoggerV2 — Exercise complete` | 📱 Mobile | `102:58` |
| `Screen/Mobile/WorkoutLoggerV2 — Workout complete` | 📱 Mobile | `106:117` |
| `Screen/Mobile/WorkoutLoggerV2 — Scrolled` (sticky regions) | 📱 Mobile | `122:294` |
| `Screen/Mobile/WorkoutLoggerV2 — Set type sheet` | 📱 Mobile | `123:377` |
| `Screen/Mobile/WorkoutLoggerV2 — Exercise actions` | 📱 Mobile | `124:439` |
| `Spec/Mobile/WorkoutLoggerV2` (states + column model) | 📱 Mobile | `108:217` |
| `Spec/Mobile/WorkoutLoggerV2 — Interactions` | 📱 Mobile | `125:501` |
| `Screen/Web/WorkoutLoggerV2` (1280) | 🖥️ Web | `110:2` |
| `Screen/WebMobile/... — Active (390)` | 🖥️ Web | `120:398` |
| `Screen/WebMobile/... — Exercise complete (390)` | 🖥️ Web | `120:462` |

Direct link form:
`https://www.figma.com/design/pb64t99w7Um3FTeFiJ1riz/Setline?node-id=99-2`

The two `Screen/WebMobile/*` frames are literal clones of the mobile
frames. That is the parity claim made visible: mobile web is not a
separate design, it is the same 390px layout, and any divergence between
those frames and the `Screen/Mobile/*` ones is a bug in one of them.

---

## 2. Mobile layout (390px)

Screen padding 16 → content width **358**. Card padding 12 → table width
**334**.

### 2.1 Column widths, 390px

The row carries **4px of horizontal padding**. Without it the completed
row's green wash and the error row's red wash run flush into the `SET`
chip and the result mark, which reads as a rendering bug rather than a
state.

| Column | Width | Notes |
|---|---:|---|
| row padding | 4 + 4 | So a tinted row never touches its own content. |
| `SET` | 34 | Chip, 34×34, r8. Also the set-type control. |
| `PREVIOUS` | 74 | Last session's value for *this set index*. Tappable. |
| PR slot | 24 | **Reserved in every row**, empty unless the set is a PR. |
| `LB` | 70 | Input, 70×40, r8. |
| `REPS` | 70 | Input, 70×40, r8. |
| result mark | 24 | 24×24 ring. Not a control. |

`4 + (34 + 74 + 24 + 70 + 70 + 24) + (5 × 6 gaps) + 4 = 334`. Row height
**44** (touch target), rows gapped 4. The column header carries the same
padding and the same widths, or the labels stop sitting over their columns.

The PR slot is **reserved space, not a conditional element**. The badge
originally lived inside the `PREVIOUS` cell, right-aligned with
`SPACE_BETWEEN` — which pushed that row's previous value out of line with
every row above it. A fixed slot keeps the badge beside the number it
qualifies while leaving `PREVIOUS`, `LB` and `REPS` in the same place in
every row, PR or not.

Input value text is **16px** — this is not incidental. 16px is the
threshold below which iOS Safari zooms on focus, which is story 28's rule
and the reason the mobile-web table stays usable.

### 2.2 Exercise card

```
┌ card · Surface/Raised · Border/Subtle · r16 · pad 12 · gap 8 ┐
│ Bench Press          [Plan 3 × 8]                        ⋯  │  28
│ SET  PREVIOUS        LB       REPS                          │  14
│  1   225 × 8        [225]     [8]                        ✓  │  44
│  2   225 × 8  (PR)  [235]     [8]                        ✓  │  44
│  3   225 × 6        [225]     [ 8]                       ○  │  44
│ + Add set                                                   │  34
└─────────────────────────────────────────────────────────────┘
```

**A three-set exercise is 264px.** Two fit above the fold on a 390×844
screen with the session header. That number is the whole point of the
redesign, and it is the number to re-measure if the design drifts.

### 2.3 Vertical budget, 390×844

| Region | Height |
|---|---:|
| Session header | 76 |
| Body padding | 32 |
| Exercise card (3 sets) | 264 |
| Gap | 12 |
| Exercise card (3 sets) | 264 |
| **Total** | **648** |

A four-set exercise adds 48 (row + gap) → 312.

This budget is the view at scroll offset 0, where the header is its full
76px. Once scrolled it condenses to 48 (§10.2), returning 28px to content.

---

## 3. Row states

Component set `SetRow/Mobile` (`96:57`), variant property `State`.

| State | Treatment |
|---|---|
| `Empty` | No tint. Value cells show the **target** in placeholder tone (Regular / `Text/Disabled`); `PREVIOUS` is `Text/Primary` Regular, i.e. *more* prominent than the placeholder (see §3.1). Mark is an empty ring, `Border/Default`. |
| `Focused` | Active input takes a 2px `Action/Primary` border. No tint — nothing has been written yet. |
| `Saved` | Row tinted `Status/Success` @ 12%, r10. Mark is `Surface/Raised` with a `Status/Success` ring and check — the same treatment Today already uses (story 42.8). |
| `PR` | As `Saved`, plus a solid `Action/Primary` `PR` badge with inverse text, in the reserved slot immediately after `PREVIOUS`. The `SET` chip is unchanged — the chip's job is set *type*, the badge's job is achievement. |
| `Error` | Row tinted `Action/Destructive` @ 10%. **Values untouched.** Mark becomes a `↻` retry in `Action/Destructive`. |

Colour meanings, and how each is kept legible:

| Signal | Treatment |
|---|---|
| *planned* | purple, subtle tint — `Accent/100` fill, `Action/Primary` text |
| *record beaten* | purple, **solid badge** — `Action/Primary` fill, inverse text |
| *done* | green — `Status/Success` |
| *down on last session* | amber — `#F5A623` @ 16% wash, `Text/Primary` |

Purple appears twice and is separated by **form**, not hue: a solid badge
and a subtle pill never read alike even at a glance.

**Amber never carries text colour.** It appears only as a background wash
under dark text. An earlier pass used `Status/Caution` as the *foreground*
of the PR badge and measured **1.63:1**; the same colour as a 16% wash
behind `Text/Primary` measures **16.16:1**. The colour was never the
problem — using it for glyphs was.

### 3.1 Placeholder vs. previous

These are the two easiest things on the screen to confuse, and they are
adjacent. They are separated by weight and colour, not position:

- `PREVIOUS` — 13px Regular, `Text/Primary`, **unboxed**. Fact: what you
  did last time.
- entered value — 16px Semi Bold, `Text/Primary`, **in a bordered input**.
- placeholder — 13px Regular, `Text/Disabled`, in that same input. Target:
  what the plan says.

`PREVIOUS` was `Text/Secondary` until a contrast audit measured it at
**3.21:1** over a completed row. The hierarchy it was carrying with colour
now comes from size, weight and the presence of an input border, which is
where hierarchy belongs. Placeholders stay at `Text/Disabled` knowingly —
darkening them would make a target look like entered data, which is the
worse failure.

---

## 4. Columns follow the prescription

The table reads `prescriptionDefinitions[kind].fields` from
`packages/domain/src/prescription-fields.ts`. It does not re-decide per
screen.

`SET`, `PREVIOUS`, the PR slot and the result mark are **constant across
every kind**. Only the value columns change, and they divide the remaining
width evenly.

| Prescription kind | Value columns |
|---|---|
| `sets_reps`, `top_set_backoff`, `per_side` | `LB` · `REPS` |
| `bodyweight_reps` | `REPS` |
| `timed` | `TIME` (seconds) |
| `distance` | `DISTANCE` |
| `distanceDuration` | `DISTANCE` · `TIME` (minutes) |
| `duration` | `MINUTES` — one continuous effort, so this kind alone also drops the `SET` chip and has no set type |

`RPE` has **no column**. It was specified as an optional extra, off by
default and toggled per exercise from the ⋯ sheet; that option was removed
during the build-23 reskin. A field most sets leave blank was not worth a
column the 390px table cannot spare, and the toggle was the only control in
the actions sheet that changed the table's shape rather than doing something.

RPE is still stored on `workout_set` and is still editable per set from the
session summary's set sheet — this removes a column, not the data.

### 4.1 Set type in the SET chip

Tapping the set number opens the type sheet. Chip glyphs:

| Type | Glyph | Chip |
|---|---|---|
| Working | `1`, `2`, `3`… | `Surface/Sunken` fill / `Text/Primary` |
| Warm up | `W` | **no fill**, `Border/Default` outline / `Text/Primary` |
| Top set | `T` | `Accent/100` / `Action/Primary` (4.80:1) |
| Backoff | `B` | `Surface/Sunken` / `Text/Primary` |
| Drop set | `D` | `Status/Info` @ 20% / `Text/Primary` (14.59:1) |
| Failure | `F` | `Action/Destructive` @ 20% / `Text/Primary` (14.66:1) |

Warm-up still reads quietest — it is excluded from the completed-set count
(story 42.8) and the visual weight should match the arithmetic — but that
quietness now comes from an **outlined** chip rather than dimmed text.
`Text/Disabled` on `Surface/Sunken` measured 1.46:1. Every glyph is
`Text/Primary` except Top set, whose accent-on-accent pairing clears AA on
its own.

---

## 5. The save model

There is no Save control in the table, and the check is not one either.

1. A row writes itself **when focus leaves it** and every field its
   prescription marks required holds a value. A half-filled row is not
   written; nothing is lost and nothing is nagged.
2. The mark **reports** that write. Feedback, not action — hence a
   ring-and-check achievement mark, not a checkbox.
3. Editing a saved row costs one tap: select the field, change it, move
   on. The row rewrites itself on blur under the same rule. This is what
   makes corrections after completion free.
4. A failed write keeps the values on screen and turns the mark into a
   retry. Optimistic updates must roll back **visibly**.
5. Completion is derived, never declared. An exercise is complete when
   every planned row is written. Warm-ups do not count.

### 5.1 Keyboard accessory bar

With the keypad up (`107:179`), a bar sits above it carrying `‹ ›` field
navigation, the current context (`Bench Press · set 3 reps`), and a
primary **Next set** action. `Next` advancing focus out of the row is
what commits it — the commit is a side effect of moving on, which is the
whole model in one control.

---

## 6. Completion

### 6.1 Exercise complete (`102:58`)

Nothing moves. The card's height and position are identical to its active
state — **264px in both**, verified in Figma. What changes:

- the plan pill is replaced, **in the same slot**, by the result pill;
- rows take the `Saved`/`PR` tint;
- the card border becomes `Status/Success` @ 45%.

Result pill content is total volume plus its delta against last session:

| Case | Pill | Treatment |
|---|---|---|
| Up | `5,480 lb · +80 lb` | Solid `Status/Success`, `Text/Primary` (7.98:1) |
| Matched | `2,100 lb · Matched last session` | `Status/Success` @ 16%, `Text/Primary` |
| Down | `4,900 lb · −140 lb` | `#F5A623` @ 16%, `Text/Primary` (16.16:1) — stated plainly, not hidden |
| No history | `3,200 lb · First time` | `Surface/Sunken`, `Text/Primary` — the comparison is omitted, never faked |

Pill text is `Text/Primary`, not inverse: white on `#00c48c` measures
**2.26:1**. Setframe's success green is light enough that it only ever
takes dark text.

Volume, not set or rep count: an extra set at lower reps is not progress.
This is `compareWithPreviousSession` in
`packages/domain/src/completed-exercise.ts`, unchanged.

### 6.2 Workout complete (`106:117`)

The session's strongest reward, and the only place a green gradient
appears. A banner replaces the session header: ring-and-check, "Workout
complete", the session meta line, and the total volume at 32px with its
week-over-week delta. Every card below stays fully editable.

Completed exercise cards deliberately do **not** carry a gradient. On
this screen every card is complete; gradients on all of them made the
page uniformly green and erased the distinction between the exercise
reward and the session reward.

---

## 7. Web

### 7.1 Mobile web (390)

Identical to the mobile frames — same component, same measurements. The
clones listed in §1 exist so that claim can be checked rather than
asserted. They are re-cloned whenever `SetRow` changes, so their node IDs
move — §1 is the current index.

### 7.2 Desktop (1280, `110:2`)

Content is a centred 760px column; the table is 720px. The extra width was
specified to buy the **RPE column** rather than stretch LB and REPS. With
the column removed (§4) the 130px it held is now free; desktop is a web
target and web is being retired, so the reallocation is left unspecified
rather than guessed at.

| Column | 390 | 1280 |
|---|---:|---:|
| row padding | 4 + 4 | 4 + 4 |
| `SET` | 34 | 40 |
| `PREVIOUS` | 74 | 158 |
| PR slot | 24 | 30 |
| `LB` | 70 | 140 |
| `REPS` | 70 | 140 |
| `RPE` | — | removed |
| mark | 24 | 26 |
| gap | 6 | 8 |

`4 + (40 + 158 + 30 + 140 + 140 + 130 + 26) + (6 × 8 gaps) + 4 = 720` was
the sum while `RPE` was in it; it no longer adds up and is kept only to show
what the 130px was. Row
height 48; card padding 20; a three-set exercise is 306px.

---

## 8. What today's screen keeps

Explicitly preserved from the current implementation, because they were
called out as working:

- **Planned sets/reps** — now a pill in the exercise header (`Plan 3 × 8`)
  plus per-field placeholder targets in unlogged rows.
- **Last session's sets/reps** — promoted from a separate card *above* the
  sets to a column *inside* the row it applies to.
- **Volume delta and "Matched last session"** — the result pill, on the
  exercise; and the banner, on the session.
- **Corrections after completion** — now cheaper than before: one tap.
- **Warm-up exclusion from the completed count** — story 42.8, unchanged,
  and now reflected in how quiet a warm-up chip reads.

## 9. Contrast

Every text/background pair in these frames was measured against WCAG AA
(4.5:1 for normal text). Six pairs failed the first pass and all six are
fixed above: the PR badge (1.63), the result pill (2.26), the Failure chip
(2.41), the Drop chip (2.75), the `SET` glyph (3.11) and `PREVIOUS`
(3.21), plus the warm-up chip at 1.46.

Amber returns in §6.1 as the Down pill's background wash, which is a
different use from the one that failed: as a wash under `Text/Primary` it
measures 16.16:1.

Two failures are **left alone deliberately**, because they are pre-existing
token pairings used across shipped screens and changing them is a
design-system decision, not one about this screen:

| Pairing | Ratio | Where |
|---|---:|---|
| `Text/Secondary` on `Surface/Sunken` | 3.11 | chips, sunken rows, app-wide |
| `Text/Disabled` on `Surface/Sunken` | 1.46 | dimmed states, app-wide |

Both are worth their own pass. Neither is introduced by this design.

## 10. Sticky regions and scrolling

See `Screen/Mobile/WorkoutLoggerV2 — Scrolled` (`122:294`), which is the
only frame that shows content passing *under* the fixed regions.

**Two regions are fixed on mobile. Everything between them scrolls.**

| Region | Height | Behaviour |
|---|---:|---|
| Session header | 76 → **48** | Fixed to the top. Condenses on first scroll. |
| Bottom bar (`+ Add exercise`) | 76 | Fixed to the bottom. Hidden while the keypad is up. |

### 10.1 Why the header is fixed

`Finish` must be reachable at any scroll position. A workout is finished
from wherever the user happens to be — usually the bottom of a long list —
and making them scroll back to the top to end a session they have already
ended in the gym is the kind of friction that gets an app closed mid-set.
Elapsed time is ambient status and belongs in the same place for the same
reason.

### 10.2 The condensed state

At scroll offset 0 the header is the full 76px: title at 18px on its own
line, then the meta line (`elapsed · volume · sets`). On any scroll past 0
it condenses to 48px in a single row: back chevron, title at 15px,
elapsed time inline, `Finish`. **Running volume is dropped, not shrunk** —
every completed card carries its own volume in its result pill, so the
running total is the least load-bearing thing on the line.

That is 28px returned to the content, roughly a third of a set row, and it
matters most on the screens where it is scarcest.

The condensed header carries a soft drop shadow (`y 2, blur 8, black 8%`).
Content scrolls *under* it, so it needs a layering cue; a hard border reads
as a divider between two static regions rather than as an overlay.

### 10.3 Scroll-into-view must clear both regions

**This is the implementation trap.** When a row takes focus, the app scrolls
it into view — and "into view" must mean *into the visible area between the
fixed regions*, not merely inside the viewport. A row scrolled flush to the
viewport's bottom edge sits behind the bottom bar or behind the keypad.

There is precedent in this repo: `ExerciseWorkCard.tsx` already carries a
`STICKY_ACTIONS_CLEARANCE_PX` constant for exactly this reason, and a
`scroll-margin-bottom` that was very nearly deleted as an orphan during a
cleanup. Clearances for the new layout:

| | Clearance |
|---|---:|
| Top | 48 (condensed header) |
| Bottom, keypad closed | 76 (bottom bar) |
| Bottom, keypad open | 280 (accessory 48 + keypad 232) |

### 10.4 The keypad replaces the bottom bar

They never coexist. Two stacked bars would take 124px off an 844px screen
before the keypad's own 232px, leaving under half the viewport for the
table. When the keypad opens, the bottom bar hides and the keyboard
accessory bar (§5.1) takes its place — the accessory carries the action
that matters while typing (`Next set`), so nothing is lost.

### 10.5 Safe areas and viewport units

- The bottom bar's 20px bottom padding is the home indicator. It must come
  from `env(safe-area-inset-bottom)`, not a literal — the frames are drawn
  at a nominal 390×844 with no device chrome.
- Likewise the header needs `env(safe-area-inset-top)`; its real height on
  device is 48 + inset, not 48.
- The scroll container is sized in `dvh`, not `vh`. Story 20 fixed exactly
  this in `Modal.tsx`: iOS Safari's chrome resizes the visual viewport, and
  `vh` does not follow it, which puts the bottom bar under the browser UI.

### 10.6 Web

At 1280 only the header is sticky. There is no fixed bottom bar —
`+ Add exercise` sits inline after the last card, because a desktop
viewport is tall enough not to need one and fixed chrome on a wide screen
is spent space. The header does not condense on desktop either; 76px of a
tall window is not worth reclaiming.

On mobile web the 390px layout applies unchanged, including both fixed
regions.

---

## 11. What is deliberately not here

- **Rest timer.** In the teardown's "adapt later" list; it needs its own
  decision about per-exercise defaults and background behaviour.
- **Exercise illustrations and muscle labels.** Explored separately and
  additively in `docs/design/exercise-examples-exploration.md` (Figma
  section `🔬 Exploration — Exercise examples`). Nothing in this spec
  changes for it. Muscle labels turn out to need no schema work;
  illustrations still need a media pipeline we do not have.
- **Collapsing finished exercises.** At 264px an exercise no longer needs
  to collapse. Whether a *long* session wants it is a separate question;
  do not answer it by keeping the current disclosure by default.
