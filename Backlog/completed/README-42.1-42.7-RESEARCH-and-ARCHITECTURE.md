# Story 42 Research & Architecture Decision — Exercise Work Card

## Why this research exists

Story 42 has repeatedly received visual patches without first stabilizing its interaction and data model. The current regressions show that the next pass must begin with architecture.

## Research findings

### WAI-ARIA Accordion
The W3C accordion pattern defines the accordion header as a heading containing a button that controls the panel. That is not a natural fit for a Setframe exercise header that also contains quick-log inputs, status, and actions.

Source: W3C WAI-ARIA Authoring Practices — Accordion Pattern  
https://www.w3.org/WAI/ARIA/apg/patterns/accordion/

### WAI-ARIA Disclosure Card
The disclosure-card example is closer to the Setframe use case. It explicitly treats the disclosure control as distinct from nested interactive elements, and nested inputs/actions should not toggle the disclosure.

Source: W3C WAI-ARIA Authoring Practices — Disclosure Card  
https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-card/

### React Aria Disclosure / DisclosureGroup
React Aria supports controlled expansion, a dedicated disclosure header/trigger, sibling interactive controls, and controlled expanded keys in a group. This maps well to Setframe's requirement that at most one detailed exercise be open while quick-log controls remain independently interactive.

Sources:
- https://react-aria.adobe.com/Disclosure
- https://react-aria.adobe.com/DisclosureGroup

### Radix Accordion
Radix is accessible and unstyled, but it follows the classic accordion model. It is a viable fallback if the repository already prefers Radix, but the Setframe exercise card behaves more like a disclosure card than a conventional accordion.

Source: https://www.radix-ui.com/primitives/docs/components/accordion

### Avoid abandoned accordion dependencies
The `react-accessible-accordion` project states that it is no longer maintained. Do not add it as a new dependency.

Source: https://github.com/springload/react-accessible-accordion

### Native mobile
React Native provides accessibility roles/state and should mirror the same interaction contract with native controls. A web dependency should not force an unnatural native implementation.

Source: https://reactnative.dev/docs/accessibility.html

## Recommended architecture decision

### Web
1. Evaluate React Aria `Disclosure` / `DisclosureGroup` first.
2. Use Radix only if existing architecture strongly favors it.
3. Build a custom disclosure only with documented accessibility justification and tests.

### Product-level naming
Stop calling the product component an accordion. Suggested components:

```text
ExerciseWorkCard
ExerciseQuickLog
ExerciseDetailPanel
SetEditor
CompletedExerciseSummary
```

## Required state model

```text
PLANNED VALUE
  template/session target
  visible to user
  may seed a draft
  never proof of performed work

DRAFT ACTUAL VALUE
  local editable value
  may initially equal plan
  not necessarily logged

SAVED ACTUAL VALUE
  persisted current-session performance

SET COMPLETE
  representation-required actual data persisted

EXERCISE COMPLETE
  required expected sets complete

WORKOUT COMPLETE
  parent session explicitly finished
```

## Fundamental invariant

> Starting a workout must never mark an exercise complete simply because planned values exist or draft inputs are prefilled.

## Representation-aware completion examples
- Sets + reps: reps required; weight required only when meaningful for that exercise; RPE optional.
- Bodyweight reps: reps required; no fake 0 lb.
- Duration: duration required.
- Distance: distance required.
- Distance + duration: both required.
- Timed sets: only fields required by that representation.

## Target UX

### Collapsed / ready

```text
Barbell Front Squat                         ˅
Planned: 3 × 6      0 of 3 logged

Weight (lb)        Reps
[ 115      ]       [ 6       ]

                 [ Log all 3 sets ]
```

### Expanded / detailed edit

```text
Barbell Front Squat                         ˄
Planned: 3 × 6      2 of 3 logged
────────────────────────────────────────────
Detailed sets
Set 1  Working  Planned: 115 × 6
Weight [115]  Reps [6]  RPE [ ]
Set 2 ...
```

### Collapsed / complete during active workout

```text
✓ Barbell Front Squat                       ˅
  3 sets logged
  Top set            Volume
  120 lb × 6         2,160 lb
```

