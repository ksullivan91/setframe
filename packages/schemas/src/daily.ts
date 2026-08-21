import { z } from 'zod';

export const dailyManualEntrySchema = z.object({
  localDate: z.string().date(),
  morningWeightValue: z.number().nullable(),
  morningWeightUnit: z.enum(['lb', 'kg']).nullable(),
  systolicBp: z.number().int().nullable(),
  diastolicBp: z.number().int().nullable(),
  notes: z.string().nullable(),
  mood: z.number().int().min(1).max(5).nullable(),
  preWorkoutMealLogged: z.boolean().nullable(),
});
export type DailyManualEntry = z.infer<typeof dailyManualEntrySchema>;

export const patchDailyManualEntrySchema = z.object({
  morningWeightValue: z.number().positive().nullable().optional(),
  morningWeightUnit: z.enum(['lb', 'kg']).nullable().optional(),
  systolicBp: z.number().int().positive().nullable().optional(),
  diastolicBp: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  preWorkoutMealLogged: z.boolean().nullable().optional(),
});
export type PatchDailyManualEntryInput = z.infer<typeof patchDailyManualEntrySchema>;
