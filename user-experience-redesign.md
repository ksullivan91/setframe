# Setframe UX Architecture & Application Enhancement

I want you to perform a comprehensive UX architecture and implementation improvement of the Setframe application.

Do **not** treat this as a cosmetic redesign or a collection of isolated styling changes.

Before making changes:

1. Inspect the existing application architecture, routes, components, state/data models, API calls, mutations, loading behavior, workout/program models, Apple Health integration, history/progress models, and responsive layout.
2. Identify which existing components and APIs can be reused.
3. Identify data-model or API changes required to support the UX described below.
4. Produce a concise implementation plan.
5. Then implement the work incrementally.
6. Preserve good existing functionality rather than rewriting working systems unnecessarily.
7. Avoid introducing duplicate concepts or competing ways of accomplishing the same task.

The objective is to improve the **entire user workflow**, not merely the appearance of individual pages.

---

# 1. Product vision

Setframe is intended to become a personal fitness tracking and training application that replaces much of a workflow currently performed manually through ChatGPT.

The primary workflow is not simply:

> Build workout → log workout

It is:

> Plan → perform → record → sync health data → understand progress → use that context tomorrow.

The application should make daily fitness tracking friendly, efficient, structured, and historically reliable.

A typical morning currently involves manually telling ChatGPT:

* today's workout and every set performed
* morning body weight
* notes about how the workout felt
* subjective observations about stability, fatigue, performance, mobility, etc.
* cardio performed
* Apple Health information
* a request to compare this with historical progress

For example, a real daily input may look conceptually like:

> RDL
> 135 × 10
> 185 × 8
> 225 × 8
> 275 × 6
> 225 × 8
> 225 × 8
>
> Sumo squat
> Bar × 8
> 135 × 8
> 155 × 8
> 155 × 8
>
> Calf raises
> 135 × 8
> 155 × 8
> 155 × 8
>
> Notes: Calf raises finally increased. Movements feel very stable. The objective isn't maximizing calf-raise load; this is being used partly as a stability exercise because improved balance/control should transfer to skating.
>
> Back/glute extension
> 70 × 3 × 8
>
> Leg raises
> 3 × 15
>
> Cardio
> 25-minute / 5-mile bike ride
>
> Morning weight
> 168.6 lb
>
> Then analyze Apple Health data and overall progress.

Setframe should capture this information structurally so that historical fitness analysis does **not depend upon conversational memory**.

The database should become the durable source of truth.

AI may eventually interpret that history, but AI should consume structured Setframe data rather than being relied upon to remember it.

---

# 2. Core UX model

The application should consistently distinguish four concepts:

## Program

The overall training plan.

It answers:

> What training structure am I following?

---

## Workout Template

A reusable workout definition such as:

* Lower C
* Upper A
* Recovery
* Conditioning

It answers:

> What does this workout normally contain?

Avoid exposing implementation-oriented language such as **Day type** if a clearer user-facing term such as **Workout** or **Workout template** communicates the concept better.

Internal model names do not necessarily need to change if that creates unnecessary migration work, but user-facing terminology should.

---

## Scheduled Workout

An instance of a workout assigned to a date/day.

It answers:

> What am I supposed to do today?

---

## Workout Session

What actually happened when the user trained.

It answers:

> What did I actually perform?

The program/template must represent intent.

The workout session must represent reality.

Do not blur these concepts.

---

# 3. Overall information architecture

The Training area currently attempts to expose workout creation, workout editing, scheduling, and exceptions simultaneously.

This creates unnecessary cognitive load.

Redesign this area around stronger conceptual boundaries.

A program should conceptually provide:

```text
Program Name

Overview | Workouts | Schedule | Settings
```

Possible global Training navigation:

```text
Training

Programs
Workouts
Exercise Library
```

Use the application's existing navigation conventions where sensible rather than blindly implementing these exact labels.

The important requirement is separation of responsibilities.

---

# 4. Program creation: use guided setup, not a permanent wizard

Use a guided setup flow when a user initially creates a program.

Do **not** turn normal program maintenance into a rigid wizard.

Recommended initial flow:

## Step 1 — Program details

Capture information such as:

* program name
* scheduling model
* optional start information

Example:

```text
Build your program

Program name
[ Strength & Conditioning ]

Schedule
○ Repeat weekly
○ Custom rotation

Continue →
```

---

## Step 2 — Build workouts

Show workout templates belonging to the program.

Example:

```text
Workouts

Lower C        8 exercises
Upper A        7 exercises
Recovery       2 activities

+ Add workout

Back                       Continue →
```

---

## Step 3 — Schedule

Assign workouts to days.

Example:

```text
Sunday        Lower C
Monday        Upper A
Tuesday       Upper B
Wednesday     Recovery
Thursday      Lower A
Friday        Conditioning
Saturday      Rest
```

---

## Step 4 — Review

Summarize before activating.

Example:

```text
Your program

5 workout templates
31 exercises
6 scheduled training days
1 rest day

Edit anything

Start program
```

Users should be able to revisit previous steps.

Where practical, allow experienced users to skip guided setup or move directly into manual editing.

