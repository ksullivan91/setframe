# Story 17 — Clarify the Program → Workout → Exercise Mental Model

## User Story

As a new Setframe user, I want Guided Setup to explain the difference between a program, a workout, and an exercise so that I understand what I am creating at each step and do not accidentally put today's exercises in the wrong level of the hierarchy.

## Screenshot / Beta-Test Evidence

Screenshot 1 shows Guided Program Setup moving from **Program** to **Workouts** to **Exercises**.

Beta-test quote:

> “What are you looking for in the first tab? Workout and Exercises a little confusing. It seems like I am entering the exercises in the workouts and then doing it again for exercises tab. More clarification on the tree breakdown and simplify the cascading information.”

The user named the program **Leg Day** because it was her leg day that day, then began entering exercises into the **Workouts** step because she interpreted “workout” as “what I am doing right now.”

## Problem Statement

Setframe currently assumes users already understand its domain hierarchy:

Program → reusable workouts → exercises inside each workout.

A novice may instead interpret Program as today's workout and Workout as an exercise entry. The terminology may be fine, but the wizard is not teaching scope and containment clearly enough.

## UX / Product Intent

Keep **Program**, **Workout**, and **Exercise** unless research shows a clearly better vocabulary.

Improve contextual guidance:

- **Program**: “Your overall training plan over time.” Example: `4-Day Strength Plan`.
- **Workouts**: “Reusable training days inside your program.” Examples: `Upper A`, `Lower B`, `Recovery`. Explicitly say: **You’ll add exercises inside each workout in the next step.**
- **Exercises**: “What you actually perform inside the selected workout.” Examples: `Squat`, `RDL`, `Bench Press`, `Walking`.

Consider a lightweight hierarchy cue such as:

`My Program`
`└─ Lower A`
`   ├─ Squat`
`   ├─ RDL`
`   └─ Calf Raise`

Do not turn the wizard into documentation.

## Acceptance Criteria

- [ ] A novice can understand Program → Workout → Exercise without external explanation.
- [ ] Program copy explains that a program contains multiple reusable workouts.
- [ ] Workout copy explicitly explains that exercises are added in the next step.
- [ ] Exercise copy explains that exercises belong inside the selected workout.
- [ ] At least one concise contextual hierarchy/example is shown.
- [ ] Copy remains compact on mobile.
- [ ] Stepper subtitles reinforce the hierarchy.
- [ ] No new internal jargon is introduced.
- [ ] Mobile web and mobile app use equivalent hierarchy cues.
- [ ] Figma review confirms improved clarity without excessive density.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Any user-facing web change is also implemented in the mobile application.
- Mobile web and mobile app are compared for behavioral and visual parity.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior are considered.
- Existing historical user data is preserved unless a migration is explicitly required.
- Behavioral tests cover the important user-visible outcomes; do not rely only on snapshots.
- Type checking, linting, relevant tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Before coding, inspect every Guided Setup heading, subtitle, helper text, empty state, and stepper label.

Do not solve this with a large intro modal. Guidance should appear at the moment the user makes each decision.

Keep the existing four-step structure unless implementation constraints require otherwise.

Prefer concise examples and lightweight visual hierarchy over paragraphs.

Have the Figma reviewer explicitly assess whether:
- Step 2 means “create reusable workout days”
- Step 3 means “put exercises inside those workouts”
- mobile still feels lightweight.
