import { z } from 'zod';

export const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  isCustom: z.boolean(),
  ownerUserId: z.string().uuid().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const createExerciseSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const exerciseHistoryItemSchema = z.object({
  sessionId: z.string().uuid(),
  sessionLocalDate: z.string().date(),
  sessionCompletedAt: z.string().datetime().nullable(),
  sessionName: z.string(),
  setId: z.string().uuid(),
  exerciseLogId: z.string().uuid(),
  setType: z.enum(['warmup', 'working', 'top', 'backoff', 'drop', 'failure', 'bodyweight', 'timed', 'distance']),
  sortOrder: z.number().int().nonnegative(),
  weightValue: z.number().nullable(),
  weightUnit: z.enum(['lb', 'kg']).nullable(),
  reps: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  distanceValue: z.number().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  rpe: z.number().min(0).max(10).nullable(),
  isPrWeight: z.boolean(),
  isPrReps: z.boolean(),
  notes: z.string().nullable(),
});
export type ExerciseHistoryItem = z.infer<typeof exerciseHistoryItemSchema>;

export const exerciseHistoryResponseSchema = z.object({
  items: z.array(exerciseHistoryItemSchema),
  nextCursor: z.string().nullable(),
});
export type ExerciseHistoryResponse = z.infer<typeof exerciseHistoryResponseSchema>;

export const exerciseProgressPointSchema = z.object({
  sessionId: z.string().uuid(),
  localDate: z.string().date(),
  sessionName: z.string(),
  topWeight: z.number().nullable(),
  topReps: z.number().int().nullable(),
  estimatedOneRepMax: z.number().nullable(),
  volume: z.number().nonnegative(),
  isWeightPr: z.boolean(),
  isRepPr: z.boolean(),
});
export type ExerciseProgressPoint = z.infer<typeof exerciseProgressPointSchema>;

export const exerciseProgressResponseSchema = z.object({
  exerciseId: z.string().uuid(),
  points: z.array(exerciseProgressPointSchema),
});
export type ExerciseProgressResponse = z.infer<typeof exerciseProgressResponseSchema>;

export const progressConsistencyWeekSchema = z.object({
  weekStart: z.string().date(),
  plannedCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  completionRatio: z.number().nullable(),
});
export type ProgressConsistencyWeek = z.infer<typeof progressConsistencyWeekSchema>;

/**
 * Progress overview.
 *
 * The previous shape was a list of `cards` each carrying `trend: number[]`,
 * which the clients rendered as full-width bars scaled to the series max.
 * That made a single observation always render as a 100% bar and two similar
 * observations render as two indistinguishable full bars — the visual said
 * nothing. Everything below is an explicit series with units, dates and an
 * insufficient-data state instead, so a chart can only be drawn when there is
 * something real to draw.
 */

export const progressMetricValueSchema = z.object({
  key: z.string(),
  /** `null` means "applicable, but not enough data" — never render 0 for it. */
  value: z.number().nullable(),
  loadUnit: z.enum(['lb', 'kg']).optional(),
  distanceUnit: z.enum(['m', 'km', 'mi']).optional(),
});
export type ProgressMetricValue = z.infer<typeof progressMetricValueSchema>;

export const progressExercisePointSchema = z.object({
  sessionId: z.string().uuid(),
  localDate: z.string().date(),
  sessionName: z.string(),
  /** Only the metrics valid for this exercise's prescription are present. */
  metrics: z.array(progressMetricValueSchema),
  isWeightPr: z.boolean(),
  isRepPr: z.boolean(),
});
export type ProgressExercisePoint = z.infer<typeof progressExercisePointSchema>;

export const progressExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  prescriptionKind: z.string(),
  /** Ordered; the first is the headline metric for this exercise. */
  metricKeys: z.array(z.string()),
  points: z.array(progressExercisePointSchema),
  sessionCount: z.number().int().nonnegative(),
});
export type ProgressExercise = z.infer<typeof progressExerciseSchema>;

export const progressTrainingWeekSchema = z.object({
  weekStart: z.string().date(),
  completedCount: z.number().int().nonnegative(),
  /** `null` when the plan is unknown, rather than mirroring completedCount. */
  plannedCount: z.number().int().nonnegative().nullable(),
  completionRatio: z.number().nullable(),
  /** `null` for a week of non-load training, so 0 never implies a bad week. */
  volume: z.number().nullable(),
  /** Days in the week the user deliberately took off. */
  restCount: z.number().int().nonnegative(),
  /** Nothing trained but rest was logged: a week off, not a disappearance. */
  isRestWeek: z.boolean(),
  isCurrent: z.boolean(),
});
export type ProgressTrainingWeek = z.infer<typeof progressTrainingWeekSchema>;

export const progressTrainingDaySchema = z.object({
  localDate: z.string().date(),
  completedCount: z.number().int().nonnegative(),
  /** `null` for a day of non-load training, so 0 never implies wasted work. */
  volume: z.number().nullable(),
});
export type ProgressTrainingDay = z.infer<typeof progressTrainingDaySchema>;

