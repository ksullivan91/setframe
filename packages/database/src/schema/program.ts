import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { progressionRuleTypeEnum } from './enums';
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
    // Cycle length in weeks, e.g. 4; used to derive "Week 2" labeling for
    // the pre-workout preview card. Nullable — not every program cycles.
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

export const workoutTemplate = pgTable('workout_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  programVersionId: uuid('program_version_id')
    .notNull()
    .references(() => programVersion.id),
  name: text('name').notNull(),
  dayLabel: text('day_label'),
  sortOrder: integer('sort_order').notNull(),
  description: text('description'),
  // Single-value estimate (e.g. 50); UI renders a +-5min band around it.
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workoutTemplateExercise = pgTable('workout_template_exercise', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => workoutTemplate.id),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercise.id),
  sortOrder: integer('sort_order').notNull(),
  // Discriminated union validated in packages/schemas (`prescriptionSchema`),
  // stored as JSONB — see docs/data-model.md §3.1.
  prescription: jsonb('prescription').notNull().$type<Prescription>(),
  progressionRuleId: uuid('progression_rule_id').references(() => progressionRule.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
