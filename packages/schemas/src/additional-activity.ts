import { z } from 'zod';

/**
 * Story 40 — supplemental movement outside the formal program schedule,
 * distinct from a scheduled `workout_session`. See
 * `packages/database/src/schema/additional-activity.ts` for the full
 * domain-boundary rationale.
 */
export const additionalActivityTypeSchema = z.enum([
  'walk',
  'yoga',
  'mobility',
  'foam_rolling',
  'outdoor_cycle',
  'indoor_cycle',
  'run',
  'stretching',
  'other',
]);
export type AdditionalActivityType = z.infer<typeof additionalActivityTypeSchema>;

export const additionalActivitySourceSchema = z.enum(['manual', 'apple_health']);
export type AdditionalActivitySource = z.infer<typeof additionalActivitySourceSchema>;

export const additionalActivitySchema = z.object({
  id: z.string().uuid(),
  localDate: z.string().date(),
  timezone: z.string(),
  startedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  activityType: additionalActivityTypeSchema,
  source: additionalActivitySourceSchema,
  title: z.string().nullable(),
  distanceValue: z.number().positive().nullable(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  caloriesKcal: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
  externalSourceId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdditionalActivity = z.infer<typeof additionalActivitySchema>;

export const createAdditionalActivitySchema = z.object({
  localDate: z.string().date(),
  timezone: z.string().min(1),
  startedAt: z.string().datetime().nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  activityType: additionalActivityTypeSchema,
  title: z.string().max(120).nullable().optional(),
  distanceValue: z.number().positive().nullable().optional(),
  distanceUnit: z.enum(['m', 'km', 'mi']).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  // Manual entries never carry a source/external id — those are set
  // server-side for manual rows and only ever supplied by the (future)
  // Apple Health discovery flow (Story 44).
  source: additionalActivitySourceSchema.optional(),
  caloriesKcal: z.number().nonnegative().nullable().optional(),
  externalSourceId: z.string().nullable().optional(),
});
export type CreateAdditionalActivityInput = z.infer<typeof createAdditionalActivitySchema>;

export const updateAdditionalActivitySchema = createAdditionalActivitySchema
  .omit({ localDate: true, timezone: true, source: true, externalSourceId: true })
  .partial();
export type UpdateAdditionalActivityInput = z.infer<typeof updateAdditionalActivitySchema>;

/**
 * Story 43 — a saved shortcut for a frequently-repeated activity. Stores
 * defaults only, never a reference to a specific logged activity; tapping
 * one prefills the add form for review, it never saves directly.
 */
export const additionalActivityPresetSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  activityType: additionalActivityTypeSchema,
  defaultDurationSeconds: z.number().int().positive().nullable(),
  defaultDistanceValue: z.number().positive().nullable(),
  defaultDistanceUnit: z.enum(['m', 'km', 'mi']).nullable(),
  defaultNotes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdditionalActivityPreset = z.infer<typeof additionalActivityPresetSchema>;

export const createAdditionalActivityPresetSchema = z.object({
  title: z.string().min(1).max(60),
  activityType: additionalActivityTypeSchema,
  defaultDurationSeconds: z.number().int().positive().nullable().optional(),
  defaultDistanceValue: z.number().positive().nullable().optional(),
  defaultDistanceUnit: z.enum(['m', 'km', 'mi']).nullable().optional(),
  defaultNotes: z.string().max(500).nullable().optional(),
});
export type CreateAdditionalActivityPresetInput = z.infer<typeof createAdditionalActivityPresetSchema>;
