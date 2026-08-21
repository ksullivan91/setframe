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
import { distanceUnitEnum, loadUnitEnum, progressionRuleTypeEnum, setTypeEnum } from './enums';
import { user } from './user';
import { exercise } from './exercise';
import type { Prescription } from '@setline/schemas';

export const trainingProgram = pgTable(
  'training_program',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(false),
    startDate: date('start_date'),
    // Null means perpetual mode; a positive value means block mode with
    // that many weeks in the repeating cycle.
    cycleLengthWeeks: integer('cycle_length_weeks'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('training_program_user_id_is_active_idx').on(table.userId, table.isActive)],
);

export const programVersion = pgTable(
  'program_version',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainingProgramId: uuid('training_program_id')
      .notNull()
      .references(() => trainingProgram.id),
    versionNumber: integer('version_number').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('program_version_training_program_id_version_number_key').on(
      table.trainingProgramId,
      table.versionNumber,
    ),
  ],
);

export const progressionRule = pgTable('progression_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: progressionRuleTypeEnum('type').notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dayType = pgTable(
  'day_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    name: text('name').notNull(),
    description: text('description'),
    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('day_type_user_id_idx').on(table.userId)],
);

export const dayTypeExercise = pgTable(
  'day_type_exercise',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dayTypeId: uuid('day_type_id')
      .notNull()
      .references(() => dayType.id),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id),
    sortOrder: integer('sort_order').notNull(),
    // Summary/simple-case prescription (e.g. "3x8"). When
    // dayTypeExercisePlannedSet rows exist for this exercise, they take
    // precedence for session instantiation and display — this field
    // remains as a fallback and quick-glance summary.
    prescription: jsonb('prescription').notNull().$type<Prescription>(),
    progressionRuleId: uuid('progression_rule_id').references(() => progressionRule.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('day_type_exercise_day_type_id_sort_order_idx').on(table.dayTypeId, table.sortOrder)],
);

// Individual planned sets for a day-type exercise, allowing sets to differ
// from one another (e.g. warm-up 45x10, working 135x8x3) — see
// user-experience-redesign.md §9. Optional: an exercise may have zero
// planned sets and rely solely on `dayTypeExercise.prescription` as a
// simple summary.
export const dayTypeExercisePlannedSet = pgTable(
  'day_type_exercise_planned_set',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dayTypeExerciseId: uuid('day_type_exercise_id')
      .notNull()
      .references(() => dayTypeExercise.id),
    sortOrder: integer('sort_order').notNull(),
    setType: setTypeEnum('set_type').notNull(),
    reps: integer('reps'),
    repsMax: integer('reps_max'),
    loadValue: numeric('load_value'),
    loadUnit: loadUnitEnum('load_unit'),
    durationSeconds: integer('duration_seconds'),
    distanceValue: numeric('distance_value'),
    distanceUnit: distanceUnitEnum('distance_unit'),
    rpe: numeric('rpe'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('day_type_exercise_planned_set_day_type_exercise_id_sort_order_idx').on(
      table.dayTypeExerciseId,
      table.sortOrder,
    ),
  ],
);

export const programScheduleSlot = pgTable(
  'program_schedule_slot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programVersionId: uuid('program_version_id')
      .notNull()
      .references(() => programVersion.id),
    dayTypeId: uuid('day_type_id')
      .notNull()
      .references(() => dayType.id),
    weekNumber: integer('week_number'),
    dayIndex: integer('day_index').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('program_schedule_slot_program_version_id_idx').on(table.programVersionId),
    index('program_schedule_slot_day_type_id_idx').on(table.dayTypeId),
  ],
);

export const scheduleOverride = pgTable(
  'schedule_override',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    date: date('date').notNull(),
    dayTypeId: uuid('day_type_id')
      .notNull()
      .references(() => dayType.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('schedule_override_user_id_date_key').on(table.userId, table.date),
    index('schedule_override_day_type_id_idx').on(table.dayTypeId),
  ],
);
