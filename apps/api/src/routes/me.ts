import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { updateMeSchema, userSchema } from '@setframe/schemas';
import { user } from '@setframe/database';
import { getDb } from '../lib/db.js';
import { deleteAccountData } from '../lib/delete-account.js';
import { deleteClerkUser } from '../lib/clerk.js';
import { requireAuth } from '../plugins/auth.js';
import { ApiError, notFound } from '../lib/errors.js';

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
   * Deletes the account and everything in it.
   *
   * Required by App Store Review Guideline 5.1.1(v): an app that lets you
   * create an account has to let you delete it from inside the app.
   *
   * Database first, Clerk second, and the order is load-bearing. If Clerk
   * fails after the rows are gone, the user can still sign in and gets a
   * fresh empty account — recoverable, and they can try again. The reverse
   * leaves data belonging to an identity nobody can authenticate as.
   *
   * The database side is one batch, which Neon runs as a transaction, so a
   * half-deleted account is not a state this can produce.
   */
  fastify.delete(
    '/v1/me',
    { preHandler: requireAuth, schema: { response: { 204: z.null() } } },
    async (request, reply) => {
      const db = getDb();
      await deleteAccountData(db, request.userId!);

      /* Clerk failing here is reported, not swallowed: the data is gone
         either way, but the user needs to know their email is still
         claimed rather than discovering it at sign-up. */
      try {
        await deleteClerkUser(request.clerkUserId!);
      } catch {
        throw new ApiError(
          502,
          'ACCOUNT_PARTIALLY_DELETED',
          'Your data was deleted, but the sign-in could not be removed. Sign in again to retry.',
        );
      }

      return reply.code(204).send(null);
    },
  );

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
