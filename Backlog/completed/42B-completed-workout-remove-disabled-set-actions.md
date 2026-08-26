# Story 42B — Remove Disabled Set Mutation Controls From Completed Workout Review

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

As a user reviewing a workout I already completed,  
I want the detailed set view to show the workout data without disabled editing controls,  
so that the completed experience reads like a clean historical review rather than a broken editor.

## Screenshot / Gym-Test Evidence

When a completed exercise is expanded after the overall workout has been marked complete, Save, Copy, Delete, and Add set appear disabled. These controls cannot be used, so their presence creates unnecessary visual noise.

## Problem Statement

Once the workout itself has been marked complete, this screen is primarily a **review surface**. The UI should not render active-editing affordances that the user can no longer use.

## UX / Product Intent

When the **parent workout/session is complete**:

- preserve the ability to expand an exercise and inspect its sets
- present the completed set data cleanly
- remove mutation controls that are intentionally unavailable in this state

Remove/hide, as applicable:

- Save
- Copy
- Delete
- Add set
- any other active-workout-only mutation action that is intentionally disabled after workout completion

Do not merely disable them.

### Active Workout Is Different

During an active workout, completed exercises can still be reopened and individual sets may still be edited. This story must not regress that workflow.

## Acceptance Criteria

- [ ] Once the parent workout is marked complete, disabled `Save` buttons are not rendered.
- [ ] Once the parent workout is marked complete, disabled `Copy` controls are not rendered.
- [ ] Once the parent workout is marked complete, disabled `Delete` controls are not rendered.
- [ ] Once the parent workout is marked complete, `Add set` is not rendered if the completed state intentionally prevents adding sets.
- [ ] Other active-session-only mutation controls are also removed from completed review mode.
- [ ] Users can still expand/collapse completed exercises and inspect set data.
- [ ] Set data remains complete and understandable without the removed controls.
- [ ] Active workouts preserve existing save/copy/delete/add-set behavior.
- [ ] A completed exercise inside an active workout is still editable according to existing Story 42 behavior.
- [ ] Removing controls does not shift content into an awkward or broken layout.
- [ ] Focus order remains correct when controls are conditionally absent.
- [ ] No mutation capability is accidentally removed from the underlying active-workout flow.


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

### Core Principle

**Completed workout review is not a disabled editor.**

Prefer state-specific rendering rather than leaving inactive buttons on screen.

### State Boundary

```text
exercise complete inside active workout
!=
workout complete
```

Only the second state removes the active mutation controls.

### Preserve Historical Accuracy

This story does not change set values, calculated volume, top-set calculation, 1RM calculation, PR logic, or program templates. It only changes what actions are rendered in completed review mode.

### Avoid

- leaving disabled buttons with lower opacity
- disabling the whole card via CSS and calling it complete
- hiding fields that are important to historical review
- accidentally making active workout sets read-only
- propagating completed-session edits back into templates

### Final Review Question

Does expanding an exercise in a completed workout feel like “I’m reviewing what I did” rather than “I’m looking at a form that the app won’t let me use”? That distinction is the purpose of this story.
