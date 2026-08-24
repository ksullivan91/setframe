# Story 27 — Clarify Today Workout Actions and Give Rest Day Its Own Intent

## User Story

As a user deciding what to do with today's scheduled training, I want the available actions to have a clear hierarchy and explanation so that starting, previewing, changing, or taking a rest day each feels intentional rather than like four competing buttons.

## Screenshot / Product-Test Evidence

The screenshots show the **Today's workout** card for a scheduled workout (`Recovery Day A`) on both mobile and wider web.

The card currently presents four actions in the same visual region:

- **Start workout** — solid primary
- **Preview** — secondary/outlined
- **Change today's workout** — secondary/outlined
- **Rest day** — solid green

On mobile these actions stack into multiple rows. On wider layouts they sit in one horizontal cluster.

The mix of:
- one solid purple button,
- two lighter actions,
- one solid green button,

creates two high-emphasis CTAs with different meanings and makes the action order feel arbitrary.

The Rest Day capability itself is valuable because it lets the user intentionally take time off without being penalized, but the current card does not explain what choosing Rest Day actually means.

## Problem Statement

The Today workout card currently combines **primary workout actions** and a **schedule exception / recovery decision** into one flat action cluster.

This creates two UX issues:

1. **Action hierarchy is unclear**
   - Start Workout and Rest Day both demand high visual attention.
   - Preview and Change are mixed between them.
   - On mobile, the stacked layout makes the user parse four separate actions with little grouping.

2. **Rest Day lacks explanatory context**
   - The user may not know whether Rest Day:
     - skips only today,
     - removes the workout from the program,
     - affects streaks/consistency,
     - counts as a completed recovery choice,
     - can be undone.

The user should understand that Rest Day is a deliberate day-level override, not a destructive program change.

## UX / Product Intent

Reorganize the card around **one primary action** and a clearly separated set of supporting / alternative actions.

### Recommended hierarchy

#### Primary action
`Start workout`

This should remain the strongest CTA when a workout is scheduled and not yet started.

#### Supporting actions
Group:
- `Preview`
- `Change today's workout`

These are lower-emphasis actions because they help the user inspect or modify the plan before acting.

#### Rest-day action
Do **not** present Rest Day as another equal primary CTA beside Start Workout.

Instead, separate it visually and explain its meaning.

Recommended pattern:

---

**Need a day off?**

Taking a rest day skips today's scheduled workout without changing your program or breaking your consistency.

`Take a rest day`

---

This can live as:
- a lower section inside the same card,
- a subtle secondary surface beneath the main action area,
- or an expandable/help row if vertical space needs to stay compact.

The Rest Day action can still use green as a positive/recovery semantic color, but avoid giving it the same visual weight as Start Workout.

### Suggested mobile layout

`Start workout` — full-width primary

Then a compact secondary row:
`Preview`   `Change`

Then a separated rest section:
`Need a day off?`
`Skip today's workout without changing your program.`
`Take a rest day`

### Suggested desktop layout

Keep the same semantic grouping, even if there is more horizontal space.

Do not simply put all four actions back into one line because they fit.

### Rest Day semantics

The UI should explain the exact behavior based on actual product rules.

Preferred semantics if consistent with Setframe's current direction:

- applies to the current calendar day only,
- does not modify the underlying program schedule,
- does not delete or reschedule the workout automatically,
- does not count as a missed workout for consistency/streak logic,
- records an intentional rest/recovery decision,
- can be changed/undone during the same day where practical.

Do not promise any of these in UI copy unless the underlying behavior actually supports them.

## Acceptance Criteria

- [ ] Today's workout card has one clearly dominant primary action when a workout is scheduled and not started.
- [ ] `Start workout` remains the primary CTA.
- [ ] `Preview` and `Change today's workout` are visually grouped as supporting actions.
- [ ] Rest Day is visually separated from the primary workout-action cluster.
- [ ] Rest Day includes concise explanatory copy describing what it does.
- [ ] The explanatory copy accurately reflects actual product behavior.
- [ ] Rest Day is not given equal visual weight to Start Workout.
- [ ] Green is used semantically for recovery/rest confirmation rather than as a competing generic primary CTA.
- [ ] Choosing Rest Day applies only to the intended day and does not silently modify the user's program.
- [ ] Rest Day behavior is reflected consistently in Today, History, Progress, and consistency/streak calculations where applicable.
- [ ] The user receives a clear confirmation after taking a rest day.
- [ ] The user can reverse/change the decision during the same day if the product supports undo.
- [ ] Mobile layout remains easy to scan without a dense stack of equal-sized buttons.
- [ ] Desktop preserves the same action hierarchy rather than flattening all actions into one horizontal row.
- [ ] Mobile web and mobile app use equivalent action semantics and hierarchy.
- [ ] Figma reviewer validates that the action grouping improves clarity and that Rest Day feels supportive rather than punitive.

