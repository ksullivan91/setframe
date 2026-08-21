import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { loadUnitEnum } from './enums';
import { user } from './user';

export const dailyManualEntry = pgTable(
  'daily_manual_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    localDate: date('local_date').notNull(),
    morningWeightValue: numeric('morning_weight_value'),
    morningWeightUnit: loadUnitEnum('morning_weight_unit'),
    systolicBp: integer('systolic_bp'),
    diastolicBp: integer('diastolic_bp'),
    // Reused for the Today journal text to avoid a breaking column rename.
    notes: text('notes'),
    mood: integer('mood'),
    preWorkoutMealLogged: boolean('pre_workout_meal_logged').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('daily_manual_entry_user_id_local_date_key').on(table.userId, table.localDate)],
);
