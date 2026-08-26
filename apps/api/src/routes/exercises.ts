import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, desc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  createExerciseSchema,
  exerciseHistoryResponseSchema,
  exerciseProgressResponseSchema,
  exerciseSchema,
} from '@setframe/schemas';
import { exercise, workoutExerciseLog, workoutSession, workoutSet } from '@setframe/database';
import { calculateVolume, detectRepPR, detectWeightPR, estimateOneRepMax, type HistoricalSet } from '@setframe/domain';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { notFound, forbidden } from '../lib/errors.js';

function toExerciseResponse(row: typeof exercise.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    movementPattern: row.movementPattern,
    isCustom: !row.isSystem,
    ownerUserId: row.createdByUserId,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const paramsSchema = z.object({ exerciseId: z.string().uuid() });

async function getOwnedExercise(db: ReturnType<typeof getDb>, exerciseId: string, userId: string) {
  const rows = await db.select().from(exercise).where(eq(exercise.id, exerciseId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound('Exercise not found');
  if (!row.isSystem && row.createdByUserId !== userId) {
    throw forbidden('Not allowed to view this exercise');
  }
  return row;
}

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
          movementPattern: request.body.movementPattern ?? null,
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
      const row = await getOwnedExercise(db, request.params.exerciseId, request.userId!);
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

  fastify.get(
    '/v1/exercises/:exerciseId/history',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        response: { 200: exerciseHistoryResponseSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedExercise(db, request.params.exerciseId, request.userId!);

      const rows = await db
        .select({
          sessionId: workoutSession.id,
          sessionLocalDate: workoutSession.localDate,
          sessionCompletedAt: workoutSession.completedAt,
          sessionName: workoutSession.sessionNameSnapshot,
          setId: workoutSet.id,
          exerciseLogId: workoutExerciseLog.id,
          setType: workoutSet.setType,
          sortOrder: workoutSet.sortOrder,
          weightValue: workoutSet.loadValue,
          weightUnit: workoutSet.loadUnit,
          reps: workoutSet.reps,
          durationSeconds: workoutSet.durationSeconds,
          distanceValue: workoutSet.distanceValue,
          distanceUnit: workoutSet.distanceUnit,
          rpe: workoutSet.rpe,
          isPrWeight: workoutSet.isPrWeight,
          isPrReps: workoutSet.isPrReps,
          notes: workoutSet.notes,
        })
        .from(workoutSet)
        .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
        .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
            eq(workoutExerciseLog.exerciseId, request.params.exerciseId),
            // Story 34: an exercise removed from its session never happened,
            // so it can't contribute to this exercise's history/PR trend.
            eq(workoutExerciseLog.skipped, false),
          ),
        )
        .orderBy(desc(workoutSession.localDate), desc(workoutSession.completedAt), desc(workoutSet.sortOrder));

      return {
        items: rows.map((row) => ({
          sessionId: row.sessionId,
          sessionLocalDate: row.sessionLocalDate,
          sessionCompletedAt: row.sessionCompletedAt ? row.sessionCompletedAt.toISOString() : null,
          sessionName: row.sessionName,
          setId: row.setId,
          exerciseLogId: row.exerciseLogId,
          setType: row.setType,
          sortOrder: row.sortOrder,
          weightValue: row.weightValue != null ? Number(row.weightValue) : null,
          weightUnit: row.weightUnit,
          reps: row.reps,
          durationSeconds: row.durationSeconds,
          distanceValue: row.distanceValue != null ? Number(row.distanceValue) : null,
          distanceUnit: row.distanceUnit,
          rpe: row.rpe != null ? Number(row.rpe) : null,
          isPrWeight: row.isPrWeight,
          isPrReps: row.isPrReps,
          notes: row.notes,
        })),
        nextCursor: null,
      };
    },
  );

  fastify.get(
    '/v1/exercises/:exerciseId/progress',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        response: { 200: exerciseProgressResponseSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedExercise(db, request.params.exerciseId, request.userId!);

      const rows = await db
        .select({
          sessionId: workoutSession.id,
          localDate: workoutSession.localDate,
          sessionName: workoutSession.sessionNameSnapshot,
          completedAt: workoutSession.completedAt,
          setId: workoutSet.id,
          sortOrder: workoutSet.sortOrder,
          weightValue: workoutSet.loadValue,
          weightUnit: workoutSet.loadUnit,
          reps: workoutSet.reps,
          setType: workoutSet.setType,
          isPrWeight: workoutSet.isPrWeight,
          isPrReps: workoutSet.isPrReps,
        })
        .from(workoutSet)
        .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
        .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
            eq(workoutExerciseLog.exerciseId, request.params.exerciseId),
            // Story 34: an exercise removed from its session never happened,
            // so it can't contribute to this exercise's history/PR trend.
            eq(workoutExerciseLog.skipped, false),
          ),
        )
        .orderBy(workoutSession.localDate, workoutSession.completedAt, workoutSet.sortOrder);

      const bySession = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = bySession.get(row.sessionId) ?? [];
        list.push(row);
        bySession.set(row.sessionId, list);
      }

      const seenHistory: HistoricalSet[] = [];
      const points = Array.from(bySession.values()).map((sessionRows) => {
        const sortedRows = [...sessionRows].sort((a, b) => a.sortOrder - b.sortOrder);
        const sessionHistory = sortedRows.map((row) => ({
          weightValue: row.weightValue != null ? Number(row.weightValue) : null,
          reps: row.reps,
        }));
        const topStrengthSet = sortedRows.reduce<(typeof sortedRows)[number] | null>((best, row) => {
          if (row.weightValue == null || row.reps == null) return best;
          const rowEstimate = estimateOneRepMax(Number(row.weightValue), row.reps);
          if (!best) return row;
          const bestEstimate = estimateOneRepMax(Number(best.weightValue!), best.reps!);
          return rowEstimate > bestEstimate ? row : best;
        }, null);

        const point = {
          sessionId: sortedRows[0]!.sessionId,
          localDate: sortedRows[0]!.localDate,
          sessionName: sortedRows[0]!.sessionName,
          topWeight: topStrengthSet?.weightValue != null ? Number(topStrengthSet.weightValue) : null,
          topReps: topStrengthSet?.reps ?? null,
          estimatedOneRepMax:
            topStrengthSet?.weightValue != null && topStrengthSet.reps != null
              ? Math.round(estimateOneRepMax(Number(topStrengthSet.weightValue), topStrengthSet.reps))
              : null,
          volume: calculateVolume(
            sortedRows.map((row) => ({
              weightValue: row.weightValue != null ? Number(row.weightValue) : null,
              reps: row.reps,
            })),
          ),
          isWeightPr: sessionHistory.some((candidate) => detectWeightPR(candidate, seenHistory)),
          isRepPr: sessionHistory.some((candidate) => detectRepPR(candidate, seenHistory)),
        };
        seenHistory.push(...sessionHistory.filter((candidate) => candidate.weightValue != null && candidate.reps != null));
        return point;
      });

      return { exerciseId: request.params.exerciseId, points };
    },
  );
};
