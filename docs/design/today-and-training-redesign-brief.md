# Today & Training Redesign Brief

**Status:** Draft for review — not yet approved, not yet in Figma.
**Inputs:** User interviews (this session), `docs/research/today-and-training-redesign-research.md`.
**Scope:** Two screens only — Today (web + mobile) and Training/ProgramEditor (web + mobile). No other screens change.

---

## 1. Today Screen → Guided Daily Ritual

### 1.1 Problem with current screen
Current Today screen is a static stats dashboard (streak count, next workout card). It doesn't reflect the user's actual morning routine or give a sense of "what do I do next."

### 1.2 Target behavior (from user's described real workflow)
A **sequential checklist of the day's ritual steps**, each either auto-synced (from Watch/HealthKit/MFP) or manually logged, in this order:

1. **Morning weight** — manual entry (already have `daily_manual_entry.morningWeightValue`)
2. **Journal / mood** — manual entry (short text + mood selector) — **new field needed**
3. **Pre-workout meal** — logged externally in MyFitnessPal; Setline just shows a "logged in MFP ✓" checkbox or link-out, not full nutrition tracking (no MFP API integration in this phase — manual "done" toggle only)
4. **Workout** — tap to start today's scheduled session (existing workflow, now the 4th ritual step, not the sole focus)
5. **Watch auto-sync** — calories/duration pulled in automatically after the fact (already exists via `daily_activity_summary`); shown as a completed step once data lands, not something the user "does"

### 1.3 UX pattern decisions (from research)
- **Streaks-style ordered checklist**, not Habitica-style gamified points — matches user's "sequence" framing, avoids extra gamification complexity.
- **Oura-style "morning card"** for weight/journal/mood grouped as one micro-ritual block at the top, separate visually from the workout step below it.
- Auto-synced items render in a **visually distinct "passive/done-for-you" state** (subtle checkmark + timestamp, no tap target) vs. manual items which are **actionable tap targets** until completed.
- No streak-breaking penalty framing (research flagged this as a common anti-pattern that causes user disengagement) — missed days just don't get a checkmark, no guilt copy.

### 1.4 New data model needs
- Add `mood` (small enum: e.g. 1–5 or emoji set) and `journalText` to `daily_manual_entry` — **or** keep `notes` as the journal field and just add `mood`. Recommend: reuse existing `notes` for journal text (rename column comment only, no schema break), add new `mood` smallint column.
- Add `preWorkoutMealLogged` boolean to `daily_manual_entry` (manual "done in MFP" toggle — no real MFP integration this phase).
- No new tables required for Today — extending `daily_manual_entry` covers it.

### 1.5 New API needs
- `PATCH /v1/me/daily-entries/:date` already likely exists for weight/BP — extend payload to accept `mood`, `preWorkoutMealLogged`. Confirm/extend existing daily-manual-entry route rather than adding new endpoints.

---

## 2. Training / Program Editor → Flexible Day-Type Builder

### 2.1 Problem with current design
Current schema hard-wires `workout_template` rows directly under a single `program_version`, in a fixed sort order — there's no reusable, freely-named "day type" that exists independently of a specific program's week structure, and no way to swap a day ad hoc without editing the program itself.

### 2.2 Core requirement (explicit, from user)
**Day types must be fully user-authored and editable at any time** — never a predetermined/fixed list. This directly validates against the research's clearest finding: **Strong/Hevy pattern (free-text, user-owned) is correct; Fitbod's fixed Fresh/Full-Body/Push-Pull-Lower taxonomy is the explicit anti-pattern to avoid.**

### 2.3 Proposed model: separate "Day Type Library" from "Program Schedule"
Two independent concepts, linked by reference rather than embedding:

1. **Day Type** (new first-class, reusable entity) — e.g. "Upper A," "Recovery Walk," "Bike 5mi." Freely named, freely edited, freely deleted, independent of any program. This is essentially today's `workout_template` promoted to a **standalone library entity** (`workout_template.programVersionId` currently forces every template to belong to one program version — this coupling needs to be removed/loosened).
2. **Program Schedule** — assigns Day Types to calendar slots. Two modes, matching the research's identified market-gap distinction:
   - **Block mode**: fixed `cycleLengthWeeks`, day types assigned to specific week/day slots (current model, made optional rather than default).
   - **Perpetual mode**: a repeating day-type sequence with no end date (e.g. "A, B, Rest, A, B, Rest, Rest" forever) — no week-numbering UI shown to the user in this mode.
3. **Ad hoc override** — a given calendar date can point at a different Day Type than its schedule would imply (for travel/disruption), without editing the underlying schedule. Needs a small `schedule_override` table: `(userId, date, dayTypeId, note)`.

### 2.4 Mixed-modality exercise entry (research Rec: support sets/reps, duration-based, and distance+duration in the same day type)
- `workout_template_exercise.prescription` is already a discriminated-union JSONB field per `docs/data-model.md` §3.1 — confirm it currently supports sets/reps only; extend the Zod union in `packages/schemas` to add `duration` (e.g. "Mobility, 30 min") and `distanceDuration` (e.g. "Bike ride, 5mi / 30min") variants if not already present.

### 2.5 Plan vs. Log visual separation (research Rec 5)
- When viewing today's scheduled Day Type before starting: exercises render in a **muted "planned" state** showing target prescription only.
- Once a `workout_session` is started: same exercises switch to a **live "logging" state** showing actual entered values, mirroring WHOOP's target-vs-actual pattern. This is a UI-state change only, no new schema needed — driven by presence of an active `workout_session`.

### 2.6 New data model needs (summary)
| Change | Detail |
|---|---|
| Loosen `workout_template.programVersionId` | Make nullable, or introduce a new `day_type` table and have `workout_template` reference it, with `program_version` scheduling referencing `day_type` instead of owning templates directly. Recommend: rename/repurpose `workout_template` → `day_type` (drop hard FK to `program_version`), add new `program_schedule_slot` table for block-mode week/day assignment. |
| `training_program.cycleLengthWeeks` | Make fully optional (already nullable) — becomes the toggle for block vs. perpetual: `null` = perpetual, set = block. |
| New `program_schedule_slot` table | `(programVersionId, dayTypeId, weekNumber?, dayIndex, sortOrder)` — `weekNumber` null in perpetual mode. |
| New `schedule_override` table | `(userId, date, dayTypeId, note, createdAt)` — ad hoc swap, takes precedence over computed schedule for that date. |
| `prescription` Zod union | Add `duration` and `distanceDuration` variants if missing. |
| `daily_manual_entry` | Add `mood` smallint, `preWorkoutMealLogged` boolean (see §1.4). |

### 2.7 New/changed API needs
- `day_type` CRUD (`GET/POST/PATCH/DELETE /v1/day-types`) — replacing or extending current template-under-program endpoints.
- `program_schedule_slot` endpoints for assigning day types to a program's calendar.
- `schedule_override` endpoints: `GET /v1/me/schedule/:date`, `PUT /v1/me/schedule/:date/override`.
- Dashboard/Today "next workout" resolution logic must check `schedule_override` before falling back to computed block/perpetual schedule.

---

## 3. Explicitly Unchanged
Progress, Settings, Sign In/Up, and nav shell remain as-is per prior confirmation — no work planned there in this pass.

## 4. Suggested Sequencing
1. Approve this brief (you are here).
2. Figma: redesign Today (ritual checklist) and Training (day-type library + schedule builder + override modal), web + mobile parity, using existing style guide (`docs/design/setline-figma-style-guide.md`) as the base system — no new color/typography work needed, just new layout/components.
3. Update `docs/data-model.md` and `docs/api.md` for the schema/endpoint changes in §2.6/§2.7 and §1.4/§1.5.
4. Migrate DB (new tables/columns), implement new API routes.
5. Rebuild `TodayPage`/`ProgramEditorPage` (web) and mobile equivalents against the new schema.
