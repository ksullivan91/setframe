import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { additionalActivityPreset } from '@setframe/database';
import { additionalActivityPresetSchema, createAdditionalActivityPresetSchema } from '@setframe/schemas';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { notFound } from '../lib/errors.js';

/**
 * Additional Activity presets (Story 43) — a user-saved shortcut for a
 * frequently-repeated Additional Activity. Stores defaults only; see
 * packages/database/src/schema/additional-activity.ts for why this can
 * never reference a specific logged activity.
 */

function toPresetResponse(row: typeof additionalActivityPreset.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    activityType: row.activityType,
    defaultDurationSeconds: row.defaultDurationSeconds,
    defaultDistanceValue: row.defaultDistanceValue != null ? Number(row.defaultDistanceValue) : null,
    defaultDistanceUnit: row.defaultDistanceUnit,
    defaultNotes: row.defaultNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const paramsSchema = z.object({ id: z.string().uuid() });

export const additionalActivityPresetRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/additional-activity-presets',
    {
      preHandler: requireAuth,
      schema: { response: { 200: z.object({ items: z.array(additionalActivityPresetSchema) }) } },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(additionalActivityPreset)
        .where(eq(additionalActivityPreset.userId, request.userId!))
        .orderBy(additionalActivityPreset.title);
      return { items: rows.map(toPresetResponse) };
    },
  );

  fastify.post(
    '/v1/additional-activity-presets',
    {
      preHandler: requireAuth,
      schema: { body: createAdditionalActivityPresetSchema, response: { 201: additionalActivityPresetSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      const body = request.body;
      const rows = await db
        .insert(additionalActivityPreset)
        .values({
          userId: request.userId!,
          title: body.title,
          activityType: body.activityType,
          defaultDurationSeconds: body.defaultDurationSeconds ?? null,
          defaultDistanceValue: body.defaultDistanceValue?.toString() ?? null,
          defaultDistanceUnit: body.defaultDistanceUnit ?? null,
          defaultNotes: body.defaultNotes ?? null,
        })
        .returning();
      reply.status(201);
      return toPresetResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/additional-activity-presets/:id',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(additionalActivityPreset)
        .where(and(eq(additionalActivityPreset.id, request.params.id), eq(additionalActivityPreset.userId, request.userId!)))
        .limit(1);
      if (!rows[0]) throw notFound('Quick activity not found');
      await db
        .delete(additionalActivityPreset)
        .where(and(eq(additionalActivityPreset.id, request.params.id), eq(additionalActivityPreset.userId, request.userId!)));
      reply.status(204);
      return null;
    },
  );
};