Once a program has been created, the wizard should disappear.

Editing an existing program should use normal navigation:

```text
Overview | Workouts | Schedule | Settings
```

This creates guidance for novice users without slowing down returning or advanced users.

---

# 5. Workout list/editor redesign

The selected workout should be the dominant object when editing it.

Do not simultaneously show unrelated scheduling and exception interfaces beside it.

For example:

```text
Training / Workouts / Lower C

Lower C
8 exercises · approximately 75 min

[ + Add exercise ]

Barbell Romanian Deadlift
3 × 8                                      •••

Mobility
30 min                                     •••

Treadmill Walk
10 min                                     •••

Barbell Sumo Squat
3 × 8                                      •••
```

The current interface displays move-up, move-down, edit, and delete buttons on every row.

That creates excessive repeated visual controls.

Prefer:

* drag/reorder handle where appropriate
* row click/edit affordance
* overflow menu for secondary actions

Example:

```text
⠿ Barbell Romanian Deadlift
  3 × 8                                  •••
```

Overflow menu:

```text
Edit
Duplicate
Move
Delete
```

Maintain accessible keyboard reorder behavior if drag-and-drop is introduced.

Do not make drag-and-drop the only accessible way to rearrange workouts.

---

# 6. Reduce destructive-action prominence

Delete is currently one of the most visually prominent controls in several screens.

Destructive actions should not compete with common primary actions.

Move actions such as workout deletion into a secondary menu where appropriate.

Example:

```text
•••

Rename workout
Duplicate workout
Delete workout
```

When deletion can be reversed, prefer:

```text
Lower C deleted. Undo
```

When deletion cannot be reversed, use an explicit confirmation dialog explaining what will be removed.

Keep destructive actions visually distinct without making them the dominant element on the page.

---

# 7. Completely redesign Add Exercise

The current workflow mixes three concepts simultaneously:

* choosing an existing exercise
* creating a new exercise
* adding an exercise to the workout

This causes competing calls to action such as:

```text
Exercise
[ Barbell Back Squat ]

Create a new exercise
[ Outdoor Cycle ]
[ Create exercise ]

[ Add exercise ]
```

This should be removed.

The user has one primary intention:

> Add an exercise to this workout.

Make that the interaction.

---

## Primary interaction

Click:

```text
+ Add exercise
```

Open a searchable picker:

```text
Add exercise

Search exercises...
[ ______________________________ ]

Barbell Back Squat
Barbell Romanian Deadlift
Cable Face Pull
...

Can't find it?
+ Create custom exercise
```

Support keyboard interaction and good search/filter behavior.

---

## Custom exercise workflow

Only expose custom exercise creation when requested.

Example:

```text
Create custom exercise

Exercise name
[ Outdoor Cycle ]

Category
[ Cardio ▾ ]

Cancel                 Create & add
```

Use **Create & add**, not simply **Create exercise**.

Creating a database record is an implementation detail.

The user's goal is to add that exercise to the workout.

After successful creation, the exercise should already be selected/added into the current workflow rather than requiring another redundant action.

---

# 8. Configure exercise after selecting it

Do not require the user to reason about both exercise selection and prescription simultaneously if this can be avoided.

Preferred sequence:

1. Choose exercise.
2. Configure how it should be performed.

Example:

```text
Barbell Back Squat

Prescription
[ Sets & reps ▾ ]

Sets
[ 3 ]

Reps
[ 8 ]

Add exercise
```

This corresponds more closely with the user's mental process:

> What exercise am I doing?

followed by:

> How am I programming it?

---

# 9. Expand the workout prescription model

This is a major functional requirement.

The existing workout template appears capable of defining something like:

```text
3 × 8
```

However, once the actual workout begins, the session interface represents individual sets.

That means the execution model is richer than the programming model.

The workout template should be capable of expressing the expected set structure.

---

## Keep simple programming simple

Default:

```text
Barbell Back Squat

3 sets × 8 reps
```

This must remain quick and easy.

Do not force every user into a complicated set editor.

---

## Add advanced/custom set configuration through progressive disclosure

Provide something conceptually like:

```text
Customize individual sets
```

When expanded:

```text
SET     TYPE        REPS      WEIGHT      RPE
1       Working     8         —           —
2       Working     8         —           —
3       Working     8         —           —
```

Allow different configurations such as:

```text
1    Warm-up     10      45
2    Warm-up      8      95
3    Working      8     135
4    Working      8     135
5    Working      6     135
```

Or:

```text
1    Working      8      —      7
2    Working      8      —      8
3    Working      8      —      9
```

Or concepts such as:

```text
Top set
Backoff set
Warm-up set
Working set
```

Do not over-engineer specialized strength-training terminology if the existing model cannot support it cleanly.

The immediate requirement is that **individual planned sets may differ from one another**.

---

# 10. Planned versus actual performance

When starting a workout, instantiate the workout template as a session.

The session should clearly distinguish:

```text
PLANNED
225 × 8

ACTUAL
[ 225 ] × [ 8 ]
```

Avoid excessive visual duplication, but keep the intended workout readily available so users don't have to remember it.

For each set, consider useful contextual information such as:

