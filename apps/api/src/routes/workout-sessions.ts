import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  createWorkoutSessionSchema,
  createWorkoutSetSchema,
  workoutExerciseLogSchema,
  workoutSessionSchema,
  workoutSetSchema,
} from '@setline/schemas';
import {
  exercise,
  workoutExerciseLog,
  workoutSession,
  workoutSet,
  dayType,
} from '@setline/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';

function toSessionResponse(row: typeof workoutSession.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    templateId: row.templateId,
    localDate: row.localDate,
    timezone: row.timezone,
    status: row.status === 'planned' ? 'in_progress' : row.status,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toExerciseLogResponse(row: typeof workoutExerciseLog.$inferSelect) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    templateExerciseId: null,
    sortOrder: row.sortOrder,
    skipped: row.skipped,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSetResponse(row: typeof workoutSet.$inferSelect) {
  return {
    id: row.id,
    exerciseLogId: row.exerciseLogId,
    clientId: row.clientId,
    sortOrder: row.sortOrder,
    weightValue: row.loadValue != null ? Number(row.loadValue) : null,
    weightUnit: row.loadUnit,
    reps: row.reps,
    durationSeconds: row.durationSeconds,
    distanceValue: row.distanceValue != null ? Number(row.distanceValue) : null,
    distanceUnit: row.distanceUnit,
    rpe: row.rpe != null ? Number(row.rpe) : null,
    isPrWeight: false,
    isPrReps: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });
const exerciseLogParamsSchema = z.object({ id: z.string().uuid() });
const setParamsSchema = z.object({ setId: z.string().uuid() });
const exerciseLogSetsParamsSchema = z.object({ exerciseLogId: z.string().uuid() });

const addExerciseLogSchema = z.object({
  exerciseId: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

async function getOwnedSession(db: ReturnType<typeof getDb>, sessionId: string, userId: string) {
  const rows = await db
    .select()
    .from(workoutSession)
    .where(and(eq(workoutSession.id, sessionId), eq(workoutSession.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Workout session not found');
  return row;
}

async function getOwnedExerciseLog(db: ReturnType<typeof getDb>, id: string, userId: string) {
  const rows = await db
    .select({ log: workoutExerciseLog, session: workoutSession })
    .from(workoutExerciseLog)
    .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
    .where(eq(workoutExerciseLog.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Exercise log not found');
  if (row.session.userId !== userId) throw forbidden('Not allowed to access this exercise log');
  return row.log;
}

async function getOwnedSet(db: ReturnType<typeof getDb>, setId: string, userId: string) {
  const rows = await db
    .select({ set: workoutSet, session: workoutSession })
    .from(workoutSet)
    .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
    .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
    .where(eq(workoutSet.id, setId))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Set not found');
  if (row.session.userId !== userId) throw forbidden('Not allowed to access this set');
  return row.set;
}

export const workoutSessionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/workout-sessions',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({
          localDate: z.string().date().optional(),
          status: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().int().positive().max(100).default(20),
        }),
        response: { 200: z.object({ items: z.array(workoutSessionSchema), nextCursor: z.string().nullable() }) },
      },
    },
    async (request) => {
      const db = getDb();
      const conditions = [eq(workoutSession.userId, request.userId!)];
      if (request.query.localDate) conditions.push(eq(workoutSession.localDate, request.query.localDate));
      const rows = await db
        .select()
        .from(workoutSession)
        .where(and(...conditions))
        .limit(request.query.limit);
      // TODO(phase-3): implement full cursor pagination encoding
      // (created_at, id) per docs/api.md "Decided" §1.
      return { items: rows.map(toSessionResponse), nextCursor: null };
    },
  );

  fastify.post(
    '/v1/workout-sessions',
    {
      preHandler: requireAuth,
      schema: { body: createWorkoutSessionSchema, response: { 201: workoutSessionSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      let sessionNameSnapshot = 'Ad hoc workout';
      if (request.body.templateId) {
        const templateRows = await db
          .select()
          .from(dayType)
          .where(eq(dayType.id, request.body.templateId))
          .limit(1);
        if (!templateRows[0]) throw badRequest('templateId does not exist');
        sessionNameSnapshot = templateRows[0].name;
      }
      const rows = await db
        .insert(workoutSession)
        .values({
          userId: request.userId!,
          templateId: request.body.templateId ?? null,
          localDate: request.body.localDate,
          timezone: request.body.timezone,
          startedAt: new Date(),
          status: 'in_progress',
          sessionNameSnapshot,
        })
        .returning();
      reply.status(201);
      return toSessionResponse(rows[0]!);
    },
  );

  fastify.get(
    '/v1/workout-sessions/:sessionId',
    {
      preHandler: requireAuth,
      schema: { params: sessionParamsSchema, response: { 200: workoutSessionSchema } },
    },
    async (request) => {
      const db = getDb();
      const session = await getOwnedSession(db, request.params.sessionId, request.userId!);
      return toSessionResponse(session);
    },
  );

  fastify.patch(
    '/v1/workout-sessions/:sessionId',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParamsSchema,
        body: z.object({
          notes: z.string().nullable().optional(),
          status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
        }),
        response: { 200: workoutSessionSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);
      const rows = await db
        .update(workoutSession)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(workoutSession.id, request.params.sessionId))
        .returning();
      return toSessionResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-sessions/:sessionId/complete',
    {
      preHandler: requireAuth,
      schema: { params: sessionParamsSchema, response: { 200: workoutSessionSchema } },
    },
    async (request) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);
      const rows = await db
        .update(workoutSession)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(workoutSession.id, request.params.sessionId))
        .returning();
      return toSessionResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-sessions/:sessionId/exercises',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParamsSchema,
        body: addExerciseLogSchema,
        response: { 201: workoutExerciseLogSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);
      const exerciseRows = await db
        .select()
        .from(exercise)
        .where(eq(exercise.id, request.body.exerciseId))
        .limit(1);
      if (!exerciseRows[0]) throw badRequest('exerciseId does not exist');
      const existing = await db
        .select()
        .from(workoutExerciseLog)
        .where(eq(workoutExerciseLog.sessionId, request.params.sessionId));
      const rows = await db
        .insert(workoutExerciseLog)
        .values({
          sessionId: request.params.sessionId,
          exerciseId: request.body.exerciseId,
          exerciseNameSnapshot: exerciseRows[0].name,
          notes: request.body.notes ?? null,
          sortOrder: existing.length,
        })
        .returning();
      reply.status(201);
      return toExerciseLogResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/workout-exercise-logs/:id',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogParamsSchema,
        body: z.object({
          notes: z.string().nullable().optional(),
          skipped: z.boolean().optional(),
          sortOrder: z.number().int().nonnegative().optional(),
        }),
        response: { 200: workoutExerciseLogSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedExerciseLog(db, request.params.id, request.userId!);
      const rows = await db
        .update(workoutExerciseLog)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(workoutExerciseLog.id, request.params.id))
        .returning();
      return toExerciseLogResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-exercise-logs/:exerciseLogId/sets',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogSetsParamsSchema,
        body: createWorkoutSetSchema,
        response: { 200: workoutSetSchema, 201: workoutSetSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedExerciseLog(db, request.params.exerciseLogId, request.userId!);

      // Idempotent create by (exercise_log_id, client_id) — mobile offline
      // retry queue may resend the same client_id; return the existing
      // row instead of erroring/duplicating (docs/api.md).
      const existingRows = await db
        .select()
        .from(workoutSet)
        .where(
          and(
            eq(workoutSet.exerciseLogId, request.params.exerciseLogId),
            eq(workoutSet.clientId, request.body.clientId),
          ),
        )
        .limit(1);
      if (existingRows[0]) {
        return toSetResponse(existingRows[0]);
      }

      const existing = await db
        .select()
        .from(workoutSet)
        .where(eq(workoutSet.exerciseLogId, request.params.exerciseLogId));
      const rows = await db
        .insert(workoutSet)
        .values({
          exerciseLogId: request.params.exerciseLogId,
          clientId: request.body.clientId,
          sortOrder: existing.length,
          setType: 'working',
          loadValue: request.body.weightValue?.toString() ?? null,
          loadUnit: request.body.weightUnit ?? null,
          reps: request.body.reps ?? null,
          durationSeconds: request.body.durationSeconds ?? null,
          distanceValue: request.body.distanceValue?.toString() ?? null,
          distanceUnit: request.body.distanceUnit ?? null,
          rpe: request.body.rpe?.toString() ?? null,
          completed: true,
        })
        .returning();
      reply.status(201);
      return toSetResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/workout-sets/:setId',
    {
      preHandler: requireAuth,
      schema: {
        params: setParamsSchema,
        body: createWorkoutSetSchema.partial().omit({ clientId: true }),
        response: { 200: workoutSetSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedSet(db, request.params.setId, request.userId!);
      const rows = await db
        .update(workoutSet)
        .set({
          loadValue: request.body.weightValue?.toString(),
          loadUnit: request.body.weightUnit,
          reps: request.body.reps,
          durationSeconds: request.body.durationSeconds,
          distanceValue: request.body.distanceValue?.toString(),
          distanceUnit: request.body.distanceUnit,
          rpe: request.body.rpe?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(workoutSet.id, request.params.setId))
        .returning();
      return toSetResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/workout-sets/:setId',
    {
      preHandler: requireAuth,
      schema: { params: setParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedSet(db, request.params.setId, request.userId!);
      await db.delete(workoutSet).where(eq(workoutSet.id, request.params.setId));
      reply.status(204);
      return null;
    },
  );

  fastify.post(
    '/v1/workout-exercise-logs/:exerciseLogId/sets/reorder',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogSetsParamsSchema,
        body: z.object({ setIdsInOrder: z.array(z.string().uuid()) }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedExerciseLog(db, request.params.exerciseLogId, request.userId!);
      await Promise.all(
        request.body.setIdsInOrder.map((setId, index) =>
          db
            .update(workoutSet)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(and(eq(workoutSet.id, setId), eq(workoutSet.exerciseLogId, request.params.exerciseLogId))),
        ),
      );
      return { ok: true as const };
    },
  );
};
