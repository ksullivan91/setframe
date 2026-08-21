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

export const progressOverviewCardSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  detail: z.string().nullable(),
  trend: z.array(z.number().nonnegative()),
  status: z.enum(['neutral', 'positive', 'informational']),
});
export type ProgressOverviewCard = z.infer<typeof progressOverviewCardSchema>;

export const bodyWeightPointSchema = z.object({
  localDate: z.string().date(),
  weightValue: z.number().positive(),
  weightUnit: z.enum(['lb', 'kg']),
});
export type BodyWeightPoint = z.infer<typeof bodyWeightPointSchema>;

export const consistencySummarySchema = z.object({
  currentStreakWeeks: z.number().int().nonnegative(),
  longestStreakWeeks: z.number().int().nonnegative(),
  totalCompleted: z.number().int().nonnegative(),
  totalPlanned: z.number().int().nonnegative(),
});
export type ConsistencySummary = z.infer<typeof consistencySummarySchema>;

export const progressOverviewResponseSchema = z.object({
  cards: z.array(progressOverviewCardSchema),
  consistency: z.object({
    weeks: z.array(progressConsistencyWeekSchema),
    summary: consistencySummarySchema,
  }),
  bodyWeight: z.object({
    points: z.array(bodyWeightPointSchema),
    trendLabel: z.string().nullable(),
  }),
  featuredExercise: z
    .object({
      exerciseId: z.string().uuid(),
      exerciseName: z.string(),
      trendLabel: z.string().nullable(),
      points: z.array(exerciseProgressPointSchema),
    })
    .nullable(),
  recentSessions: z.array(
    z.object({
      sessionId: z.string().uuid(),
      localDate: z.string().date(),
      completedAt: z.string().datetime().nullable(),
      sessionName: z.string(),
      exerciseCount: z.number().int().nonnegative(),
      setCount: z.number().int().nonnegative(),
      volume: z.number().nonnegative(),
      prCount: z.number().int().nonnegative(),
    }),
  ),
});
export type ProgressOverviewResponse = z.infer<typeof progressOverviewResponseSchema>;
