import { pgEnum } from 'drizzle-orm/pg-core';

export const preferredUnitsEnum = pgEnum('preferred_units', ['imperial', 'metric']);

export const muscleRoleEnum = pgEnum('muscle_role', ['primary', 'secondary']);

export const progressionRuleTypeEnum = pgEnum('progression_rule_type', [
  'manual',
  'double_progression',
  'linear',
]);

export const workoutSessionStatusEnum = pgEnum('workout_session_status', [
  'planned',
  'in_progress',
  'completed',
  'abandoned',
]);

export const setTypeEnum = pgEnum('set_type', [
  'warmup',
  'working',
  'top',
  'backoff',
  'drop',
  'failure',
  'bodyweight',
  'timed',
  'distance',
]);

export const loadUnitEnum = pgEnum('load_unit', ['lb', 'kg']);

export const distanceUnitEnum = pgEnum('distance_unit', ['m', 'km', 'mi']);

export const setSideEnum = pgEnum('set_side', ['left', 'right', 'both']);

export const integrationTypeEnum = pgEnum('integration_type', ['apple_health']);

export const syncStatusEnum = pgEnum('sync_status', [
  'missing',
  'partial',
  'complete',
  'stale',
  'unavailable',
  'error',
]);

export const integrationSyncStateStatusEnum = pgEnum('integration_sync_state_status', [
  'ok',
  'error',
  'never_synced',
]);
