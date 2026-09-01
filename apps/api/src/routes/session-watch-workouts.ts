import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { sessionWatchSeries, sessionWatchWorkout, workoutSession } from '@setframe/database';
import { attachWatchWorkoutSchema, sessionWatchWorkoutSchema } from '@setframe/schemas';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { notFound } from '../lib/errors.js';

/**
 * Apple Watch workouts attached to a Setframe session (story 45).
 *
 * These are evidence *about* a session, not standalone activities — which
 * is why they live here rather than in `additional_activity`. Listing them
 * as activities is the double-count story 44 exists to suppress.
 *
 * Everything scopes by `request.userId` (ADR 0002). This is per-five-second
 * heart-rate data; it is the least forgiving place in the API to forget it.
 */

type WorkoutRow = typeof sessionWatchWorkout.$inferSelect;
type SeriesRow = typeof sessionWatchSeries.$inferSelect;

function toResponse(row: WorkoutRow, series: SeriesRow[] = []) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    externalId: row.externalId,
    activityType: row.activityType,
    appleActivityType: row.appleActivityType,
    title: row.title,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    activeEnergyKcal: row.activeEnergyKcal != null ? Number(row.activeEnergyKcal) : null,
    totalEnergyKcal: row.totalEnergyKcal != null ? Number(row.totalEnergyKcal) : null,
    avgHeartRateBpm: row.avgHeartRateBpm,
    peakHeartRateBpm: row.peakHeartRateBpm,
    minHeartRateBpm: row.minHeartRateBpm,
    distanceValue: row.distanceValue != null ? Number(row.distanceValue) : null,
    distanceUnit: row.distanceUnit,
    deviceName: row.deviceName,
    series: series.map((s) => ({ kind: s.kind, offsets: s.offsets, values: s.values })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const sessionParams = z.object({ sessionId: z.string().uuid() });
const attachParams = sessionParams.extend({ id: z.string().uuid() });

export const sessionWatchWorkoutRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/workout-sessions/:sessionId/watch-workouts',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParams,
        response: { 200: z.object({ items: z.array(sessionWatchWorkoutSchema) }) },
      },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(sessionWatchWorkout)
        .where(
          and(
            eq(sessionWatchWorkout.userId, request.userId!),
            eq(sessionWatchWorkout.sessionId, request.params.sessionId),
          ),
        )
        .orderBy(asc(sessionWatchWorkout.startedAt));
      if (rows.length === 0) return { items: [] };

      // One query for every series rather than one per workout: a session
      // with a lift, a run and a walk would otherwise be four round trips.
      const seriesRows = await db
        .select()
        .from(sessionWatchSeries)
        .where(
          and(
            eq(sessionWatchSeries.userId, request.userId!),
            inArray(
              sessionWatchSeries.sessionWatchWorkoutId,
              rows.map((r) => r.id),
            ),
          ),
        );
      const byWorkout = new Map<string, SeriesRow[]>();
      for (const s of seriesRows) {
        const list = byWorkout.get(s.sessionWatchWorkoutId) ?? [];
        list.push(s);
        byWorkout.set(s.sessionWatchWorkoutId, list);
      }
      return { items: rows.map((row) => toResponse(row, byWorkout.get(row.id) ?? [])) };
    },
  );

  fastify.post(
    '/v1/workout-sessions/:sessionId/watch-workouts',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParams,
        body: attachWatchWorkoutSchema,
        // 200 is the already-attached case; 201 is a new attachment.
        response: { 200: sessionWatchWorkoutSchema, 201: sessionWatchWorkoutSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const body = request.body;

      const sessionRows = await db
        .select()
        .from(workoutSession)
        .where(
          and(
            eq(workoutSession.id, request.params.sessionId),
            eq(workoutSession.userId, request.userId!),
          ),
        )
        .limit(1);
      if (!sessionRows[0]) throw notFound('Workout session not found');

      /* One Watch workout, one attachment, ever. The unique index would
         turn a repeat into a 500, and attaching twice is a no-op rather
         than an error — the client re-reads HealthKit on every foreground
         and will offer the same workout again until it sees it stored. */
      const existing = await db
        .select()
        .from(sessionWatchWorkout)
        .where(
          and(
            eq(sessionWatchWorkout.userId, request.userId!),
            eq(sessionWatchWorkout.externalId, body.externalId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        reply.status(200);
        return toResponse(existing[0]);
      }

      const inserted = await db
        .insert(sessionWatchWorkout)
        .values({
          userId: request.userId!,
          sessionId: request.params.sessionId,
          externalId: body.externalId,
          activityType: body.activityType as never,
          appleActivityType: body.appleActivityType,
          title: body.title,
          startedAt: new Date(body.startedAt),
          endedAt: new Date(body.endedAt),
          durationSeconds: body.durationSeconds,
          activeEnergyKcal: body.activeEnergyKcal?.toString() ?? null,
          totalEnergyKcal: body.totalEnergyKcal?.toString() ?? null,
          avgHeartRateBpm: body.avgHeartRateBpm ?? null,
          peakHeartRateBpm: body.peakHeartRateBpm ?? null,
          minHeartRateBpm: body.minHeartRateBpm ?? null,
          distanceValue: body.distanceValue?.toString() ?? null,
          distanceUnit: body.distanceUnit ?? null,
          deviceName: body.deviceName ?? null,
        })
        .returning();
      const row = inserted[0]!;

      /* Series are written once, here, and never resent — they are not part
         of the daily reconcile payload. An empty series is skipped rather
         than stored as a pair of empty arrays. */
      const series = (body.series ?? []).filter((s) => s.offsets.length > 0);
      if (series.length > 0) {
        await db.insert(sessionWatchSeries).values(
          series.map((s) => ({
            sessionWatchWorkoutId: row.id,
            userId: request.userId!,
            kind: s.kind,
            offsets: s.offsets,
            values: s.values,
          })),
        );
      }

      reply.status(201);
      return toResponse(
        row,
        series.map((s) => ({ ...s, sessionWatchWorkoutId: row.id }) as SeriesRow),
      );
    },
  );

  fastify.delete(
    '/v1/workout-sessions/:sessionId/watch-workouts/:id',
    {
      preHandler: requireAuth,
      schema: { params: attachParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(sessionWatchWorkout)
        .where(
          and(
            eq(sessionWatchWorkout.id, request.params.id),
            eq(sessionWatchWorkout.userId, request.userId!),
          ),
        )
        .limit(1);
      if (!rows[0]) throw notFound('Attached workout not found');

      /* Detach really deletes. Our snapshot outlives HealthKit — deleting
         the workout in Health leaves this untouched by design — so this is
         the only way back out, and leaving the samples behind would orphan
         them under a user who asked for them gone. The FK cascades, and
         this is explicit so the intent survives a schema change. */
      /* Both deletes scope by user as well as id. The ownership check above
         already 404s a workout that is not yours, so this is redundant
         today — and it is exactly the redundancy that survives someone
         later reordering or removing that check. */
      await db
        .delete(sessionWatchSeries)
        .where(
          and(
            eq(sessionWatchSeries.sessionWatchWorkoutId, request.params.id),
            eq(sessionWatchSeries.userId, request.userId!),
          ),
        );
      await db
        .delete(sessionWatchWorkout)
        .where(
          and(
            eq(sessionWatchWorkout.id, request.params.id),
            eq(sessionWatchWorkout.userId, request.userId!),
          ),
        );

      reply.status(204);
      return null;
    },
  );
};
