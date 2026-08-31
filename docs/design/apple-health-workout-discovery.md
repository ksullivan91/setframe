# Apple Health workout discovery (story 44)

Figma: 📱 Mobile → `🔬 Exploration — Apple Health workout discovery, story 44
(not signed off)`, five 390×844 frames plus a spec board (`node-id=211-962`).

Status: **designed, not built, not signed off.** Backlog item is
`Backlog/WAIT-apple-health-activity-discovery.md`.

## The shape

Detect → suggest → you confirm. Never silent import. That is the story's rule
and every frame holds to it.

1. **One suggestion** — a tinted row inside the existing Additional activity
   card: `Outdoor Walk · 12:42 PM · 17 min · 0.8 mi`, with **Add to today** and
   **Dismiss**.
2. **Several found** — stacked, each confirmed separately, above any already
   imported rows.
3. **Prefilled, still yours to edit** — Add opens the normal Add Activity
   sheet with the mapping filled in and labelled as a guess.
4. **One more permission** — connected to Apple Health, but workouts not
   shared.
5. **Already your session** — a Watch-recorded strength workout that overlaps
   a logged Setframe session, suppressed and said out loud.

## Two traps that are not in the story

Both surfaced from reading the shipped adapter against the story text, and
both change what gets built.

### Workouts are a separate permission

`HKWorkoutTypeIdentifier` is in **no read set today** —
`CORE_READ_TYPES` and `EXTENDED_READ_TYPES` cover activity, nutrition,
recovery, body and characteristics, and `queryWorkoutSamples` is never called.

So "connected to Apple Health" does not imply "workouts discoverable". Anyone
who connected this week still has to grant this one, and the card has to
explain a *second* ask without reading as a broken promise (frame 4). It
should go through `EXTENDED_READ_TYPES` so it rides the existing
`hasUnaskedTypes()` / second-sheet path rather than inventing another prompt.

### We would suggest the user's own session back to them

The Watch records `Traditional Strength Training` for the same hour the user
logged Lower A in Setframe. Setframe never writes to HealthKit, so our session
is not there — but the Watch's recording of it is, and offering it as
"additional" activity **double-counts the session that is the centre of the
screen**.

External-id dedupe does not catch this: it is a different record entirely, and
the user has never imported it. It needs an overlap check against logged
sessions. And the suppression must be *visible* (frame 5) — silently dropping
the one workout the user definitely did looks like the feature is broken.

## Decisions taken

| Decision | Why |
|---|---|
| Suggestions never look logged | Tinted, with their own actions. If offered and recorded looked alike, Dismiss would feel like Delete. |
| No "Add all" | Each suggestion is a separate claim about the day. A bulk button is how silent importing arrives by the back door. |
| Add opens the prefilled sheet | Walking → Walk is a guess; the guess should be visible and changeable, not committed. |
| Provenance survives import | The saved row keeps `source: apple_health` and shows the badge, so months later it is clear which activities were typed and which the Watch supplied. |

## Cost

**Already there** — `additional_activity` has `source` and
`external_source_id`, a unique index on `(user_id, source, external_id)`, and
the `apple_health` badge already renders. The dedupe key has been waiting
since story 40. `POST /v1/additional-activities` already accepts both fields,
so the import itself needs **no new endpoint and no migration**.

**New** — `queryWorkoutSamples`, a workout-type → activity-type mapping layer,
the overlap-with-session check, the suggestion UI, and one more permission
type.

## Open — needs a decision before building

- **Where dismissals live.** Nothing stores them. On device, a reinstall
  re-nags with a month of old walks; on the server, it is a new table and
  endpoint. Leaning device-local with a date floor.
- **How far back to look.** Today only is simplest and matches the frames. A
  rolling window matches the reconciliation model but turns first launch into
  a wall of suggestions.
- **What counts as overlap.** Any time intersection with a logged session, or
  a stricter type match? Too loose and a genuine post-gym walk is suppressed;
  too strict and the double-count returns.
- **Whether web says anything.** Web cannot read HealthKit. Silence risks
  reading as a missing feature; a note explains that discovery is phone-only.
