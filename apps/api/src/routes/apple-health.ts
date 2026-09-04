import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dailyActivitySummary, dailyNutritionSnapshot, integrationSyncState } from '@setframe/database';
import {
  appleHealthReconcileSchema,
  appleHealthDayStatusSchema,
  type AppleHealthDay,
} from '@setframe/schemas';
import { deriveDayStatus } from '@setframe/domain';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

const reconcileSchema = appleHealthReconcileSchema;

/* The driver takes numerics as strings and the column is `numeric`; a bare
   number round-trips fine but a NaN would not, so it is filtered here rather
   than at nine call sites. */
function numOrNull(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
}

function intOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

/**
 * UPSERT one day, keyed by `(user_id, local_date)`.
 *
 * A single statement on the unique index rather than select-then-write:
 * idempotent, as architecture §5 requires — resending the same payload must
 * not change the stored result — and free of the race two foreground events
 * a second apart would otherwise hit.
 *
 * The set list is the full column set, not a partial merge. A metric that
 * has become null (sample deleted in Health, a source app removed) has to be
 * able to return to null; merging would pin the old value forever.
 *
 * `reconciledAt` does move on every call. It records when we last looked,
 * which is not part of the data and is the one thing that should change.
 */
async function upsertActivity(
  db: ReturnType<typeof getDb>,
  values: typeof dailyActivitySummary.$inferInsert,
): Promise<void> {
  const { userId: _u, localDate: _d, ...updatable } = values;
  await db
    .insert(dailyActivitySummary)
    .values(values)
    .onConflictDoUpdate({
      target: [dailyActivitySummary.userId, dailyActivitySummary.localDate],
      set: { ...updatable, updatedAt: new Date() },
    });
}

async function upsertNutrition(
  db: ReturnType<typeof getDb>,
  values: typeof dailyNutritionSnapshot.$inferInsert,
): Promise<void> {
  const { userId: _u, localDate: _d, ...updatable } = values;
  await db
    .insert(dailyNutritionSnapshot)
    .values(values)
    .onConflictDoUpdate({
      target: [dailyNutritionSnapshot.userId, dailyNutritionSnapshot.localDate],
      set: { ...updatable, updatedAt: new Date() },
    });
}

async function getOrCreateSyncState(db: ReturnType<typeof getDb>, userId: string) {
  const existing = await db
    .select()
    .from(integrationSyncState)
    .where(and(eq(integrationSyncState.userId, userId), eq(integrationSyncState.integrationType, 'apple_health')))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(integrationSyncState)
    .values({ userId, integrationType: 'apple_health', status: 'never_synced' })
    .returning();
  return inserted[0]!;
}

