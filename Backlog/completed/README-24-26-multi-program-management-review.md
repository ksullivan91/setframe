# Setframe Product Backlog — Multi-Program Training Management

## Purpose

This pack addresses the Training information architecture now that Setframe supports multiple programs.

The current Workouts / Schedule model was designed around an implicit single-program assumption.

The desired hierarchy is now:

Program
→ contains workouts
→ has its own schedule
→ one program is active and drives Today

## Stories

24. [Add Program Management and Active Program Selection](./24-programs-tab-and-active-program.md)
25. [Scope Workouts to the Selected Program](./25-program-scoped-workouts.md)
26. [Make Scheduling Program-Aware](./26-program-aware-schedule.md)

## Recommended Navigation

`Programs | Workouts | Schedule`

The **Programs** tab owns:
- creating programs,
- selecting a program for editing,
- setting the active program.

The **Workouts** tab owns:
- workouts associated with the selected program,
- adding an existing workout to the program,
- creating a new workout in that program.

The **Schedule** tab owns:
- assigning that program's workouts to days.

## Important Product Distinction

**Selected program** and **Active program** are not the same thing.

Selected:
- currently being viewed/edited.

Active:
- drives Today and the user's current schedule.

Simply opening Program B must not silently deactivate Program A.

## Suggested Implementation Order

24 → 25 → 26

First establish program context and activation, then program/workout membership, then make scheduling consume those relationships.

## Product Recommendation

Do not make every workout globally visible inside every program.

There may still be value in maintaining a reusable workout-template library internally or through an explicit “Add existing workout” flow, but the normal program editor should show only workouts included in that program.

This keeps the mental model introduced in Guided Setup consistent:

Program → Workouts → Exercises → Schedule.
