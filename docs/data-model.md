# Setline — Data Model (Phase 0 Draft)

Status: Proposed, pending review. No migrations exist yet — this defines
the target Drizzle/PostgreSQL schema shape for Phase 2+.

Conventions: UUIDs (or ULIDs — TBD, see open question) for all primary
keys. Every user-owned table has a `user_id` foreign key and every query
must be scoped by the authenticated internal user id — never by record id
alone (master spec §17).

## 1. Identity

```text
user
- id (uuid, pk)
- clerk_user_id (text, unique, not null)
- display_name (text)
- preferred_units (enum: 'imperial' | 'metric', default 'imperial')
- timezone (text, IANA tz name, e.g. "America/Chicago")
- created_at, updated_at
```

## 2. Exercise catalog

```text
exercise
- id (uuid, pk)
- name (text, not null)
- canonical_slug (text, unique)
- movement_pattern (text, nullable)
- equipment (text, nullable)
- is_system (boolean, not null, default false)
- created_by_user_id (uuid, fk -> user.id, nullable) -- null for system exercises
- archived_at (timestamptz, nullable)
- created_at, updated_at

Indexes: (canonical_slug) unique; (created_by_user_id) for "my custom exercises";
GIN trigram index on (name) for /v1/exercises?q= search (pg_trgm extension).

muscle_group
- id (uuid, pk)
- name (text, unique, not null)  -- e.g. "Quadriceps", "Lats", "Anterior Deltoid"
- region (text, nullable)        -- e.g. "legs", "back", "shoulders" — coarse grouping for UI filters
- created_at

exercise_muscle
- id (uuid, pk)
- exercise_id (uuid, fk -> exercise.id, not null)
- muscle_group_id (uuid, fk -> muscle_group.id, not null)
- role (enum: 'primary' | 'secondary', not null)

Unique: (exercise_id, muscle_group_id).
Index: (muscle_group_id) for "exercises that target X" lookups.
```

**Muscle metadata: normalized, not JSONB.** Decided in favor of normalized
join tables over a `muscle_metadata` JSONB column. Rationale: this is a
small, bounded reference dataset (a few dozen muscle groups shared across
all exercises), so the normalization cost is trivial, while it unlocks
cheap indexed filtering/search ("show exercises targeting hamstrings",
program-balance analysis across muscle groups) without a future migration
off JSONB. This is the option that scales best relative to its low added
complexity, per the request to optimize for scale over MVP-minimalism on
this specific field.

## 3. Programs, versions, templates

```text
training_program
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- name (text, not null)
- description (text, nullable)
- is_active (boolean, not null, default false)
- start_date (date, nullable)
- cycle_length_weeks (integer, nullable)  -- e.g. 4; used to derive "Week 2"
  labeling for the pre-workout preview card. Nullable because not every
  program is cyclical (e.g. a single non-repeating block).
- archived_at (timestamptz, nullable)
- created_at, updated_at

Index: (user_id, is_active) for "find my active program" lookups.

program_version
- id (uuid, pk)
- training_program_id (uuid, fk -> training_program.id, not null)
- version_number (integer, not null)
- effective_from (date, not null)
- effective_to (date, nullable)
- notes (text, nullable)
- created_at

Unique: (training_program_id, version_number).

workout_template
- id (uuid, pk)
- program_version_id (uuid, fk -> program_version.id, not null)
- name (text, not null)
- day_label (text, nullable)   -- e.g. "Lower C"
- sort_order (integer, not null)
- description (text, nullable)
- estimated_duration_minutes (integer, nullable)  -- single estimate (e.g. 50);
  UI renders a ±5min band ("~45-55 min") around it. Nullable so older/simple
  templates aren't forced to guess.
- created_at, updated_at

workout_template_exercise
- id (uuid, pk)
- template_id (uuid, fk -> workout_template.id, not null)
- exercise_id (uuid, fk -> exercise.id, not null)
- sort_order (integer, not null)
- prescription (jsonb, not null)  -- see §3.1
- progression_rule_id (uuid, fk -> progression_rule.id, nullable)
- notes (text, nullable)
- created_at, updated_at
```

### 3.1 Prescription shape (JSONB, typed at the application layer via Zod)

Must not force weight+reps onto every exercise. Proposed discriminated
union (validated with Zod in `packages/schemas`, stored as JSONB):

```ts
type Prescription =
  | { kind: 'sets_reps'; sets: number; repsMin: number; repsMax?: number }
  | { kind: 'top_set_backoff'; topSets: number; topRepsMin: number; topRepsMax: number;
      backoffSets: number; backoffRepsMin: number; backoffRepsMax: number }
  | { kind: 'per_side'; sets: number; repsMin: number; repsMax?: number }
  | { kind: 'timed'; sets: number; durationSeconds: number }
  | { kind: 'distance'; sets: number; distanceValue: number; distanceUnit: 'm' | 'km' | 'mi' }
  | { kind: 'bodyweight_reps'; sets: number; repsMin: number; repsMax?: number };
```

