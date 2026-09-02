# Onboarding + shared guided setup — Build Pack (84–89)

## Purpose

A first-run experience that explains what Setframe needs and why, and a
guided program setup that is **one implementation used from two places**.

Two things drove this. Guided setup was shipped "picker only" (story 83) and
still wears its own four-step chrome, so it never matched the Build 1–7
frames. And the app has no onboarding at all: a new account lands on Today
with no Health connection, no body profile, and no program, and nothing
ever explains why any of those matter.

## The designs

Figma page **🚀 Onboarding** (`329:2`).

**Onboarding flow** (section `334:1177`):

| Screen | Node |
|---|---|
| 1 · Welcome | `333:2` |
| 2 · Apple Health | `333:10` |
| 3 · About you | `334:2` |
| 4 · Already measured | `334:37` |
| 5 · Turn workouts into progress | `334:1151` |
| 7 · You're set | `334:1166` |

Each screen has a path annotation card beneath it naming every control and
where it goes. Eleven prototype links are wired; open `333:2` and play it.

**Guided setup** (section `338:2`):

| Screen | Node |
|---|---|
| 6a · Name your plan | `338:3` |
| 6b · Add a workout | `338:21` |
| 6c · Add exercises | `339:2` |
| 6d · Which days | `339:30` |
| 6a as opened from Training | `339:1152` |
| Spec · One flow, two hosts | `339:1170` |

Decisions board: `329:3`.

---

## The load-bearing constraint: one flow, two hosts

Guided setup is reached from onboarding **and** from Training's "Build your
own". It must be **one screen set**, not two.

This repo has already paid for getting that wrong. Before story 78 there
were two divergent exercise pickers, built per-flow, and the training-v2
pack says so plainly: *"building it per-flow is how the current codebase
ended up with two divergent copies."*

### What differs between hosts — and it is only the bar

| | Onboarding | From Training |
|---|---|---|
| Left | plain `‹` | `‹ Training` |
| Middle | `Step 3 of 4` | plan name, or `New plan` |
| Right | `Skip` → onboarding step 7 | `Save & exit` → Training |

**What must not differ:** the steps, their order, the copy, and what each
step writes. If a step behaves differently depending on where it was opened,
this stops being one flow and becomes two to maintain.

### The shape that makes that true

```
GuidedSetupFlow({ host: 'onboarding' | 'training' })
  ├── <SetupChrome host={host} step={n} of={4} onExit={…} />   ← the only host-aware part
  ├── <StepBody />                                             ← swapped per step
  └── <SetupActions />                                         ← owned by the shell
```

The shell owns the chrome and the action bar. A step contributes **only its
body** and a validity flag. A step that needs to know which host it is in is
a design smell — raise it rather than adding a second branch.

---

## Transitions

The prototype uses Smart Animate (ease-out, 0.3s) and it reads well because
every frame shares layer names — Figma sees one header moving, not two
headers swapping.

**Do not chase Smart Animate with shared-element transitions.** The shape
above gets most of the same feeling for free and honestly: because the
chrome and the action bar are rendered by the *shell*, they never unmount
between steps. Only the body changes. A cross-fade plus a short horizontal
offset on the body is enough, and the header genuinely does stay put rather
than being interpolated between two copies of itself.

- Between steps **inside** the flow: animate the body only. `react-native-reanimated`
  `FadeIn`/`FadeOut` with a ~12px translate, ~200ms. The shell does not move.
- Between onboarding **screens** (1→2→3…): the native stack push. It is the
  iOS convention, it makes the back gesture mean something, and it is what
  the rest of the app already does.

Deciding this now avoids the trap of tagging shared elements per screen to
imitate a prototype affordance.

---

## Data, and not corrupting it

Every step writes as it completes. There is no draft object held in memory
and flushed at the end, because the flow is explicitly abandonable.

| Step | Writes | Existing endpoint |
|---|---|---|
| 6a | the program | `POST /programs` |
| 6b | a day type, attached to the program | `POST /day-types` |
| 6c | exercises on the day type | `POST /day-types/:id/exercises` |
| 6d | schedule slots | `POST /programs/:id/schedule-slots` |

**Leaving at any point is safe by construction.** A program with no workouts
and a workout with no schedule are both valid states the Training tab
already renders — frame 2 of the original walkthrough is literally "a plan,
nothing in it". Nothing half-written is committed, and no step needs a
later step to have run.

The one thing to verify rather than assume: that a day type created without
exercises, and a program created without slots, both round-trip through
`GET /dashboard/today` without throwing. Story 84 covers it.

---

## Apple Health: the one-prompt rule