export const progressTrainingSchema = z.object({
  /** Contiguous window; untrained weeks are present with a zero count. */
  weeks: z.array(progressTrainingWeekSchema),
  /**
   * Sparse per-day rollup, for ranges too short to bucket weekly. Only days
   * with activity appear — a day with no session is absent, not zero, since
   * whether that absence *means* zero depends on `firstActivityDate`.
   */
  days: z.array(progressTrainingDaySchema),
  /**
   * Earliest date with any recorded training, or `null` if there is none.
   * Bounds where a chart may honestly draw an empty period as zero: before
   * it there is no fact to report, only an account that did not exist.
   */
  firstActivityDate: z.string().date().nullable(),
  weeksTrained: z.number().int().nonnegative(),
  windowWeeks: z.number().int().positive(),
  currentStreakWeeks: z.number().int().nonnegative(),
  longestStreakWeeks: z.number().int().nonnegative(),
  totalCompleted: z.number().int().nonnegative(),
  totalRestDays: z.number().int().nonnegative(),
  averageSessionsPerWeek: z.number().nonnegative(),
  volumeUnit: z.enum(['lb', 'kg']),
});
export type ProgressTraining = z.infer<typeof progressTrainingSchema>;

export const bodyWeightPointSchema = z.object({
  localDate: z.string().date(),
  /** The value the user logged, normalised to the response unit. */
  raw: z.number().positive(),
  /** Exponentially-weighted trend. Do not draw unless sufficiency is ready. */
  trend: z.number().positive(),
  rollingAverage: z.number().positive().nullable(),
});
export type BodyWeightPoint = z.infer<typeof bodyWeightPointSchema>;

export const bodyWeightWeekSchema = z.object({
  weekStart: z.string().date(),
  average: z.number().positive(),
  low: z.number().positive(),
  high: z.number().positive(),
  checkInCount: z.number().int().positive(),
});
export type BodyWeightWeek = z.infer<typeof bodyWeightWeekSchema>;

/**
 * Body weight. Deliberately carries no day-over-day delta: overnight change
 * is dominated by water and gut content, so "-1.8 lb today" is noise dressed
 * as a result. Change is only ever expressed as `ratePerWeek` over a trailing
 * window, and `direction` is unvalenced because a user who is intentionally
 * bulking is succeeding when the number rises.
 * See docs/research/body-weight-display-psychology.md.
 */
export const progressBodyWeightSchema = z.object({
  unit: z.enum(['lb', 'kg']),
  sufficiency: z.enum(['none', 'establishing', 'ready']),
  checkInCount: z.number().int().nonnegative(),
  /** 7-day rolling average — the number to lead with. */
  currentAverage: z.number().positive().nullable(),
  latestCheckIn: z
    .object({ localDate: z.string().date(), weightValue: z.number().positive() })
    .nullable(),
  ratePerWeek: z.number().nullable(),
  direction: z.enum(['rising', 'falling', 'steady']).nullable(),
  windowWeeks: z.number().int().positive(),
  points: z.array(bodyWeightPointSchema),
  weeks: z.array(bodyWeightWeekSchema),
});
export type ProgressBodyWeight = z.infer<typeof progressBodyWeightSchema>;

export const compositionWeekSchema = z.object({
  weekStart: z.string().date(),
  /**
   * Volume per movement pattern. A pattern absent from this record was
   * genuinely untrained that week; we never write a `0`, because "you did no
   * hinging" and "you did 0 lb of hinging" are the same fact but only the
   * first is worth drawing, and a zero-height segment is indistinguishable
   * from a rendering bug.
   */
  values: z.record(z.string(), z.number().positive()),
  total: z.number().nonnegative(),
  isCurrent: z.boolean(),
});
export type CompositionWeek = z.infer<typeof compositionWeekSchema>;

/**
 * Volume split by movement pattern — "what did I actually train?", which a
 * single weekly total cannot answer. 12,000 lb of squatting and 12,000 lb
 * spread evenly over six patterns are the same bar and very different weeks.
 *
 * The parts always recover the total; the total never recovers the parts.
 */
export const progressCompositionSchema = z.object({
  unit: z.enum(['lb', 'kg']),
  /** Patterns with any volume in the window, largest total first. */
  patterns: z.array(
    z.object({
      key: z.string(),
      total: z.number().positive(),
      /** Share of *classified* volume, 0-1. Excludes `unclassifiedTotal`. */
      share: z.number(),
    }),
  ),
  weeks: z.array(compositionWeekSchema),
  /**
   * Volume from exercises carrying no `movementPattern`. Reported rather than
   * silently dropped: most of the exercise library is unclassified, so a
   * chart that omitted this would quietly understate training and invite the
   * user to conclude they did less than they did. The UI must disclose it.
   */
  unclassifiedTotal: z.number().nonnegative(),
  /** How many distinct exercises contributed to `unclassifiedTotal`. */
  unclassifiedExerciseCount: z.number().int().nonnegative(),
});
export type ProgressComposition = z.infer<typeof progressCompositionSchema>;

export const progressOverviewResponseSchema = z.object({
  training: progressTrainingSchema,
  bodyWeight: progressBodyWeightSchema,
  /** Volume by movement pattern. See `progressCompositionSchema`. */
  composition: progressCompositionSchema,
  /** Every exercise with history in the window, most-trained first. */
  exercises: z.array(progressExerciseSchema),
  recentSessions: z.array(
    z.object({
      sessionId: z.string().uuid(),
      localDate: z.string().date(),
      completedAt: z.string().datetime().nullable(),
      sessionName: z.string(),
      exerciseCount: z.number().int().nonnegative(),
      setCount: z.number().int().nonnegative(),
      /** `null` for a session with no load-bearing work. */
      volume: z.number().nullable(),
      prCount: z.number().int().nonnegative(),
    }),
  ),
});
export type ProgressOverviewResponse = z.infer<typeof progressOverviewResponseSchema>;
