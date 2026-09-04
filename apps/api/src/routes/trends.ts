import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dailyActivitySummary, dailyManualEntry } from '@setframe/database';
import { zoneBands, zoneMinutesFromHistogram, type HeartRateHistogram } from '@setframe/domain';
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
  /* Zones are not columns. They are sliced from `active_hr_histogram` under
     the model the request carries — see the zone block below — so these
     never read a row directly. */
  zone1Minutes: () => null,
  zone2Minutes: () => null,
  zone3Minutes: () => null,
  zone4Minutes: () => null,
  zone5Minutes: () => null,
};

const ZONE_KEYS = ['zone1Minutes', 'zone2Minutes', 'zone3Minutes', 'zone4Minutes', 'zone5Minutes'] as const;

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
        querystring: z.object({
          from: z.string().date(),
          to: z.string().date(),
          /**
           * The heart-rate zone model, when the client has one.
           *
           * The server has no date of birth and no maximum-rate estimate,
           * and should not acquire them to answer a question the device can
           * already answer. Sent per request, so every day in the window is
           * sliced under one current model — which is what makes a two-year
           * chart internally comparable.
           *
           * Absent, the zone series are omitted rather than computed from a
           * guess.
           */
          restingBpm: z.coerce.number().positive().optional(),
          maxBpm: z.coerce.number().positive().optional(),
        }),
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

      /* Sliced once per request, not once per series: five keys read the
         same histograms under the same bands. */
      const bands =
        request.query.restingBpm && request.query.maxBpm
          ? zoneBands({ restingBpm: request.query.restingBpm, maxBpm: request.query.maxBpm })
          : [];
      const zonePoints = new Map<string, TrendPoint[]>(ZONE_KEYS.map((k) => [k, []]));
      if (bands.length > 0) {
        for (const row of rows) {
          const histogram = row.activeHrHistogram as HeartRateHistogram | null;
          if (!histogram || !Array.isArray(histogram.minutes)) continue;
          const minutes = zoneMinutesFromHistogram(histogram, bands);
          bands.forEach((band, index) => {
            const value = minutes[index] ?? 0;
            /* Zero is a reading here, unlike every other metric: a day you
               trained and spent no time in zone 5 is a real zero, and
               dropping it would leave a gap where a rest day looks the same
               as an easy day. */
            zonePoints.get(`zone${band.zone}Minutes`)?.push({ localDate: row.localDate, value });
          });
        }
      }

      const series = (Object.keys(COLUMNS) as TrendMetricKey[]).map((key) => {
        if ((ZONE_KEYS as readonly string[]).includes(key)) {
          const points = zonePoints.get(key) ?? [];
          const first = points[0];
          const last = points[points.length - 1];
          return {
            key,
            points,
            latest: last ? last.value : null,
            change: points.length >= 2 && first && last ? last.value - first.value : null,
          };
        }
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
