import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { createExerciseSchema, exerciseSchema } from '@setline/schemas';
import { exercise } from '@setline/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { notFound, forbidden } from '../lib/errors.js';

function toExerciseResponse(row: typeof exercise.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    isCustom: !row.isSystem,
    ownerUserId: row.createdByUserId,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const paramsSchema = z.object({ exerciseId: z.string().uuid() });

export const exerciseRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List system + own custom exercises. `?q=` trigram search is deferred —
  // see packages/database/src/schema/exercise.ts TODO on the GIN index.
  fastify.get(
    '/v1/exercises',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({ q: z.string().optional() }),
        response: { 200: z.array(exerciseSchema) },
      },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(exercise)
        .where(
          and(
            isNull(exercise.archivedAt),
            or(eq(exercise.isSystem, true), eq(exercise.createdByUserId, request.userId!)),
          ),
        );
      return rows.map(toExerciseResponse);
    },
  );

  fastify.post(
    '/v1/exercises',
    {
      preHandler: requireAuth,
      schema: { body: createExerciseSchema, response: { 201: exerciseSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      const rows = await db
        .insert(exercise)
        .values({
          name: request.body.name,
          isSystem: false,
          createdByUserId: request.userId!,
        })
        .returning();
      reply.status(201);
      return toExerciseResponse(rows[0]!);
    },
  );

  fastify.get(
    '/v1/exercises/:exerciseId',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 200: exerciseSchema } },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(exercise)
        .where(eq(exercise.id, request.params.exerciseId))
        .limit(1);
      const row = rows[0];
      if (!row) throw notFound('Exercise not found');
      if (!row.isSystem && row.createdByUserId !== request.userId) {
        throw forbidden('Not allowed to view this exercise');
      }
      return toExerciseResponse(row);
    },
  );

  fastify.patch(
    '/v1/exercises/:exerciseId',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        body: createExerciseSchema.partial(),
        response: { 200: exerciseSchema },
      },
    },
    async (request) => {
      const db = getDb();
      const existingRows = await db
        .select()
        .from(exercise)
        .where(eq(exercise.id, request.params.exerciseId))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) throw notFound('Exercise not found');
      // Only own custom exercises may be edited (docs/api.md "Exercises").
      if (existing.isSystem || existing.createdByUserId !== request.userId) {
        throw forbidden('Only your own custom exercises can be edited');
      }
      const rows = await db
        .update(exercise)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(exercise.id, request.params.exerciseId))
        .returning();
      return toExerciseResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/exercises/:exerciseId/archive',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 200: exerciseSchema } },
    },
    async (request) => {
      const db = getDb();
      const existingRows = await db
        .select()
        .from(exercise)
        .where(eq(exercise.id, request.params.exerciseId))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) throw notFound('Exercise not found');
      if (existing.isSystem || existing.createdByUserId !== request.userId) {
        throw forbidden('Only your own custom exercises can be archived');
      }
      const rows = await db
        .update(exercise)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(exercise.id, request.params.exerciseId))
        .returning();
      return toExerciseResponse(rows[0]!);
    },
  );

  // TODO(phase-3): implement recent sessions/sets aggregation for this
  // exercise — requires joining workout_set -> workout_exercise_log ->
  // workout_session scoped by request.userId, plus pagination decisions
  // per docs/api.md "Decided (2026-08-20)" §1 (cursor-based).
  fastify.get(
    '/v1/exercises/:exerciseId/history',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        response: { 200: z.object({ items: z.array(z.unknown()), nextCursor: z.string().nullable() }) },
      },
    },
    async () => ({ items: [], nextCursor: null }),
  );

  // TODO(phase-3): compute volume/1RM/PR trend data using
  // packages/domain's estimateOneRepMax/calculateVolume/detectWeightPR/
  // detectRepPR once workout_set querying is wired up.
  fastify.get(
    '/v1/exercises/:exerciseId/progress',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        response: { 200: z.object({ points: z.array(z.unknown()) }) },
      },
    },
    async () => ({ points: [] }),
  );
};
