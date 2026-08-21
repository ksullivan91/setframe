import { z } from 'zod';

/**
 * Prescription discriminated union — see docs/data-model.md §3.1.
 * Must not force weight+reps onto every exercise (e.g. timed/distance).
 */
export const prescriptionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('sets_reps'),
    sets: z.number().int().positive(),
    repsMin: z.number().int().positive(),
    repsMax: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal('top_set_backoff'),
    topSets: z.number().int().positive(),
    topRepsMin: z.number().int().positive(),
    topRepsMax: z.number().int().positive(),
    backoffSets: z.number().int().positive(),
    backoffRepsMin: z.number().int().positive(),
    backoffRepsMax: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('per_side'),
    sets: z.number().int().positive(),
    repsMin: z.number().int().positive(),
    repsMax: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal('timed'),
    sets: z.number().int().positive(),
    durationSeconds: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('distance'),
    sets: z.number().int().positive(),
    distanceValue: z.number().positive(),
    distanceUnit: z.enum(['m', 'km', 'mi']),
  }),
  z.object({
    kind: z.literal('duration'),
    durationMinutes: z.number().int().positive(),
    notes: z.string().optional(),
  }),
  z.object({
    kind: z.literal('distanceDuration'),
    distanceMiles: z.number().positive(),
    durationMinutes: z.number().int().positive(),
    notes: z.string().optional(),
  }),
  z.object({
    kind: z.literal('bodyweight_reps'),
    sets: z.number().int().positive(),
    repsMin: z.number().int().positive(),
    repsMax: z.number().int().positive().optional(),
  }),
]);
export type Prescription = z.infer<typeof prescriptionSchema>;

export const progressionRuleTypeSchema = z.enum(['manual', 'double_progression', 'linear']);
export type ProgressionRuleType = z.infer<typeof progressionRuleTypeSchema>;

export const trainingProgramSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  isActive: z.boolean(),
  startDate: z.string().date().nullable(),
  cycleLengthWeeks: z.number().int().positive().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TrainingProgram = z.infer<typeof trainingProgramSchema>;

export const dayTypeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  estimatedDurationMinutes: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DayType = z.infer<typeof dayTypeSchema>;

export const dayTypeExerciseSchema = z.object({
  id: z.string().uuid(),
  dayTypeId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  sortOrder: z.number().int(),
  prescription: prescriptionSchema,
  progressionRuleId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DayTypeExercise = z.infer<typeof dayTypeExerciseSchema>;

const plannedSetTypeSchema = z.enum([
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
export type PlannedSetType = z.infer<typeof plannedSetTypeSchema>;

export const dayTypeExercisePlannedSetSchema = z.object({
  id: z.string().uuid(),
  dayTypeExerciseId: z.string().uuid(),
  sortOrder: z.number().int(),
  setType: plannedSetTypeSchema,
  reps: z.number().int().positive().nullable(),
  repsMax: z.number().int().positive().nullable(),
  loadValue: z.number().nullable(),
  loadUnit: z.enum(['lb', 'kg']).nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  distanceValue: z.number().positive().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  rpe: z.number().min(0).max(10).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DayTypeExercisePlannedSet = z.infer<typeof dayTypeExercisePlannedSetSchema>;

export const createPlannedSetSchema = z.object({
  setType: plannedSetTypeSchema.default('working'),
  reps: z.number().int().positive().optional(),
  repsMax: z.number().int().positive().optional(),
  loadValue: z.number().optional(),
  loadUnit: z.enum(['lb', 'kg']).optional(),
  durationSeconds: z.number().int().positive().optional(),
  distanceValue: z.number().positive().optional(),
  distanceUnit: z.enum(['m', 'km', 'mi']).optional(),
  rpe: z.number().min(0).max(10).optional(),
  notes: z.string().nullable().optional(),
});
export type CreatePlannedSetInput = z.infer<typeof createPlannedSetSchema>;

export const reorderPlannedSetsSchema = z.object({
  plannedSetIdsInOrder: z.array(z.string().uuid()).min(1),
});


export const programScheduleSlotSchema = z.object({
  id: z.string().uuid(),
  programVersionId: z.string().uuid(),
  dayTypeId: z.string().uuid(),
  weekNumber: z.number().int().positive().nullable(),
  dayIndex: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
});
export type ProgramScheduleSlot = z.infer<typeof programScheduleSlotSchema>;

export const scheduleOverrideSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().date(),
  dayTypeId: z.string().uuid(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ScheduleOverride = z.infer<typeof scheduleOverrideSchema>;