export const appleHealthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/integrations/apple-health/sync-state',
    { preHandler: requireAuth, schema: { response: { 200: z.unknown() } } },
    async (request) => {
      const db = getDb();
      return getOrCreateSyncState(db, request.userId!);
    },
  );

  /**
   * See docs/api.md "Apple Health integration" for the full algorithm.
   * TODO(phase-8/9): implement the full transactional UPSERT of
   * daily_activity_summary/daily_nutrition_snapshot per
   * docs/sync-algorithm.md completeness rules, and per-metric
   * source_provenance handling. This currently persists a minimal
   * best-effort UPSERT keyed by (user_id, local_date) to keep the
   * idempotency guarantee real, without implementing the full
   * completeness-status derivation yet.
   */
  fastify.post(
    '/v1/integrations/apple-health/reconcile',
    {
      preHandler: requireAuth,
      schema: { body: reconcileSchema, response: { 200: z.unknown() } },
    },
    async (request) => {
      const db = getDb();
      const userId = request.userId!;
      const now = new Date();
      const results: Array<{ localDate: string; syncStatus: string }> = [];

      for (const day of request.body.days) {
        const syncStatus = deriveDayStatus(day, now);
        const syncedThrough = new Date(day.syncedThrough);
        const sources = day.sources ?? null;

        /* The columns this route never wrote. Every one of them stayed null
           on every row, which is why Trends read "Nothing recorded yet" for
           every metric except the weight the user types by hand. */
        const activityValues = day.activity
          ? {
              steps: intOrNull(day.activity.steps),
              activeEnergyKcal: numOrNull(day.activity.activeEnergyKcal),
              exerciseMinutes: intOrNull(day.activity.exerciseMinutes),
              standMinutes: intOrNull(day.activity.standMinutes),
              flightsClimbed: intOrNull(day.activity.flightsClimbed),
              walkingRunningDistanceM: numOrNull(day.activity.walkingRunningDistanceM),
              restingHeartRate: numOrNull(day.activity.restingHeartRate),
              walkingHeartRateAvg: numOrNull(day.activity.walkingHeartRateAvg),
              hrvSdnnMs: numOrNull(day.activity.hrvSdnnMs),
              vo2Max: numOrNull(day.activity.vo2Max),
              /* Kilograms on the wire, kilograms in the column, and the unit
                 recorded beside it. Converting at the edge would put the
                 same decision in two places. */
              weightValue: numOrNull(day.activity.weightKg),
              weightUnit: day.activity.weightKg === null ? null : ('kg' as const),
              bodyFatPercentage: numOrNull(day.activity.bodyFatPercentage),
              sleepTotalMinutes: numOrNull(day.activity.sleepTotalMinutes),
            }
          : {};

        await upsertActivity(db, {
          userId,
          localDate: day.localDate,
          timezone: day.timezone,
          syncStatus,
          syncedThrough,
          reconciledAt: now,
          sourceProvenance: sources,
          ...activityValues,
        });

        if (day.nutrition) {
          await upsertNutrition(db, {
            userId,
            localDate: day.localDate,
            timezone: day.timezone,
            syncStatus,
            syncedThrough,
            reconciledAt: now,
            sourceProvenance: sources,
            caloriesKcal: numOrNull(day.nutrition.caloriesKcal),
            proteinG: numOrNull(day.nutrition.proteinG),
            carbsG: numOrNull(day.nutrition.carbsG),
            fatG: numOrNull(day.nutrition.fatG),
            fiberG: numOrNull(day.nutrition.fiberG),
            sugarG: numOrNull(day.nutrition.sugarG),
            sodiumMg: numOrNull(day.nutrition.sodiumMg),
          });
        }

        results.push({ localDate: day.localDate, syncStatus });
      }

      const syncState = await getOrCreateSyncState(db, userId);
      const rows = await db
        .update(integrationSyncState)
        .set({
          lastAttemptAt: new Date(),
          lastSuccessAt: new Date(),
          status: 'ok',
          updatedAt: new Date(),
        })
        .where(eq(integrationSyncState.id, syncState.id))
        .returning();
      /* The per-day outcome comes back, so the client can settle its own
         queue without a second round trip for the days it just sent. */
      return { syncState: rows[0]!, days: results };
    },
  );

  /**
   * What the server already holds for a date range.
   *
   * The self-healing sweep needs to know which days are worth asking
   * HealthKit about again. Without this the client either re-reads every
   * day in its window on every foreground — expensive, and HealthKit
   * queries are not cheap — or it re-reads none and late Watch writes never
   * land.
   */
  fastify.get(
    '/v1/integrations/apple-health/days',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({ from: z.string().date(), to: z.string().date() }),
        response: { 200: z.object({ days: z.array(appleHealthDayStatusSchema) }) },
      },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select({
          localDate: dailyActivitySummary.localDate,
          syncStatus: dailyActivitySummary.syncStatus,
          syncedThrough: dailyActivitySummary.syncedThrough,
          reconciledAt: dailyActivitySummary.reconciledAt,
        })
        .from(dailyActivitySummary)
        .where(
          and(
            eq(dailyActivitySummary.userId, request.userId!),
            gte(dailyActivitySummary.localDate, request.query.from),
            lte(dailyActivitySummary.localDate, request.query.to),
          ),
        )
        .orderBy(asc(dailyActivitySummary.localDate));

      return {
        days: rows.map((row) => ({
          localDate: row.localDate,
          syncStatus: row.syncStatus,
          syncedThrough: row.syncedThrough ? row.syncedThrough.toISOString() : null,
          reconciledAt: row.reconciledAt ? row.reconciledAt.toISOString() : null,
        })),
      };
    },
  );
};