```text
Previous
225 × 8 @ RPE 8
```

when historical data exists.

Historical reference should help logging rather than make the screen visually noisy.

---

# 11. Improve workout-session logging

The workout session is a core Setframe workflow and should be highly optimized for repeated use.

The current session requires each individual set to be edited and saved independently.

Review whether individual Save buttons are really necessary.

Prefer lower-friction approaches such as:

* automatic save on commit/blur where reliable
* explicit completion/checkmark per set
* optimistic saving with rollback/error feedback
* keyboard-friendly data entry
* preserving focus when logging successive sets

Do not silently lose data.

If autosave is implemented, system status must be clearly communicated.

A useful exercise card could conceptually look like:

```text
Barbell Romanian Deadlift
Planned 3 × 8

        TYPE        WEIGHT     REPS    RPE
1       Working      225        8       7      ✓
2       Working      225        8       8      ✓
3       Working      225        8       9      ○

+ Add set
```

On mobile, optimize this for touch and horizontal constraints instead of forcing a desktop table into a narrow viewport.

Important actions and fields should remain comfortably tappable.

---

# 12. Allow session flexibility without corrupting the program

During an actual workout, users must be able to:

* add an unexpected set
* remove a set
* adjust repetitions
* adjust weight
* change set type
* change RPE
* potentially skip an exercise
* potentially add an exercise
* record notes

These changes should affect the current workout session by default.

They should **not silently modify the underlying reusable program**.

At workout completion, if meaningful deviations occurred, consider:

```text
You changed this workout from its plan.

Apply these changes to future Lower C workouts?

Keep program unchanged
Update Lower C
```

Do not automatically update the template.

This preserves the distinction between planned and actual training while providing a convenient improvement loop.

---

# 13. Remove "Ad hoc override" from Program Builder

The current Program Builder includes an **Ad hoc override** section.

Remove that workflow from the program-building context.

When constructing a program, the user's mental model is:

> What normally happens?

An ad hoc exception represents:

> What should happen differently on this particular date?

Those are different contexts.

Also avoid exposing the term **Ad hoc override** to ordinary users unless there is a strong product reason.

It sounds like implementation terminology.

---

# 14. Move schedule exceptions into Today / scheduled workout

Today's scheduled workout is the appropriate context for changing today's plan.

For example:

```text
Today's workout
Lower C

Start workout
Preview

•••
```

Menu:

```text
Change today's workout
Move workout
Skip today
```

Changing today's workout:

```text
Change today's workout

○ Lower C
○ Upper A
○ Lower A
○ Conditioning
○ Recovery
○ Rest

Reason (optional)
[ Travel, schedule change, recovery... ]

Apply to August 21 only
```

This should modify the scheduled instance rather than the reusable program unless the user explicitly chooses otherwise.

---

# 15. Redesign Program Schedule

Scheduling should do one job:

> Decide which workout happens when.

Do not mix scheduling with exercise programming.

Replace unclear terminology such as:

```text
Mode: Perpetual
```

with user-facing language describing behavior.

For example, depending on the actual supported models:

```text
Schedule type

Repeat weekly
Fixed duration
Custom rotation
```

Do not introduce options unsupported by the data model without implementing them correctly.

---

## Improve weekly schedule readability

The existing seven-column layout causes labels such as "Unassigned" to wrap awkwardly on narrow widths.

Prioritize glanceability.

Desktop may use cards/grid if enough width exists.

Example:

```text
SUN            MON            TUE
Lower C        Upper A        Upper B
75 min         60 min         60 min

WED            THU            FRI
Recovery       Lower A        Conditioning
30 min         65 min         45 min

SAT
Rest
```

Alternatively, a simple vertical assignment editor may be better:

```text
Sunday       Lower C          Change
Monday       Upper A          Change
Tuesday      Upper B          Change
Wednesday    Recovery         Change
Thursday     Lower A          Change
Friday       Conditioning     Change
Saturday     Rest             Change
```

Select the implementation that provides the clearest desktop and mobile behavior.

Do not force seven tiny columns when space is insufficient.

---

# 16. Today should become the center of the application

The current Today page already contains the beginning of the correct product model:

* today's workout
* morning weight
* journal + mood
* pre-workout meal
* watch auto-sync
* daily summary

Develop this into Setframe's primary daily dashboard.

The user should be able to open Setframe in the morning and understand:

1. What am I doing today?
2. What should I record?
3. What has already been recorded?
4. Is health data synced?
5. How did today's workout compare with expectations/history?
6. Is there anything worth paying attention to?

Keep the current "Today ritual" concept if it continues to fit the product, but evaluate the wording.

Potential higher-level structure:

```text
Today
Friday, August 21

Morning
✓ Morning weight
✓ Mood / journal
✓ Pre-workout meal

Training
Lower C
In progress

Health
Apple Health synced

Daily insight
Available after training data finishes syncing
```

Do not over-card the page.

Use grouping and visual hierarchy rather than putting every small metric in a separate container.

---

# 17. In-progress workout treatment

The existing global "Workout in progress / Resume" banner is useful because it preserves task continuity across the app.

Keep this concept.

