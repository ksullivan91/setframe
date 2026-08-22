# Setframe — Data Model (Phase 0 Draft)

Status: Proposed, pending review. No migrations exist yet — this defines
the target Drizzle/PostgreSQL schema shape for Phase 2+.

Conventions: UUIDs for all primary keys. Every user-owned table has a
`user_id` foreign key and every query must be scoped by the authenticated
internal user id.

## 1. Identity

```text
user
- id (uuid, pk)
- clerk_user_id (text, unique, not null)
- display_name (text)
- preferred_units (enum: 'imperial' | 'metric', default 'imperial')
- timezone (text, IANA tz name)
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
- created_by_user_id (uuid, fk -> user.id, nullable)
- archived_at (timestamptz, nullable)
- created_at, updated_at

muscle_group
- id (uuid, pk)
- name (text, unique, not null)
- region (text, nullable)
- created_at

exercise_muscle
- id (uuid, pk)
- exercise_id (uuid, fk -> exercise.id, not null)
- muscle_group_id (uuid, fk -> muscle_group.id, not null)
- role (enum: 'primary' | 'secondary', not null)
```

## 3. Programs, versions, day types, and scheduling

```text
training_program
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- name (text, not null)
- description (text, nullable)
- is_active (boolean, not null, default false)
- start_date (date, nullable)
- cycle_length_weeks (integer, nullable)  -- null = perpetual mode; set = block mode
- archived_at (timestamptz, nullable)
- created_at, updated_at

program_version
- id (uuid, pk)
- training_program_id (uuid, fk -> training_program.id, not null)
- version_number (integer, not null)
- effective_from (date, not null)
- effective_to (date, nullable)
- notes (text, nullable)
- created_at

day_type
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- name (text, not null)
- description (text, nullable)
- estimated_duration_minutes (integer, nullable)
- created_at, updated_at

day_type_exercise
- id (uuid, pk)
- day_type_id (uuid, fk -> day_type.id, not null)
- exercise_id (uuid, fk -> exercise.id, not null)
- sort_order (integer, not null)
- prescription (jsonb, not null)
- progression_rule_id (uuid, fk -> progression_rule.id, nullable)
- notes (text, nullable)
- created_at, updated_at

program_schedule_slot
- id (uuid, pk)
- program_version_id (uuid, fk -> program_version.id, not null)
- day_type_id (uuid, fk -> day_type.id, not null)
- week_number (integer, nullable) -- null in perpetual mode
- day_index (integer, not null)
- sort_order (integer, not null)
- created_at

schedule_override
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- date (date, not null)
- day_type_id (uuid, fk -> day_type.id, not null)
- note (text, nullable)
- created_at
```

`workout_template` and `workout_template_exercise` are replaced by
`day_type` and `day_type_exercise`. Reusable day types are now owned by a
user directly and scheduled into programs through `program_schedule_slot`
rather than being embedded under a specific program version.

### 3.1 Prescription shape

```ts
type Prescription =
  | { kind: 'sets_reps'; sets: number; repsMin: number; repsMax?: number }
  | { kind: 'top_set_backoff'; topSets: number; topRepsMin: number; topRepsMax: number;
      backoffSets: number; backoffRepsMin: number; backoffRepsMax: number }
  | { kind: 'per_side'; sets: number; repsMin: number; repsMax?: number }
  | { kind: 'timed'; sets: number; durationSeconds: number }
  | { kind: 'distance'; sets: number; distanceValue: number; distanceUnit: 'm' | 'km' | 'mi' }
  | { kind: 'duration'; durationMinutes: number; notes?: string }
  | { kind: 'distanceDuration'; distanceMiles: number; durationMinutes: number; notes?: string }
  | { kind: 'bodyweight_reps'; sets: number; repsMin: number; repsMax?: number };
```

## 4. Workout execution

```text
workout_session
- id (uuid, pk)
- user_id (uuid, fk -> user.id, not null)
- template_id (uuid, fk -> day_type.id, nullable)
- program_id (uuid, fk -> training_program.id, nullable)
- local_date (date, not null)
- timezone (text, not null)
- started_at (timestamptz, not null)
- completed_at (timestamptz, nullable)
- status (enum: 'planned' | 'in_progress' | 'completed' | 'abandoned', not null)
- session_name_snapshot (text, not null)
- notes (text, nullable)
- created_at, updated_at
```

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
- notes (text, nullable) -- reused as journal text
- mood (integer, nullable)
- pre_workout_meal_logged (boolean, nullable/default false)
- created_at, updated_at
```

## 6. Health sync state & snapshots

Existing sync tables are unchanged.

## 7. Notification preferences

Existing notification preference table is unchanged.
