import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { additionalActivityTypeEnum, distanceUnitEnum } from './enums';
import { user } from './user';
import { workoutSession } from './workout';

export const watchSeriesKindEnum = pgEnum('watch_series_kind', ['heart_rate']);

/**
 * An Apple Watch workout attached to a Setframe session (story 45).
 *
 * A *snapshot*, taken at attach time and never re-derived — ADR 0005's rule
 * for fact rows. Editing the workout in Health later must not change how a
 * past session reports, and deleting it there must not empty this.
 *
 * Deliberately not `additional_activity`: that entity is a standalone thing
 * the user did, keyed to a date. These are evidence *about* a session, and
 * listing them as separate activities is the double-count story 44 exists to
 * suppress.
 */
export const sessionWatchWorkout = pgTable(
  'session_watch_workout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSession.id, { onDelete: 'cascade' }),
    /** HealthKit's own UUID — the dedupe key. */
    externalId: text('external_id').notNull(),
    activityType: additionalActivityTypeEnum('activity_type').notNull(),
    /** The raw HKWorkoutActivityType, kept so a mapping change can re-derive. */
    appleActivityType: integer('apple_activity_type').notNull(),
    title: text('title').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    activeEnergyKcal: numeric('active_energy_kcal'),
    totalEnergyKcal: numeric('total_energy_kcal'),
    avgHeartRateBpm: integer('avg_heart_rate_bpm'),
    peakHeartRateBpm: integer('peak_heart_rate_bpm'),
    minHeartRateBpm: integer('min_heart_rate_bpm'),
    distanceValue: numeric('distance_value'),
    distanceUnit: distanceUnitEnum('distance_unit'),
    deviceName: text('device_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One Watch workout, one attachment, ever — it cannot be attached twice
    // nor to two different sessions.
    uniqueIndex('session_watch_workout_user_id_external_id_key').on(table.userId, table.externalId),
    index('session_watch_workout_session_id_idx').on(table.sessionId),
  ],
);

/**
 * The sample series for an attached workout, as parallel arrays (ADR 0012).
 *
 * `offsets[i]` is seconds from the workout's `startedAt` and `values[i]` is
 * the reading at that moment, so absolute times are recovered by addition
 * rather than an 8-byte timestamp repeated 720 times to say "five seconds
 * later". One row per (workout, kind) means a new sample kind is an insert
 * rather than a migration.
 */
export const sessionWatchSeries = pgTable(
  'session_watch_series',
  {
    sessionWatchWorkoutId: uuid('session_watch_workout_id')
      .notNull()
      .references(() => sessionWatchWorkout.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    kind: watchSeriesKindEnum('kind').notNull(),
    offsets: integer('offsets').array().notNull(),
    values: smallint('values').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'session_watch_series_pkey',
      columns: [table.sessionWatchWorkoutId, table.kind],
    }),
  ],
);
