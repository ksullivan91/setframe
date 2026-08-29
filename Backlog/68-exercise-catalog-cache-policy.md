# Story 68 — Exercise Catalog Cache Policy

**Status:** Open. Prerequisite for expanding the system exercise catalog.
**Related design:** `docs/design/exercise-examples-exploration.md`,
Figma `Explore/Spec/ExerciseExamples` (`132:574`) → "Data and caching".

## Origin

Came out of the exercise-examples design conversation. We want to grow the
system catalog from **33** exercises to a comprehensive one (300–500), and
the question was whether a large catalog makes the picker worse.

It does not — provided the client holds the catalog rather than re-fetching
it. The catalog is effectively static, it is small in bytes, and searching
an in-memory array beats a network round trip per keystroke, works on bad
gym wifi, and can rank by the user's own history in a way the server
cannot cheaply.

**This story is the enabling work. It does not add any exercises.**

## User story

As someone adding an exercise mid-workout, I want the picker to open and
filter instantly — including on bad gym wifi — so that finding a movement
never interrupts a set.

## Current behaviour

- `GET /v1/exercises` returns **all** system exercises plus the caller's
  own custom ones, unfiltered. `apps/api/src/routes/exercises.ts`
- The route's Zod querystring accepts `q`, and **the handler ignores it**.
  The where clause filters on `archivedAt` and ownership only.
- There is **no `staleTime`, no `gcTime`, and no query persistence** in
  either `apps/web` or `apps/mobile`. React Query's default `staleTime: 0`
  applies, so every screen that mounts refetches in the background —
  including every picker open.
- Both apps already share the `['exercises']` query key across the program
  wizard, program editor, session page and exercise history, so the data
  is already deduped within a session.
- **Except** `apps/mobile/app/workout/[sessionId].tsx:313`, which uses
  `['mobile-exercises']` — the same data under a second cache entry, so
  it fetches twice and the two can disagree.

## Requirements

### 1. Cache the catalog for 24 hours

Set `staleTime` to 24h for the exercise list query and for the
per-exercise detail query, on both platforms.

24h rather than `Infinity` so a catalog update lands without a reinstall:
stale-while-revalidate means nobody ever waits, and a new exercise appears
within a day. `Infinity` would strand users on an old catalog forever.

The detail query gets the same 24h for a concrete reason: the expected
path is *browse an exercise while building a workout → add it → reopen it
mid-workout to re-read the cues*. That is two reads of the same detail
inside one session, and the second should not hit the network.

### 2. One method for creating a custom exercise

Custom exercises are the one part of this payload that is **not** static —
a user must see their own exercise the instant they create it.
`invalidateQueries` overrides `staleTime`, so the existing invalidation is
already correct; the risk is a future create path that forgets it.

Add a single `createCustomExercise` helper per platform that POSTs and
invalidates `['exercises']`, and route every call site through it:

- `apps/web/src/lib/api-client.ts`
- `apps/mobile/src/lib/api-client.ts`

Two files, mirrored, matching this repo's per-platform duplication
convention. **Do not revive `packages/api-client` for this** — it is a stub
(see its TODO), and filling it in is a larger decision than this story.

Known create paths to migrate: the program creation wizard, the program
editor, and the in-session add-exercise flow, on both platforms.

### 3. Fix the duplicate mobile cache key

`apps/mobile/app/workout/[sessionId].tsx` → `['exercises']`, matching every
other call site. A second key silently defeats the caching this story adds.

### 4. Keep the list payload lean

The list response feeds the picker; it must carry only what a picker row
renders. Cues and secondary muscle mappings — when they exist — belong to
the per-exercise detail response, not the list.

Nothing to build here yet, since neither exists. **Record it so the
question is asked** when the muscle/cue work lands: at 400 exercises with
four cues each, folding detail into the list turns ~15KB gzipped into
something an order of magnitude larger, fetched on every app start.

### 5. Retire the deferred trigram search

Client-side search over an in-memory array replaces it. Remove, rather
than implement:

- the `pg_trgm` GIN index TODO in `packages/database/src/schema/exercise.ts`
- the "`?q=` trigram search is deferred" comment in
  `apps/api/src/routes/exercises.ts`
- the unused `q` querystring param, **or** implement it as a plain `ILIKE`
  for non-picker consumers — pick one, do not leave a param the handler
  ignores

Check whether removing `q` from the Zod querystring is a breaking change
for any caller before doing it. Zod objects strip unknown keys by default
rather than erroring, so it is very likely safe, but verify rather than
assume.

## Recommended, not yet agreed

**Persist the cache across app restarts** (`persistQueryClient` with
`localStorage` on web, `AsyncStorage` on mobile). Without it, "24 hours"
only means the current session: a web page reload or a mobile cold start
refetches. With it, the catalog is fetched roughly once a day per device.

Flagged separately because it goes beyond what was discussed and it adds a
dependency and a cache-versioning concern of its own. Cheap to add later;
the story is worth shipping without it.

## Acceptance criteria

1. Opening the exercise picker twice within 24h issues **one** network
   request for the exercise list, not two.
2. Creating a custom exercise makes it appear in the picker immediately,
   with no manual refresh — verified on web **and** mobile.
3. Every create-exercise call site goes through the shared helper; grep
   finds no direct `POST /exercises` outside it.
4. `grep -rn "mobile-exercises"` returns nothing.
5. `staleTime` is set for both the list and detail queries on both
   platforms.
6. No comment in the repo still describes `?q=` trigram search as deferred
   or planned.
7. Existing tests pass; add coverage for the invalidate-on-create path,
   since that is the one behaviour that silently breaks if the helper is
   bypassed.

## Out of scope

- **Adding exercises.** The catalog expansion is a separate story, blocked
  on the naming/canonicalization rules and a data-source decision.
- **The picker's empty state.** With a large catalog the no-query state
  needs *Recent · In this program · Popular* sections instead of a flat
  list. Real, but it belongs with the catalog expansion, not here.
- Muscle mappings, cues and illustrations — see
  `docs/design/exercise-examples-exploration.md`.

## Notes

`muscle_group` and `exercise_muscle` are created in migration
`0000_melodic_anthem.sql` and referenced **nowhere else in the repo** — no
seed, no route, no query. They are empty, and will stay empty until
something writes to them. That is a finding for the catalog work, not this
story, but it is the reason the picker cannot show a muscle subtitle today.