Improve it as necessary so it remains:

* noticeable
* compact
* consistent
* non-obstructive

Do not show multiple competing "Resume workout" calls to action unnecessarily on the same page.

If Today already contains today's in-progress workout, determine whether the global banner, card, or both are necessary.

Avoid redundant controls that do the exact same thing.

The user should always have an obvious way to get back to an unfinished workout.

---

# 18. Morning weight workflow

Morning weight is a frequent daily action.

Optimize for minimal friction.

Requirements:

* retain the configured unit
* numeric input optimized for the device
* make last/recent value available where useful
* clear loading/saving state
* clear saved state
* prevent duplicate submissions
* do not require navigating away
* make the entry immediately available to Progress/history

Consider whether explicit Save is still valuable or whether a reliable commit/autosave interaction is better.

Do not switch to autosave simply for visual cleanliness if it makes the saved state ambiguous.

---

# 19. Journal and subjective context

The journal is important because fitness progress is not purely quantitative.

Users may record observations such as:

* poor sleep
* unusually high energy
* joint discomfort
* improved stability
* exercise technique changes
* motivation
* soreness
* recovery
* athletic performance observations

Preserve mood + freeform notes.

The journal should become historically searchable/viewable alongside training data.

Eventually, insights should be able to correlate subjective observations with structured metrics.

Do not over-structure every journal observation into mandatory form fields.

Freeform notes remain useful.

---

# 20. Apple Health workflow

Apple Health data is core supporting context, not merely a Settings integration.

Settings should manage connection/configuration.

Today and Progress should expose the useful results of that connection.

Examples of useful health context where available:

* active energy
* resting energy
* exercise duration
* heart rate
* walking/running/cycling metrics
* steps
* sleep
* workout records
* other already-supported Apple Health metrics

Do not invent health data or pretend a metric is synced when the API/data source does not provide it.

Clearly communicate:

```text
Synced 8:42 AM
```

or:

```text
Waiting for Apple Health
```

or:

```text
Health data unavailable
Retry
```

Avoid showing unexplained em dashes indefinitely.

---

# 21. Post-workout review

Finishing a workout should be more meaningful than simply closing the form.

After completing a workout, provide a compact review.

Example:

```text
Lower C complete

Duration        1h 21m
Sets            24
Volume          18,450 lb
Top set         RDL 275 × 6

Compared with last Lower C
Volume          +6%
RDL top set     +20 lb

How did it feel?
[ mood / optional note ]

Health data
Waiting for Apple Health sync
```

Only surface comparisons that are mathematically and semantically valid.

Do not manufacture improvement claims from insufficient data.

This screen should connect **logging** with **understanding**.

---

# 22. Progress page redesign

The existing Progress page currently has a large empty state around an 8-week consistency section.

Progress should become the historical intelligence layer of Setframe.

Consider sections such as:

```text
Progress

Overview
Strength
Body Weight
Training
Recovery
```

Do not add tabs merely because this prompt suggests them; use the architecture that best matches the existing application and available data.

Useful overview information may include:

* workout consistency
* current workout streak if meaningful
* weekly sessions
* body-weight trend
* total training volume
* recent PRs
* training duration
* cardio volume/duration
* relevant health/recovery trends

Avoid vanity metrics that don't help the user understand training.

---

# 23. Exercise Progress page

The existing exercise Progress screen currently contains:

* exercise selector
* top set
* estimated 1RM
* last-session volume
* session history

This is a strong foundation.

Improve it into a genuinely useful historical exercise view.

Potential information:

```text
Barbell Back Squat

Top set
195 × 4

Estimated 1RM
221 lb

Last session volume
4,620 lb
```

Then provide history/trends:

* set/repetition/load history
* volume trend
* estimated 1RM trend where valid
* personal records
* session notes associated with that exercise

Allow users to understand **how they are progressing**, not merely see the most recent number.

Never estimate a 1RM for exercise/activity types where the calculation is inappropriate.

---

# 24. Empty states should teach the next action

Current empty states such as:

```text
No workout history yet — complete a workout to see your streak here.
```

are directionally correct.

Apply this consistently.

Empty-state formula:

```text
What is missing
Why it is useful
What to do next
```

For example:

```text
No squat history yet

Complete a workout containing Barbell Back Squat and your strength trend will appear here.

View today's workout
```

Avoid enormous mostly-empty pages when a useful next action or explanation can be provided.

At the same time, don't fill empty screens with decorative noise.

---

# 25. Historical records are first-class product data

One of the major reasons for building Setframe is that conversational AI is not an ideal long-term fitness database.

Therefore:

* every completed workout should remain historically accessible
* every set should retain date/session association
* weight measurements should retain historical values
* journal entries should remain associated with their date
* synced health data should retain appropriate historical references
* program changes should not rewrite completed workout history
* changing a workout template should affect future workouts, not past completed sessions
* historical calculations should derive from durable records

Review the data model for accidental mutation of historical records.

Treat this as a critical product requirement.

---

# 26. History page

Evaluate the existing History route and make it useful as the detailed source of historical activity.

A user should be able to navigate by date/session and answer:

