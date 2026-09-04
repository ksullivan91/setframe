# Today's Workout — Interaction Spec

**Status:** Design agreed in Figma, awaiting sign-off. Not implemented.
**Companion to:** `docs/design/workout-logging-table.md` (layout, states, measurements)
**Decision record:** `docs/adr/0011-set-logging-interaction-model.md`
**Figma:** `Spec/Mobile/WorkoutLoggerV2 — Interactions`, node `125:501`

Every control on this page, what it does, and what it deliberately does
*not* do. The layout spec answers "what does this look like"; this answers
"what happens when I touch it".

---

## 1. Figma frames

| Frame | Node |
|---|---|
| `Spec/Mobile/WorkoutLoggerV2 — Interactions` | `125:501` |
| `Screen/Mobile/WorkoutLoggerV2 — Set type sheet` | `123:377` |
| `Screen/Mobile/WorkoutLoggerV2 — Exercise actions` | `124:439` |
| `Screen/Mobile/WorkoutLoggerV2 — Scrolled` (sticky regions) | `122:294` |
| `Screen/Mobile/WorkoutLoggerV2 — Correcting after completion` | `139:574` |
| `Screen/Mobile/WorkoutLoggerV2 — After the correction` | `139:707` |

---

## 2. Hit targets in a set row

Four of the six cells are interactive; two are not.

| Target | Behaviour |
|---|---|
| `SET` chip | Opens the set-type sheet (§9.1). Also where a set is **deleted**. |
| `PREVIOUS` cell | Copies last session's values for this set index into the inputs and leaves focus in the weight field. It **fills**, it does not commit — the row still writes on blur under the normal rule. |
| `LB` / `REPS` input | Focuses the field, raises the numeric keypad, and **selects the value whole** so overwriting is one keystroke rather than a backspace-hold. |
| Result mark | **Not interactive** when empty or saved — it is a readout. In the error state only, it becomes a retry button named "Retry saving set 3". |
| Row background | Nothing. No row-level tap, **no swipe gesture**. |

**Why no swipe-to-delete.** A swipe beside numeric inputs, operated with
chalky hands between sets, is a data-loss vector rather than a
convenience. Delete already has a home in the type sheet, two deliberate
taps away.

**The mark is the thing most likely to be built wrong.** It looks like a
checkbox and is not one. If it ends up with an `onClick` in any state
other than `error`, the save model has been misread.

---

## 3. Session header

Fixed to the top, condensing 76px → 48px on first scroll (layout spec §10).

| Control | Behaviour |
|---|---|
| Back `‹` | Returns to Today. **The session keeps running** — not paused, cancelled, or finished. |
| Title | Not interactive. Names the day type; it is not a link to the template. Editing the plan mid-session is what ADR 0005 exists to prevent. |
| `elapsed · volume · sets` | Not interactive. Ambient status. The set count excludes warm-ups, matching the completed-set rule. |
| `Finish` | Always enabled, never disabled. See §4. |

**Elapsed time is derived from the session's start timestamp on the
server**, never from a client-side interval. Leaving the screen,
backgrounding the app, or killing it entirely cannot drift it — and a
timer that reads 04:12 after a 50-minute session is the kind of bug that
makes a user distrust everything else on the page.

---

## 4. Finishing a workout

`Finish` is always enabled. An unfinished workout is an ordinary outcome —
people get interrupted, equipment is taken, a shoulder complains — and a
disabled button in that moment is the product arguing with the gym.

| Case | Behaviour |
|---|---|
| All planned rows written | Marks the session complete and swaps the screen into the Workout complete state **in place**. No navigation, no modal. |
| Some rows unwritten | Confirmation sheet: **"Finish with 3 sets unlogged?"** / "They stay unlogged. A finished workout is still editable, so you can add them later." / **Finish workout** (primary) · **Keep going** (secondary). |
| Unwritten planned rows | **Discarded, never written as zeros.** |
| After finishing | Every row stays editable under the same blur rule. Finishing is a status change, not a lock. |
| Finish twice | Idempotent. `PATCH /v1/workout-sessions/:sessionId` with `status: 'completed'` on an already-completed session is a no-op. |

**Never write unlogged sets as zeros.** A `0 lb × 0` row would drag
volume, averages and PR comparisons down while looking like real data —
the one corruption that stays invisible until a chart looks wrong months
later.

---

## 5. Adding and deleting sets

| Action | Behaviour |
|---|---|
| `+ Add set` | Appends a row below the last, carrying the last **working** row's set type and values as placeholders, unwritten. Focus moves to its weight field and the keypad opens. |
| Delete a set | `SET` chip → type sheet → "Delete set n". One deliberate path. |
| Deleting a written set | Undo toast for 5s. Undo restores the row with its values **and its PR flags**. |
| Deleting a middle set | Rows below renumber immediately. Nothing else moves. |
| The last remaining set | Cannot be deleted — remove the exercise instead. An exercise with zero sets is a state with no meaning and no way back. |

