# Setframe Training UX — Focused Empty-State and Layout Refinement

The latest Training iteration is an improvement, but the first-program / no-workouts state still has several usability and layout issues.

This is a **small targeted refinement**.

Do not redesign the guided setup flow, Today, Progress, navigation, or the broader application architecture.

Focus specifically on the Training → Workouts experience when:

* the user has no workouts
* the user has workouts but none selected
* the user selects a workout
* the user creates a new workout

Before changing code, inspect the current Training implementation and identify:

1. which component owns the "New workout" input
2. why the same input state appears in both the Workout library and the empty editor
3. how workout selection is currently represented
4. whether the left and right cards share form state
5. the responsive breakpoint that switches between stacked and master/detail layouts

Then implement the changes below.

---

# 1. Fix the duplicate workout-creation workflow

The current desktop and mobile Training UI exposes workout creation twice:

```text
Workouts

New workout
[ Upper A, Recovery Walk... ]

[ Create workout ]
```

and:

```text
Choose a workout to edit

Select a workout from your library or create a new one.

New workout
[ Upper A, Recovery Walk ]

[ Create workout ]
```

This is redundant.

There should be **one canonical place to create a workout**.

The Workout library should own creation.

Remove the duplicated workout-name field and Create Workout button from the right-side editor empty state.

---

# 2. The right panel should only edit or explain

The right side has one responsibility:

> Edit the selected workout.

When no workout is selected, show a true empty state rather than another creation form.

Desktop example:

```text
Choose a workout to edit

Select a workout from your library to configure its exercises and prescription.

No workouts yet?
Create your first workout in the Workout library.
```

Do not add another large CTA here if the creation control is already immediately visible in the left panel.

The goal is to avoid two competing paths for the same action.

---

# 3. Remove shared duplicate input state

Currently, typing a workout name in the left-side creation input causes the same value to appear in the right-side creation form.

This feels like unintended coupling.

After removing the duplicate form, ensure the workout creation input has a single local/source-of-truth state.

Creating a workout should:

1. validate the name
2. perform the creation
3. add it to the library
4. automatically select the newly created workout
5. clear the creation input
6. show the workout editor on the right

Expected transition:

```text
Before

Workout library             Editor
----------------            -------------------------
New workout                 Choose a workout to edit
[ Lower C ]
[ Create workout ]
```

After creating:

```text
Workout library             Lower C
----------------            -------------------------
> Lower C                   Build the exercise list...
  Upper A

New workout
[              ]
[ Create workout ]
```

Do not make the user create a workout and then manually find/select the thing they just created.

---

# 4. Make the workout-creation requirement obvious

The current Create Workout button appears disabled until text is entered, but the UI does not clearly explain why it is disabled.

A user should not have to infer:

> I need to start typing before this button becomes enabled.

Use explicit helper copy.

Example:

```text
New workout

Workout name
[ e.g. Lower C ]

Enter a workout name to create it.

[ Create workout ]
```

Once meaningful text has been entered:

```text
[ Create workout ]
```

becomes enabled.

Do not rely on opacity alone to communicate the requirement.

---

# 5. Improve the placeholder

Current placeholder:

```text
Upper A, Recovery Walk...
```

This is acceptable but slightly ambiguous because it can look like multiple workouts may be entered at once.

Prefer a single concrete example:

```text
e.g. Lower C
```

or:

```text
e.g. Upper A
```

The field creates **one workout**, so the placeholder should demonstrate one workout name.

---

# 6. Keep the creation control compact

The desktop creation form does not need a huge full-width primary button if that makes the small library panel visually heavy.

Use a compact but clearly primary pattern.

For example:

```text
Workout name
[ e.g. Lower C                   ]

[ + Create workout ]
```

The exact layout can vary by breakpoint.

Desktop:

* button may size to content or use a sensible consistent width
* avoid creating a giant purple slab inside a narrow utility panel

Mobile:

* a full-width button is acceptable because it is easier to tap and visually works well in the narrow layout

Use responsive behavior rather than forcing one button geometry across all breakpoints.

---

# 7. Fix desktop vertical alignment

The current desktop master/detail layout looks visually unbalanced because:

* the left card is much shorter
* the right card contains a second creation form
* button dimensions differ significantly
* content baselines do not align well

Removing the duplicate creation form should simplify this.

For desktop master/detail:

```text
┌ Workouts ─────────────┐  ┌ Workout editor ──────────────────────┐
│                       │  │                                      │
│ workout list          │  │ selected workout / empty state       │
│                       │  │                                      │
│ + create area         │  │                                      │
└───────────────────────┘  └──────────────────────────────────────┘
```

Requirements:

* top edges aligned
* consistent card border radius
* consistent internal padding
* consistent heading baseline treatment
* do not force equal card heights just for symmetry
* do make the overall composition look intentional

It is okay for the right editor to be taller.

The problem is misalignment, not unequal height by itself.

---

# 8. Reconsider whether the creation form needs its own card

Evaluate whether the left Workout library should conceptually be:

```text
Workouts

+ New workout

Lower C
Upper A
Recovery
```

