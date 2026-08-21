import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  dailyActivitySummary,
  dailyManualEntry,
  dailyNutritionSnapshot,
} from '@setline/database';
import { dailyManualEntrySchema, patchDailyManualEntrySchema } from '@setline/schemas';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

const paramsSchema = z.object({ localDate: z.string().date() });

function toManualEntryResponse(row: typeof dailyManualEntry.$inferSelect | undefined, localDate: string) {
  if (!row) {
    return {
      localDate,
      morningWeightValue: null,
      morningWeightUnit: null,
      systolicBp: null,
      diastolicBp: null,
      notes: null,
      mood: null,
      preWorkoutMealLogged: null,
    };
  }

  return {
    localDate: row.localDate,
    morningWeightValue: row.morningWeightValue != null ? Number(row.morningWeightValue) : null,
    morningWeightUnit: row.morningWeightUnit,
    systolicBp: row.systolicBp,
    diastolicBp: row.diastolicBp,
    notes: row.notes,
    mood: row.mood,
    preWorkoutMealLogged: row.preWorkoutMealLogged,
  };
}

async function upsertManualEntry(
  db: ReturnType<typeof getDb>,
  userId: string,
  localDate: string,
  values: Partial<typeof dailyManualEntry.$inferInsert>,
) {
  const existing = await db
    .select()
    .from(dailyManualEntry)
    .where(and(eq(dailyManualEntry.userId, userId), eq(dailyManualEntry.localDate, localDate)))
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(dailyManualEntry)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(dailyManualEntry.id, existing[0].id))
      .returning();
    return rows[0]!;
  }

  const rows = await db
    .insert(dailyManualEntry)
    .values({ userId, localDate, ...values })
    .returning();
  return rows[0]!;
}

export const dailyRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/daily/:localDate',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        response: {
          200: z.object({
            manualEntry: dailyManualEntrySchema,
            activitySummary: z.unknown().nullable(),
            nutritionSnapshot: z.unknown().nullable(),
          }),
        },
      },
    },
    async (request) => {
      const db = getDb();
      const { localDate } = request.params;
      const userId = request.userId!;
      const [manual, activity, nutrition] = await Promise.all([
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
      ]);
      return {
        manualEntry: toManualEntryResponse(manual[0], localDate),
        activitySummary: activity[0] ?? null,
        nutritionSnapshot: nutrition[0] ?? null,
      };
    },
  );

  fastify.patch(
    '/v1/me/daily-entries/:localDate',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        body: patchDailyManualEntrySchema,
        response: { 200: dailyManualEntrySchema },
      },
    },
    async (request) => {
      const db = getDb();
      const payload: Partial<typeof dailyManualEntry.$inferInsert> = {};
      if (request.body.morningWeightValue !== undefined) {
        payload.morningWeightValue =
          request.body.morningWeightValue === null ? null : request.body.morningWeightValue.toString();
      }
      if (request.body.morningWeightUnit !== undefined) payload.morningWeightUnit = request.body.morningWeightUnit;
      if (request.body.systolicBp !== undefined) payload.systolicBp = request.body.systolicBp;
      if (request.body.diastolicBp !== undefined) payload.diastolicBp = request.body.diastolicBp;
      if (request.body.notes !== undefined) payload.notes = request.body.notes;
      if (request.body.mood !== undefined) payload.mood = request.body.mood;
      if (request.body.preWorkoutMealLogged !== undefined) {
        payload.preWorkoutMealLogged = request.body.preWorkoutMealLogged;
      }

      const row = await upsertManualEntry(db, request.userId!, request.params.localDate, payload);
      return toManualEntryResponse(row, request.params.localDate);
    },
  );
};