iOS grants an app **one** authorization prompt per data type for the life of
the install. This is why step 2 exists at all, and it governs step 4.

- Tapping **our** "Not now" never calls `requestAuthorization`, so Apple's
  sheet was never shown and the state stays `not_asked`. We may ask again.
- Seeing Apple's sheet and denying makes the state `asked` **forever**. An
  Enable button would then produce no sheet and appear broken.

`getConnectionState()` already models exactly this (`not_asked` / `asked`),
and `getRequestStatusForAuthorization` is the only signal iOS gives us —
it can never tell us "granted" from "denied".

**Step 4 therefore has three states:**

| State | Screen |
|---|---|
| `not_asked` | Ask again, now with the evidence of what it would light up |
| `asked` + data | The payoff, with the user's own numbers |
| `asked` + no data | "Open the Health app" — no re-prompt is possible |

Never render an Enable button that cannot produce a sheet.

Request the **full** read set in one prompt. iOS only prompts for
*undetermined* types, so a partial first ask permanently strands the rest
behind `hasUnaskedTypes()`.

---

## Every route that must be repointed

Story 86 is a swap across **seven call sites in four files**. Enumerated
here because "switch Training onto the shared flow" is not an instruction
anyone can check off:

| File | Line | Control |
|---|---|---|
| `src/screens/TrainingScreenV2.tsx` | 208 | Build your own (no-plan state) |
| `src/screens/TrainingScreenV2.tsx` | 232 | Build your own (empty-plan state) |
| `src/screens/PlansScreen.tsx` | 127 | New plan |
| `app/(tabs)/today.tsx` | 673 | Start guided setup |
| `app/training-manage.tsx` | 539, 584, 683 | Start guided setup ×3 |

**The last three are already unreachable.** Nothing links to
`/training-manage` any more — the overview's last reference to it went when
`+ New` was repointed. Its only remaining referent is its own test. So 86
should **delete `app/training-manage.tsx`** rather than repoint it, along
with `ProgramEditorScreen.test.tsx`, and the build pack for training-v2
should be updated to say the retirement finally happened.

`app/program-wizard.tsx` itself is deleted once the shared flow is live —
not before, so Training is never without a working path.

## Order, and why

| # | Story | Depends on |
|---|---|---|
| 84 | `GuidedSetupFlow` shell + host prop, replacing the wizard's chrome | — |
| 85 | The four setup steps against the shell, reusing story 78's picker | 84 |
| 86 | Training's "Build your own" switched onto the shared flow | 84, 85 |
| 87 | Onboarding shell + steps 1, 2, 7, and the run-once rule | — |
| 88 | Steps 3 and 4, prefill and the three-state Health branch | 87 |
| 89 | Onboarding embeds the shared flow as step 6 | 85, 87 |

84–86 first, deliberately. The shared flow has a caller today (Training), so
it can be built and proved against a real surface before onboarding exists.
Building onboarding first would mean designing the seam against a consumer
that is not there yet, which is how the seam ends up wrong.

---

## What must not regress

- **Training's "Build your own" keeps working throughout.** 86 is a swap, not
  a rewrite; the old wizard is deleted only once the shared flow is live.
- **The exercise picker stays single.** Story 78 unified it. 6c reuses it and
  adds nothing of its own.
- **No new API for the setup steps.** Every write in the table above
  already exists. Onboarding itself needs one addition — see below.
- **Onboarding runs once**, and never for an account that already has data —
  a user who signs in on a second device must not be walked through setup
  again. Gate on server state, not a device flag.

  **This needs a column, and there is not one today.** `user` has no
  `onboarded_at` and nothing else records that the flow ran. Inferring it
  from existing state does not work: someone who legitimately skipped
  everything is indistinguishable from a brand-new account, so they would
  be re-onboarded on every launch — which is the exact bug the rule exists
  to prevent. Story 87 adds `user.onboarded_at timestamptz null`, set when
  the flow is completed OR skipped. Migrations here are hand-written and
  applied manually before the API that needs them ships (docs/handoff.md §2).
- **Everything remains reachable afterwards.** "Set up your training" stays
  on Today, and the Health card keeps offering the connection. Nothing in
  onboarding is a one-time chance, and step 7 says so.

## Open

- **"Add another workout"** on 6d loops to 6b. Whether the step counter then
  reads "Step 2 of 4" again, or the flow switches to an unnumbered mode, is
  undesigned.
- **Skipping mid-flow with a plan already created** keeps it, per the spec —
  but no screen yet shows the state you return to.
- **Onboarding for an account with existing data** (second device) is
  specified as "do not run" and not drawn.
