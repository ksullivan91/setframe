# Apple Health workout discovery (story 44)

Figma: 📱 Mobile → `🔬 Exploration — Apple Health workout discovery, story 44
(not signed off)`, five 390×844 frames plus a spec board (`node-id=211-962`).

Status: **built** (mobile only). `apps/mobile/src/healthkit/workout-discovery.ts`
(pure rules), `useWorkoutDiscovery.ts`, `dismissed-workouts.ts`, and the
suggestion UI in `src/components/TodayAdditionalActivitySection.tsx`.
Not yet verified on a real device.

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

## Decisions taken (2026-08-31)

- **Dismissals are device-local and persisted**, in `expo-secure-store`,
  scoped to one `localDate`. The requirement was explicit: a dismissed
  suggestion must not return when the app is closed and reopened, so the
  write reaches storage on every dismissal rather than at some later flush.
  Scoping to the day means the record clears itself at midnight instead of
  growing forever.

  `expo-secure-store` rather than AsyncStorage because it is already a direct
  dependency and already native-linked here (the Clerk token cache uses it),
  whereas AsyncStorage is present only transitively through a wallet adapter
  and could vanish on any dependency bump.

- **Today only.** The query window is local midnight → now, the same boundary
  every other daily read uses.

- **Overlap is time intersection AND a loose type match.** A workout is
  suppressed only when it overlaps a logged session *and* its Apple type is
  one that could plausibly *be* that session — the strength/functional/core/
  cross-training/HIIT family, plus `other`. `other` is included deliberately:
  it is genuinely ambiguous, and ambiguity should not double-count. The type
  half is what keeps a genuine walk that merely shares a clock with a lift
  from being swallowed.

  Abandoned sessions are excluded from the check: nothing was really trained,
  so a workout over that window is a real separate activity.

- **Web does nothing.** Web is being retired to a landing page and cannot read
  HealthKit anyway.

## Verified, and not

Unit tests cover the mapping table, the overlap rule, dedupe, dismissal
persistence across a simulated relaunch, the metres→miles conversion, the
indoor-cycling flag, and the separate workout permission. Each was
revert-verified.

**Nothing here has seen a real HealthKit store.** The normalization reads
through `toJSON()` on nitro proxies, which is the shape the typings describe
but not one that has been observed. Expect the first device run to need
corrections.