`progression_rule` is a small reference table (`id`, `type`: 'manual' |
'double_progression' | 'linear', `config` jsonb) — kept generic since MVP
only needs 3 types.

## 4. Workout execution (plan vs. reality)

```text
workout_session
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- template_id (uuid, fk -> workout_template.id, nullable) -- nullable: ad hoc sessions allowed
- program_id (uuid, fk -> training_program.id, nullable)
- local_date (date, not null)
- timezone (text, not null)
- started_at (timestamptz, not null)
- completed_at (timestamptz, nullable)
- status (enum: 'planned' | 'in_progress' | 'completed' | 'abandoned', not null)
- session_name_snapshot (text, not null) -- copied at creation time, immune to later template renames
- notes (text, nullable)
- created_at, updated_at

Indexes: (user_id, local_date), (user_id, status) for "today's session" lookup.

workout_exercise_log
- id (uuid, pk)
- session_id (uuid, fk -> workout_session.id, not null)
- exercise_id (uuid, fk -> exercise.id, not null)
- exercise_name_snapshot (text, not null)
- sort_order (integer, not null)
- prescription_snapshot (jsonb, nullable) -- copy of the template prescription at session-start time
- notes (text, nullable)
- skipped (boolean, not null, default false)
- created_at, updated_at

workout_set
- id (uuid, pk)
- exercise_log_id (uuid, fk -> workout_exercise_log.id, not null)
- client_id (uuid, not null) -- client-generated, used for idempotent retry from mobile
- sort_order (integer, not null)
- set_type (enum: 'warmup' | 'working' | 'top' | 'backoff' | 'drop' | 'failure' | 'bodyweight' | 'timed' | 'distance', not null)
- load_value (numeric, nullable)
- load_unit (enum: 'lb' | 'kg', nullable)
- reps (integer, nullable)
- duration_seconds (integer, nullable)
- distance_value (numeric, nullable)
- distance_unit (enum: 'm' | 'km' | 'mi', nullable)
- rir (numeric, nullable)
- rpe (numeric, nullable)
- side (enum: 'left' | 'right' | 'both', nullable)
- completed (boolean, not null, default false)
- notes (text, nullable)
- created_at, updated_at

Unique: (exercise_log_id, client_id) -- idempotent create/retry from mobile offline queue.
```

**Historical immutability rule**: changing a `workout_template`/
`workout_template_exercise` never touches existing `workout_session` /
`workout_exercise_log` / `workout_set` rows — those carry their own
`*_snapshot` fields precisely so old sessions render correctly forever.

## 5. Daily manual inputs

```text
daily_manual_entry
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- local_date (date, not null)
- morning_weight_value (numeric, nullable)
- morning_weight_unit (enum: 'lb' | 'kg', nullable)
- systolic_bp (integer, nullable)
- diastolic_bp (integer, nullable)
- notes (text, nullable)
- created_at, updated_at

Unique: (user_id, local_date).
```

Kept separate from HealthKit-imported snapshots (below) so manual and
imported values coexist with explicit provenance rather than overwriting
each other, per master spec §10.

## 6. Health sync state & snapshots

```text
integration_sync_state
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- integration_type (enum: 'apple_health', not null) -- extensible enum, MFP is NOT modeled separately (spec §1.5/§7)
- last_attempt_at (timestamptz, nullable)
- last_success_at (timestamptz, nullable)
- latest_complete_local_date (date, nullable)
- last_foreground_reconciliation_at (timestamptz, nullable)
- last_background_reconciliation_at (timestamptz, nullable)
- status (enum: 'ok' | 'error' | 'never_synced', not null)
- last_error_code (text, nullable)
- last_error_message_redacted (text, nullable)
- created_at, updated_at

Unique: (user_id, integration_type).

daily_activity_summary
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- local_date (date, not null)
- timezone (text, not null)
- sync_status (enum: 'missing' | 'partial' | 'complete' | 'stale' | 'unavailable' | 'error', not null)
- synced_through (timestamptz, nullable) -- how far into the local day this snapshot reflects
- reconciled_at (timestamptz, nullable)
- steps (integer, nullable)
- walking_running_distance_m (numeric, nullable)
- active_energy_kcal (numeric, nullable)
- exercise_minutes (integer, nullable)
- stand_minutes (integer, nullable)
- flights_climbed (integer, nullable)
- move_actual_kcal / move_goal_kcal (numeric, nullable)
- exercise_actual_minutes / exercise_goal_minutes (integer, nullable)
- stand_actual_hours / stand_goal_hours (integer, nullable)
- resting_heart_rate (numeric, nullable)
- walking_heart_rate_avg (numeric, nullable)
- hrv_sdnn_ms (numeric, nullable)
- vo2_max (numeric, nullable)
- weight_value / weight_unit (numeric / enum, nullable) -- HealthKit-imported weight, distinct from daily_manual_entry
- body_fat_percentage (numeric, nullable)
- sleep_total_minutes (numeric, nullable)
- source_provenance (jsonb, nullable) -- per-metric source app/device where practical
- created_at, updated_at

Unique: (user_id, local_date).

daily_nutrition_snapshot
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- local_date (date, not null)
- timezone (text, not null)
- sync_status (enum: 'missing' | 'partial' | 'complete' | 'stale' | 'unavailable' | 'error', not null)
- synced_through (timestamptz, nullable)
- reconciled_at (timestamptz, nullable)
- calories_kcal (numeric, nullable)
- protein_g (numeric, nullable)
- carbs_g (numeric, nullable)
- fat_g (numeric, nullable)
- fiber_g (numeric, nullable)
- saturated_fat_g (numeric, nullable)
- sugar_g (numeric, nullable)
- sodium_mg (numeric, nullable)
- potassium_mg (numeric, nullable)
- cholesterol_mg (numeric, nullable)
- source_provenance (jsonb, nullable) -- expect "MyFitnessPal" via HealthKit
- created_at, updated_at

Unique: (user_id, local_date).
```

