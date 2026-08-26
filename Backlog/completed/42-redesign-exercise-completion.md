# Story 42 — Redesign Exercise Completion Into a Rewarding Workout Progress State

## User Story

As a user actively logging a workout,  
I want completing all required sets for an exercise to transform that exercise into a clear, compact, rewarding completed state,  
so that I immediately understand that I am finished with that exercise, feel progress throughout the workout, and can move naturally to the next thing without continuing to manage already-completed inputs.

---

## Screenshot / Gym-Test Evidence

The current completed-exercise implementation is visible in the attached screenshot.

After completing an exercise, the current implementation:

- adds a light tinted background
- adds a green border
- displays a small `✓ Complete` label
- keeps the existing exercise header structure
- keeps the large card footprint
- keeps the overflow action visually prominent
- summarizes the exercise using a dense string such as:

`5 sets · 135 lb · 8 reps → 195 lb · 6 reps`

While this technically distinguishes a completed exercise from an incomplete one, it does not meaningfully change the experience of completing an exercise.

The completed state currently feels like **the regular exercise card with success colors applied to it**.

That is not the intended product experience.

---

# Problem Statement

Workout logging is inherently repetitive.

Users may enter dozens of values across:

- exercises
- sets
- weights
- reps
- duration
- distance
- RPE
- other representation-specific fields

There is little intrinsic enjoyment in entering this information.

Setframe therefore needs to give users **small moments of feedback and accomplishment throughout the workout**.

Exercise completion is an ideal moment for that.

The current implementation does not provide that reward.

It also misses another important opportunity: once an exercise is complete, the user generally does **not need to continue seeing all of its editing UI**.

Completion should therefore accomplish two things simultaneously:

1. **Reward the user**
2. **Reduce cognitive and visual load**

The current implementation does neither particularly well.

---

# UX / Product Intent

Exercise cards should behave as distinct states throughout a workout.

The experience should feel like progressing through a list of tasks rather than filling out a long spreadsheet.

Conceptually:

```text
UPCOMING
    ↓
ACTIVE
    ↓
SAVING
    ↓
COMPLETE
```

Each state should have a deliberately different UX.

Completion is not simply:

```ts
completed ? greenBorder : normalBorder
```

It is a meaningful product state.

---

# Exercise State Model

## 1. Upcoming

An exercise has not yet been actively edited.

It should communicate:

- exercise name
- planned prescription
- completion progress if relevant

Example:

```text
Barbell Back Squat
Planned 4 × 6

0 of 4 sets complete
```

The card should remain visually neutral.

---

## 2. Active

The user is currently working on the exercise.

This may occur when:

- the exercise is expanded
- one of its fields is focused
- one or more sets have been modified
- the user explicitly expands the exercise

The active state prioritizes input.

This is where detailed editing controls live.

---

## 3. Saving

Setframe should use optimistic updates where appropriate.

The user should not have to wait for sequential API requests before continuing through their workout.

Saving should be unobtrusive.

Do not block the entire exercise because one set is persisting.

If necessary, surface a subtle saving state.

Example:

```text
Saving…
```

Do not turn this into a large spinner or interruption.

---

# 4. Complete

Once every required set contains the required valid data and persistence succeeds, the exercise should automatically transition into its completed presentation.

**This must be a materially different layout.**

Do not simply add a badge to the existing active card.

---

# Completed Exercise Redesign

Use the existing **Workout Complete** treatment elsewhere in Setframe as visual and emotional inspiration.

Do **not** duplicate that card directly.

Exercise completion should be a smaller version of the same design philosophy:

- success
- progress
- positive feedback
- clear hierarchy
- reduced complexity

---

## Proposed Completed Card Structure

Conceptually:

```text
┌───────────────────────────────────────┐
│  ✓   Barbell Back Squat          ⋮   │
│      5 sets completed                 │
│                                       │
│   TOP SET       VOLUME      VS LAST   │
│   195 × 6       4,575 lb    ↑ 10 lb   │
└───────────────────────────────────────┘
```

This does **not** need to be implemented literally.

