import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  distanceUnitEnum,
  loadUnitEnum,
  setSideEnum,
  setTypeEnum,
  workoutSessionStatusEnum,
} from './enums';
import { user } from './user';
import { dayType, trainingProgram } from './program';
import { exercise } from './exercise';
import type { Prescription } from '@setframe/schemas';

export const workoutSession = pgTable(
  'workout_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    // Nullable: ad hoc sessions (not started from a day type) are allowed.
    templateId: uuid('template_id').references(() => dayType.id),
    programId: uuid('program_id').references(() => trainingProgram.id),
    localDate: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: workoutSessionStatusEnum('status').notNull(),
    sessionNameSnapshot: text('session_name_snapshot').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workout_session_user_id_local_date_idx').on(table.userId, table.localDate),
    index('workout_session_user_id_status_idx').on(table.userId, table.status),
  ],
);

export const workoutExerciseLog = pgTable(
  'workout_exercise_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSession.id),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id),
    exerciseNameSnapshot: text('exercise_name_snapshot').notNull(),
    sortOrder: integer('sort_order').notNull(),
    prescriptionSnapshot: jsonb('prescription_snapshot').$type<Prescription>(),
    notes: text('notes'),
    skipped: boolean('skipped').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('workout_exercise_log_session_id_idx').on(table.sessionId)],
);

export const workoutSet = pgTable(
  'workout_set',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exerciseLogId: uuid('exercise_log_id')
      .notNull()
      .references(() => workoutExerciseLog.id),
    clientId: uuid('client_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    setType: setTypeEnum('set_type').notNull(),
    loadValue: numeric('load_value'),
    loadUnit: loadUnitEnum('load_unit'),
    reps: integer('reps'),
    durationSeconds: integer('duration_seconds'),
    distanceValue: numeric('distance_value'),
    distanceUnit: distanceUnitEnum('distance_unit'),
    rir: numeric('rir'),
    rpe: numeric('rpe'),
    side: setSideEnum('side'),
    completed: boolean('completed').notNull().default(false),
    isPrWeight: boolean('is_pr_weight').notNull().default(false),
    isPrReps: boolean('is_pr_reps').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('workout_set_exercise_log_id_client_id_key').on(
      table.exerciseLogId,
      table.clientId,
    ),
    index('workout_set_exercise_log_id_sort_order_idx').on(table.exerciseLogId, table.sortOrder),
  ],
);

/**
 * A day the user deliberately took off.
 *
 * Kept separate from `scheduleOverride`, which is a plan and requires a
 * `dayTypeId`: a rest day is a record of what happened, and there is nothing
 * to schedule. Unique per user per date, so a day is either rested or not.
 */
export const restDay = pgTable(
  'rest_day',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    localDate: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('rest_day_user_id_local_date_key').on(table.userId, table.localDate),
  ],
);