Rationale for 3 tables (sync state / activity+heart+body / nutrition)
instead of one giant table or full EAV: matches master spec §7's explicit
guidance to consider this split "if it improves clarity," and keeps each
table's nullability story coherent (activity vs. nutrition metrics are
independent axes of partial/complete).

All `local_date` columns pair with their own `timezone` column so a day's
identity never depends on server/UTC boundaries (spec §1.9).

### 6.1 Notification preferences

**New scope beyond the original master spec**, added to support the
Settings screen's "Workout reminders" and "Weekly progress summary"
toggles (Figma style guide §19). The master spec does not mention push
notifications; this is proposed as a minimal, additive table so the
Settings UI has real backing data without committing to a specific push
delivery mechanism yet (Expo push vs. APNs directly — deferred to an
implementation-time ADR when Phase 7+ HealthKit/mobile work begins).

```text
user_notification_preference
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null, unique)
- workout_reminders_enabled (boolean, not null, default true)
- weekly_summary_enabled (boolean, not null, default true)
- created_at, updated_at
```

This table only stores *preferences*. It intentionally does not include
device push tokens, scheduling, or delivery logs — those belong to a
future notifications-infrastructure ADR once push is actually implemented
(not required for Phase 0-6; the toggles can ship and simply persist
user intent ahead of delivery being wired up).

## 7. Ownership & indexing summary

Every table above except `exercise` (system rows) and `program_version`/
`workout_template`/`workout_template_exercise`/`workout_exercise_log`/
`workout_set` (owned transitively through their parent) carries a direct
`user_id`. API queries always join/filter through to the authenticated
user id — client-supplied ids are only used to select the record *after*
ownership is confirmed, never to establish ownership.

Key indexes beyond primary/unique keys already listed:
- `workout_session (user_id, local_date)`
- `workout_exercise_log (session_id)`
- `workout_set (exercise_log_id, sort_order)`
- `daily_activity_summary (user_id, local_date)`
- `daily_nutrition_snapshot (user_id, local_date)`
- `integration_sync_state (user_id, integration_type)`
- `training_program (user_id, is_active)`

## 8. Decisions (2026-08-20)

1. **UUID vs. ULID**: decided — plain UUIDv4 everywhere (Postgres
   `gen_random_uuid()`), per proposal above.
2. **`exercise` muscle metadata**: decided — normalized `muscle_group` +
   `exercise_muscle` join tables (see §2), not JSONB, chosen for
   scalability of filtering/search over raw MVP simplicity.
3. **Default units**: decided — `preferred_units` defaults to `'imperial'`.
4. **Progress screen "consistency streak" widget**: decided — no new
   table. Computed on read from existing `workout_session` rows
   (count of sessions per ISO week vs. planned template days in the
   active `program_version`), same pattern as `estimateOneRepMax` /
   `calculateVolume` domain functions (master spec §9). See
   `docs/api.md` for the read endpoint.
5. **Session-summary PR badge**: already fully covered — backed by the
   existing `detectWeightPR` / `detectRepPR` domain functions (master
   spec §9), no schema change needed. Cross-referenced here since the
   Figma trophy badge (style guide §17) could otherwise look like an
   undocumented gap.

## 9. Outstanding item (not a schema question, but a Phase 7/11 dependency)

The user has **not yet enrolled in the Apple Developer Program**. This is
required before HealthKit entitlements can be configured and before
TestFlight distribution is possible. This has no impact on Phase 0–6 work
(schema, API, web, mobile-without-HealthKit), but is a hard blocker for
Phase 7 (HealthKit physical-device spike) and Phase 11 (production
deployment). Recommend starting Apple Developer Program enrollment now in
parallel, since Apple's review/approval can take time.
