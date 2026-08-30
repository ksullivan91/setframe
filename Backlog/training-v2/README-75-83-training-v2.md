# Training v2 — Build Pack (75–83)

## Purpose

Build the redesigned Training surface 1:1 against Figma, on **mobile web
(`apps/web` at 390px) and the mobile app**, replacing the three-tab page that
was built and never designed.

`apps/mobile/app/(tabs)/training.tsx` is **1,143 lines**, three tabs, six
nested cards. The tabs are table names — Programs / Workouts / Schedule map
one-to-one onto `training_program`, `day_type` and `program_schedule_slot`,
so the user picks which part of our data model they want before they can act.

## The specs are the source of truth

Every story points at an existing spec rather than restating it. The Figma
node IDs below were read out of the file programmatically, not transcribed.

| Doc | Covers |
|---|---|
| `docs/design/training-page-exploration.md` | The overview, per-control interactions, empty states |
| `docs/design/training-flow-build-your-own.md` | Guided setup, step by step |
| `docs/design/training-flow-just-start-training.md` | Ad hoc sessions, save-as-workout |
| `docs/design/exercise-examples-exploration.md` | The picker and the illustration tile |
| `docs/adr/0005-...` | Intent vs fact — the constraint every editor screen must respect |
| `docs/adr/0009-...` | "Tabs are places, sessions are routes" — why this cannot regress |

## Figma inventory — every frame this pack builds

**Walkthrough** (section `146:708`) — the reference journey, fresh user → full plan:

| Screen | Node |
|---|---|
| 1 · No plan yet | `148:708` |
| 2 · A plan, nothing in it | `158:708` |
| 3 · Build a workout (editor) | `147:708` |
| 4 · Set an exercise's targets (sheet) | `152:708` |
| 5 · Plan the week (schedule) | `150:708` |
| 6 · Assign a day (sheet) | `156:708` |
| 7 · Set up, and training (overview) | `146:709` |
| 8 · Later — switch plans | `151:708` |
| Spec · Recommendations and interactions | `149:708` |
| Spec · Empty states | `152:824` |

**Build your own** (section `165:782`): `161:708`, `161:743`, `162:708`,
`162:750`, `163:708`, `164:708`, `164:747`; notes `165:708`.

**Just start training** (section `170:901`): `167:708`, `167:727`, `168:708`,
`168:834`, `169:838`, `169:883`; notes `170:838`.

**Picker and tiles** (section `129:512`): `129:513`, `130:512`, `131:512`.

## Distinct surfaces

24 frames, but far fewer surfaces — the picker appears in three flows and is
built once. Sixteen distinct surfaces:

1. Training overview (`146:709`) — replaces the three tabs
2. Empty: no plan (`148:708`) — three routes out
3. Empty: plan with no workouts (`158:708`)
4. Empty: week with nothing scheduled (`152:824`)
5. Workout editor (`147:708`) — **pushed, never appended**
6. Prescription sheet (`152:708`)
7. Schedule (`150:708`)
8. Assign-a-day sheet (`156:708`)
9. Plans list (`151:708`)
10. Exercise picker, multi-select (`163:708` / `129:513`) — **shared by all three flows**
11. Exercise detail (`130:512`)
12. Guided setup: name plan / name workout / choose days (`161:708`, `162:708`, `164:708`)
13. Guided setup: progress states (`161:743`, `162:750`, `164:747`)
14. Ad hoc empty session (`167:708`)
15. Save-as-workout offer + naming (`168:834`, `169:838`)
16. Workouts with no plan (`169:883`)

## The API is almost entirely already there

Checked endpoint by endpoint rather than assumed. Everything the redesign
needs exists except one thing:

- Programs: list/create/get/update/**activate**/archive
- Day types: full CRUD, exercises, reorder, planned sets
- Schedule slots: list/create/update/delete under `/v1/programs/:programId/schedule-slots`
- Per-date overrides: `/v1/me/schedule/:date/override`
- Rest days: `/v1/rest-days/:localDate`
- Sessions: create **with a null `templateId` already supported**

**The one gap: no endpoint saves a finished session as a `day_type`.** That is
story 82, and it is the only new backend surface in the pack.

The overview itself needs **no new aggregate endpoint** — it composes from
programs + day-types + schedule-slots + `/v1/dashboard/today`.

## Order, and why

Foundation first, then the surface everything else pushes from, then the
flows that fill it.

| # | Story | Depends on |
|---|---|---|
| 75 | Shared geometry tokens + overview domain helpers | — |
| 76 | Training overview, replacing the tabs | 75 |
| 77 | The three empty states | 76 |
| 78 | Multi-select exercise picker, extracted as one shared surface | 75 |
| 79 | Workout editor (pushed) + prescription sheet | 76, 78 |
| 80 | Schedule + assign-a-day sheet | 76 |
| 81 | Plans list + switching | 76 |
| 82 | Just start training, incl. the save-as-workout endpoint | 76, 78 |
| 83 | Build your own, guided setup | 76, 78, 79, 80 |

78 comes early and out of numeric order on purpose: three later stories all
push to the picker, and building it per-flow is how the current codebase
ended up with two divergent copies.

## Verification, per story

The approach proven on logger v2, which caught three real defects a pixel
diff would have dismissed as rasterisation noise:

1. **Geometry assertions, not pixel diffs.** Constants read out of Figma,
   asserted against the rendered DOM in Playwright at 390px.
2. **Render it and look at it.** Screenshot both platforms. Green tests did
   not catch the wrapped PREVIOUS column, the doubled header, or the missing
   banner figures — looking did.
3. **Both platforms, every story.** Web/mobile parity is verified by
   screenshot, never assumed.

## What must not regress

- **ADR 0009.** Tabs are places, sessions are routes. Mobile/web Training
  divergence already caused production data loss once: a mount effect POSTed
  a session, shadowing a finished workout and destroying rest days.
- **ADR 0005.** Editing intent never alters logged fact. Every editor screen
  carries the hint line saying so.
- **Rest is the absence of a slot.** `dayTypeId` is `NOT NULL`, so assigning
  Rest deletes the day's slots rather than writing one.
- **A day can hold several workouts.** No unique constraint on
  `(programVersionId, dayIndex)`, and `sortOrder` exists — the assign sheet is
  multi-select, not single.