Claude/Figma may improve the layout.

The important product requirements are:

- significantly more compact than expanded input mode
- clear exercise title
- unmistakable completion indicator
- meaningful summary data
- subtle access to secondary actions
- visually rewarding
- visually quieter than active input mode

---

# Completion Visual Language

Use Setframe's success green intentionally.

The current lavender-filled card with a thin green border does not create enough semantic distinction.

Explore a composition using:

- very light success tint
- green accent
- success checkmark
- subtle highlight/halo
- neutral text hierarchy
- restrained animation

Avoid turning the entire interface bright green.

The goal is **reward**, not visual noise.

---

# Completion Icon

The completion icon should carry more visual weight than the current inline checkmark.

Consider something closer to the visual language already used by the Workout Complete card:

```text
✓
```

inside a circular success treatment.

Potentially:

- 32–40 px success circle
- subtle background ring
- short completion animation

The icon should immediately communicate:

> This exercise is finished.

Do not rely solely on color.

---

# Do Not Make “Complete” the Main Content

The current implementation inserts:

`✓ Complete`

into an already crowded header.

That creates additional visual competition.

The completed layout should make completion obvious through:

- structure
- iconography
- color
- collapsed state
- summary

If `Completed` text remains, it should be secondary metadata rather than another headline.

---

# Replace Database-Like Summary Strings

Avoid summaries like:

```text
5 sets · 135lb · 8 reps → 195lb · 6 reps
```

This technically describes the session but requires interpretation.

Instead show metrics users care about.

For a sets-and-reps strength exercise, examples include:

### Sets Completed

```text
5 sets
```

### Top Set

```text
195 lb × 6
```

### Volume

```text
4,575 lb
```

### Historical Comparison

When enough history exists:

```text
↑ 10 lb vs last session
```

or:

```text
+8% volume
```

or:

```text
Matched last session
```

or:

```text
Volume PR
```

Only show metrics that are meaningful and supported by actual data.

Do not fabricate comparisons when historical data is unavailable.

---

# Representation-Aware Completion Summary

The completed state must respect Setframe's exercise representation model.

Do not force strength metrics onto every exercise.

Examples:

### Sets + Reps

Possible metrics:

- sets
- top set
- volume
- total reps
- PR
- comparison to previous session

### Bodyweight Reps

Possible metrics:

- total reps
- sets
- best set
- comparison with previous session

### Duration

Possible metrics:

- duration
- comparison to previous duration

### Distance

Possible metrics:

- distance
- duration if available
- pace if legitimately derivable

### Distance + Duration

Possible metrics:

- distance
- duration
- pace

### Timed Sets

Possible metrics:

- number of intervals
- total duration
- longest interval

Do not display irrelevant metrics.

---

# Auto-Collapse on Completion

Once all required data for the exercise is complete and successfully persisted:

1. determine that the exercise is complete
2. transition to completed state
3. collapse the detailed set editor
4. show the compact completed card

The user should **not have to manually collapse the exercise**.

---

# Progression Toward the Next Exercise

Once an exercise completes, Setframe should help the user continue.

After collapsing the completed exercise:

- identify the next incomplete exercise
- make the next exercise visually easy to locate
- optionally bring it into a comfortable viewport position
- do not aggressively hijack scrolling

Do not automatically focus a form field unless research/testing indicates that behavior is desirable.

The objective is orientation, not forced interaction.

---

# Only One Primary Working Exercise

The workout should increasingly behave like a focused workflow.

If the user begins interacting with another exercise:

- the previous active exercise may collapse
- its completion state should be recalculated
- completed exercises remain in compact success state
- incomplete exercises return to their appropriate neutral/in-progress state

Avoid leaving multiple enormous exercise editors open unless the user explicitly chooses to do so.

---

# Completed Exercise Must Remain Editable

Completion is not irreversible.

Users make mistakes.

Tapping the completed exercise should allow the user to expand it again and review/edit individual sets.

When reopened:

```text
COMPLETE
   ↓
EDITING
```

After the user changes data:

- recalculate validity
- update derived metrics
- update completion state
- persist changes
- collapse again when appropriate

If required data becomes incomplete, the exercise must return to an incomplete state.

---

# Overflow Menu

The existing large circular kebab action currently competes visually with the completed state.

Retain access to necessary actions, but visually demote them.

Possible actions include:

- edit/reopen
- remove from today's workout
- other existing contextual actions

The overflow menu must remain accessible but should not appear equally important as exercise completion.

---

# Microinteraction

Exercise completion is an appropriate place for a restrained success interaction.

Explore:

- checkmark animation
- subtle success fade
- border/tint transition
- very small scale transition
- native haptic feedback where appropriate

Keep it brief.

Approximately:

```text
150–350ms
```

Avoid:

- confetti after every exercise
- large screen animations
- audio
- excessive bouncing
- anything that delays workout logging

The interaction should feel satisfying after the twentieth exercise too.

---

# Reduced Motion

Respect reduced-motion preferences.

When reduced motion is enabled:

- no scale animation
- no unnecessary movement
- state change remains immediately understandable

---

# Optimistic Update Integration

Completion UX must work with the optimistic set-saving behavior introduced into the workout logging experience.

The UI should not require:

```text
save set 1
wait
save set 2
wait
save set 3
wait
```

Users must be able to continue logging.

Each mutation should:

1. optimistically update local state
2. update completion calculation
3. persist independently
4. reconcile server response
5. roll back or surface an actionable error if persistence fails

Do not mark an exercise permanently completed if required persistence ultimately fails.

---

# Derived Completion State

Do not store exercise completion merely as a presentation boolean unless the architecture specifically requires persisted state.

Completion should primarily be derived from the actual exercise data.

Conceptually:

```ts
isExerciseComplete =
  requiredSets.every(set =>
    requiredFieldsForRepresentation.every(field =>
      isValid(set[field])
    )
  )
```

Representation type determines required fields.

Optional fields must **not** prevent completion.

Example:

For weighted sets + reps:

Required:

- weight
- reps

Optional:

- RPE

Therefore:

```text
Weight ✓
Reps ✓
RPE blank

= COMPLETE
```

RPE should not block completion.

---

# Completion Must Not Depend on Zero Being Falsy

Be careful with valid zero values.

Examples:

- bodyweight exercise weight may legitimately be `0`
- assisted or representation-specific values may allow zero

Do not use logic such as:

```ts
if (!weight)
```

when zero can be a valid value.

Validate according to the domain rules.

---

# Performance Summary Should Be Derived

The summary shown on the collapsed completed card should use actual logged data.

Do not summarize planned data as completed performance.

For example:

Planned:

```text
3 × 8
```

Actual:

```text
135 × 8
155 × 8
175 × 6
```

The completion card should summarize **actual performance**.

---

# Empty Historical Comparison

When there is no useful history:

Do not show:

```text
vs last —
```

or placeholder UI simply to preserve layout.

Instead use the available metrics.

Example:

```text
3 sets
Top set 175 × 6
Volume 3,610 lb
```

The card can evolve as more history becomes available.

---

# Future Insight Architecture

Design this state so that future Setframe insights can be introduced without redesigning the entire card.

Eventually an exercise completion might surface:

```text
Strongest set this month
```

or:

```text
Volume is up 12% over your last 4 sessions
```

or:

```text
You added 10 lb while maintaining reps
```

Do **not** implement AI coaching in this story.

But avoid a rigid layout that prevents contextual insight from being added later.

This is important to the long-term Setframe product direction:

> logging data should result in useful feedback.

---

# Acceptance Criteria

