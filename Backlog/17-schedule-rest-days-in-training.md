# Story 17 — Schedule Rest Days from the Training Schedule Table

## User Story

As a user planning my week, I want to assign a rest day to a slot in the Training schedule table so that my planned recovery is part of my program rather than something I can only declare on the day it happens.

## Screenshot / Gym-Test Evidence

Rest days shipped on 2026-08-23 (`feat: let users mark a day as rest without penalty`). Today now offers a green "Mark as rest day" action, and Progress tints a rest week's column so a deliberate week off reads differently from a gap. But a rest day can only be recorded for **today** — there is no way to plan one, and no way to correct a day you forgot to mark. The Training page's schedule table assigns a day type to each slot and has no rest option, so a planned off-day is currently indistinguishable from an unassigned slot.

## Problem Statement

Rest is currently only ever recorded retroactively, one day at a time. That has three consequences:

1. **Recovery cannot be planned.** A program with deliberate off-days cannot express them, so the schedule table implies every unassigned day is a gap rather than a decision.
2. **Days cannot be corrected.** A user who trains hard Saturday and opens the app Monday has no way to mark Sunday as rest, so their history under-reports intent.
3. **The schedule and the record disagree.** `scheduleOverride` is a *plan* (`dayTypeId` is `notNull`), while `rest_day` is a *record of what happened*. Nothing currently connects them, so a planned rest day cannot pre-satisfy Today.

## UX / Product Intent

Rest is a first-class schedule assignment, not the absence of one. In the schedule table a rest slot must be visually distinct from both a training slot and an empty slot, using the established green rest treatment rather than the neutral empty styling.

Planning and recording must stay coherent: a scheduled rest day should make Today open in the rested state without requiring a second confirmation, but the user must still be able to override it by choosing a workout — training always wins over rest, exactly as it does today.

Editing the past is a correction, not time travel. Users may mark or unmark rest on a past date, but a day that already contains a non-abandoned workout stays refused, since training and rest are contradictory claims about the same day.

**The psychology rules established for rest days are non-negotiable and must survive this change:** a rest day never counts as training (`weeksTrained` and `completedCount` stay untouched), and rest weeks stay transparent to streaks — they neither extend nor break one. Planning rest further ahead must not become a way to manufacture a streak.

## Acceptance Criteria

- [ ] A slot in the Training schedule table can be assigned "Rest" alongside the existing day types.
- [ ] A rest slot is visually distinct from both a training slot and an unassigned slot, using the existing green rest treatment.
- [ ] A rest assignment can be cleared, returning the slot to unassigned.
- [ ] Rest can be assigned to a past date as a correction, and to a future date as a plan.
- [ ] Assigning rest to a day that already has a non-abandoned workout is refused with a clear explanation, matching the existing 409 behavior.
- [ ] Starting a workout on a rest day supersedes the rest assignment, as it already does on Today.
- [ ] A scheduled rest day makes Today resolve to the rested state without a second confirmation, and the user can still choose a workout instead.
- [ ] Undoing a rest day from Today is reflected in the schedule table, and vice versa.
- [ ] Rest days still never count toward `weeksTrained`, `completedCount`, or any streak, whether planned or recorded.
- [ ] Rest weeks remain transparent to streak calculation regardless of how far ahead they were planned.
- [ ] Progress continues to distinguish a rest week from an untrained gap.
- [ ] Mobile web/mobile app behavior matches.

## Product-wide Definition of Done

Every story in Setframe must satisfy these rules before it is considered done:

- The feature is implemented **mobile-first** and is fully responsive on web.
- Any user-facing behavior added or changed on web is also implemented in the **mobile application**.
- Mobile web and mobile app are reviewed side-by-side for behavioral and visual parity.
- The change is reviewed with the **GitHub reviewer** for implementation/code quality.
- The change is reviewed with the **Figma reviewer** for visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch target, and screen-reader behavior are considered for interactive controls.
- Existing historical user data is not mutated or lost unless the story explicitly requires a migration.
- Automated tests cover the important user-visible behavior; do not rely only on snapshots.
- Type checking, linting, relevant unit/integration tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.

## Copilot Steering Document

Reuse the existing rest day primitives — the `rest_day` table, `POST /v1/rest-days`, `DELETE /v1/rest-days/:localDate`, and the `restCount`/`isRestWeek`/`totalRestDays` fields already threaded through `packages/domain/src/training-trends.ts` and `packages/schemas`. Do not introduce a parallel representation of rest.

Decide deliberately whether a scheduled rest day is a `rest_day` row written ahead of time or a new nullable-`dayTypeId` path on `scheduleOverride`, and record the decision. The existing rest day work chose a dedicated table precisely because `scheduleOverride.dayTypeId` is `notNull` and that table is a plan rather than a record; if that boundary is crossed, the reason must be written down. If a migration is needed, hand-write it — `db:generate` is unusable in this repo because drizzle-kit sees the existing hand-written migrations as drift — and remember that migrations are **not** applied automatically on deploy.

`POST /v1/rest-days` is already an idempotent upsert on `(user_id, local_date)` and already 409s on a conflicting session; extend rather than reimplement it. Session creation already deletes a same-day rest day, so that supersession path is done.

Relevant surfaces: `apps/web/src/components/WeekScheduleEditor.tsx`, `apps/web/src/pages/TodayPage.tsx`, `apps/api/src/routes/rest-days.ts`, `apps/api/src/routes/dashboard.ts`, `apps/mobile/app/(tabs)/today.tsx`, and the mobile schedule editor.

Test: assigning and clearing rest, past and future dates, the workout conflict refusal, supersession by a started workout, Today reflecting a scheduled rest day, round-tripping an undo between Today and the schedule, and — most importantly — that streaks and `weeksTrained` are unchanged by a planned rest day, including a fully rest-scheduled week.
