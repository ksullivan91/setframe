import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { restDay, workoutSession } from '@setframe/database';
import { createRestDaySchema, restDaySchema } from '@setframe/schemas';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

/**
 * Rest days.
 *
 * A rest day records that the user deliberately took a day off. It is not a
 * session and never counts as training; its only jobs are to close out the
 * day on Today and to mark a quiet week as intentional rather than as a
 * disappearance. See `summarizeTrainingTrends` for how that stays honest.
 */

function toRestDayResponse(row: typeof restDay.$inferSelect) {
  return {
    id: row.id,
    localDate: row.localDate,
    timezone: row.timezone,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export const restDayRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/v1/rest-days',
    {
      preHandler: requireAuth,
      schema: {
        body: createRestDaySchema,
        response: { 200: restDaySchema, 409: z.object({ message: z.string() }) },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const userId = request.userId!;
      const { localDate, timezone, note } = request.body;

      // Training and resting on the same day are contradictory claims, and
      // allowing both would make the day's state ambiguous on Today.
      const sessions = await db
        .select({ id: workoutSession.id, status: workoutSession.status })
        .from(workoutSession)
        .where(and(eq(workoutSession.userId, userId), eq(workoutSession.localDate, localDate)));
      if (sessions.some((session) => session.status !== 'abandoned')) {
        return reply
          .code(409)
          .send({ message: 'There is already a workout logged for this day.' });
      }

      // Upsert rather than check-then-insert: a double-tap or a retry from
      // two devices would otherwise race past a pre-check and collide on
      // rest_day_user_id_local_date_key.
      const rows = await db
        .insert(restDay)
        .values({ userId, localDate, timezone, note: note ?? null })
        .onConflictDoUpdate({
          target: [restDay.userId, restDay.localDate],
          set: { timezone, note: note ?? null, updatedAt: new Date() },
        })
        .returning();
      return toRestDayResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/rest-days/:localDate',
    {
      preHandler: requireAuth,
      schema: {
        params: z.object({ localDate: z.string().date() }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await db
        .delete(restDay)
        .where(
          and(eq(restDay.userId, request.userId!), eq(restDay.localDate, request.params.localDate)),
        );
      return reply.code(204).send(null);
    },
  );
};