> What exactly did I do that day?

For example:

```text
August 21

Weight
168.6 lb

Mood
🙂

Workout
Lower C
1h 21m

RDL
135 × 10
185 × 8
225 × 8
275 × 6
225 × 8
225 × 8

...

Cardio
Bike
25 min
5 mi

Health
Active calories ...
Average HR ...
```

This historical record should not depend on the current version of the workout template.

---

# 27. Long-term insight architecture

Do not implement speculative AI simply because the application ultimately wants insights.

However, shape data and UX so future analysis can answer questions such as:

* Is body weight trending up or down?
* How has RDL strength changed over 8 weeks?
* Am I training consistently?
* Has volume increased?
* How do high-volume sessions affect sleep/recovery?
* Is performance falling after several difficult days?
* What was my last working weight for this exercise?
* How often have I skipped scheduled workouts?
* What have I written recently about stability or soreness?

Prefer deterministic/statistical calculations where sufficient.

Reserve AI for summarization, interpretation, pattern explanation, and natural-language interaction.

The source-of-truth metrics should not require AI.

---

# 28. Consider a future "Daily Insight" experience

Architect the UI so an insight component can eventually live naturally on Today.

For example:

```text
Today's insight

Body weight remains within your recent trend.

RDL reached a new recent top set at 275 × 6.

Training volume was higher than your previous Lower C session.

Apple Health
Exercise: 81 min
Active energy: ...
Average HR: ...
```

Insights must always indicate when data is incomplete.

Examples:

```text
Waiting for Apple Health before calculating today's training summary.
```

or:

```text
Not enough squat history yet to show a trend.
```

Never produce confident conclusions from missing data.

---

# 29. Application-wide loading and async interaction system

The application currently contains many API-triggered buttons/icons and page transitions that provide little or no indication that work is occurring.

Treat this as a design-system problem.

Do not patch individual buttons inconsistently.

Establish reusable async states:

```text
idle
loading
success
error
```

and where appropriate:

```text
optimistic
```

---

## Buttons

Example:

```text
Save exercise
```

After interaction:

```text
Saving…
```

Requirements:

* prevent accidental duplicate requests
* preserve button dimensions where possible
* show local progress
* don't freeze unrelated parts of the page
* restore interactivity after error
* surface actionable error feedback

---

## Icon actions

For icon-triggered mutations, show progress at the location where the user acted.

For example:

```text
trash icon → spinner
```

Do not use a full-page loader for a row-level mutation.

---

## Page loading

Use skeletons for structured pages where the page layout is predictable.

Avoid flashes of empty content.

Avoid loaders that appear for extremely short operations and visually flicker.

---

## Saving

Where autosaving is used, communicate states such as:

```text
Saving…
Saved
Couldn't save
Retry
```

A user should never wonder whether their workout data was persisted.

---

## Errors

Errors should:

* use plain language
* explain what failed
* preserve user-entered data
* provide retry when meaningful
* not expose raw backend error messages unless useful during development

---

# 30. Accessibility of dynamic updates

Ensure asynchronous status changes are communicated to assistive technology.

Use appropriate semantic HTML and WAI-ARIA patterns.

For non-critical status changes such as saving:

```html
role="status"
```

and/or an appropriate polite live region.

For important errors, use appropriate alert/error semantics.

Do not move keyboard focus merely to announce routine status updates.

Loading indicators should have accessible text rather than relying on animation alone.

---

# 31. Responsive behavior

The screenshots demonstrate both wide desktop layouts and narrow layouts.

Do not simply shrink desktop grids until the content wraps awkwardly.

Design responsive transformations intentionally.

Examples:

Desktop:

```text
TYPE | WEIGHT | REPS | RPE
```

Mobile might become:

```text
Set 1
Type       Working
Weight     225
Reps       8
RPE        8
```

Schedule grids may become vertical schedules.

Side-by-side page regions may stack.

Maintain hierarchy and action priority at every breakpoint.

---

# 32. Visual hierarchy

The current visual style is clean and should not be thrown away.

Preserve the existing Setframe visual identity where possible.

The problem is primarily hierarchy and workflow.

Use visual emphasis deliberately:

Primary emphasis:

* today's workout
* current task
* primary page action
* meaningful progress

Secondary emphasis:

* supporting data
* historical context
* configuration

Low emphasis:

* destructive actions
* infrequent settings
* implementation details

Avoid using large colored buttons simply because an action exists.

---

# 33. Avoid card overload

Several current pages put almost every conceptual section into a bordered/rounded card.

Cards are useful for meaningful grouping, but too many cards can make hierarchy flatter rather than clearer.

Use:

* whitespace
* section headings
* dividers
* grouping
* typography

where those are sufficient.

Reserve containers/cards for components that genuinely form distinct conceptual objects.

---

# 34. Settings

The existing Settings architecture is mostly appropriate.

Continue grouping settings by user intent.

For example:

```text
Account
Health & notifications
Preferences
Danger zone
```

Consider whether units/timezone belong under preferences rather than account information.

Do not redesign Settings merely to match another page.

The "Danger zone" treatment is appropriate for genuinely irreversible actions.

---