Adding a set and logging it is one gesture, not two: the new row arrives
focused with the keypad already up.

---

## 6. Set numbering

The number in the chip is **positional, not an identity**.

| Rule | Detail |
|---|---|
| Counted types | Working, top set, backoff, drop set and failure share one ascending sequence: 1, 2, 3… |
| Warm-ups | Show `W` and take no number, wherever they sit in the order. |
| Insert / delete / retype | Renumbering is immediate. Changing set 2 from working to warm-up turns it into `W` and pulls every number below it down by one. |

Warm-ups are unnumbered because they are excluded from the completed-set
count (story 42.8) — numbering them would contradict the count printed
directly above them.

**What to key on:** `workout_set.id` is identity, `sortOrder` is order.
Never key a request, a test selector, or an optimistic-update lookup on
the displayed number — it changes under you the moment a type changes.

---

## 7. The save lifecycle

```
blur ──▶ optimistic ──▶ request ──▶ settle
focus     mark + tint    PATCH       confirm silently,
leaves    paint at       /v1/        or roll back
the row   once           workout-    visibly
                         sets/:id
```

The user should only ever notice the first two stages.

| Concern | Rule |
|---|---|
| What commits | Blur **and** every field the prescription marks required holding a value. Optional fields (set type) never block a write. A half-filled row is silently not written. |
| Optimistic paint | Immediate, **no spinner**. A spinner on a sub-second write is more disruptive than the write. |
| Debounce | Writes for one row coalesce over **400ms**, so weight → reps → out is one request, not two. Different rows never coalesce with each other. |
| Slow request | After **1.5s** with no response the mark shows a quiet pending ring. This stage should normally never be seen. |
| Failure | Mark rolls back to the error state, **every entered value is kept**, retry lives on the mark. |
| Offline | Rows queue; the header shows an offline chip. Queued rows keep the **pending ring, not a check**. |

**Failure is never a toast alone.** A toast about row 3 that appears while
the user is looking at row 5 is not error recovery. The failure has to be
visible on the row it belongs to.

**A save that has not happened must never look like one that has.** This is
the single rule that makes silent autosave trustworthy enough to remove
the Save button in the first place.

---

## 8. Focus and keyboard order

Mid-workout the keypad is up almost continuously, so the accessory bar's
`Next` is the most-pressed control on the page after the digits.

| Situation | Behaviour |
|---|---|
| Order within a row | Weight → reps. Set type is **not** in the tab order; it is a sheet. RPE was in this order while it had a column; that column was removed in build 23 (see `workout-logging-table.md` §4). |
| `Next`, mid-row | Advances within the row. Nothing is written — the row has not been left. |
| `Next`, last field of a row | Leaves the row (**commits it**) and moves to the first field of the next row. Label reads "Next set". |
| `Next`, last row of an exercise | Commits, moves to the next exercise, and scrolls it clear of both fixed regions. Label reads "Next exercise". |
| `Next`, last row of the session | Commits and dismisses the keypad. **Does not auto-finish.** |
| Web `Tab` / `Shift-Tab` | Same order, both directions. `Enter` behaves as `Next`. `Escape` blurs, which commits if the row qualifies. |

**No auto-advance on commit.** Committing a row never moves focus by
itself. A phone sitting on a bench takes stray taps; auto-advance moves
the cursor somewhere the user is not looking, and the next thing they type
lands in the wrong set.

---

## 9. Sheets

### 9.1 Set type (`123:377`)

