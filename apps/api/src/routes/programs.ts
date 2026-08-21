import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { trainingProgramSchema } from '@setline/schemas';
import { trainingProgram } from '@setline/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { notFound } from '../lib/errors.js';

function toProgramResponse(row: typeof trainingProgram.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    startDate: row.startDate,
    cycleLengthWeeks: row.cycleLengthWeeks,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const paramsSchema = z.object({ programId: z.string().uuid() });

const createProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  cycleLengthWeeks: z.number().int().positive().nullable().optional(),
});

export const programRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/programs',
    { preHandler: requireAuth, schema: { response: { 200: z.array(trainingProgramSchema) } } },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(trainingProgram)
        .where(eq(trainingProgram.userId, request.userId!));
      return rows.map(toProgramResponse);
    },
  );

  fastify.post(
    '/v1/programs',
    {
      preHandler: requireAuth,
      schema: { body: createProgramSchema, response: { 201: trainingProgramSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      // New programs become the active one — a user's just-created program
      // should immediately be usable for schedule resolution rather than
      // silently sitting inactive until something else activates it.
      await db
        .update(trainingProgram)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(trainingProgram.userId, request.userId!), eq(trainingProgram.isActive, true)));
      const rows = await db
        .insert(trainingProgram)
        .values({
          userId: request.userId!,
          name: request.body.name,
          description: request.body.description ?? null,
          startDate: request.body.startDate ?? null,
          cycleLengthWeeks: request.body.cycleLengthWeeks ?? null,
          isActive: true,
        })
        .returning();
      reply.status(201);
      return toProgramResponse(rows[0]!);
    },
  );

  fastify.get(
    '/v1/programs/:programId',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 200: trainingProgramSchema } },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(trainingProgram)
        .where(
          and(eq(trainingProgram.id, request.params.programId), eq(trainingProgram.userId, request.userId!)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) throw notFound('Program not found');
      return toProgramResponse(row);
    },
  );

  fastify.patch(
    '/v1/programs/:programId',
    {
      preHandler: requireAuth,
      schema: {
        params: paramsSchema,
        body: createProgramSchema.partial(),
        response: { 200: trainingProgramSchema },
      },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .update(trainingProgram)
        .set({ ...request.body, updatedAt: new Date() })
        .where(
          and(eq(trainingProgram.id, request.params.programId), eq(trainingProgram.userId, request.userId!)),
        )
        .returning();
      const row = rows[0];
      if (!row) throw notFound('Program not found');
      return toProgramResponse(row);
    },
  );

  fastify.post(
    '/v1/programs/:programId/activate',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 200: trainingProgramSchema } },
    },
    async (request) => {
      const db = getDb();
      // Deactivate any currently-active program for this user, then
      // activate the target — keeps "one active program" semantics
      // implied by training_program (user_id, is_active) index.
      await db
        .update(trainingProgram)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(trainingProgram.userId, request.userId!), eq(trainingProgram.isActive, true)));
      const rows = await db
        .update(trainingProgram)
        .set({ isActive: true, updatedAt: new Date() })
        .where(
          and(eq(trainingProgram.id, request.params.programId), eq(trainingProgram.userId, request.userId!)),
        )
        .returning();
      const row = rows[0];
      if (!row) throw notFound('Program not found');
      return toProgramResponse(row);
    },
  );

  fastify.post(
    '/v1/programs/:programId/archive',
    {
      preHandler: requireAuth,
      schema: { params: paramsSchema, response: { 200: trainingProgramSchema } },
    },
    async (request) => {
      const db = getDb();
      const rows = await db
        .update(trainingProgram)
        .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
        .where(
          and(eq(trainingProgram.id, request.params.programId), eq(trainingProgram.userId, request.userId!)),
        )
        .returning();
      const row = rows[0];
      if (!row) throw notFound('Program not found');
      return toProgramResponse(row);
    },
  );
};
