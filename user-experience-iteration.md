# Setline UX Refinement — Focused Iteration

I want you to make a focused UX refinement pass on Setline based on the latest implementation.

Do **not** perform another broad application-wide redesign. The recent architecture changes are moving in the right direction, and several screens — especially Today and the guided setup flow — are substantially better.

This pass should concentrate on the remaining UX issues:

1. Desktop Training page hierarchy and space utilization
2. Guided setup discoverability
3. Add Exercise workflow simplification
4. Global action/button hierarchy
5. State-sensitive controls on Today
6. Mobile polish where it still adds real value

Before changing code, inspect the current implementation and summarize:

* relevant Training components/routes
* current button variants/components
* current Add Exercise flow
* current guided setup entry points
* current Today workout-state logic
* any existing responsive abstractions that can be reused

Then implement the refinements below.

---

# 1. Do not redesign the entire product again

The current product direction is good.

Keep the existing conceptual model:

```text
Program
↓
Workout templates
↓
Schedule
↓
Workout session
↓
History / Progress
```

Keep the current Today-first product direction.

Keep the existing guided setup concept.

Keep the current Setline visual identity.

This iteration is about improving hierarchy and interaction clarity, not rethinking the entire app.

---

# 2. Improve desktop Training page architecture

The current desktop Training page is cleaner than before, but still feels like a dashboard containing unrelated cards:

* Workout library
* Select a workout
* Program schedule
* One-off changes

This does not use large-screen space well and still creates competing visual regions.

The desktop Training page should feel like a **workbench/editor**, not a dashboard.

Use a master-detail model.

Recommended structure:

```text
Training
Manage the workouts and schedule in your program.

[ guided onboarding banner when appropriate ]

[ Workouts ] [ Schedule ]
```

---

# 3. Use Workouts and Schedule as separate views

Do not show workout editing and weekly scheduling simultaneously unless there is a strong functional reason.

The user has two distinct intentions:

```text
Workouts
→ What is inside each workout?

Schedule
→ When does each workout happen?
```

Represent those as sibling views/tabs within Training.

Example:

```text
Training

[ Workouts ] [ Schedule ]
```

Use accessible tabs or equivalent navigation following the application's current routing architecture.

Do not implement visual tabs without proper keyboard/ARIA behavior.

---

# 4. Workouts desktop layout should use master/detail

For sufficiently wide screens, use the available horizontal space.

Example:

```text
┌ Workout library ─────────┐   ┌ Lower C ────────────────────────────┐
│                          │   │ 8 exercises · ~75 min               │
│ Lower C                  │   │                                     │
│ Upper A                  │   │ Barbell Romanian Deadlift     3 × 8 │
│ Recovery                 │   │ Barbell Sumo Squat            3 × 8 │
│ Conditioning             │   │ Barbell Calf Raise            3 × 8 │
│                          │   │                                     │
│ + New workout            │   │ + Add exercise                      │
└──────────────────────────┘   └─────────────────────────────────────┘
```

The left panel should own workout selection.

The right panel should own editing of the selected workout.

Avoid a generic editor heading like:

```text
Select a workout
```

once a workout is selected.

Use the actual workout name:

```text
Lower C
8 exercises · approximately 75 min
```

---

# 5. Improve the empty workout state

When no workout is selected, the editor should communicate the next action without showing an inactive form.

Example:

```text
Choose a workout to edit

Select a workout from your library or create a new one.

[ Create workout ]
```

Do not show empty Exercise / Prescription controls when there is no selected workout.

---

# 6. Mobile Training should remain vertically focused

The current mobile experience is generally strong.

Do not force the desktop master-detail structure into a narrow mobile viewport.

On mobile:

* workout library can appear first
* selected workout editor can stack below or navigate into a dedicated view
* Schedule should be a separate view
* avoid horizontally compressed desktop tables/cards

Preserve the single-task focus that currently makes the mobile UX work well.

---

# 7. Guided setup should become a contextual onboarding banner

The current top-right white "Guided setup" button on desktop is too visually weak for a new user.

When the user has no active/configured training program, replace the standalone header button with a contextual onboarding banner beneath the Training heading.

Conceptually:

```text
NEW TO SETLINE?

Build your training program

Create your workouts and weekly schedule in a few guided steps.

[ Start guided setup → ]
```

This banner should:

* appear prominently when setup is actually relevant
* disappear once the user has a usable program
* use one clear primary CTA
* not permanently occupy the page for configured users

Do not duplicate the same Guided Setup CTA in both the header and banner.

Remove the header-level button when the banner is shown.

---

# 8. Do not copy the Resume Workout banner exactly

Setline already has a useful Resume Workout banner.

Preserve the semantic distinction between:

```text
Resume workout
→ active/in-progress task

Guided setup
→ recommended onboarding action
```

