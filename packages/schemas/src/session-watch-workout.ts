import { z } from 'zod';

/**
 * Apple Watch workouts attached to a Setframe session (story 45).
 *
 * The shapes are shared end-to-end: the mobile client posts what it read
 * from HealthKit, and the API returns the snapshot it stored.
 */

export const watchSeriesKindSchema = z.enum(['heart_rate']);
export type WatchSeriesKind = z.infer<typeof watchSeriesKindSchema>;

/**
 * A sample series as parallel arrays (ADR 0012).
 *
 * `offsets[i]` is seconds from the workout's start and `values[i]` is the
 * reading, so the two must be the same length — a mismatched pair is a
 * corrupt series, not a partial one.
 */
export const watchSeriesSchema = z
  .object({
    kind: watchSeriesKindSchema,
    offsets: z.array(z.number().int().nonnegative()),
    values: z.array(z.number().int()),
  })
  .refine((s) => s.offsets.length === s.values.length, {
    message: 'offsets and values must be the same length',
    path: ['values'],
  });
export type WatchSeries = z.infer<typeof watchSeriesSchema>;

export const sessionWatchWorkoutSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  externalId: z.string(),
  activityType: z.string(),
  appleActivityType: z.number().int(),
  title: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  activeEnergyKcal: z.number().nullable(),
  totalEnergyKcal: z.number().nullable(),
  avgHeartRateBpm: z.number().int().nullable(),
  peakHeartRateBpm: z.number().int().nullable(),
  minHeartRateBpm: z.number().int().nullable(),
  distanceValue: z.number().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  deviceName: z.string().nullable(),
  /** Present on the detail read, omitted from list responses. */
  series: z.array(watchSeriesSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SessionWatchWorkout = z.infer<typeof sessionWatchWorkoutSchema>;

/**
 * What the client posts to attach one workout.
 *
 * `externalId` is HealthKit's own UUID and carries the whole dedupe
 * contract: a workout cannot be attached twice, nor to two sessions.
 */
export const attachWatchWorkoutSchema = z.object({
  externalId: z.string().min(1),
  activityType: z.string().min(1),
  appleActivityType: z.number().int(),
  title: z.string().min(1).max(120),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  activeEnergyKcal: z.number().nonnegative().nullish(),
  totalEnergyKcal: z.number().nonnegative().nullish(),
  avgHeartRateBpm: z.number().int().positive().nullish(),
  peakHeartRateBpm: z.number().int().positive().nullish(),
  minHeartRateBpm: z.number().int().positive().nullish(),
  distanceValue: z.number().nonnegative().nullish(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullish(),
  deviceName: z.string().max(120).nullish(),
  series: z.array(watchSeriesSchema).optional(),
});
export type AttachWatchWorkoutInput = z.infer<typeof attachWatchWorkoutSchema>;
