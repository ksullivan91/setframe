import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { dailyActivitySummary, dailyManualEntry, dailyNutritionSnapshot } from '@setline/database';
import { getDb } from '../lib/db';
import { requireAuth } from '../plugins/auth';

const paramsSchema = z.object({ localDate: z.string().date() });

const bodyWeightSchema = z.object({
  weightValue: z.number().positive(),
  weightUnit: z.enum(['lb', 'kg']),
});

const bloodPressureSchema = z.object({
  systolic: z.number().int().positive(),
  diastolic: z.number().int().positive(),
});

const notesSchema = z.object({ notes: z.string().nullable() });

function toManualEntryResponse(row: typeof dailyManualEntry.$inferSelect | undefined, localDate: string) {
  if (!row) return { localDate, morningWeightValue: null, morningWeightUnit: null, systolicBp: null, diastolicBp: null, notes: null };
  return {
    localDate: row.localDate,
    morningWeightValue: row.morningWeightValue != null ? Number(row.morningWeightValue) : null,
    morningWeightUnit: row.morningWeightUnit,
    systolicBp: row.systolicBp,
    diastolicBp: row.diastolicBp,
    notes: row.notes,
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
            manualEntry: z.object({
              localDate: z.string(),
              morningWeightValue: z.number().nullable(),
              morningWeightUnit: z.enum(['lb', 'kg']).nullable(),
              systolicBp: z.number().nullable(),
              diastolicBp: z.number().nullable(),
              notes: z.string().nullable(),
            }),
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

  for (const method of ['put', 'patch'] as const) {
    fastify[method](
      '/v1/daily/:localDate/body-weight',
      {
        preHandler: requireAuth,
        schema: { params: paramsSchema, body: bodyWeightSchema, response: { 200: z.unknown() } },
      },
      async (request) => {
        const db = getDb();
        const row = await upsertManualEntry(db, request.userId!, request.params.localDate, {
          morningWeightValue: request.body.weightValue.toString(),
          morningWeightUnit: request.body.weightUnit,
        });
        return toManualEntryResponse(row, request.params.localDate);
      },
    );

    fastify[method](
      '/v1/daily/:localDate/blood-pressure',
      {
        preHandler: requireAuth,
        schema: { params: paramsSchema, body: bloodPressureSchema, response: { 200: z.unknown() } },
      },
      async (request) => {
        const db = getDb();
        const row = await upsertManualEntry(db, request.userId!, request.params.localDate, {
          systolicBp: request.body.systolic,
          diastolicBp: request.body.diastolic,
        });
        return toManualEntryResponse(row, request.params.localDate);
      },
    );

    fastify[method](
      '/v1/daily/:localDate/notes',
      {
        preHandler: requireAuth,
        schema: { params: paramsSchema, body: notesSchema, response: { 200: z.unknown() } },
      },
      async (request) => {
        const db = getDb();
        const row = await upsertManualEntry(db, request.userId!, request.params.localDate, {
          notes: request.body.notes,
        });
        return toManualEntryResponse(row, request.params.localDate);
      },
    );
  }
};