# 35. Terminology audit

Perform an application-wide terminology review.

Prefer user-facing fitness language over database/domain jargon.

Audit terms including:

```text
Day type
Perpetual
Ad hoc override
Resolved now
Prescription type
```

For each, ask:

> Would someone understand this without knowing our internal model?

Potential replacements may include:

```text
Workout
Workout template
Repeats weekly
Change today's workout
Schedule exception
Exercise plan
Sets & reps
Duration
```

Do not mechanically rename fields where the current term is clearer.

---

# 36. Recognition over recall

Wherever historical context can reduce memory burden, expose it appropriately.

During workout logging, useful context might include:

```text
Last time
225 × 8
225 × 8
225 × 7
```

or:

```text
Previous working weight: 225 lb
```

The user should not need to open Progress in another tab merely to remember what they did during the previous session.

Avoid overwhelming the session with full history.

Expose the minimum useful historical cue.

---

# 37. User control

Allow users to recover from reasonable mistakes.

Examples:

* undo removed exercise
* undo schedule change where feasible
* don't discard workout-session data after accidental navigation
* confirm abandonment if meaningful unsaved data exists
* preserve in-progress workouts
* allow returning to a workout through the global Resume treatment

The application should feel safe to use while tired, training, or moving between activities.

---

# 38. Primary workflow optimization

Optimize Setframe for this repeated daily loop:

```text
Open Today
↓
Record morning weight
↓
Record mood / journal
↓
Confirm nutrition step if desired
↓
Review today's workout
↓
Start / resume workout
↓
Log actual sets efficiently
↓
Finish workout
↓
Sync Apple Health
↓
Review workout + daily insight
↓
Historical data immediately becomes available in Progress
```

This should feel like one connected product experience.

Do not require the user to manually reconstruct their day on several disconnected pages.

---

# 39. Preserve flexibility

Although this is being designed around a real recurring workflow, do not hardcode the application exclusively around one person's exact workout schedule.

The architecture should support:

* strength workouts
* mobility
* walking
* cycling/cardio
* recovery sessions
* workouts measured by sets/reps
* activities measured by duration
* potentially activities measured by distance

A "Mobility — 30 min" exercise should not be forced into Weight/Reps fields simply because strength exercises use them.

Use prescription/activity types that match the activity.

---

# 40. Data model review

Before implementing UI changes, examine whether the current schema properly models:

```text
Program
WorkoutTemplate
WorkoutTemplateExercise
PlannedSet / Prescription
ScheduledWorkout
WorkoutSession
WorkoutSessionExercise
PerformedSet
Exercise
BodyWeightEntry
JournalEntry
HealthMetric / HealthSync
```

The names above are conceptual, not mandatory.

Do not rename existing entities unnecessarily.

The important relationships are:

```text
Program
  ↓
Workout template
  ↓
Planned exercise
  ↓
Planned set(s)

Schedule
  ↓
Scheduled workout/date

Scheduled workout
  ↓
Workout session
  ↓
Performed exercises
  ↓
Performed sets
```

Completed/performed data must remain immutable historical truth except through explicit historical editing.

---

# 41. Implementation sequencing

Do not attempt to rewrite everything in one uncontrolled change.

I recommend approximately this sequence:

## Phase 1 — Foundation

* audit current routes/models/components/API behavior
* formalize terminology
* formalize async/loading patterns
* implement shared loading/status components
* identify data migrations needed for planned individual sets

## Phase 2 — Training architecture

* separate Workouts from Schedule
* remove Ad hoc Override from builder
* improve workout-template editor
* simplify exercise rows
* redesign Add Exercise workflow

## Phase 3 — Prescription model

* support simple sets × reps
* support optional individualized planned sets
* instantiate those planned sets correctly into sessions

## Phase 4 — Workout session

* improve repeated set-entry UX
* planned vs actual cues
* previous-session cues
* safe adding/removing/editing
* robust persistence/loading/error states

## Phase 5 — Today

* streamline morning ritual
* scheduled-workout exception flow
* health sync/status
* improved in-progress workout handling
* post-workout review

## Phase 6 — History and Progress

* historical session detail
* meaningful Progress dashboard
* exercise trends
* body-weight trends
* consistency/history
* useful empty states

## Phase 7 — Guided program creation

Implement the creation stepper/wizard after the underlying program/workout/schedule architecture is clean.

Do not create a wizard around the current overloaded information architecture.

---

# 42. Acceptance criteria

The redesign should be considered successful when a new user can answer the following without explanation:

### Training

* How do I create a program?
* How do I create a workout?
* How do I add an exercise?
* How do I schedule a workout?
* How do I change only today's workout?

### Workout programming

* How do I prescribe 3 × 8?
* How do I prescribe different reps/weights for different sets?
* How do I reorder exercises?

### Workout session

* What was planned?
* What have I completed?
* What did I do last time?
* How do I add an unexpected set?
* Is my workout currently saved?

### Today

* What should I do today?
* What have I already recorded?
* Is my health data synced?
* Is a workout still in progress?

### Progress

* Am I training consistently?
* Is my body weight trending?
* Is an exercise getting stronger?
* What exactly did I do on a previous date?

