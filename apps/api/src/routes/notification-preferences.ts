import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { notificationPreferenceSchema, updateNotificationPreferenceSchema } from '@setline/schemas';
import { userNotificationPreference } from '@setline/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

function toResponse(row: typeof userNotificationPreference.$inferSelect) {
  return {
    workoutRemindersEnabled: row.workoutRemindersEnabled,
    weeklySummaryEnabled: row.weeklySummaryEnabled,
  };
}

async function getOrCreatePreference(db: ReturnType<typeof getDb>, userId: string) {
  const existing = await db
    .select()
    .from(userNotificationPreference)
    .where(eq(userNotificationPreference.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(userNotificationPreference).values({ userId }).returning();
  return inserted[0]!;
}

/** See docs/data-model.md §6.1 / ADR 0007 — preferences only, no push
 * delivery is implemented yet. */
export const notificationPreferenceRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/me/notification-preferences',
    { preHandler: requireAuth, schema: { response: { 200: notificationPreferenceSchema } } },
    async (request) => {
      const db = getDb();
      const pref = await getOrCreatePreference(db, request.userId!);
      return toResponse(pref);
    },
  );

  fastify.patch(
    '/v1/me/notification-preferences',
    {
      preHandler: requireAuth,
      schema: { body: updateNotificationPreferenceSchema, response: { 200: notificationPreferenceSchema } },
    },
    async (request) => {
      const db = getDb();
      await getOrCreatePreference(db, request.userId!);
      const rows = await db
        .update(userNotificationPreference)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(userNotificationPreference.userId, request.userId!))
        .returning();
      return toResponse(rows[0]!);
    },
  );
};
