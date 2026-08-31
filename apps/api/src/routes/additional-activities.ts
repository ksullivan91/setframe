import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { additionalActivity } from '@setframe/database';
import {
  additionalActivitySchema,
  createAdditionalActivitySchema,
  updateAdditionalActivitySchema,
} from '@setframe/schemas';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { badRequest, notFound } from '../lib/errors.js';

/**
 * Additional Activity (Story 40) — supplemental movement outside the
 * formal program schedule (a walk, yoga, mobility work). Deliberately
 * separate from `workout_session`/`day_type`: nothing here ever touches
 * program/template tables, and no scheduled-workout metric (adherence,
 * streak, scheduled session completion) should ever read this table.
 */

function toActivityResponse(row: typeof additionalActivity.$inferSelect) {
  return {
    id: row.id,
    localDate: row.localDate,
    timezone: row.timezone,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    durationSeconds: row.durationSeconds,
    activityType: row.activityType,
    source: row.source,
    title: row.title,
    distanceValue: row.distanceValue != null ? Number(row.distanceValue) : null,
    distanceUnit: row.distanceUnit,
    caloriesKcal: row.caloriesKcal != null ? Number(row.caloriesKcal) : null,
    notes: row.notes,
    externalSourceId: row.externalSourceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const paramsSchema = z.object({ id: z.string().uuid() });

async function getOwnedActivity(db: ReturnType<typeof getDb>, id: string, userId: string) {
  const rows = await db
    .select()
    .from(additionalActivity)
    .where(and(eq(additionalActivity.id, id), eq(additionalActivity.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Additional activity not found');
  return row;
}

export const additionalActivityRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/additional-activities',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({
          localDate: z.string().date().optional(),
          from: z.string().date().optional(),
          to: z.string().date().optional(),
        }),
        response: { 200: z.object({ items: z.array(additionalActivitySchema) }) },
      },
    },
    async (request) => {
      const db = getDb();
      const { localDate, from, to } = request.query;
      if (!localDate && !(from && to)) {
        throw badRequest('Provide either localDate or both from and to');
      }
      const conditions = [eq(additionalActivity.userId, request.userId!)];
      if (localDate) {
        conditions.push(eq(additionalActivity.localDate, localDate));
      } else {
        conditions.push(gte(additionalActivity.localDate, from!));
        conditions.push(lte(additionalActivity.localDate, to!));
      }
      const rows = await db
        .select()
        .from(additionalActivity)
        .where(and(...conditions))
        .orderBy(desc(additionalActivity.localDate), desc(additionalActivity.startedAt), desc(additionalActivity.createdAt));
      return { items: rows.map(toActivityResponse) };
    },
  );

  fastify.post(
    '/v1/additional-activities',
    {
      preHandler: requireAuth,
      schema: {
        body: createAdditionalActivitySchema,
        // 200 is the already-imported case; 201 is a new row.
        response: { 200: additionalActivitySchema, 201: additionalActivitySchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const body = request.body;

      /* Story 44 shipped the discovery flow this used to disclaim.
         `source: 'manual'` and `externalSourceId: null` were hardcoded here
         because a client-supplied `apple_health` source with no discovery
         flow behind it would have misrepresented the row's provenance.
         There is one now, and hardcoding them meant an imported workout
         came back looking manual — so the dedupe key was never stored, the
         suggestion never cleared, and tapping "Add to today" appeared to do
         nothing while quietly allowing duplicates.

         Still guarded: `apple_health` is only honoured with an external id
         to key it by, and anything else is recorded as manual. */
      const importedId =
        body.source === 'apple_health' && body.externalSourceId ? body.externalSourceId : null;
      const source = importedId ? 'apple_health' : 'manual';

      if (importedId) {
        // The unique index on (user_id, source, external_id) would turn a
        // repeat import into a 500. Importing the same workout twice is a
        // no-op, not an error — return what is already there.
        const existing = await db
          .select()
          .from(additionalActivity)
          .where(
            and(
              eq(additionalActivity.userId, request.userId!),
              eq(additionalActivity.source, 'apple_health'),
              eq(additionalActivity.externalSourceId, importedId),
            ),
          )
          .limit(1);
        if (existing[0]) {
          reply.status(200);
          return toActivityResponse(existing[0]);
        }
      }

      const rows = await db
        .insert(additionalActivity)
        .values({
          userId: request.userId!,
          localDate: body.localDate,
          timezone: body.timezone,
          startedAt: body.startedAt ? new Date(body.startedAt) : null,
          durationSeconds: body.durationSeconds ?? null,
          activityType: body.activityType,
          source,
          title: body.title ?? null,
          distanceValue: body.distanceValue?.toString() ?? null,
          distanceUnit: body.distanceUnit ?? null,
          caloriesKcal: body.caloriesKcal?.toString() ?? null,
          notes: body.notes ?? null,
          externalSourceId: importedId,
        })
        .returning();
      reply.status(201);
      return toActivityResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/additional-activities/:id',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        body: updateAdditionalActivitySchema,
        response: { 200: additionalActivitySchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedActivity(db, request.params.id, request.userId!);
      const body = request.body;
      const rows = await db
        .update(additionalActivity)
        .set({
          ...(body.startedAt !== undefined ? { startedAt: body.startedAt ? new Date(body.startedAt) : null } : {}),
          ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
          ...(body.activityType !== undefined ? { activityType: body.activityType } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.distanceValue !== undefined ? { distanceValue: body.distanceValue?.toString() ?? null } : {}),
          ...(body.distanceUnit !== undefined ? { distanceUnit: body.distanceUnit } : {}),
          ...(body.caloriesKcal !== undefined ? { caloriesKcal: body.caloriesKcal?.toString() ?? null } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(additionalActivity.id, request.params.id))
        .returning();
      return toActivityResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/additional-activities/:id',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedActivity(db, request.params.id, request.userId!);
      await db.delete(additionalActivity).where(eq(additionalActivity.id, request.params.id));
      reply.status(204);
      return null;
    },
  );
};
