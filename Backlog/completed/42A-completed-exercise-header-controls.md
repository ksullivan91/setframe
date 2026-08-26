# Story 42A — Simplify Completed Exercise Header Controls

## Product Conversation Context

### User Prompt

> Okay, we’ve made some progress here but this isn’t totally complete yet. We are reviewing 42 again. Keep in mind this is when the planned workout for the day is complete, therefore all exercises are complete. I’ve not been able to test this again when it’s an active workout.
> 
> First screenshot,
> The ellipsis menu doesn’t do anything when the workout is complete. That’s okay. However, let’s just remove this icon when the workout is complete. Let’s put the green circled check mark locked to the right side. You’ll see in screenshot two that when you expand the menu, the arrow is visible. Let’s always have the arrow visible locked into the position that the green check mark is at in the screenshot. Again, remove the ellipsis.
> 
> Screenshots 3/4,
> Also, the save, copy, and delete buttons are disabled when the workout is complete. So let’s go ahead and remove those once the workout is complete (only once the user has marked the workout has complete.)
> 
> One more thing on these screenshots. I want the pills that the labels, “planned xlb - y reps” to have a purple background with white text color. Regardless of the state the workout is in
> 
> Can you write up the stories for me in markdown for Claude. Please include all of this prompt and your response inside the markdown files

### Assistant Response

> This should stay framed as a Story 42 follow-up rather than creating unrelated backlog items. The visual direction is much stronger now, but the completed-workout state still exposes controls that no longer have a meaningful action and it is mixing the completion icon with the expand/collapse affordance.
> 
> I would split the remaining work into three tightly scoped follow-up stories:
> 
> 1. **Story 42A — Simplify completed exercise headers and preserve expand/collapse affordance.** When the overall workout has been marked complete, remove the non-functional ellipsis, keep the green completion indicator as a status cue, and give the expand/collapse arrow a stable dedicated position so the user can always tell that completed exercises remain reviewable.
> 2. **Story 42B — Remove inactive set-editing controls after workout completion.** Once the overall workout is complete, do not render Save, Copy, Delete, or other mutation controls that are intentionally disabled. The completed workout becomes a review experience, not a disabled editor. Active workouts must retain the current editing behavior.
> 3. **Story 42C — Standardize planned-prescription pills.** Give every `Planned: ...` pill the same purple background and white text treatment regardless of exercise state so planned-versus-actual information has a consistent visual language across active, incomplete, completed, and post-workout review states.
> 
> The important state boundary is **workout completion**, not merely exercise completion. A completed exercise inside an active workout still needs its workout-time controls when reopened because the user may continue editing it. These removals should only happen once the parent workout/session is marked complete.
> 
> I’d also make Claude explicitly preserve the stronger completed-card design from the current iteration rather than accidentally “simplifying” it back into the earlier flat state. The changes here should reduce dead controls and clarify hierarchy without undoing the progress already made.


## User Story

As a user reviewing a workout that I have already marked complete,  
I want each completed exercise header to show only meaningful status and navigation controls,  
so that the review experience feels intentional instead of showing dead actions.

## Screenshot / Gym-Test Evidence

In the completed-workout screenshots:

- each exercise is shown in the new green completed card treatment
- the green circled check mark communicates successful completion
- the ellipsis control is still rendered even though it performs no useful action in this state
- when the exercise is expanded, the expand/collapse arrow becomes visible
- the arrow and completion check currently compete for the same visual territory

The visual design is improved, but the header hierarchy is not yet resolved.

## Problem Statement

A completed workout is a review state. Controls that do nothing should not remain visible merely because they existed during the active workout. At the same time, completed exercises must remain expandable so users can inspect the underlying sets.

## UX / Product Intent

For a workout whose **parent session has been marked complete**:

- remove the ellipsis/overflow action from the exercise header when it has no meaningful completed-state actions
- keep the green circled check mark as a completion-status cue
- keep the expand/collapse arrow always visible
- give the arrow its own stable dedicated position
- do not swap the arrow and completion icon in and out of the same location
- preserve the compact completed-card design from Story 42