Opened from the `SET` chip. Header names the set and exercise ("Set 3 ·
Bench Press"). Options, each with its chip glyph and a one-line
explanation: Working set, Warm-up, Top set, Backoff, Drop set, Failure.
Current type is checked and tinted. A destructive **"Delete set n"** sits
below a divider.

Selecting a type applies it immediately and closes the sheet — no confirm
step for a reversible, single-field change.

### 9.2 Exercise actions (`124:439`)

Opened from the card's `⋯`. Header names the exercise and its context
("3 sets planned · last done 20 Aug").

| Action | Note |
|---|---|
| View history | Every session logged for this exercise. |
| Add a note | Cues, setup, how it felt — kept with **this session**, not written back to the template. |
| Replace exercise | Swap the movement, keeping the sets already logged. |
| Reorder exercises | Enters reorder mode for the session. |
| Remove exercise | Destructive, below a divider. |

"Add a note" writing to the session and never to the template is ADR 0005
in miniature: today's customisation must never mutate training intent.

---

## 9a. Editing after completion

**Completed does not mean immutable** — story 23's product principle, already
shipped for the current design. Nothing about the save model changes when a
workout is finished; what changes is what recalculates.

Frames: `139:574` (mid-edit) and `139:707` (settled).

### Worked example — a correction that revokes a PR

Set 3 of Bench Press was logged `235 × 8` and flagged a PR. The user
corrects it to `225`. On blur, four things change at once:

| | Before | After |
|---|---|---|
| Set 3 PR badge | shown | **gone** |
| Exercise pill | `5,480 lb · +80 lb` | `5,400 lb · Matched last session` |
| Session total | `11,240` | `11,160` |
| Week delta | `+420 lb` | `+340 lb` |
| Banner meta | `11 sets · 1 PR` | `11 sets` |

Nothing moves. Every figure is derived, so every figure updates.

### Rules

| | |
|---|---|
| The save model | **Identical.** The row writes itself on blur once its required fields hold values. No edit mode, no Edit button, no Save button — a completed workout is the same table it was a minute earlier. |
| Session status | **Never changes.** Editing must not reopen or reactivate the session (story 23 AC). It stays `completed`, the banner stays, the user stays in the review context. |
| What recalculates | Everything derived: the exercise's volume and delta pill, PR flags across the whole exercise log, the session total, the week-over-week delta, and downstream history and progress. |
| PR revocation | A correction can demote a set that was a record, and the badge **must visibly disappear**. Silently keeping a badge on a corrected set is the worst outcome here. |
| Clearing a required field | Treated as **unlogging** that set, not as an error. The row returns to `Empty`, its tint and mark clear, and the pill recalculates over the remaining sets. Exercise and session both stay complete — you did do the other sets. If the row should not exist at all, that is **Delete**, from the set-type sheet. |
| Adding a set | Allowed. `+ Add set` is present on a completed workout and behaves exactly as mid-session. |
| No re-celebration | The banner does not re-animate and no haptic fires. Motion marks the transition *into* completion, not every subsequent keystroke. Numbers update in place. |
| Historical sessions | Same rules, different entry point — reached from history rather than from finishing, so there is no banner. **No time limit**: completed does not mean immutable at one day or at six months. |

### What the API already does

`recalculateLogPrFlags` in `apps/api/src/routes/workout-sessions.ts` resolves
the **entire** exercise log from scratch on every set mutation, because a set
is only a record relative to the sets around it — creating, editing, deleting
or reordering any set can promote or demote any other.

`PATCH /v1/workout-sets/:setId` carries **no session-status guard**, so a
completed session already accepts edits. Nothing new is needed server-side.

**Concurrency caveat, from the code's own comment:** neon-http has no
interactive transactions, so two concurrent edits to the same exercise can
leave one stale PR flag. It self-heals on the next mutation, and both clients
refetch between saves. Worth knowing before someone edits one session on two
devices.

---

## 10. Motion, haptics and accessibility

| Concern | Rule |
|---|---|
| Row commits | Tint and mark cross-fade, **180ms** ease-out. No scale, no bounce — this fires up to 30 times a session. |
| Exercise completes | Result pill cross-fades in as the plan pill fades out, **220ms**, same slot. Border tints over the same duration. Layout does not change, so there is nothing to animate into place. |
| Workout completes | Banner slides down 8px and fades in, **300ms**. The only motion with any travel, matching its place at the top of the reward hierarchy. |
| `prefers-reduced-motion` | All of the above become instant state swaps. Nothing conveys meaning through movement, so removing it costs nothing. |
| Haptics · row commits | Light impact. Confirms the save without looking — the user is often watching the bar, not the phone. |
| Haptics · PR | Success notification, once per PR set. Not repeated on a correction that keeps the PR. |
| Screen reader · row | A group named "Set 3, previous 225 by 8". Fields carry their own labels. The mark is `aria-live="polite"` and announces "Set 3 saved" / "Set 3 failed to save, retry available". |
| Screen reader · not a grid | Built as a **list of groups, not a data grid**. Grid semantics force cell-by-cell navigation on a screen whose whole purpose is quick entry into two fields. |
| Touch targets | Row height 44; every interactive cell fills it. The mark draws at 24px but its hit area is the full 24 × 44 cell. |
| Contrast | Every pairing measured — layout spec §9. **State is never carried by colour alone**: the mark's glyph changes with its colour in every state. |

---

## 11. Edge cases

| Case | Behaviour |
|---|---|
| No previous session | `PREVIOUS` shows `—` and is not tappable. The result pill reads "First time" rather than faking a comparison. |
| First-ever workout | Same as above for every row. Nothing about the layout changes. |
| Long exercise name | Truncates with an ellipsis at the plan pill; the pill and `⋯` never move. Full name is in the exercise sheet header. |
| Four-digit weight | Inputs hold `1,225` at 16px in 70px. Beyond that the value shrinks one step rather than the column widening — column widths are fixed so rows stay aligned. |
| Ad-hoc exercise added mid-session | No plan pill, no placeholders, `PREVIOUS` from history if the exercise has any. |
| Session left open overnight | Elapsed keeps counting from the server timestamp. Reconciliation is unaffected — workouts are always our DB, never HealthKit. |
| Two devices, same session | Last write wins per set, scoped by `request.userId`. Rows are independent, so concurrent edits to different sets cannot conflict. |
| Prescription with no planned values | Story 19 made planned values optional. Placeholders are simply absent; everything else behaves identically. |