- [ ] Exercises support explicit Upcoming, Active, Saving, and Complete UX states.
- [ ] Exercise completion remains a derived domain state based on valid required inputs.
- [ ] Required fields vary according to exercise representation.
- [ ] Optional fields such as RPE do not block completion.
- [ ] Valid zero values are handled correctly.
- [ ] Completing all required sets automatically collapses the exercise.
- [ ] Completion produces a materially redesigned compact state rather than merely adding success styling to the active card.
- [ ] Completed state uses success semantics without relying solely on color.
- [ ] Completed state contains a recognizable success icon.
- [ ] Completed state uses substantially less vertical space than the expanded editor.
- [ ] Completed state summarizes actual workout performance.
- [ ] Strength exercises may show sets, top set, volume, and historical comparison when appropriate.
- [ ] Non-strength representations show representation-appropriate metrics.
- [ ] Irrelevant metrics are not displayed.
- [ ] Historical comparison is displayed only when meaningful historical data exists.
- [ ] Completed exercises remain editable.
- [ ] Reopening a completed exercise exposes the individual sets.
- [ ] Changing required values recalculates completion immediately.
- [ ] Removing required data returns the exercise to an incomplete state.
- [ ] Saving behavior supports optimistic interaction.
- [ ] Users are not blocked from editing another set while a previous mutation is pending.
- [ ] Failed persistence is surfaced and reconciled appropriately.
- [ ] The overflow action remains available but visually secondary.
- [ ] Completion includes a restrained microinteraction.
- [ ] Reduced-motion preferences are respected.
- [ ] Completing an exercise helps orient the user toward the next incomplete exercise.
- [ ] Completion does not aggressively alter scroll position.
- [ ] No completed state causes horizontal scrolling.
- [ ] Layout works at narrow mobile-web widths.
- [ ] Desktop responsive behavior remains intentional.
- [ ] Native mobile receives equivalent product behavior and appropriate platform-specific presentation.
- [ ] Existing ability to add/remove exercises only for the active workout remains functional.
- [ ] Template/program workout definitions are not modified by exercise-completion state changes.

---

# Product-Wide Definition of Done

## Mobile-First Responsive Web

- Begin implementation and testing at narrow mobile widths.
- No horizontal page scrolling.
- No clipped content.
- No overlapping sticky controls.
- No viewport overflow from cards, menus, tooltips, or animations.
- Verify iOS Safari behavior.

## Mobile Application Parity

The equivalent workflow must exist in the mobile application.

Visual implementation may be platform-native, but:

- behavior
- state model
- completion logic
- information hierarchy
- performance summaries

must remain functionally equivalent.

## Accessibility

- Completion is not conveyed by color alone.
- Interactive controls have accessible names.
- Expanded/collapsed state is communicated appropriately.
- Keyboard navigation works on web.
- Focus behavior remains predictable.
- Touch targets meet appropriate minimum sizes.
- Screen readers receive useful completion state information.
- Reduced-motion preferences are honored.

## Loading / Saving / Error States

Explicitly test:

- initial loading
- optimistic saving
- slow network
- mutation failure
- retry
- offline/temporary connection loss where supported
- stale server response
- reopening previously completed data

## Behavioral Tests

Add tests for at least:

- required-field completion
- optional-field omission
- zero-value handling
- automatic collapse
- reopening completed exercise
- editing completed exercise
- reverting to incomplete
- representation-aware metrics
- optimistic updates
- failed optimistic update reconciliation
- historical comparison availability
- next-exercise progression

## GitHub Reviewer

Run the GitHub/code reviewer against the completed implementation.

Verify:

- domain state is not duplicated unnecessarily
- completion logic is not scattered across presentation components
- representation rules use shared domain logic
- optimistic cache updates are safe
- server reconciliation works
- no template data is mutated accidentally
- no unrelated scope creep

## Figma Reviewer

Review web mobile and native mobile side by side.

Specifically inspect:

- visual reward
- hierarchy
- completed-card density
- success semantics
- next-exercise orientation
- active vs complete differentiation
- responsive behavior

The design review should explicitly answer:

> Does completing an exercise actually feel meaningfully better than it did before?

A green border alone does **not** satisfy this requirement.

---

# Claude Steering Document

## Read This Before Writing Code

This story exists because the previous implementation technically fulfilled a requirement while missing the intended experience.

Do not approach this ticket as:

> “Improve the styles of completed exercise cards.”

The problem is larger.