## Product-wide Definition of Done

Every story in Setframe must satisfy these rules before it is considered done:

- The feature is implemented **mobile-first** and is fully responsive on web.
- Any user-facing behavior added or changed on web is also implemented in the **mobile application**.
- Mobile web and mobile app are reviewed side-by-side for behavioral and visual parity.
- The change is reviewed with the **GitHub reviewer** for implementation/code quality.
- The change is reviewed with the **Figma reviewer** for visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch target, and screen-reader behavior are considered for interactive controls.
- Existing historical user data is not mutated or lost unless the story explicitly requires a migration.
- Automated tests cover the important user-visible behavior; do not rely only on snapshots.
- Type checking, linting, relevant unit/integration tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Treat this as an **action hierarchy + day-state semantics** story, not merely a button-color cleanup.

### Before coding

Audit the current Today workout card and identify:

- which actions are shown for each workout state,
- whether Rest Day currently maps to Skip Today or a distinct domain state,
- how Today resolves a rested/skipped day,
- how streak/consistency calculations treat skipped/rest days,
- whether Rest Day is persisted,
- whether the user can undo it,
- whether History records the choice,
- whether the scheduled workout remains intact for the recurring program.

Do not write explanatory UI copy until these semantics are known.

### Recommended component structure

Refactor the card into semantic groups rather than styling each button independently.

Conceptually:

`WorkoutPrimaryAction`
- Start / Resume / Completed state

`WorkoutSupportActions`
- Preview
- Change today's workout

`RestDayAction`
- explanatory copy
- rest-day CTA
- confirmation / undo state

The exact component names should fit the codebase.

### Action priority

When scheduled and not started:

1. Start workout
2. Preview / Change
3. Rest day

When in progress:
- Resume should take priority.
- Do not offer Rest Day for a session that already contains logged work unless product rules explicitly support abandoning/completing it as rest.

When completed:
- show completed-workout review state from Story 06.
- do not show Rest Day.

When already marked Rest Day:
- replace the normal action cluster with an intentional recovery state, for example:

`Rest day`
`Today's scheduled workout has been skipped. Your program is unchanged.`

plus `Undo` / `Choose a workout` only if supported.

### Button color guidance

Do not add another generic high-emphasis button system.

Use:
- purple = primary action,
- neutral/outlined = supporting actions,
- green = semantic success/recovery/status.

The goal is hierarchy through grouping and semantics, not more color variety.

### Confirmation interaction

If Rest Day materially affects consistency/history:
- use a lightweight confirmation sheet/dialog before committing.

Example:

`Take a rest day?`
`This skips Recovery Day A for today only. Your program schedule stays the same.`

Actions:
- `Take rest day`
- `Cancel`

Avoid alarming destructive styling because this is not destructive.

### Data model / analytics

If Rest Day is currently represented as generic `skipped`, assess whether the domain needs an explicit reason/status such as:
- intentional_rest
- skipped
- substituted

Do not introduce a migration unless necessary, but consistency logic should be able to distinguish an intentional rest from an unexplained missed workout if the product promises “no penalty.”

### Tests

Cover at minimum:

1. scheduled workout → Start available
2. scheduled workout → Preview
3. scheduled workout → Change today
4. scheduled workout → Take Rest Day
5. reload → Rest Day persists
6. recurring program remains unchanged
7. consistency/streak behavior matches documented rules
8. undo Rest Day where supported
9. in-progress workout does not incorrectly expose Rest Day
10. completed workout does not expose Rest Day

### Scope boundary

Do not redesign the entire Today page.

Do not change the core workout start/resume/completed lifecycle beyond what is necessary for the Rest Day state.

Do not add a new global button color system.

This story is about making the user's choice on Today **clear, intentional, and understandable**.
