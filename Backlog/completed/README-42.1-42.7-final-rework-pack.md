# Setframe Story 42 — Corrective Rework Pack

This pack replaces incremental accordion patching with a deliberate exercise-logging architecture.

## Recommended order
1. **42.1 — P0 false completion**
2. **42.2 — Exercise Work Card disclosure**
3. **42.3 — Representation-aware quick log**
4. **42.4 — Batch + optimistic persistence**
5. **42.5 — Completion lifecycle / auto-collapse / reopen**
6. **42.6 — Visual state redesign**
7. **42.7 — End-to-end regression harness**

Read `RESEARCH-and-ARCHITECTURE.md` before implementation.

## Critical invariant

```text
planned != draft actual != saved actual != complete
```

## Target common-case flow

```text
Start workout
→ exercise is visibly planned but NOT complete
→ enter only required/common-case actuals
→ one logical commit for the exercise
→ optimistic save
→ completed feedback
→ auto-collapse
→ move to next exercise
→ reopen only when detailed per-set edits are needed
```

The detailed set editor is an escape hatch, not the primary logging path.

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


## Pack contents
- `RESEARCH-and-ARCHITECTURE.md`
- `42.1-false-completion-p0.md`
- `42.2-exercise-work-card-disclosure.md`
- `42.3-representation-aware-quick-log.md`
- `42.4-batch-optimistic-persistence.md`
- `42.5-completion-lifecycle.md`
- `42.6-visual-state-redesign.md`
- `42.7-e2e-regression-harness.md`
