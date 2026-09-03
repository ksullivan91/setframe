import { z } from 'zod';

/**
 * A metric's value on one day.
 *
 * A day is present only when something recorded it. Absence is not zero:
 * whether a missing day means "nothing happened" or "we were not syncing
 * yet" depends on context the client cannot recover from a zero, and
 * drawing one invents a flat line the user never lived.
 */
export const trendPointSchema = z.object({
  localDate: z.string().date(),
  value: z.number(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const trendMetricKeys = [
  'weight',
  'bodyFatPercentage',
  'restingHeartRate',
  'hrvSdnn',
  'sleepMinutes',
  'steps',
  'activeEnergy',
  'exerciseMinutes',
  'vo2Max',
] as const;
export type TrendMetricKey = (typeof trendMetricKeys)[number];

export const trendSeriesSchema = z.object({
  key: z.enum(trendMetricKeys),
  /** Points ascending by date, sparse. */
  points: z.array(trendPointSchema),
  /**
   * The most recent value, and the change across the window.
   *
   * `null` when there are fewer than two points — a single reading has
   * nothing to be a change from, and reporting one as "+0" would claim a
   * stability nobody observed.
   */
  latest: z.number().nullable(),
  change: z.number().nullable(),
});
export type TrendSeries = z.infer<typeof trendSeriesSchema>;

export const trendsResponseSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  series: z.array(trendSeriesSchema),
});
export type TrendsResponse = z.infer<typeof trendsResponseSchema>;
