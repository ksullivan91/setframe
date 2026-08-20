import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  dailyActivitySummary,
  dailyManualEntry,
  dailyNutritionSnapshot,
  integrationSyncState,
  workoutSession,
} from '@setline/database';
import { getDb } from '../lib/db';
import { requireAuth } from '../plugins/auth';

/**
 * GET /v1/dashboard/today — purpose-built aggregate (master spec §34) so
 * the Today screen never needs several serial requests. See docs/api.md
 * "Dashboard aggregate".
 *
 * TODO(phase-4): derive weekLabel/dayLabel from training_program
 * .cycle_length_weeks + program_version.effective_from, and surface
 * workout_template.estimated_duration_minutes for the planned session —
 * requires resolving the active program/version/template chain, which is
 * deferred until program-activation flows (Phase 3) are exercised.
 */
export const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/dashboard/today',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({ localDate: z.string().date() }),
        response: { 200: z.object({}).passthrough() },
      },
    },
    async (request) => {
      const db = getDb();
      const userId = request.userId!;
      const { localDate } = request.query;

      const [sessions, manual, activity, nutrition, syncState] = await Promise.all([
        db
          .select()
          .from(workoutSession)
          .where(and(eq(workoutSession.userId, userId), eq(workoutSession.localDate, localDate))),
        db
          .select()
          .from(dailyManualEntry)
          .where(and(eq(dailyManualEntry.userId, userId), eq(dailyManualEntry.localDate, localDate)))
          .limit(1),
        db
          .select()
          .from(dailyActivitySummary)
          .where(and(eq(dailyActivitySummary.userId, userId), eq(dailyActivitySummary.localDate, localDate)))
          .limit(1),
        db
          .select()
          .from(dailyNutritionSnapshot)
          .where(and(eq(dailyNutritionSnapshot.userId, userId), eq(dailyNutritionSnapshot.localDate, localDate)))
          .limit(1),
        db
          .select()
          .from(integrationSyncState)
          .where(and(eq(integrationSyncState.userId, userId), eq(integrationSyncState.integrationType, 'apple_health')))
          .limit(1),
      ]);

      return {
        localDate,
        sessions,
        manualEntry: manual[0] ?? null,
        activitySummary: activity[0] ?? null,
        nutritionSnapshot: nutrition[0] ?? null,
        syncState: syncState[0] ?? null,
        // TODO(phase-4): weekLabel, dayLabel, estimatedDurationMinutes.
        weekLabel: null,
        dayLabel: null,
        estimatedDurationMinutes: null,
      };
    },
  );
};