The setup banner may borrow the layout language, but should be visually less urgent than an active workout.

Suggested treatment:

* neutral/light surface
* subtle purple accent/border/icon
* purple primary CTA
* small onboarding eyebrow or label

Avoid making it another large saturated lavender surface if that makes it compete with active workout status.

---

# 9. Guided setup itself should largely remain

The current four-step model is understandable:

```text
1. Program
2. Workouts
3. Exercises
4. Schedule
```

Keep this unless the actual implementation reveals a strong reason to change it.

The current guided setup is one of the stronger parts of the redesign.

Only make targeted refinements.

---

# 10. Reduce emphasis of "Exit to full editor"

In the wizard, "Exit to full editor" currently carries substantial visual weight.

It is an escape hatch, not the preferred next step.

Primary:

```text
Next →
```

Secondary/tertiary:

```text
Switch to full editor
```

or:

```text
Skip guided setup
```

Use lower visual emphasis than Next.

Do not make both actions look equally primary.

---

# 11. Compress the setup summary on mobile

The "What you've built" panel is useful on desktop.

On mobile it can create unnecessary vertical length.

Use a compact representation such as:

```text
Program progress
2 of 4 steps complete
```

Optionally make the detailed summary expandable.

Desktop may continue showing the full summary panel.

---

# 12. Remove the permanent "One-off changes" card from Training

The current card explains:

> Need to swap today's workout without touching your regular schedule? Use "Change today's workout" on the Today page.

This is conceptually better than exposing override controls, but it does not need permanent page real estate.

Remove this card.

Training should not permanently explain functionality that belongs on another page.

One-off workout changes belong in Today / the scheduled workout context.

---

# 13. Completely simplify Add Exercise

The Training page still exposes too many exercise-related actions simultaneously:

```text
Exercise
Prescription type

Create a new exercise
Create exercise

Add exercise
```

This remains confusing and should be fixed in this iteration.

The user should start from one clear action:

```text
+ Add exercise
```

---

# 14. Add Exercise should open a picker

Preferred interaction:

```text
Add exercise

Search exercises
[ __________________________ ]

Barbell Back Squat
Barbell Romanian Deadlift
Cable Face Pull
...

Can't find it?
+ Create custom exercise
```

The primary task is selecting an existing exercise.

Custom creation should be progressive disclosure.

Do not show custom exercise creation fields all the time.

---

# 15. Custom exercise should "Create & add"

When the user chooses:

```text
+ Create custom exercise
```

show:

```text
Create custom exercise

Exercise name
[ Outdoor Cycle ]

Category
[ Cardio ▾ ]

[ Cancel ]        [ Create & add ]
```

Use:

```text
Create & add
```

not:

```text
Create exercise
```

Creating the database record is not the user's goal.

Their goal is adding it to this workout.

After creation, continue directly into the workout configuration flow.

Do not require an additional redundant Add action.

---

# 16. Configure prescription after exercise selection

After selecting an exercise, configure its workout prescription.

Example:

```text
Barbell Back Squat

Prescription
[ Sets & reps ▾ ]

Sets
[ 3 ]

Reps
[ 8 ]

[ Add to workout ]
```

The user should not have to reason about:

* which exercise
* whether to create it
* prescription type
* adding it

all at once.

Use progressive disclosure.

---

# 17. Establish a global action hierarchy

The application currently uses the same solid purple button treatment for many actions.

This causes visual competition, particularly on desktop.

Do **not** solve this by randomly introducing another CTA color.

Instead, formalize semantic button/action variants.

Recommended model:

## Primary

Use solid Setline purple.

Purpose:

> the most important action in the immediate context

Examples:

```text
Next
Start workout
Finish workout
Save
Create workout
```

There should usually be one obvious primary action within a local interaction region.

---

## Secondary

Use a neutral/light surface with border.

Examples:

```text
Preview
Change workout
Create manually
Cancel
```

Secondary controls should be clearly interactive without competing with the primary CTA.

---

## Tertiary

Use text or ghost treatment.

Examples:

```text
Switch to full editor
View history
Skip
Learn more
```

Use for low-frequency or low-priority actions.

---

## Destructive

Use the existing pink/red treatment only for destructive behavior.

Examples:

```text
Delete workout
Delete account
Remove
```

Do not use destructive styling for normal cancellation/navigation.

---

# 18. Color should communicate meaning

Keep Setline purple as the primary brand/action color.

Do not create a third chromatic button color purely to create variety.

If additional colors are introduced, use them semantically.

For example:

```text
Green
→ successful / complete / synced

Pink/red
→ destructive

Purple
→ current primary action / selected brand state

Neutral
→ secondary and tertiary interaction
```

Avoid turning green into another generic CTA color.

Color should reduce cognitive load rather than merely add variety.

---

# 19. Audit the entire app for competing primary buttons

