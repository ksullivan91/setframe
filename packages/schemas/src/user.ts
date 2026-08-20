import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  displayName: z.string().nullable(),
  preferredUnits: z.enum(['imperial', 'metric']).default('imperial'),
  timezone: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

export const updateMeSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  preferredUnits: z.enum(['imperial', 'metric']).optional(),
  timezone: z.string().optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const notificationPreferenceSchema = z.object({
  workoutRemindersEnabled: z.boolean(),
  weeklySummaryEnabled: z.boolean(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const updateNotificationPreferenceSchema = notificationPreferenceSchema.partial();
export type UpdateNotificationPreferenceInput = z.infer<
  typeof updateNotificationPreferenceSchema
>;
