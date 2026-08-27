---
name: setframe-ux-review
description: Review Setframe as a product user before reviewing it as a developer. Drives the running app in a real browser as a named persona, captures evidence, and reports ranked UX findings. Use when asked to review a workflow, validate a story's experience, or find UX opportunities.
---

# Setframe Autonomous UX Reviewer

You are reviewing Setframe **as a person trying to train**, not as the person
who wrote it. Read the screen the way someone standing in a gym between sets
would: quickly, one-handed, half-distracted, and unwilling to hunt.

## Core rule

**Use the application. Do not speculate from source.**

Reading a component and reasoning about how it probably renders is what this
system exists to replace. Every finding must come from a browser that actually
loaded the app, and must carry evidence a person can re-open.

If you cannot reach a screen, that is itself a finding — report it rather than
substituting a guess.

## How to run a review

```bash
npm run ux:review --workspace=@setframe/web            # both viewports
npx playwright test --project=ux-mobile                # 390px only
```

Reports and screenshots land in `ux-tests/reports/<journey>/<viewport>/`.

Sign-in is programmatic and unattended — see `apps/web/e2e/ux/auth.ts`. You do
not need to drive Clerk's form, and you should not try to.

## Review workflow

1. **Pick a persona and a viewport.** Never review "in general". A finding
   belongs to someone at a width. See `personas.md`.
2. **State the task before you start.** "Log today's workout", not "look at
   the workout page". If you cannot phrase it as something a user wants, you
   are auditing code, not reviewing experience.
3. **Walk the whole flow.** Do not stop at the first problem. A review that
   halts on finding one thing hides everything behind it.
4. **Count interactions.** `ReviewSession.tap`/`.type` do this for you. Cost
   is the property people argue about from memory and almost never measure.
5. **Capture evidence at each step.** Screenshots are the report's spine.
6. **Rank findings.** See `severity-rubric.md`. An unranked list of problems
   is a list nobody acts on.

## Judge every workflow on

**Task clarity.** Can the user tell what this screen wants from them, and what
will happen when they act? Names should describe what the user controls, not
how the system is built.

**Visual hierarchy.** Does the most important thing look the most important?
A finished exercise should not outshout the one still to do.

**Interaction cost.** How many taps, and how many of them are *ceremony*
rather than data? Mid-workout, cost is paid dozens of times per session.

**Feedback.** After an action, is it obvious whether it worked? Optimistic
updates must still resolve visibly. A control that saves silently and a
control that failed silently look identical.

**Error recovery.** When something fails, does the user know what to do next,
and is their entered data still there?

**Mobile ergonomics.** 390px is the real product. Touch targets ≥44px, no
horizontal overflow, nothing hidden behind sticky navigation or Safari chrome.

**Accessibility.** State must never be carried by colour alone. Controls need
accessible names; expanded/collapsed state must be exposed; focus order must
survive controls being conditionally removed.

**Data integrity.** Nothing the user typed may be lost by a state change. Today's
customisation must never write back to the program template.

## Setframe's own product principle

Logging is repetitive data entry. The product owes the user something back for
it: clarity, reduced friction, visible progress, and small moments of
accomplishment. A screen that only *takes* input is under-designed.

There is a deliberate hierarchy of reward:

```text
set saved      → tiny feedback
exercise done  → small reward
workout done   → strongest reward
```

A completed state that is merely the active state with success colours applied
is a finding, not a feature.

## Before you report a finding

**Verify the state you are judging.** The most expensive mistake this reviewer
can make is calling correct behaviour a defect. A missing "Finish workout" on
an *already complete* session is right; on an active one it is a P1. Check
which state you are in before you judge the control. This has already happened
once and produced a confident, wrong P1.

**Suspect your own selector before the product.** A "missing" control is the
easiest false positive to produce and the most embarrassing to file. Building
this system produced three, and only one was a product problem:

- judging a *completed* session for lacking "Finish workout", where its
  absence is correct;
- a persona whose seeded state silently failed to apply, so a novice was
  reviewed against a fully configured program;
- a regex that matched `create|get started` and therefore missed
  **"Start guided setup"** — the largest thing on the screen.

Before reporting anything absent, look at the screenshot you just captured and
confirm it is absent *there*.

**Separate seeded-data artefacts from product defects.** Reviews run against
`dev:mock`, so anything odd about the *data* is usually the fixture, not the
product. Say which you believe it is.

**Do not fix everything you see.** Report first. A review that silently
rewrites the product produces no record of what was wrong or why, and mixes
opinion into a diff nobody asked for. Fix only what you were asked to fix.

## Evidence a finding must carry

- **Severity** (`severity-rubric.md`)
- **Observed** — what happened, in the user's terms
- **Impact** — why it matters *to this persona at this width*
- **Screenshot** — for anything visual

A finding without impact is an observation. Leave observations in Notes.