Perform a targeted audit of visible CTAs.

Look especially for screens where several large purple buttons appear above the fold.

Ask:

> Are all of these really primary at the same time?

If not, downgrade appropriate actions to secondary or tertiary variants.

Do not mechanically change every button.

Use context.

Multiple local Save buttons down a long form may be appropriate.

Several unrelated primary actions competing in the same viewport usually are not.

---

# 20. Today: improve empty-program / empty-workout state

The current Today screen may show both:

```text
Set up your training
```

and immediately below:

```text
Today's workout
No workout scheduled yet
```

These communicate almost the same dependency when the user does not yet have a training program.

Avoid redundant large cards.

For a new user, consider combining this into one meaningful training state.

Example:

```text
Today's training

No workout scheduled yet.

Create your first training program to automatically schedule workouts.

[ Start guided setup ]

Train without a program
```

Do not force the user to create a program before using workout logging if the existing product model supports an unscheduled/ad-hoc session.

---

# 21. Today controls must reflect actual state

Do not show actions whose wording assumes a state that does not exist.

Example:

If there is no scheduled workout:

```text
Swap today
Skip today
```

do not make semantic sense.

There is nothing to swap or skip.

Use state-sensitive actions.

Possible empty state:

```text
Choose workout
Start unscheduled workout
Set up program
```

When a workout is scheduled:

```text
Start workout
Preview
Change today's workout
Skip today
```

When a workout is in progress:

```text
Resume workout
```

Derive labels and available actions from state rather than rendering one static set of controls.

---

# 22. Preserve the strong Today structure

Do not broadly redesign Today.

The current workflow direction is good:

```text
Today's training
Morning weight
Mood + journal
Nutrition
Health sync
Today summary
```

Keep this structure.

Focus only on:

* removing redundant training empty states
* state-aware workout actions
* button hierarchy
* mobile spacing/safe-area polish

---

# 23. Exercise Progress mobile metrics can be more compact

On desktop, the three summary metrics work well:

```text
Top Set
Est. 1RM
Last Session Volume
```

On mobile, separate full-width cards for all three values consume a lot of vertical space.

Consider one compact card:

```text
Performance summary

Top set                 195 × 4
Estimated 1RM           221 lb
Last session volume     4,620 lb
```

Only make this responsive change if it clearly improves scanability and the existing component architecture supports it cleanly.

Do not sacrifice desktop readability.

---

# 24. Improve Progress empty state without fake data

The Progress page is structurally cleaner, but a brand-new account produces a very large mostly-empty screen.

Do not fill it with fake charts.

Instead, consider previewing the types of information that will eventually appear.

Example:

```text
No training history yet

Complete a workout or log a morning weight to unlock your trends.

Strength
Track top sets, PRs, and estimated strength.

Body weight
Follow your morning weight trend.

Consistency
See how regularly you've been training.
```

These should look like explanatory previews, not real metric cards containing fabricated data.

Do not overfill the page.

Whitespace is acceptable.

---

# 25. Mobile UX principles

The current mobile application is generally strong.

Preserve what is working.

Focus mobile effort on high-frequency interaction screens rather than redesigning every page.

Priority order:

1. Workout session logging
2. Today
3. Training editor
4. Progress
5. Settings

---

# 26. Mobile workout logging deserves special attention

The workout session is likely to be used while actively training.

Optimize for:

* touch targets
* minimal scrolling within one exercise
* quick numeric input
* avoiding accidental taps
* clear saved state
* easy Add Set
* clear current exercise
* easy navigation between exercises
* no hover-dependent controls
* keyboard behavior that does not obscure fields
* safe-area spacing around fixed navigation

Do not simply stack a desktop table.

---

# 27. Respect mobile safe areas and bottom navigation

The bottom navigation is working well.

Ensure content above it receives enough spacing that:

* Save buttons
* textareas
* workout controls
* final form fields

are never obscured.

Use safe-area environment variables where applicable.

---

# 28. Avoid excessive card usage

Continue evaluating whether every section deserves a rounded bordered card.

Use cards for conceptual grouping, but rely on:

* spacing
* typography
* dividers
* section headers

where sufficient.

The objective is stronger hierarchy, not more containers.

---

# 29. Preserve selected state vs primary action distinction

Purple currently appears in both navigation selection and primary actions.

That is acceptable, but the treatments should differ.

For example:

```text
Selected navigation/tab
→ light purple background / purple foreground

Primary CTA
→ solid purple background / white text
```

Avoid making all selected elements look like clickable primary buttons.

---

# 30. Empty states should remain actionable

Continue the good work already present in Progress and History.

Good empty-state pattern:

```text
What is missing
Why it matters
What the user can do next
```

Do not add CTAs when there is no useful next action.

---

# 31. Desktop Training acceptance criteria

The Training redesign should be considered successful when:

* guided setup is obvious for an unconfigured user
* guided setup does not permanently dominate configured users
* Workouts and Schedule no longer visually compete
* desktop space is used intentionally
* selecting a workout feels natural
* the selected workout is the dominant editing surface
* adding an exercise starts from one obvious action
* custom exercise creation is secondary
* there is no permanent One-off Changes documentation card
* the page does not feel like a collection of unrelated widgets

---

# 32. Button hierarchy acceptance criteria

After this change:

* purple no longer means "every clickable thing"
* destructive actions remain clearly destructive
* secondary actions are discoverable but quieter
* tertiary actions do not compete with primary actions
* there are fewer large competing purple surfaces above the fold
* no arbitrary third CTA color is introduced without semantic purpose

---

# 33. Today acceptance criteria

For each workout state, the correct actions should appear.

## No program

User sees a clear setup path and, if supported, a way to train without a program.

## Program exists but no workout scheduled

User can choose/start an appropriate workout.

Do not show "Swap" or "Skip" when there is nothing scheduled.

## Workout scheduled

User can:

```text
Start
Preview
Change today's workout
Skip
```

## Workout in progress

The primary action is:

```text
Resume workout
```

Avoid redundant Resume actions competing on the same screen.

---

# 34. Implementation approach

Do this incrementally.

Recommended order:

## Phase 1

Introduce or formalize action variants:

```text
primary
secondary
tertiary
destructive
```

Audit the relevant screens.

## Phase 2

Training architecture:

```text
Workouts | Schedule
```

Implement desktop master/detail Workouts layout.

## Phase 3

Guided setup onboarding banner.

Remove redundant top-level setup CTA.

## Phase 4

Redesign Add Exercise.

## Phase 5

Clean up Today state-specific workout controls.

## Phase 6

Small responsive improvements:

* guided setup mobile summary
* Progress metric compression
* safe areas
* workout logging polish

---

# 35. Testing

Update tests for behavior changed in this iteration.

At minimum cover:

* Training tab/view switching
* workout selection
* empty workout editor
* guided setup banner visibility
* setup banner hidden when no longer applicable
* existing exercise picker
* custom exercise Create & add
* button loading behavior if touched
* no invalid Today actions for empty states
* correct Today actions for scheduled workout
* responsive navigation where existing tooling supports it
* keyboard accessibility for tabs/dialogs/pickers

Avoid relying only on snapshot tests.

Test user-visible behavior.

---

# 36. UX rationale

Use established usability principles as the basis for these changes:

## Nielsen Norman Group — Visibility of system status

Use consistent interaction states and distinguish selected/active/primary states clearly.

Source:
Nielsen Norman Group, "10 Usability Heuristics for User Interface Design"

https://www.nngroup.com/articles/ten-usability-heuristics/

---

## Nielsen Norman Group — Aesthetic and minimalist design

Avoid repeated competing controls, unnecessary permanent instructional cards, and interfaces where every action receives equal emphasis.

Source:
Nielsen Norman Group, "10 Usability Heuristics for User Interface Design"

https://www.nngroup.com/articles/ten-usability-heuristics/

---

## Nielsen Norman Group — Recognition rather than recall

Workout selection, previous context, and explicit state-sensitive actions should reduce the amount users need to remember.

Source:
Nielsen Norman Group, "10 Usability Heuristics for User Interface Design"

https://www.nngroup.com/articles/ten-usability-heuristics/

---

## Nielsen Norman Group — Progressive disclosure

Use progressive disclosure for custom exercise creation and advanced configuration instead of displaying all controls simultaneously.

Source:
Nielsen Norman Group guidance on progressive disclosure

https://www.nngroup.com/articles/progressive-disclosure/

---

## Nielsen Norman Group — Choice overload

Reduce simultaneous competing actions and let each region communicate a clear next step.

Source:
Nielsen Norman Group, "Decision Making in UX"

https://www.nngroup.com/articles/decision-making/

---

## W3C / WCAG

Maintain accessible touch targets, keyboard operation, focus handling, dialogs, tabs, dynamic state announcements, and semantic controls.

Relevant sources:

https://www.w3.org/WAI/ARIA/apg/

https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

---

# 37. Most important design principle for this iteration

Do **not** attempt to make every available action visually obvious at all times.

Instead ask:

> What is the user trying to accomplish right now?

Then make that action dominant.

Everything else should become secondary, tertiary, contextual, or progressively disclosed.

For Training:

```text
Choose workout
→ edit workout
```

or:

```text
View schedule
→ change schedule
```

not both at once.

For Today:

```text
Do what today's state requires.
```

For Guided Setup:

```text
Help an unconfigured user get started.
```

For Add Exercise:

```text
Add an exercise.
```

The goal of this iteration is to reduce visual competition while preserving functionality and making the large-screen Training experience feel as intentional as the current mobile experience.
