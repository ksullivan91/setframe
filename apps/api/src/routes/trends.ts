import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dailyActivitySummary, dailyManualEntry } from '@setframe/database';
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
  /* Read from the imported snapshot; the user's own weigh-ins are merged
     over the top below. See `manualWeights`. */
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

      /**
       * The user's own morning weigh-ins.
       *
       * Weight is the one metric with two sources. `daily_activity_summary`
       * carries what HealthKit imported; `daily_manual_entry` carries what
       * the user typed. Architecture §4's precedence rule is that a manual
       * entry is shown first and neither overwrites the other — so the
       * series prefers the manual value for a date and falls back to the
       * imported one. Reading only the snapshot, as this first did, would
       * have shown nothing at all to anyone who weighs in by hand.
       */
      const manualRows = await db
        .select({
          localDate: dailyManualEntry.localDate,
          value: dailyManualEntry.morningWeightValue,
          unit: dailyManualEntry.morningWeightUnit,
        })
        .from(dailyManualEntry)
        .where(
          and(
            eq(dailyManualEntry.userId, request.userId!),
            gte(dailyManualEntry.localDate, from),
            lte(dailyManualEntry.localDate, to),
          ),
        );
      const manualWeights = new Map<string, number>();
      for (const row of manualRows) {
        const value = toNumber(row.value);
        if (value === null) continue;
        /* Stored in whichever unit the user entered. The snapshot is in
           pounds, so a kilogram entry converts rather than being plotted
           2.2x too low. */
        manualWeights.set(row.localDate, row.unit === 'kg' ? value * 2.20462 : value);
      }

      const dates = new Set(rows.map((r) => r.localDate));
      for (const localDate of manualWeights.keys()) dates.add(localDate);

      const series = (Object.keys(COLUMNS) as TrendMetricKey[]).map((key) => {
        const points: TrendPoint[] = [];
        if (key === 'weight') {
          const byDate = new Map(rows.map((r) => [r.localDate, toNumber(r.weightValue)]));
          for (const localDate of [...dates].sort()) {
            const value = manualWeights.get(localDate) ?? byDate.get(localDate) ?? null;
            if (value === null) continue;
            points.push({ localDate, value: Math.round(value * 10) / 10 });
          }
        }
        for (const row of key === 'weight' ? [] : rows) {
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