The detailed panel should remain a neutral editable surface even if the exercise is complete.

## Product guardrails
- Quick logging must reduce taps, not add another layer above per-set Save buttons.
- Input focus must not expand details.
- Only a dedicated disclosure affordance toggles details.
- Planned values cannot count as logged actuals.
- Saving should feel concurrent and immediate.
- Completion must be representation-aware and deterministic.
- Active workout and completed-workout review are distinct states.

---

## Original Product Feedback

> So it looks like we’re not done with 42 yet..
>
> First of all the accordion still looks awful once expanded. 
>
> But most importantly, all of my exercises were marked as complete as soon as I started the workout. I didn’t provide any actions on this workout page other than start the workout from the Today screen. Again, this is not the purpose of the enhancements we’ve been trying to make to this page.
>
> We want it to be easy to input variables in for our exercises while also making it consistent, repeatable, and with as little friction as possible. I think Claude is doing too much here while still missing all the important points of the page. I think part of this may be the use of its own built accordion component. Perhaps we need to research libraries that we can use or steal from to create a better experience here. With the knowledge you have from my inputs and your research on 42, can we finally build an appropriate solution through well thought out stories?

## Product/UX Response

> Yes. I think the core problem with Story 42 is now clear: we have been treating this as an accordion styling problem when it is actually an interaction-state and data-model problem.
>
> The screenshots expose the most important bug so far: a planned value is being treated as if it were a logged value. Starting a workout should create the session and expose the plan, but it must not make an exercise complete. “Planned,” “draft actual,” “saved actual,” and “complete” need to be separate concepts.
>
> I also do not think a generic accordion is the right primitive for the entire exercise card. Your exercise card contains interactive quick-log inputs, status, contextual actions, and a disclosure control. The WAI-ARIA accordion pattern expects the accordion heading to contain the disclosure button rather than a cluster of nested interactive controls. The W3C disclosure-card guidance specifically calls out that nested interactive controls should not trigger disclosure. React Aria’s Disclosure API also supports interactive elements adjacent to the disclosure heading and controlled expanded state. That is a much better match for what Setframe is trying to build.
>
> For web, my preferred direction is to evaluate React Aria Disclosure/DisclosureGroup first, with Radix Accordion as a secondary option. React Aria is the cleaner conceptual match because we need a dedicated disclosure trigger plus sibling interactive controls, not a giant clickable accordion header. It also supports controlled expandedKeys, which fits the requirement that moving to another exercise can collapse the previous one. We should not blindly import a component and accept its visual design; we should use a proven accessibility/interaction primitive and build the Setframe visual experience around it.
>
> The target interaction should be an “exercise work card,” not an accordion:
> - A collapsed card is the fast path.
> - It shows exercise name, plan, progress, and only the representation-specific quick-log fields that are required to log the common case.
> - RPE stays out of the quick-log area because it is optional and adds clutter.
> - Planned values may prefill draft inputs, but prefilling does not count as user activity and must never mark anything complete.
> - The user changes the fields that differ from plan, then commits all planned sets in one action or by leaving the valid quick-log context.
> - That commit should save all affected sets as one logical operation from the user’s perspective.
> - The UI updates optimistically instead of forcing sequential per-set saves.
> - If the user expands the card, the detailed individual sets appear on a neutral editable surface, prefilled from the current draft/saved values.
> - Interacting with inputs must not toggle the disclosure.
> - Only the dedicated chevron/disclosure control expands or collapses details.
> - When the required actual data for all expected sets has been successfully committed, the exercise transitions into the stronger green completed state and collapses automatically.
> - Reopening a completed exercise during an active workout returns to editable detail mode.
> - Once the entire workout has been finished, the same exercise becomes a read-only completed review card.
>
> I would break the repair into a research/architecture decision plus seven implementation stories. The P0 false-completion bug should happen first. Then we replace the interaction primitive, establish the quick-log state model, add batch/optimistic persistence, implement completion transitions, refine the visual states, and finally add an end-to-end regression matrix so Story 42 stops regressing every time one piece changes.

