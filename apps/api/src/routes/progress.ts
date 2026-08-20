import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { summarizeConsistency } from '@setline/domain';
import { workoutSession } from '@setline/database';
import { getDb } from '../lib/db';
import { requireAuth } from '../plugins/auth';

function isoWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /v1/progress/consistency — backs the Progress screen's "Consistency
 * (last N weeks)" widget (docs/api.md "Progress", data-model.md §8
 * decision 4). Computed on read from workout_session rows; uses
 * summarizeConsistency from packages/domain for the shaping/ratio logic.
 *
 * TODO(phase-4): derive `plannedCount` from the active program_version's
 * workout_template count per week (currently 0 — completed-only until
 * program-activation querying lands).
 */
export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/progress/consistency',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({ weeks: z.coerce.number().int().positive().max(52).default(8) }),
        response: {
          200: z.array(
            z.object({
              weekStart: z.string(),
              plannedCount: z.number(),
              completedCount: z.number(),
              completionRatio: z.number().nullable(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const db = getDb();
      const weeksBack = request.query.weeks;
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - weeksBack * 7);
      const sinceLocalDate = since.toISOString().slice(0, 10);

      const sessions = await db
        .select()
        .from(workoutSession)
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
            gte(workoutSession.localDate, sinceLocalDate),
          ),
        );

      const completedByWeek = new Map<string, number>();
      for (const session of sessions) {
        const week = isoWeekStart(new Date(session.localDate));
        completedByWeek.set(week, (completedByWeek.get(week) ?? 0) + 1);
      }

      const weeks = Array.from(completedByWeek.entries()).map(([weekStart, completedCount]) => ({
        weekStart,
        plannedCount: 0,
        completedCount,
      }));

      return summarizeConsistency(weeks);
    },
  );
};
