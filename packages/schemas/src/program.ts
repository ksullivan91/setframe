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

export const workoutTemplateSchema = z.object({
  id: z.string().uuid(),
  programVersionId: z.string().uuid(),
  name: z.string().min(1),
  dayLabel: z.string().nullable(),
  sortOrder: z.number().int(),
  description: z.string().nullable(),
  estimatedDurationMinutes: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;

export const workoutTemplateExerciseSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  sortOrder: z.number().int(),
  prescription: prescriptionSchema,
  progressionRuleId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutTemplateExercise = z.infer<typeof workoutTemplateExerciseSchema>;
