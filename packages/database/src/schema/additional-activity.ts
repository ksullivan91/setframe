import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { additionalActivitySourceEnum, additionalActivityTypeEnum, distanceUnitEnum } from './enums';
import { user } from './user';

/**
 * Supplemental movement outside the formal program schedule — a walk, yoga,
 * mobility work, foam rolling (see docs/adr for the scheduled-workout vs.
 * additional-activity vs. ad-hoc-workout distinction). Day-scoped, not
 * workout-scoped: it never references `workout_session`, `day_type`, or any
 * program table, and nothing here ever mutates one. Scheduled-workout-only
 * metrics (program adherence, workout streaks, scheduled session
 * completion, and any "sessions per week" reading that means scheduled
 * training) must never join against this table.
 */
export const additionalActivity = pgTable(
  'additional_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    // Calendar day + the timezone that defined it, same as every other
    // daily record (workout_session, rest_day, daily_manual_entry) —
    // never grouped solely by UTC date.
    localDate: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    activityType: additionalActivityTypeEnum('activity_type').notNull(),
    source: additionalActivitySourceEnum('source').notNull().default('manual'),
    title: text('title'),
    distanceValue: numeric('distance_value'),
    distanceUnit: distanceUnitEnum('distance_unit'),
    caloriesKcal: numeric('calories_kcal'),
    notes: text('notes'),
    // Stable id from the source system (e.g. an Apple Health workout UUID),
    // so a later sync can't create a duplicate row for the same activity.
    externalSourceId: text('external_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('additional_activity_user_id_source_external_id_key').on(
      table.userId,
      table.source,
      table.externalSourceId,
    ),
    index('additional_activity_user_id_local_date_idx').on(table.userId, table.localDate),
  ],
);

/**
 * Story 43 — a user-saved shortcut for a frequently-repeated Additional
 * Activity ("Post-meal walk · 15 min"). Stores *defaults* only, never a
 * reference to a specific logged `additional_activity` row — tapping one
 * prefills the add form for review, it never saves directly, and removing
 * or editing a preset can never retroactively change any activity already
 * logged from it.
 */
export const additionalActivityPreset = pgTable(
  'additional_activity_preset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull(),
    activityType: additionalActivityTypeEnum('activity_type').notNull(),
    defaultDurationSeconds: integer('default_duration_seconds'),
    defaultDistanceValue: numeric('default_distance_value'),
    defaultDistanceUnit: distanceUnitEnum('default_distance_unit'),
    defaultNotes: text('default_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('additional_activity_preset_user_id_idx').on(table.userId)],
);