We are redesigning the **interaction state of a completed exercise**.

---

## Core Product Principle

Workout logging asks the user to perform repetitive data entry.

Setframe should continuously repay that effort with:

- clarity
- reduced friction
- visible progress
- meaningful summaries
- small moments of accomplishment

Exercise completion is one of those repayment moments.

---

## Explicitly Avoid the Previous Implementation Pattern

Do not:

1. keep the existing exercise header unchanged
2. add `Complete`
3. change the border green
4. tint the background
5. consider the story finished

That implementation has already been evaluated and rejected.

---

## Start With State Architecture

Before touching CSS, understand:

```text
Upcoming
Active
Saving
Complete
```

Trace:

- where exercise state comes from
- how set validity is determined
- how representation type affects required data
- how optimistic mutations currently work
- how workout templates differ from active-session exercise data
- how progress/history metrics are calculated

Keep domain logic out of visual components where practical.

---

## Then Redesign the Completed Presentation

The completed view should almost feel like a different component mode.

Think:

```tsx
<ExerciseCard>
  {state === 'complete'
    ? <CompletedExerciseSummary />
    : <ExerciseEditor />
  }
</ExerciseCard>
```

This is conceptual, not mandated architecture.

The important point is that the complete state deserves its own information hierarchy.

---

## Preserve Active Workout Customization

This work must **not** disrupt the existing ability to customize today's workout.

A user must still be able to:

- add an exercise to today's active session
- remove an exercise from today's active session
- modify sets
- add sets
- remove sets

These operations affect the active session only unless the user explicitly edits the template elsewhere.

Never accidentally propagate today's workout customization back into the program template.

---

## Optimize for Gym Conditions

Remember how this interface is actually used.

The user may be:

- standing
- moving
- sweating
- between sets
- holding their phone with one hand
- distracted
- trying to log something in a few seconds

The completed state should help the interface progressively become simpler as the workout progresses.

A workout with:

```text
8 exercises
```

should visually feel like it is shrinking as exercises are completed.

That is a feature.

---

## Use Completion to Create Momentum

The desired feeling is:

```text
enter data
↓
save
↓
exercise finished
↓
small reward
↓
UI simplifies
↓
next exercise becomes obvious
↓
continue
```

We want momentum.

Not more administration.

---

## Design Quality Bar

Use the existing Workout Complete card as an emotional reference.

It communicates:

> You accomplished something.

Exercise completion should communicate the same thing at a smaller scale.

Do not literally duplicate the Workout Complete card.

Create a hierarchy:

```text
Set saved        → tiny feedback
Exercise done    → small reward
Workout done     → strongest reward
```

That gives Setframe a coherent accomplishment system.

---

## Think Beyond This Screenshot

The goal is not to make one screenshot prettier.

The goal is to establish a reusable exercise lifecycle that can later support:

- PR celebrations
- comparison with previous sessions
- progressive overload feedback
- historical trend snippets
- OpenAI-generated insights
- coaching
- adaptive programming

Do not implement those future systems now.

Build today's state in a way that does not block them.

---

## Final Review Question

Before marking this story complete, inspect the implementation on an actual mobile viewport and ask:

> If a user just finished a difficult exercise, does this transition feel satisfying?

Then ask:

> Is the interface now easier to understand than it was before the exercise was completed?

Both answers must be **yes**.

If the only visible difference is some green styling and a completion label, this story is not done.

---

# Additional Product Note

This should be treated as **a correction to the interaction model**, not another styling pass.

The current implementation technically satisfies “show a completed state,” but it misses what we were actually trying to accomplish: **make finishing an exercise feel satisfying while simultaneously making the workout easier to navigate.**

This should remain one story rather than breaking the visuals, auto-collapse, summary, and completion semantics apart—they're all parts of the same interaction and Claude needs to understand the **whole emotional arc** to implement any one of them correctly.

The important side effect is that if we nail this, the workout page starts naturally transforming as you move through it: the giant data-entry form gradually becomes a compact record of accomplishments. That's a much stronger experience than a static list of forms from beginning to end.
