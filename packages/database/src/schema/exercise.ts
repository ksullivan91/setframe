import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { muscleRoleEnum } from './enums';
import { user } from './user';

export const exercise = pgTable(
  'exercise',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    canonicalSlug: text('canonical_slug'),
    movementPattern: text('movement_pattern'),
    equipment: text('equipment'),
    isSystem: boolean('is_system').notNull().default(false),
    createdByUserId: uuid('created_by_user_id').references(() => user.id),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('exercise_canonical_slug_key').on(table.canonicalSlug),
    index('exercise_created_by_user_id_idx').on(table.createdByUserId),
    // Trigram GIN index on `name` for fuzzy search is added via a raw SQL
    // migration step (pg_trgm extension) — see docs/api.md "Exercise search".
    // drizzle-kit does not model GIN/trgm indexes natively; add a custom
    // migration when Phase 2 wires up `?q=` search.
  ],
);

export const muscleGroup = pgTable(
  'muscle_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    region: text('region'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('muscle_group_name_key').on(table.name)],
);

export const exerciseMuscle = pgTable(
  'exercise_muscle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id),
    muscleGroupId: uuid('muscle_group_id')
      .notNull()
      .references(() => muscleGroup.id),
    role: muscleRoleEnum('role').notNull(),
  },
  (table) => [
    uniqueIndex('exercise_muscle_exercise_id_muscle_group_id_key').on(
      table.exerciseId,
      table.muscleGroupId,
    ),
    index('exercise_muscle_muscle_group_id_idx').on(table.muscleGroupId),
  ],
);
