import { z } from 'zod';

export const workoutSessionStatusSchema = z.enum(['in_progress', 'completed', 'abandoned']);
export type WorkoutSessionStatus = z.infer<typeof workoutSessionStatusSchema>;

export const workoutSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid().nullable(),
  localDate: z.string().date(),
  timezone: z.string(),
  status: workoutSessionStatusSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

export const createWorkoutSessionSchema = z.object({
  templateId: z.string().uuid().optional(),
  localDate: z.string().date(),
  timezone: z.string(),
});
export type CreateWorkoutSessionInput = z.infer<typeof createWorkoutSessionSchema>;

export const workoutExerciseLogSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  templateExerciseId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  skipped: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutExerciseLog = z.infer<typeof workoutExerciseLogSchema>;

export const workoutSetSchema = z.object({
  id: z.string().uuid(),
  exerciseLogId: z.string().uuid(),
  clientId: z.string().uuid(),
  sortOrder: z.number().int(),
  weightValue: z.number().nullable(),
  weightUnit: z.enum(['lb', 'kg']).nullable(),
  reps: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  distanceValue: z.number().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  rpe: z.number().min(0).max(10).nullable(),
  isPrWeight: z.boolean().default(false),
  isPrReps: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema>;

export const createWorkoutSetSchema = z.object({
  clientId: z.string().uuid(),
  weightValue: z.number().optional(),
  weightUnit: z.enum(['lb', 'kg']).optional(),
  reps: z.number().int().optional(),
  durationSeconds: z.number().int().optional(),
  distanceValue: z.number().optional(),
  distanceUnit: z.enum(['m', 'km', 'mi']).optional(),
  rpe: z.number().min(0).max(10).optional(),
});
export type CreateWorkoutSetInput = z.infer<typeof createWorkoutSetSchema>;

/** Backs GET /v1/progress/consistency — see docs/api.md "Progress". */
export const consistencyWeekSchema = z.object({
  weekStart: z.string().date(),
  plannedCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
});
export type ConsistencyWeek = z.infer<typeof consistencyWeekSchema>;