If these answers require users to understand implementation terminology, the UX still needs improvement.

---

# 43. Testing requirements

Add or update tests for changed behavior.

At minimum, test:

* program creation/navigation
* workout-template creation
* existing exercise selection
* custom exercise creation and immediate addition
* simple prescription creation
* individualized-set prescription
* schedule assignment
* date-specific workout changes
* session creation from template
* session set modifications not mutating templates
* async button/loading/error behavior
* in-progress workout persistence
* completing workout
* historical record persistence
* responsive critical flows where the existing test environment supports it
* keyboard/accessibility behavior of important interactions

Do not rely solely on snapshots.

Test behavioral outcomes.

---

# 44. UX research basis

Use established interaction-design guidance as rationale rather than treating these requirements as arbitrary preferences.

Relevant sources:

### Nielsen Norman Group — 10 Usability Heuristics for User Interface Design

Particularly:

* Visibility of system status
* Match between system and the real world
* User control and freedom
* Consistency and standards
* Error prevention
* Recognition rather than recall
* Flexibility and efficiency of use
* Aesthetic and minimalist design
* Error recognition/recovery

Apply these directly to:

* loading states
* terminology
* historical cues
* safe workout editing
* undo/recovery
* reducing visible repeated controls
* separating unrelated workflows

Source: Nielsen Norman Group, "10 Usability Heuristics for User Interface Design."

---

### Nielsen Norman Group — Helping Users Make Decisions: Reduce Choice Overload and Avoid Overwhelming Users

Use this research when simplifying the current Program Builder and Add Exercise experience.

The objective is not merely fewer controls. It is to avoid exposing multiple competing decisions at the same time.

Source: Nielsen Norman Group, "Helping Users Make Decisions: Reduce Choice Overload and Avoid Overwhelming Users."

---

### Nielsen Norman Group — Progressive Disclosure guidance

Use progressive disclosure for advanced exercise prescriptions and less-common functionality.

The common workflow should remain simple while advanced configuration remains discoverable.

Do not hide core functionality behind ambiguous controls.

Source: Nielsen Norman Group research/guidance on progressive disclosure.

---

### Nielsen Norman Group — Application Design Showcase / Wizard Patterns

Use guided setup for initial program construction where the task naturally progresses through program → workouts → schedule → review.

Do not force returning users through the same wizard when editing an existing configuration.

Source: Nielsen Norman Group, "Application Design Showcase," wizard/navigation discussion.

---

### W3C WAI — ARIA `role=status` / Status Messages

Dynamic statuses such as:

```text
Saving…
Saved
Synced
```

must be perceivable by assistive technology without unnecessarily moving focus.

Use semantic status/live-region patterns appropriately.

Source: W3C WAI, "ARIA22: Using role=status to present status messages" and WAI-ARIA status-role guidance.

---

# 45. UX principles to keep during implementation

When uncertain about a particular visual implementation, prioritize in this order:

1. Correct mental model
2. Clear user intention
3. Efficient repeated use
4. Visibility of system state
5. Historical data integrity
6. Accessibility
7. Responsive usability
8. Visual hierarchy
9. Aesthetic polish

Do not sacrifice workflow clarity merely to make the interface look minimal.

Do not expose database concepts simply because they are convenient for implementation.

Do not create duplicate paths that behave differently for the same operation.

Do not add complexity simply because the data model supports it.

---

# 46. Most important product principle

Every major screen should answer one primary question.

```text
Programs
→ What training program am I following?

Workouts
→ What workouts exist?

Workout editor
→ What should this workout contain?

Schedule
→ When should each workout occur?

Today
→ What do I need to do and record today?

Workout session
→ What am I actually performing?

History
→ What exactly happened previously?

Progress
→ How am I changing over time?
```

The existing application often tries to answer several of these questions simultaneously.

The redesign should fix that at the architecture level before polishing individual components.

---

# 47. Expected output from this task

Before modifying code, give me:

1. A brief audit of the current relevant implementation.
2. The existing routes/components/data models involved.
3. Any data-model/API changes required.
4. The proposed component/page architecture.
5. A phased implementation plan.
6. Any areas where the requested UX conflicts with current technical constraints.

Then begin implementation.

While implementing:

* reuse existing design-system components where good
* extract reusable patterns where duplication is currently occurring
* preserve existing visual identity
* keep TypeScript types strict
* preserve accessibility
* don't introduce large dependencies without justification
* don't rewrite unrelated features
* keep commits/changes conceptually scoped where possible

After implementation, summarize:

1. What changed.
2. Why.
3. Data-model/API changes.
4. New reusable UI patterns.
5. Tests added/updated.
6. Remaining UX debt.
7. Any recommendations for the next iteration.

The goal is not simply to make Setframe look better.

The goal is to make the application feel like a coherent personal fitness system in which planning, daily tracking, training execution, Apple Health context, history, and progress all reinforce one another.


https://www.nngroup.com/articles/ten-usability-heuristics/?utm_source=chatgpt.com

https://www.nngroup.com/reports/make-decisions/?utm_source=chatgpt.com

