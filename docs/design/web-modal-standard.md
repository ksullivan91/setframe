# Setframe web modal standard

Written 2026-08-26 for story 64, after a mobile-web add-exercise flow was
reported rendering as two disconnected sheets.

**Scope: `apps/web` only.** The native app keeps its own `Sheet` primitive and
is deliberately untouched — an explicit, one-off exception to the parity rule,
because the defect and the fix are both specific to the mobile *browser*.

## The diagnosis

There is one modal primitive (`apps/web/src/components/Modal.tsx`), it
portals to `document.body`, and it renders exactly one backdrop and one
surface. It is not nested and it does not stack. So the reported "two sheets"
is not a second dialog.

What it is: below 640px the primitive presents **every** modal as a bottom
sheet — `align-items: flex-end`, `max-height: 85dvh`, rounded top corners.
A form that does not fill 85% of the viewport therefore sits as a rounded
white slab against the dimmed app, and the app's own white cards remain
visible above it. Two rounded light surfaces stacked vertically read as two
sheets, because visually that is what they are.

That is a presentation problem, not a CSS bug, which is why it has recurred:
the primitive is correct and the *shape it always chooses* is wrong for the
content.

The `85dvh` cap compounds it. A short dialog is a small slab; a long one is a
tall slab that still leaves a strip of dimmed app above. Neither reads as a
focused task.

## The rule

**Presentation follows the task, not the breakpoint.**

| Presentation | Use for | Compact (<640px) | Wider |
|---|---|---|---|
| `task` | Forms, searchable pickers, anything that raises the keyboard or grows dynamically | Fills the viewport as one surface | Centred dialog, content scrolls inside |
| `compact` | Confirmations, destructive checks, short warnings, binary decisions | Centred, sized to content | Centred, sized to content |
| `actions` | A short list of contextual choices tied to one action | Bottom sheet | Centred dialog |

A `compact` dialog does **not** become full-screen just because the device is
small. A confirmation with two sentences and two buttons filling an iPhone is
as wrong as a form crammed into a drawer — the presentation should match how
much of the user's attention the task actually deserves.

`actions` is deliberately narrow. It is the one place a bottom sheet is still
right, and it must never hold a scrolling multi-field form. If a choice list
can grow without bound, it is a `task`.

### Why full-screen for tasks

- W3C's own modal-dialog example fills the screen on small devices,
  specifically to improve readability and stop the background moving while
  dialog content scrolls.
- Apple's HIG directs full-screen presentation for more complex or in-depth
  tasks, and warns against popover-style presentation in compact views.
- It removes the failure mode above by construction: if the dialog is the
  whole viewport, there is no strip of application left to read as a second
  sheet.

## Rules every presentation must satisfy

**One scroll container.** Exactly one element owns vertical scrolling for a
given dialog. For `task`, that is the content region between a fixed header
and an optional fixed footer — never the outer surface and never the body.
Nested scrolling is what produces "which thing am I scrolling" and detached
visual states.

**Dynamic viewport units.** `dvh`, with `vh` first as a fallback for browsers
without it. `100vh` in mobile Safari is the viewport *without* browser chrome,
so a `100vh` dialog is taller than the screen and its footer is unreachable.
Never a hard-coded pixel height, and never a JS-measured `window.innerHeight`
written to a style — both go stale the moment the keyboard opens.

**Safe areas extend padding, they do not replace it.** `max(spacing,
env(safe-area-inset-*))`. Using the inset alone leaves content edge-to-edge in
portrait, where the inset is 0 — a bug this repo has already fixed once
(story 29).

**The background is inert.** Body scroll locked without a layout width shift,
scroll position restored on close, and repeated open/close must not
accumulate lock styles.

**The app's bottom navigation never sits above a modal.** A primary action the
user cannot reach is the same defect as one that is clipped.

**Focus is deliberate.** Focus moves into the dialog on open, cannot leave it
while open, `Escape` dismisses anything non-blocking, and focus returns to the
control that opened it.

**No stacked modals.** A dialog transitions its own content internally rather
than opening a second layer over itself. `AddExercisePicker` already does this
correctly — it swaps between three states inside one dialog rather than
nesting — and that pattern is the standard.

## Inventory and classification

Fourteen modal instances, all built on the single `Modal` primitive.

### `task` — full-screen on compact

| Dialog | Where | Why |
|---|---|---|
| Add exercise (search + list) | `AddExercisePicker` | Search input, keyboard, list grows with the library |
| Exercise prescription | `AddExercisePicker` | Multi-field form, keyboard. **The reported defect** |
| Create custom exercise | `AddExercisePicker` | Text input, keyboard |
| Edit exercise | `ExerciseEditModal` | Multi-field prescription form |
| Add / edit activity | `TodayAdditionalActivitySection` | Multi-field form incl. the duration inputs |
| Add an existing workout | `ProgramEditorPage` | Selection list, grows with the program library |
| Swap today's workout | `TodayPage` | Selection list, grows |
| Today's plan preview | `TodayPage` | Read-only but unbounded — an exercise list of any length |

### `compact` — centred, brief decision

| Dialog | Where |
|---|---|
| Remove set? | `WorkoutSessionPage` |
| Remove exercise from today's workout? | `WorkoutSessionPage` |
| Finish workout? | `WorkoutSessionPage` |
| Remove activity? | `TodayAdditionalActivitySection` |
| Remove workout? | `ProgramCreationWizardPage` |
| Remove / delete workout? | `ProgramEditorPage` |

### `actions` — none today

No current web dialog is a short contextual choice list. The variant exists
because the native app uses that shape for exactly this (the workout action
sheet in Training), and web will want it when an overflow menu outgrows
`Menu`. It is specified but unused, and that is recorded here so nobody
"migrates" a form into it to make it look used.

### Not a modal

`MetricInfo` is an anchored popover on Floating UI, not a dialog. Story 46
made it that deliberately — it is transient, non-blocking, and tied to a
trigger. It stays out of this system.

## What this replaces

The current primitive takes `maxWidth` and infers everything else from the
breakpoint. The replacement takes `presentation` and infers layout from the
task. `maxWidth` remains meaningful only for the wider-viewport case.

Callers should not be able to produce a bottom-sheet form by accident, which
is why the variant is a required prop rather than a default.
