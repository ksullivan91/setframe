import {
  date,
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
  integrationSyncStateStatusEnum,
  integrationTypeEnum,
  loadUnitEnum,
  syncStatusEnum,
} from './enums';
import { user } from './user';

export const integrationSyncState = pgTable(
  'integration_sync_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    // Extensible enum — MFP is NOT modeled separately (spec §1.5/§7).
    integrationType: integrationTypeEnum('integration_type').notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    latestCompleteLocalDate: date('latest_complete_local_date'),
    lastForegroundReconciliationAt: timestamp('last_foreground_reconciliation_at', {
      withTimezone: true,
    }),
    lastBackgroundReconciliationAt: timestamp('last_background_reconciliation_at', {
      withTimezone: true,
    }),
    status: integrationSyncStateStatusEnum('status').notNull(),
    lastErrorCode: text('last_error_code'),
    lastErrorMessageRedacted: text('last_error_message_redacted'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('integration_sync_state_user_id_integration_type_key').on(
      table.userId,
      table.integrationType,
    ),
  ],
);

export const dailyActivitySummary = pgTable(
  'daily_activity_summary',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    localDate: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    syncStatus: syncStatusEnum('sync_status').notNull(),
    // How far into the local day this snapshot reflects.
    syncedThrough: timestamp('synced_through', { withTimezone: true }),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    steps: integer('steps'),
    walkingRunningDistanceM: numeric('walking_running_distance_m'),
    activeEnergyKcal: numeric('active_energy_kcal'),
    exerciseMinutes: integer('exercise_minutes'),
    standMinutes: integer('stand_minutes'),
    flightsClimbed: integer('flights_climbed'),
    moveActualKcal: numeric('move_actual_kcal'),
    moveGoalKcal: numeric('move_goal_kcal'),
    exerciseActualMinutes: integer('exercise_actual_minutes'),
    exerciseGoalMinutes: integer('exercise_goal_minutes'),
    standActualHours: integer('stand_actual_hours'),
    standGoalHours: integer('stand_goal_hours'),
    restingHeartRate: numeric('resting_heart_rate'),
    walkingHeartRateAvg: numeric('walking_heart_rate_avg'),
    hrvSdnnMs: numeric('hrv_sdnn_ms'),
    vo2Max: numeric('vo2_max'),
    // HealthKit-imported weight, distinct from daily_manual_entry.
    weightValue: numeric('weight_value'),
    weightUnit: loadUnitEnum('weight_unit'),
    bodyFatPercentage: numeric('body_fat_percentage'),
    sleepTotalMinutes: numeric('sleep_total_minutes'),
    // Per-metric source app/device where practical.
    sourceProvenance: jsonb('source_provenance'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('daily_activity_summary_user_id_local_date_key').on(table.userId, table.localDate),
  ],
);

export const dailyNutritionSnapshot = pgTable(
  'daily_nutrition_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    localDate: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    syncStatus: syncStatusEnum('sync_status').notNull(),
    syncedThrough: timestamp('synced_through', { withTimezone: true }),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    caloriesKcal: numeric('calories_kcal'),
    proteinG: numeric('protein_g'),
    carbsG: numeric('carbs_g'),
    fatG: numeric('fat_g'),
    fiberG: numeric('fiber_g'),
    saturatedFatG: numeric('saturated_fat_g'),
    sugarG: numeric('sugar_g'),
    sodiumMg: numeric('sodium_mg'),
    potassiumMg: numeric('potassium_mg'),
    cholesterolMg: numeric('cholesterol_mg'),
    // Expect "MyFitnessPal" via HealthKit.
    sourceProvenance: jsonb('source_provenance'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('daily_nutrition_snapshot_user_id_local_date_key').on(
      table.userId,
      table.localDate,
    ),
  ],
);
