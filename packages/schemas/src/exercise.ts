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