### Important State Boundary

This behavior is based on **workout/session completion**, not exercise completion alone. A completed exercise inside an otherwise active workout may still need active-session actions.

## Recommended Header Hierarchy

```text
┌─────────────────────────────────────┐
│ ✓  Barbell Back Squat          ˅   │
│    4 sets completed                 │
│                                     │
│    Top set          Volume          │
│    195 × 6          4,095 lb        │
└─────────────────────────────────────┘
```

The exact layout can evolve, but the completion icon should read as status, the chevron should read as navigation, and no dead ellipsis should appear.

## Acceptance Criteria

- [ ] When the parent workout is complete, the exercise-header ellipsis is not rendered if it has no meaningful completed-state action.
- [ ] The green circled check remains visible in the collapsed completed state.
- [ ] The expand/collapse arrow is always visible for completed exercises that can be expanded.
- [ ] The arrow occupies a stable, predictable location in both collapsed and expanded states.
- [ ] The completion icon and arrow do not replace one another in the same slot.
- [ ] Tapping the arrow expands/collapses the completed exercise.
- [ ] Active-workout exercise behavior remains unchanged unless explicitly required by Story 42.
- [ ] A completed exercise inside an active workout still retains whatever contextual controls are required for active-session editing.
- [ ] No horizontal overflow is introduced.
- [ ] The existing completed-card visual treatment is preserved.


## Product-Wide Definition of Done

### Mobile-First Responsive Web
- Start implementation and validation at narrow mobile-web widths.
- No horizontal page scrolling.
- No clipped controls, text, cards, or badges.
- No overlap with sticky bottom navigation or Safari browser chrome.
- Validate iOS Safari specifically.
- Preserve responsive desktop/tablet behavior.

### Mobile Application Parity
This follow-up changes web and mobile app behavior unless explicitly stated otherwise.
- Equivalent completed-workout behavior must exist in the native/mobile application.
- Visual implementation may be platform-native, but information hierarchy and state behavior must remain equivalent.
- Compare mobile web and mobile app side by side before completion.

### Accessibility
- Do not communicate state by color alone.
- Expand/collapse controls must expose accessible expanded/collapsed state.
- Completion status must be announced meaningfully.
- Touch targets must remain appropriately sized.
- Keyboard navigation must continue to work on web.
- Focus order must remain predictable after controls are conditionally removed.

### Loading / Saving / Error States
- Verify the UI while workout completion is still saving.
- Do not transition into immutable review mode before completion persistence succeeds.
- If completion fails, restore the active workout affordances and surface the existing error treatment.
- Reopening a previously completed workout must render directly into the completed review state.

### Behavioral Tests
Add or update tests covering the exact completed-versus-active workout boundaries described in each story.

### GitHub Reviewer
Run the GitHub/code reviewer and verify:
- no duplicated completion logic
- no accidental removal of controls during an active workout
- no mutation of program/template data
- no unrelated scope creep
- conditional rendering is driven from the correct parent workout/session state

### Figma Reviewer
Review completed workout states on mobile web and mobile app side by side.
Verify:
- hierarchy is clearer
- dead controls are gone
- completion status remains celebratory
- expand/collapse remains obvious
- planned-prescription styling is consistent
- current Story 42 visual improvements are preserved rather than regressed


## Claude Steering Document

### Read Before Coding

This is a **Story 42 refinement**, not a redesign from scratch. Do not discard the new completed-card design. The current iteration is materially better. The remaining problem is control hierarchy.

### Desired Semantics

```text
green check = status
chevron     = navigation
ellipsis    = contextual actions
```

If contextual actions do not exist in completed review mode, the ellipsis should not render.

### Avoid

- hiding the chevron until expanded
- moving the chevron between positions
- using the green check itself as the only disclosure affordance
- rendering an inert overflow menu
- changing active-workout behavior by accident

### Final Review Question

When viewing a completed workout, can a user understand in under one second that the exercise is complete, it can still be opened, and there are no meaningless actions being presented? If not, this story is not done.
