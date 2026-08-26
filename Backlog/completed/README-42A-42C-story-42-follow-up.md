# Setframe Story 42 Follow-Up Pack

This pack contains targeted follow-up work for Story 42 after reviewing the latest completed-exercise implementation.

## Story Order

1. **42A — Simplify Completed Exercise Header Controls**
2. **42B — Remove Disabled Set Mutation Controls From Completed Workout Review**
3. **42C — Standardize Planned Prescription Pill Styling**

## Key State Rule

The requested removals are based on **the parent workout/session being marked complete**.

Do not treat a completed exercise inside an active workout the same as a completed exercise inside a completed workout. The former must retain active-session editing capabilities when reopened.

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


## Screenshot Mapping

- Screenshot 1: completed workout, collapsed completed exercise cards
- Screenshot 2: completed workout, expanded completed exercise showing arrow/ellipsis hierarchy
- Screenshots 3–4: completed workout, expanded detailed sets with disabled Save/Copy/Delete controls and current planned-pill treatment

## Product Direction

The current Story 42 visual redesign is a meaningful improvement and should be preserved. This follow-up should **remove dead UI and clarify state**, not restart the design.

## Files

- `story-42A-completed-exercise-header-controls.md`
- `story-42B-completed-workout-remove-disabled-set-actions.md`
- `story-42C-standardize-planned-prescription-pill.md`
