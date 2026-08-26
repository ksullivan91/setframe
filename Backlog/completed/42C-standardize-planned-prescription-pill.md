# Story 42C — Standardize Planned Prescription Pill Styling

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

As a user moving through or reviewing a workout,  
I want planned set targets to use one consistent visual treatment,  
so that I can immediately distinguish what was planned from what I actually performed.

## Screenshot / Gym-Test Evidence

The detailed set rows currently show labels such as `Planned: 135lb · 8 reps`, `Planned: 195lb · 5 reps`, and `Planned: 195lb · 6 reps`. The requested visual treatment is a purple background with white text regardless of workout or exercise state.

## Problem Statement

Planned-versus-actual comparison is a core part of the workout logging experience. The planned target should have a stable visual language across states.

## UX / Product Intent

Create a single semantic `planned` pill/badge treatment:

```text
background: Setframe purple
text: white
```

Use existing design-system tokens rather than one-off hard-coded values where possible.

## State Independence

The planned pill must retain the same treatment in:

- active workouts
- incomplete exercises
- completed exercises
- expanded completed exercises
- completed workout review
- equivalent native-mobile presentation

The pill communicates **planned target**, not completion status. It should not turn green because the set or workout is complete.

## Acceptance Criteria

- [ ] All planned-prescription pills use the same purple semantic background.
- [ ] Planned-prescription pill text is white.
- [ ] Styling remains the same regardless of workout completion state.
- [ ] Styling remains the same regardless of exercise completion state.
- [ ] The badge has sufficient color contrast for accessibility.
- [ ] Existing representation-aware planned text is preserved.
- [ ] Planned values remain visually distinct from actual logged values.
- [ ] The design uses shared design-system tokens rather than isolated hard-coded values where possible.
- [ ] Badge content wraps or truncates intentionally on narrow mobile widths without causing horizontal overflow.
- [ ] Mobile web and native mobile use equivalent semantic styling.


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

### This Is a Semantic Badge, Not a Status Badge

The planned pill answers “What was I supposed to do?” It does not answer “Did I complete it?” Therefore its color should not track completion state.

### Use the Design System

Search for existing Setframe purple tokens before adding new values. Prefer a reusable planned badge variant or equivalent shared styling.

### Representation Awareness

Do not regress prior work around different prescription types. The badge content should continue to come from existing domain formatting logic.

### Avoid

- purple only during active workout
- green planned pill after completion
- gray planned pill in review mode
- white-on-purple text that fails contrast because the wrong purple token was chosen
- fixed widths that cause mobile overflow

### Final Review Question

If a user scans five different workout states, does `Planned:` always look like the same category of information? It should.
