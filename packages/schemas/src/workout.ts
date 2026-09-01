import { z } from 'zod';
import { dayTypeExerciseSchema } from './program';

const workoutLoggedSetTypeSchema = z.enum(['warmup', 'working', 'top', 'backoff', 'drop', 'failure']);

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
  setType: workoutLoggedSetTypeSchema,
  weightValue: z.number().nullable(),
  weightUnit: z.enum(['lb', 'kg']).nullable(),
  reps: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  distanceValue: z.number().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  rpe: z.number().min(0).max(10).nullable(),
  /** When the set was performed. Null for sets logged before the column
   *  existed — it cannot be backfilled. */
  performedAt: z.string().datetime().nullable().optional(),
  isPrWeight: z.boolean(),
  isPrReps: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema>;

export const workoutSetPreviousPerformanceSchema = z.object({
  sessionId: z.string().uuid(),
  localDate: z.string().date(),
  completedAt: z.string().datetime().nullable(),
  setType: workoutLoggedSetTypeSchema,
  weightValue: z.number().nullable(),
  weightUnit: z.enum(['lb', 'kg']).nullable(),
  reps: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  distanceValue: z.number().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  rpe: z.number().min(0).max(10).nullable(),
});
export type WorkoutSetPreviousPerformance = z.infer<typeof workoutSetPreviousPerformanceSchema>;

export const workoutSessionExerciseDetailSchema = workoutExerciseLogSchema.extend({
  exercise: z.object({
    id: z.string().uuid(),
    name: z.string(),
    isCustom: z.boolean(),
    ownerUserId: z.string().uuid().nullable(),
    archivedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  prescription: dayTypeExerciseSchema.shape.prescription.nullable(),
  sets: z.array(workoutSetSchema),
  previousSession: z
    .object({
      sessionId: z.string().uuid(),
      localDate: z.string().date(),
      completedAt: z.string().datetime().nullable(),
      sets: z.array(workoutSetPreviousPerformanceSchema),
    })
    .nullable(),
});
export type WorkoutSessionExerciseDetail = z.infer<typeof workoutSessionExerciseDetailSchema>;

export const workoutSessionDetailSchema = workoutSessionSchema.extend({
  exercises: z.array(workoutSessionExerciseDetailSchema),
});
export type WorkoutSessionDetail = z.infer<typeof workoutSessionDetailSchema>;

/**
 * Quick Log — apply one set of exercise-level values to several existing sets
 * and mark them performed, in one request.
 *
 * Story 59. The exercise-level action used to only *populate* the set inputs;
 * the user still had to expand the exercise and save each set. Doing that as N
 * sequential client requests would also serialise the user behind the network,
 * which is the specific complaint the pack raises.
 *
 * `setIds` is explicit rather than "all sets on this log" so the server writes
 * exactly what the client showed the user it would write — a set logged or
 * added between render and tap is not silently swept in. Because session start
 * pre-creates one row per planned set, this only ever *updates* rows, so
 * repeating the same request converges instead of duplicating.
 */
export const quickLogSetsSchema = z.object({
  setIds: z.array(z.string().uuid()).min(1).max(50),
  /** Only the fields the representation actually requires; RPE is never here. */
  values: z.object({
    weightValue: z.number().nonnegative().optional(),
    weightUnit: z.enum(['lb', 'kg']).optional(),
    reps: z.number().int().nonnegative().optional(),
    durationSeconds: z.number().int().nonnegative().optional(),
    distanceValue: z.number().nonnegative().optional(),
    distanceUnit: z.enum(['m', 'km', 'mi']).optional(),
  }),
});
export type QuickLogSetsInput = z.infer<typeof quickLogSetsSchema>;

export const createWorkoutSetSchema = z.object({
  clientId: z.string().uuid(),
  setType: workoutLoggedSetTypeSchema.default('working'),
  // Story 23: a floor matching the client's own validateSessionSet rule
  // (packages/domain/src/prescription-fields.ts — rejects negative, allows
  // 0). Previously unconstrained server-side, so a negative value the
  // client already blocked could still reach the API directly (relevant
  // now that a completed set's values are editable, not just a new one's).
  /*
   * Every value field is `nullish`, not `optional`.
   *
   * The logger sends one body per row containing every field that row's
   * representation manages, using `null` for the empties — a row is a whole
   * unit, not a patch. `optional()` accepted an absent key but *rejected*
   * `null`, so every save from the v2 logger failed with
   * `body/rpe Invalid input: expected number, received null`. Leaving RPE
   * blank, which is what almost everyone does, broke logging entirely.
   *
   * The two are distinguished rather than conflated: **absent means leave
   * alone, null means clear**. Anything else makes an optional value
   * impossible to remove once set.
   */
  weightValue: z.number().nonnegative().nullish(),
  weightUnit: z.enum(['lb', 'kg']).nullish(),
  reps: z.number().int().nonnegative().nullish(),
  durationSeconds: z.number().int().nonnegative().nullish(),
  distanceValue: z.number().nonnegative().nullish(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullish(),
  rpe: z.number().min(0).max(10).nullish(),
  /**
   * Whether the set was actually performed. Sets pre-populated from a program
   * are stored as `false` until the user logs them; PR detection ignores those
   * so a planned load never counts as a lift.
   */
  completed: z.boolean().optional(),
});
export type CreateWorkoutSetInput = z.infer<typeof createWorkoutSetSchema>;

export const consistencyWeekSchema = z.object({
  weekStart: z.string().date(),
  plannedCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
});
export type ConsistencyWeek = z.infer<typeof consistencyWeekSchema>;

export const restDaySchema = z.object({
  id: z.string().uuid(),
  localDate: z.string().date(),
  timezone: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type RestDay = z.infer<typeof restDaySchema>;

export const createRestDaySchema = z.object({
  localDate: z.string().date(),
  timezone: z.string().min(1),
  note: z.string().max(500).optional(),
});
export type CreateRestDayInput = z.infer<typeof createRestDaySchema>;
