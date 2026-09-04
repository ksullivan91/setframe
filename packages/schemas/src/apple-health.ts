import { z } from 'zod';

/**
 * The Apple Health reconcile contract.
 *
 * Shared rather than declared per side, because the two ends drifted badly
 * while it was loose: the route accepted `Record<string, unknown>` for a
 * day's activity and then wrote none of it, so every metric column stayed
 * null and Trends showed "Nothing recorded yet" for everything except the
 * one metric the user types by hand.
 *
 * Every metric is nullable rather than optional-and-absent. A null is a
 * real answer — "we read this day and there was no resting heart rate" —
 * and it has to survive to the server, or a day can never be settled.
 */

const metric = z.number().finite().nullable();

/** What HealthKit could tell us about one local day. */
export const appleHealthActivitySchema = z.object({
  steps: metric,
  activeEnergyKcal: metric,
  exerciseMinutes: metric,
  standMinutes: metric.optional(),
  flightsClimbed: metric.optional(),
  walkingRunningDistanceM: metric.optional(),
  restingHeartRate: metric,
  walkingHeartRateAvg: metric.optional(),
  hrvSdnnMs: metric,
  vo2Max: metric,
  /* Always kilograms on the wire. HealthKit is metric internally and the
     column carries its own unit, so converting at the edge would mean two
     places to get it wrong. */
  weightKg: metric,
  bodyFatPercentage: metric,
  sleepTotalMinutes: metric,
});
export type AppleHealthActivity = z.infer<typeof appleHealthActivitySchema>;

export const appleHealthNutritionSchema = z.object({
  caloriesKcal: metric,
  proteinG: metric,
  carbsG: metric,
  fatG: metric,
  fiberG: metric.optional(),
  sugarG: metric.optional(),
  sodiumMg: metric.optional(),
});
export type AppleHealthNutrition = z.infer<typeof appleHealthNutritionSchema>;

/**
 * How the read went, per day.
 *
 * `ok` does not mean "found everything" — a day with no Watch data read
 * fine and simply has nulls. The server decides completeness; the client
 * only reports what happened.
 */
export const appleHealthReadOutcomeSchema = z.enum(['ok', 'unavailable', 'error']);

/**
 * Minutes at each heart rate, bucketed — see
 * docs/design/heart-rate-zone-trends.md §3 for why this rather than zone
 * minutes.
 */
export const heartRateHistogramSchema = z.object({
  bucketWidthBpm: z.number().int().positive(),
  minBpm: z.number().int().positive(),
  minutes: z.array(z.number().nonnegative()).min(1).max(256),
  attribution: z.object({
    source: z.enum(['exerciseTime', 'workouts']),
    maxGapSeconds: z.number().int().positive(),
    version: z.number().int().positive(),
  }),
});
export type HeartRateHistogramPayload = z.infer<typeof heartRateHistogramSchema>;

export const appleHealthDaySchema = z.object({
  localDate: z.string().date(),
  timezone: z.string().min(1),
  /**
   * The instant this read covers up to.
   *
   * For a finished day that is the day's own end; for today it is "now".
   * The server compares it against the day's end to decide whether the day
   * is settled or still accruing, which is what stops the self-healing
   * sweep from re-querying a day forever.
   */
  syncedThrough: z.string().datetime(),
  outcome: appleHealthReadOutcomeSchema.default('ok'),
  activity: appleHealthActivitySchema.nullable().optional(),
  nutrition: appleHealthNutritionSchema.nullable().optional(),
  /** Metric key → the app or device that wrote it, where HealthKit says. */
  sources: z.record(z.string(), z.string()).optional(),
  /** Active-minute heart-rate distribution. Absent when nothing was read. */
  activeHeartRateHistogram: heartRateHistogramSchema.nullable().optional(),
});
export type AppleHealthDay = z.infer<typeof appleHealthDaySchema>;

export const appleHealthReconcileSchema = z.object({
  /* Capped so one client cannot ask for an unbounded transaction. The
     backfill sends its history in chunks. */
  days: z.array(appleHealthDaySchema).min(1).max(60),
});
export type AppleHealthReconcileBody = z.infer<typeof appleHealthReconcileSchema>;

/** One day's settled state, as the client needs it to plan the next sweep. */
export const appleHealthDayStatusSchema = z.object({
  localDate: z.string(),
  syncStatus: z.enum(['missing', 'partial', 'complete', 'stale', 'unavailable', 'error']),
  syncedThrough: z.string().nullable(),
  reconciledAt: z.string().nullable(),
});
export type AppleHealthDayStatus = z.infer<typeof appleHealthDayStatusSchema>;