https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22?utm_source=chatgpt.com

---

# 48. Mobile app parity gap (tracked separately, added 2026-08-21)

The web app (`apps/web`) has received all Phase 1–3 redesign work described
above. **The mobile app (`apps/mobile`, Expo/React Native) has not** — it
was scaffolded early with the pre-redesign information architecture and
several screens still render mocked/local-only state. This section
documents exactly what's missing so mobile parity can be scoped as its
own project once the web architecture (Phases 4–7) has stabilized. Do not
start mobile work until the web session/Today/History/Progress
architecture is final — otherwise mobile will be built against a moving
target and need to be redone.

## Current mobile state (as of Phase 3 completion)

Routes present under `apps/mobile/app/`:
- `(auth)` sign-in/sign-up — wired to Clerk, functional.
- `(tabs)/today.tsx` — **mocked**. Workout preview card ("Push Day A ·
  Week 2 · Day 3") is hardcoded text, not fetched from
  `/v1/dashboard/today`. "Today's check-in" inputs (weight/BP) have no
  submit handler — nothing is persisted. Sync status pill is hardcoded to
  `'synced'`. Apple Health metrics do render live via `HealthKitAdapter`,
  but only steps/calories/exercise-minutes/nutrition — no write-back to
  `/v1/daily-manual-entry` or `/v1/health-sync`.
- `(tabs)/training.tsx` — **entirely mocked**. Sets are local
  `useState` only; explicit `// TODO: wire POST /v1/workout-sessions +
  /v1/workout-exercise-logs/:id/sets` comment in the file. No session
  actually starts, no exercise data loads from a day-type/program, "Finish"
  just navigates to a static summary screen without persisting anything.
- `(tabs)/progress.tsx` — stub, no trend cards wired (the web parity gap
  the Figma audit flagged — "Progress: Figma calls for 5 trend cards; web
  shows only 1" — is *worse* on mobile, which shows effectively none).
- `(tabs)/settings.tsx` — has not been checked against the web Settings
  redesign (compact grouped-card layout, on/off toggle text).
- `exercise-history/[exerciseId].tsx` — exists but wasn't audited for the
  "silently defaults to first exercise" bug fixed on web; needs its own
  check.
- `program-editor.tsx` — pre-Phase-3; has none of the planned-set
  (per-set prescription) UI added to web's `ProgramEditorPage` in Phase 3,
  and likely predates the Phase 2 exercise-row Menu/Modal conventions.
- `session-summary.tsx` — static/mocked.

## What full mobile parity will require (do this after web Phases 4–7)

1. **Data wiring pass**: replace every mocked `useState`/hardcoded value
   above with real `useQuery`/`useMutation` calls against the same
   `apps/api` endpoints the web app uses (session start/log-set/finish,
   dashboard/today, day-types, planned-sets, daily-manual-entry,
   health-sync). Mobile has no shared API client analogous to
   `apps/web/src/lib/api-client.ts` yet — needs one (Clerk token
   attachment + base URL from `apps/mobile/.env`).
2. **Terminology/IA parity**: re-apply the terminology cleanup and
   IA changes from web Phases 1–2 (Workouts vs. Schedule separation,
   "Change today's workout" flow living on Today not the builder, etc.) —
   mobile was never updated for these.
3. **Per-set prescription model UI** (Phase 3 parity): mobile's
   `program-editor.tsx` needs the same "Customize individual sets"
   progressive-disclosure editor added to web, once the interaction
   pattern is validated on web.
4. **Phase 4 parity** (after web Phase 4 ships): real workout-session
   logging screen — planned-vs-actual set display, previous-session
   ghost values (already partially mocked via `previousWeight`/
   `previousReps` props on `SetRowEditable` — good bones, just needs
   real data), PR detection wired to real historical sets via
   `@setframe/domain`'s `detectWeightPR` (already imported, just fed
   mock `history` array), persistence/error/loading states.
5. **Phase 5 parity** (after web Phase 5 ships): real Today ritual —
   dashboard fetch, manual entry persistence, live sync status, schedule
   exception flow, post-workout review.
6. **Phase 6 parity** (after web Phase 6 ships): real History/Progress —
   the `(tabs)/progress.tsx` stub and `exercise-history` screen need the
   full trend-card set once the web version defines what "meaningful
   Progress dashboard" looks like.
7. **Design-system parity check**: mobile has its own component library
   (`apps/mobile/src/components/*`) that mirrors but does not share code
   with `apps/web/src/components/*` (different rendering targets —
   `styled-components` (web) vs. React Native `StyleSheet` (mobile)).
   Any visual/UX fix made to a web component (e.g. the banner
   opaque-background fix, toggle on/off text) must be manually
   re-applied to the mobile equivalent — there is no automatic sync.

## Recommendation

Treat mobile as **Phase 8** (not formally in the numbered phase list
above since it was scoped later): a dedicated pass that re-implements
each mobile screen against the now-stable web-validated architecture,
rather than parallelizing mobile alongside web Phases 4–7. Building
mobile screens against an architecture that's still actively changing
(Phases 4–7 haven't shipped yet) would mean redoing the same screens
twice.