rather than permanently exposing the text input.

A potentially cleaner interaction is:

```text
Workouts

[ + New workout ]

Lower C
Upper A
Recovery
```

Clicking `+ New workout` could reveal the small creation form inline:

```text
Workout name
[ e.g. Lower C ]

Create     Cancel
```

This is progressive disclosure and would reduce visual noise.

However:

* do not introduce extra clicks if the current always-visible form is clearly more efficient
* prefer the approach that provides the best balance of clarity and repeated-use efficiency

If using progressive disclosure, ensure keyboard focus moves into the new input and Cancel returns focus appropriately.

---

# 9. Empty library state should actively teach creation

When there are zero workouts, don't make the left panel look like a generic form without context.

Consider:

```text
Workouts

No workouts yet.

Create reusable workouts like Lower C, Upper A, or Recovery.

Workout name
[ e.g. Lower C ]

[ Create workout ]
```

Once workouts exist, the empty explanation disappears and the library becomes primarily a selection list.

This allows the interface to change appropriately as the user's state changes.

---

# 10. Once workouts exist, prioritize the workout list

Example:

```text
Workouts

Lower C
Upper A
Recovery

+ New workout
```

The persistent content should become the workouts themselves, not the form for making more workouts.

The user will edit workouts far more frequently than create new workout templates.

Design the hierarchy accordingly.

---

# 11. Automatically select the first/new workout where appropriate

Avoid unnecessary empty editor states.

Rules to consider:

## Zero workouts

Show the no-workouts creation state.

## First workout created

Automatically select it.

## Existing workouts and no explicit selection

If it is safe and consistent with routing/state behavior, automatically select the first or previously selected workout.

Do not automatically override an explicit user selection.

If preserving the previous selection across navigation is straightforward and reliable, prefer that.

---

# 12. Empty editor state should be visually quiet

The current right-side empty state is visually large and contains another primary action.

After removing duplicate creation, make it quieter.

Example:

```text
Choose a workout to edit

Select a workout from the library to view its exercises and prescription.
```

Optionally include a subtle illustration/icon if the existing design system already has an appropriate one.

Do not add decorative assets solely for this change.

Do not add another purple CTA.

---

# 13. Do not introduce a green generic action button

We considered introducing another action color because purple appears frequently throughout Setframe.

Do **not** add green as a generic alternative CTA color.

Keep the semantic action hierarchy:

```text
Primary
→ solid purple

Secondary
→ neutral / outlined

Tertiary
→ text / ghost

Destructive
→ pink/red
```

Green should be reserved for positive status or completion where useful.

Examples:

```text
✓ Saved

✓ Synced

✓ Workout complete

✓ Health connected
```

Potentially a green status icon/badge.

Do not create:

```text
green Save button
green Create button
green Next button
```

merely to add visual variety.

Color should communicate meaning.

---

# 14. Neutral/text buttons are intentional

The recently introduced borderless/text-style button treatment is directionally correct for tertiary actions.

Examples:

```text
Switch to full editor
Cancel
View history
Show details
```

Improve hover/focus states as needed, but do not give every action a filled background.

Interaction hierarchy should come from:

* placement
* label
* weight
* shape
* state
* color

rather than every button becoming a colored rectangle.

---

# 15. Button consistency does not mean equal width everywhere

Do not force all buttons to exactly the same width across unrelated contexts.

Instead use consistent sizing rules.

For example:

```text
compact
default
full-width
```

Potential usage:

Desktop library:
`default` or compact

Desktop primary form:
`default`

Mobile primary form:
`full-width`

Dialog:
`default`

Bottom-sheet action:
possibly `full-width`

````

What matters is consistency **within context**.

The current screenshot feels inconsistent because two adjacent cards perform the same action using completely different button geometry.

Removing duplicate actions should resolve most of this.

---

# 16. Guided setup banner is now good

Do not significantly redesign the new Training onboarding banner.

The current direction:

```text
NEW TO SETFRAME?

Build your training program
Create your workouts and weekly schedule in a few guided steps.

Start guided setup →
````

is much better than the old floating white header button.

Preserve it.

Potential minor polish only:

* keep maximum readable content width
* ensure spacing aligns with Training content
* keep it visually quieter than the Resume Workout active-state banner
* hide it once onboarding/program setup is no longer relevant

Do not spend this iteration redesigning it again.

---

# 17. Guided program setup is also in a good place

The current wizard layout is substantially improved.

Do not redesign the stepper.

Keep:

```text
Program
Workouts
Exercises
Schedule
```

The current lower-emphasis:

```text
Switch to full editor
```

treatment is appropriate.

The collapsed "What you've built / Show details" pattern is also moving in the right direction.

Only fix bugs or obvious responsive issues discovered during implementation.

---

# 18. Desktop Workouts target state

The resulting desktop experience should feel approximately like:

```text
Training
Manage the workouts and schedule in your program.

[ onboarding banner when applicable ]

[ Workouts ] [ Schedule ]


