import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { trainingProgramSchema } from '@setframe/schemas';
import { trainingProgram } from '@setframe/database';
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
      //
      // Order matters: insert-then-deactivate (not deactivate-then-insert).
      // neon-http doesn't support real transactions (db.transaction throws
      // "No transactions support in neon-http driver"), so these two
      // statements can't be made atomic. If a failure/race happens between
      // them, insert-first means the worst case is briefly having two
      // active programs (harmless — dashboard/day-type resolution just
      // takes .limit(1) with no meaningful ordering), never zero active
      // programs, which is what previously stranded a user's schedule
      // resolution with no active program at all.
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
      const row = rows[0]!;
      await db
        .update(trainingProgram)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(trainingProgram.userId, request.userId!),
            eq(trainingProgram.isActive, true),
            ne(trainingProgram.id, row.id),
          ),
        );
      reply.status(201);
      return toProgramResponse(row);
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
      // Activate the target first, then deactivate any other active
      // program — keeps "one active program" semantics implied by
      // training_program (user_id, is_active) index.
      //
      // Order matters: activate-then-deactivate (not the reverse). As in
      // POST /programs above, neon-http doesn't support real transactions,
      // so these two statements can't be made atomic. Activating first
      // means an invalid/foreign programId (0 rows updated) or any
      // failure before the second step leaves the prior active program
      // untouched — never zero active programs.
      const rows = await db
        .update(trainingProgram)
        .set({ isActive: true, updatedAt: new Date() })
        .where(
          and(eq(trainingProgram.id, request.params.programId), eq(trainingProgram.userId, request.userId!)),
        )
        .returning();
      const row = rows[0];
      if (!row) throw notFound('Program not found');
      await db
        .update(trainingProgram)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(trainingProgram.userId, request.userId!),
            eq(trainingProgram.isActive, true),
            ne(trainingProgram.id, row.id),
          ),
        );
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
