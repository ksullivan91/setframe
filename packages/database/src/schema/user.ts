import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { preferredUnitsEnum } from './enums';

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: text('clerk_user_id').notNull(),
    displayName: text('display_name'),
    preferredUnits: preferredUnitsEnum('preferred_units').notNull().default('imperial'),
    timezone: text('timezone'),
    /**
     * When onboarding finished — completed OR skipped.
     *
     * Null means it has never run. Nothing else can tell us: a user who
     * skipped every step looks exactly like a brand-new account, so
     * inferring it from whether they have a program or a Health connection
     * would re-run the flow forever for anyone who declined it.
     */
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_clerk_user_id_key').on(table.clerkUserId)],
);

export const userNotificationPreference = pgTable(
  'user_notification_preference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    workoutRemindersEnabled: boolean('workout_reminders_enabled').notNull().default(true),
    weeklySummaryEnabled: boolean('weekly_summary_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_notification_preference_user_id_key').on(table.userId)],
);