┌ Workouts ─────────────────────┐   ┌ Choose a workout to edit ─────────────┐
│                               │   │                                      │
│ No workouts yet.              │   │ Select a workout from your library    │
│ Create your first workout.    │   │ to configure its exercises.          │
│                               │   │                                      │
│ Workout name                  │   │                                      │
│ [ e.g. Lower C              ] │   │                                      │
│                               │   │                                      │
│ Enter a workout name.         │   │                                      │
│ [ Create workout ]            │   │                                      │
└───────────────────────────────┘   └──────────────────────────────────────┘
```

After creation:

```text
┌ Workouts ─────────────────────┐   ┌ Lower C ──────────────────────────────┐
│                               │   │                                      │
│ ● Lower C                     │   │ Build the exercise list...            │
│                               │   │                                      │
│ + New workout                 │   │ exercises...                          │
│                               │   │                                      │
└───────────────────────────────┘   └──────────────────────────────────────┘
```

The selected workout should become the dominant surface.

---

# 19. Mobile target state

Do not mirror the desktop two-column layout.

Zero workouts:

```text
Training

[ setup banner ]

Workouts | Schedule

Workouts

No workouts yet.
Create your first workout.

Workout name
[ e.g. Lower C ]

[ Create workout ]
```

Do not immediately follow it with a second huge:

```text
Choose a workout to edit
```

card if there is nothing the user can select.

On mobile with zero workouts, that second empty-state card can be omitted entirely.

Once a workout exists, show/select it and display the editor appropriately.

This reduces unnecessary vertical scrolling.

---

# 20. Responsive empty-state logic

This is important.

Do not show UI merely because desktop has space for it.

## Desktop with zero workouts

It is okay to show the right empty editor because it reinforces the master/detail model.

## Mobile with zero workouts

Prefer showing only the actionable creation state.

There is little value in stacking a large "Choose a workout to edit" card underneath when no workouts exist.

## Mobile with workouts but none selected

Then:

```text
Choose a workout to edit
```

may be appropriate.

Use responsive/contextual state rather than identical markup everywhere if doing so materially improves usability.

---

# 21. Focus and keyboard behavior

After successful workout creation:

* automatically select the workout
* move focus appropriately into the new workout experience only if doing so is helpful and not disorienting
* do not unexpectedly focus arbitrary fields

For inline New Workout expansion:

* focus the input
* Escape/Cancel should close it
* return focus to `+ New workout`

Ensure visible focus styles are maintained.

---

# 22. Loading state

Workout creation is an API mutation.

Use the existing async button pattern.

Example:

```text
[ Creating… ]
```

During submission:

* prevent duplicate creation
* preserve the typed name if the request fails
* show an inline or nearby error
* do not clear the input until creation succeeds

Example error:

```text
Couldn't create this workout. Try again.
```

On success:

* clear input
* insert/select workout
* announce success appropriately if needed

---

# 23. Validation

Trim whitespace.

Do not allow an all-whitespace workout name.

Respect existing length constraints.

If duplicate names are prohibited, provide a user-friendly inline message.

Examples:

```text
Enter a workout name.
```

```text
A workout named "Lower C" already exists.
```

Do not expose raw API/backend validation messages.

---

# 24. Tests

Update tests for:

* only one workout creation form exists in the relevant UI state
* typing in the creation input does not mutate unrelated editor state
* Create Workout disabled/enabled state or validation behavior
* helper/error text
* whitespace validation
* successful workout creation
* input clears after success
* new workout automatically becomes selected
* failed creation preserves input
* desktop empty editor
* mobile zero-workout state does not show redundant editor card
* accessible keyboard/focus behavior for New Workout if progressive disclosure is used

Avoid relying solely on snapshots.

---

# 25. UX principles

Apply these principles:

## Single source of interaction truth

One user intention should not have multiple competing controls unless those paths serve genuinely different contexts.

Here:

```text
Create workout
```

should have one canonical interaction.

---

## Recognition over recall

Do not expect users to infer why a control is unavailable.

Tell them:

```text
Enter a workout name to create it.
```

---

## Progressive disclosure

Creation controls should become less visually prominent once workouts already exist.

The user's primary repeated workflow eventually becomes selecting and editing workouts.

---

## Aesthetic and minimalist design

Do not solve alignment problems with arbitrary equal heights or decorative elements.

Remove redundant functionality first.

---

## Match the system to the user's mental model

The user thinks:

```text
I create a workout in my workout library.
Then I edit that workout.
```

Not:

```text
I can create one on the left or create the same thing inside an empty editor.
```

---

# 26. Definition of done

This iteration is complete when:

* there is only one workout creation interaction
* no shared duplicated input state exists
* zero-workout users clearly understand how to create their first workout
* disabled/validation behavior is self-explanatory
* creating a workout automatically transitions into editing it
* desktop cards align intentionally
* duplicate mismatched Create Workout buttons are gone
* mobile does not show redundant empty-state content
* guided setup remains intact
* no generic green CTA system is introduced
* green remains available for semantic success/completion states
* the Training page feels like a library + editor rather than two forms competing with one another

Do not expand the scope beyond these items unless a directly related implementation defect prevents the requested behavior.
