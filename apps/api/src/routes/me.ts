import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, sql } from 'drizzle-orm';
import { updateMeSchema, userSchema } from '@setframe/schemas';
import { user } from '@setframe/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { notFound } from '../lib/errors.js';

function toUserResponse(row: typeof user.$inferSelect) {
  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    displayName: row.displayName,
    preferredUnits: row.preferredUnits,
    timezone: row.timezone ?? '',
    onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const meRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * Marks onboarding finished — completed or skipped, which are the same
   * thing here: both are decisions the user made.
   *
   * Deliberately an action rather than a field on PATCH /v1/me. The client
   * has no business choosing the timestamp, and onboarding must never be
   * un-finished — a bug that cleared it would put an established user back
   * through a first-run flow.
   *
   * Idempotent: calling it twice keeps the first time, so a retry after a
   * dropped response does not move the date.
   */
  fastify.post(
    '/v1/me/onboarded',
    { preHandler: requireAuth, schema: { response: { 200: userSchema } } },
    async (request) => {
      const db = getDb();
      const rows = await db
        .update(user)
        .set({ onboardedAt: sql`coalesce(${user.onboardedAt}, now())`, updatedAt: new Date() })
        .where(eq(user.id, request.userId!))
        .returning();
      const row = rows[0];
      if (!row) throw notFound('User not found');
      return toUserResponse(row);
    },
  );

  fastify.get(
    '/v1/me',
    { preHandler: requireAuth, schema: { response: { 200: userSchema } } },
    async (request) => {
      const db = getDb();
      const rows = await db.select().from(user).where(eq(user.id, request.userId!)).limit(1);
      const row = rows[0];
      if (!row) throw notFound('User not found');
      return toUserResponse(row);
    },
  );

  fastify.patch(
    '/v1/me',
    {
      preHandler: requireAuth,
      schema: { body: updateMeSchema, response: { 200: userSchema } },
    },
    async (request) => {
      const db = getDb();
      const updates: Partial<typeof user.$inferInsert> = {
        ...request.body,
        updatedAt: new Date(),
      };
      const rows = await db
        .update(user)
        .set(updates)
        .where(eq(user.id, request.userId!))
        .returning();
      const row = rows[0];
      if (!row) throw notFound('User not found');
      return toUserResponse(row);
    },
  );
};
