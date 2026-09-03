import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dailyActivitySummary } from '@setframe/database';
import { trendsResponseSchema, type TrendMetricKey, type TrendPoint } from '@setframe/schemas';
import { badRequest } from '../lib/errors.js';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

/**
 * Body, recovery, activity and capacity over time.
 *
 * Every other route that knows about these is single-date —
 * `/dashboard/today` and `/daily/:localDate` both take one `localDate` —
 * so Trends had no way to draw a line. `/progress/overview` already carries
 * body weight, but nothing carried resting heart rate, HRV, sleep, steps,
 * active energy or VO2 max as a series.
 *
 * Everything here is a *measurement*, which is the boundary Progress and
 * Trends divide on (ADR 0013): Progress is computed from sets the user
 * logged, Trends is what was measured about them and is true whether or not
 * they ever opened the app.
 */

/** Column per metric. Numerics arrive as strings from the driver. */
const COLUMNS: Record<TrendMetricKey, (row: typeof dailyActivitySummary.$inferSelect) => unknown> = {
  weight: (r) => r.weightValue,
  bodyFatPercentage: (r) => r.bodyFatPercentage,
  restingHeartRate: (r) => r.restingHeartRate,
  hrvSdnn: (r) => r.hrvSdnnMs,
  sleepMinutes: (r) => r.sleepTotalMinutes,
  steps: (r) => r.steps,
  activeEnergy: (r) => r.activeEnergyKcal,
  exerciseMinutes: (r) => r.exerciseMinutes,
  vo2Max: (r) => r.vo2Max,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export const trendRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/trends',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({ from: z.string().date(), to: z.string().date() }),
        /* Only the success shape is declared. A 400 is formatted by the
           global error handler into the uniform ApiError envelope, and
           declaring a different 400 here makes serialization fail — the
           client sees a 500 for what is a validation error. */
        response: { 200: trendsResponseSchema },
      },
    },
    async (request) => {
      const { from, to } = request.query;
      if (from > to) throw badRequest('`from` must not be after `to`.');

      const db = getDb();
      const rows = await db
        .select()
        .from(dailyActivitySummary)
        .where(
          and(
            eq(dailyActivitySummary.userId, request.userId!),
            gte(dailyActivitySummary.localDate, from),
            lte(dailyActivitySummary.localDate, to),
          ),
        )
        .orderBy(asc(dailyActivitySummary.localDate));

      const series = (Object.keys(COLUMNS) as TrendMetricKey[]).map((key) => {
        const points: TrendPoint[] = [];
        for (const row of rows) {
          const value = toNumber(COLUMNS[key](row));
          /* A day with no reading is absent, not zero. A zero resting heart
             rate is not a low one — it is a day we did not measure. */
          if (value === null) continue;
          points.push({ localDate: row.localDate, value });
        }
        const first = points[0];
        const last = points[points.length - 1];
        return {
          key,
          points,
          latest: last ? last.value : null,
          /* One reading has nothing to be a change from, and calling it +0
             would claim a stability nobody observed. */
          change: points.length >= 2 && first && last ? last.value - first.value : null,
        };
      });

      return { from, to, series };
    },
  );
};
