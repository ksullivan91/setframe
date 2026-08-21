import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { dailyActivitySummary, dailyNutritionSnapshot, integrationSyncState } from '@setline/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

const dayPayloadSchema = z.object({
  localDate: z.string().date(),
  timezone: z.string(),
  activity: z.record(z.string(), z.unknown()).optional(),
  nutrition: z.record(z.string(), z.unknown()).optional(),
});

const reconcileSchema = z.object({ days: z.array(dayPayloadSchema) });

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

      for (const day of request.body.days) {
        if (day.activity) {
          const existing = await db
            .select()
            .from(dailyActivitySummary)
            .where(and(eq(dailyActivitySummary.userId, userId), eq(dailyActivitySummary.localDate, day.localDate)))
            .limit(1);
          if (existing[0]) {
            await db
              .update(dailyActivitySummary)
              .set({ syncStatus: 'complete', reconciledAt: new Date(), updatedAt: new Date() })
              .where(eq(dailyActivitySummary.id, existing[0].id));
          } else {
            await db.insert(dailyActivitySummary).values({
              userId,
              localDate: day.localDate,
              timezone: day.timezone,
              syncStatus: 'complete',
              reconciledAt: new Date(),
            });
          }
        }
        if (day.nutrition) {
          const existing = await db
            .select()
            .from(dailyNutritionSnapshot)
            .where(and(eq(dailyNutritionSnapshot.userId, userId), eq(dailyNutritionSnapshot.localDate, day.localDate)))
            .limit(1);
          if (existing[0]) {
            await db
              .update(dailyNutritionSnapshot)
              .set({ syncStatus: 'complete', reconciledAt: new Date(), updatedAt: new Date() })
              .where(eq(dailyNutritionSnapshot.id, existing[0].id));
          } else {
            await db.insert(dailyNutritionSnapshot).values({
              userId,
              localDate: day.localDate,
              timezone: day.timezone,
              syncStatus: 'complete',
              reconciledAt: new Date(),
            });
          }
        }
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
      return rows[0]!;
    },
  );
};
