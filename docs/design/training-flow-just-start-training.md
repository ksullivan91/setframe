# Training flow — "Just start training"

**Status:** Exploration. **Not signed off, not scheduled.**
**Figma:** section `🔬 Exploration — Training flow: "Just start training"` on
the 📱 Mobile page
**Parent:** `docs/design/training-page-exploration.md` §2.2 and §3 — this is
the second of the three routes off an empty Training page.
**Sibling:** `docs/design/training-flow-build-your-own.md` — the third route,
drawn the same way in its own section.

| # | Frame | Node |
|---|---|---|
| 1 | `Just 1 · Empty session` | `167:708` |
| 2 | `Just 2 · Add exercises` | `167:727` |
| 3 | `Just 3 · Log it` | `168:708` |
| 4 | `Just 4 · Finished, save it?` | `168:834` |
| 5 | `Just 5 · Name and save it` | `169:838` |
| 6 | `Just 6 · Workouts, still no plan` | `169:883` |
| — | `Just start training — model and decisions` | `170:838` |

---

## 1. The schema already allows all of this

Both facts were checked in `packages/database/src/schema`, not inferred from
the docs, and together they settle the flow without a migration.

**`workout_session.templateId` is nullable**, carrying the comment
*"Nullable: ad hoc sessions (not started from a day type) are allowed."* An
unplanned session is an ordinary session — not a mode, not a scratchpad.

**`day_type` has no program reference.** It is keyed on `userId` alone;
plans reach it through `program_schedule_slot`, not by owning it. So a
workout saved out of an ad hoc session can exist with **no plan anywhere in
the account**.

That second one is the load-bearing discovery. It means Just 6 — two saved
workouts, no plan — is a legitimate resting place in the data model rather
than a half-finished setup we have to nag someone out of. Without it, saving
a workout would have had to conjure a plan to put it in, and the flow's whole
premise (train first, decide later) would have collapsed at the last step.

---

## 2. The six screens

**1 · Empty session.** The clock is already running; the only offered action
is adding the first exercise. It is the same sticky header as the logger,
because it *is* the logger. A note states up front that this counts as a real
workout and can be saved afterwards, so the offer in step 4 is not a surprise
sprung at the end.

**2 · Add exercises.** The same multi-select picker used everywhere else,
with the subject changed to "today's workout". **No step counter** — an ad
hoc session is not a wizard, and you come back to this as many times as you
like mid-session.

**3 · Log it.** Literally the v2 logger, cloned rather than redrawn. The only
difference is that cards carry no plan pill: there is no prescription, so
there is nothing planned to show.

**4 · Finished, save it?** The completion banner, with the save offer beneath
it — not in a modal over it.

**5 · Name and save.** Shows exactly what will be copied, because "save as a
workout" is otherwise an opaque promise.

**6 · Workouts, still no plan.** Where you land. Training holds real
workouts, offers a plan, and does not require one.

---

## 3. Rules this flow must not break

| Rule | Why |
|---|---|
| Saving creates **new** intent | It creates a fresh `day_type` and never writes back into an existing one. ADR 0005's separation — and an ad hoc session has nothing to write back to anyway. |
| The offer cannot block the reward | The save card sits under the completion banner. The workout is already recorded; this is optional, and the footnote says so. |
| Targets from fact, weights not | Sets and reps performed become the prescription. Weight does not — a target weight copied from one good day becomes a stale number you fight with for weeks. |
| Saving does not create a plan | No plan is implied, required, or silently created. Step 6 makes the planless state look finished, because it is. |

---

## 4. What drawing it turned up

**A first session has no history, and the frames initially lied about it.**
Cloning the logger brought its `PREVIOUS` column and its PR badge along, so
the first draft of step 4 showed a previous session, a personal record and a
`+420 lb vs last week` delta on a workout it simultaneously labelled "First
time". Corrected: `PREVIOUS` reads an em dash, the rows are plain saved rows,
and the banner reads a bare `lb total` — which is exactly what
`formatSessionTotalSuffix` already returns when `volumeDelta` is `null`. The
code was right; the design had to catch up to it.

**PRs on a first-ever session** then became a real question — and the answer
was already in the code. `resolveSessionPRs` (`packages/domain/src/session-pr.ts`,
rule 5) returns all-false flags the moment the baseline is empty:

```ts
// Rule 5 — an exercise with no qualifying history has no record to break.
if (!baseline.length) return flags;
```

So an exercise with no previously completed session earns **no badges at
all** — including for a set that beat an earlier set in the same session,
since the early return happens before the running baseline is consulted. The
frames were right by accident, and are now right on purpose.

Worth noting the mechanism, because the obvious alternative is worse. The
tempting design is "flag it on the server since it technically is a record,
then hide the badge in the logger". Setframe never sets the flag. That
matters beyond the logger: `apps/api/src/routes/progress.ts` counts stored
flags into a session's `prCount`, so a stored-but-hidden PR would make
Progress report records the logger refused to show, and the two surfaces
would disagree with no way to tell which was lying. Not storing it keeps
every reader honest at once.

---

## 5. Decided

**An unplanned session counts** toward streaks and `weeksTrained`, like any
other. No code needed — see the parent exploration's §3 table for why it is
already true, and why it is worth recording anyway.

**No PR badges without history**, per §4. Also already true, one layer
earlier than the obvious design.

Both were settled by reading the code rather than changing it, which is the
useful outcome: the decision is now written down next to the behaviour, so a
later refactor that breaks either one reads as a regression instead of a
tidy-up.

## 6. Still open

- **Naming the saved workout.** Step 5 pre-fills nothing. A suggestion built
  from the exercises performed ("Squat + RDL") is tempting and probably worse
  than a blank field with the keyboard already up.
- **Repeat without saving.** Someone who taps "Not now" three weeks running
  has clearly got a routine. Whether we notice and re-offer, or leave them
  alone, is undecided.
- **"Start from a template"** — now badged "Coming soon" on the no-plan
  screen, with a muted button, and moved below "Build your own" so the two
  live routes come first. Still undrawn, and still with no data behind it.
