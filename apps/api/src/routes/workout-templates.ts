import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { prescriptionSchema, workoutTemplateExerciseSchema, workoutTemplateSchema } from '@setline/schemas';
import {
  programVersion,
  trainingProgram,
  workoutTemplate,
  workoutTemplateExercise,
} from '@setline/database';
import { getDb } from '../lib/db';
import { requireAuth } from '../plugins/auth';
import { forbidden, notFound } from '../lib/errors';

function toTemplateResponse(row: typeof workoutTemplate.$inferSelect) {
  return {
    id: row.id,
    programVersionId: row.programVersionId,
    name: row.name,
    dayLabel: row.dayLabel,
    sortOrder: row.sortOrder,
    description: row.description,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTemplateExerciseResponse(row: typeof workoutTemplateExercise.$inferSelect) {
  return {
    id: row.id,
    templateId: row.templateId,
    exerciseId: row.exerciseId,
    sortOrder: row.sortOrder,
    prescription: row.prescription,
    progressionRuleId: row.progressionRuleId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const programParamsSchema = z.object({ programId: z.string().uuid() });
const templateParamsSchema = z.object({ templateId: z.string().uuid() });
const templateExerciseParamsSchema = z.object({ id: z.string().uuid() });

const createTemplateSchema = z.object({
  name: z.string().min(1),
  dayLabel: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
});

const addTemplateExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  prescription: prescriptionSchema,
  progressionRuleId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Verifies `programId` belongs to `userId` and returns its current
 * (latest) program_version, creating one if none exists yet. */
async function getOrCreateCurrentVersion(
  db: ReturnType<typeof getDb>,
  programId: string,
  userId: string,
) {
  const programs = await db
    .select()
    .from(trainingProgram)
    .where(and(eq(trainingProgram.id, programId), eq(trainingProgram.userId, userId)))
    .limit(1);
  if (!programs[0]) throw notFound('Program not found');

  const versions = await db
    .select()
    .from(programVersion)
    .where(eq(programVersion.trainingProgramId, programId));
  if (versions[0]) return versions.sort((a, b) => b.versionNumber - a.versionNumber)[0]!;

  const inserted = await db
    .insert(programVersion)
    .values({
      trainingProgramId: programId,
      versionNumber: 1,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    })
    .returning();
  return inserted[0]!;
}

export const workoutTemplateRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/programs/:programId/workouts',
    {
      preHandler: requireAuth,
      schema: { params: programParamsSchema, response: { 200: z.array(workoutTemplateSchema) } },
    },
    async (request) => {
      const db = getDb();
      const version = await getOrCreateCurrentVersion(db, request.params.programId, request.userId!);
      const rows = await db
        .select()
        .from(workoutTemplate)
        .where(eq(workoutTemplate.programVersionId, version.id));
      return rows.map(toTemplateResponse);
    },
  );

  fastify.post(
    '/v1/programs/:programId/workouts',
    {
      preHandler: requireAuth,
      schema: {
        params: programParamsSchema,
        body: createTemplateSchema,
        response: { 201: workoutTemplateSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const version = await getOrCreateCurrentVersion(db, request.params.programId, request.userId!);
      const existing = await db
        .select()
        .from(workoutTemplate)
        .where(eq(workoutTemplate.programVersionId, version.id));
      const rows = await db
        .insert(workoutTemplate)
        .values({
          programVersionId: version.id,
          name: request.body.name,
          dayLabel: request.body.dayLabel ?? null,
          description: request.body.description ?? null,
          estimatedDurationMinutes: request.body.estimatedDurationMinutes ?? null,
          sortOrder: existing.length,
        })
        .returning();
      reply.status(201);
      return toTemplateResponse(rows[0]!);
    },
  );

  /** Resolves a template + verifies ownership via its program chain. */
  async function getOwnedTemplate(db: ReturnType<typeof getDb>, templateId: string, userId: string) {
    const rows = await db
      .select({ template: workoutTemplate, program: trainingProgram })
      .from(workoutTemplate)
      .innerJoin(programVersion, eq(programVersion.id, workoutTemplate.programVersionId))
      .innerJoin(trainingProgram, eq(trainingProgram.id, programVersion.trainingProgramId))
      .where(eq(workoutTemplate.id, templateId))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('Workout template not found');
    if (row.program.userId !== userId) throw forbidden('Not allowed to access this template');
    return row.template;
  }

  fastify.get(
    '/v1/workout-templates/:templateId',
    {
      preHandler: requireAuth,
      schema: { params: templateParamsSchema, response: { 200: workoutTemplateSchema } },
    },
    async (request) => {
      const db = getDb();
      const template = await getOwnedTemplate(db, request.params.templateId, request.userId!);
      return toTemplateResponse(template);
    },
  );

  fastify.patch(
    '/v1/workout-templates/:templateId',
    {
      preHandler: requireAuth,
      schema: {
        params: templateParamsSchema,
        body: createTemplateSchema.partial(),
        response: { 200: workoutTemplateSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedTemplate(db, request.params.templateId, request.userId!);
      const rows = await db
        .update(workoutTemplate)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(workoutTemplate.id, request.params.templateId))
        .returning();
      return toTemplateResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-templates/:templateId/reorder',
    {
      preHandler: requireAuth,
      schema: {
        params: templateParamsSchema,
        body: z.object({ sortOrder: z.number().int().nonnegative() }),
        response: { 200: workoutTemplateSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedTemplate(db, request.params.templateId, request.userId!);
      const rows = await db
        .update(workoutTemplate)
        .set({ sortOrder: request.body.sortOrder, updatedAt: new Date() })
        .where(eq(workoutTemplate.id, request.params.templateId))
        .returning();
      return toTemplateResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-templates/:templateId/exercises',
    {
      preHandler: requireAuth,
      schema: {
        params: templateParamsSchema,
        body: addTemplateExerciseSchema,
        response: { 201: workoutTemplateExerciseSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedTemplate(db, request.params.templateId, request.userId!);
      const existing = await db
        .select()
        .from(workoutTemplateExercise)
        .where(eq(workoutTemplateExercise.templateId, request.params.templateId));
      const rows = await db
        .insert(workoutTemplateExercise)
        .values({
          templateId: request.params.templateId,
          exerciseId: request.body.exerciseId,
          prescription: request.body.prescription,
          progressionRuleId: request.body.progressionRuleId ?? null,
          notes: request.body.notes ?? null,
          sortOrder: existing.length,
        })
        .returning();
      reply.status(201);
      return toTemplateExerciseResponse(rows[0]!);
    },
  );

  /** Resolves a workout_template_exercise + verifies ownership. */
  async function getOwnedTemplateExercise(db: ReturnType<typeof getDb>, id: string, userId: string) {
    const rows = await db
      .select({ templateExercise: workoutTemplateExercise, program: trainingProgram })
      .from(workoutTemplateExercise)
      .innerJoin(workoutTemplate, eq(workoutTemplate.id, workoutTemplateExercise.templateId))
      .innerJoin(programVersion, eq(programVersion.id, workoutTemplate.programVersionId))
      .innerJoin(trainingProgram, eq(trainingProgram.id, programVersion.trainingProgramId))
      .where(eq(workoutTemplateExercise.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('Workout template exercise not found');
    if (row.program.userId !== userId) throw forbidden('Not allowed to access this resource');
    return row.templateExercise;
  }

  fastify.patch(
    '/v1/workout-template-exercises/:id',
    {
      preHandler: requireAuth,
      schema: {
        params: templateExerciseParamsSchema,
        body: addTemplateExerciseSchema.partial().extend({
          sortOrder: z.number().int().nonnegative().optional(),
        }),
        response: { 200: workoutTemplateExerciseSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedTemplateExercise(db, request.params.id, request.userId!);
      const rows = await db
        .update(workoutTemplateExercise)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(workoutTemplateExercise.id, request.params.id))
        .returning();
      const row = rows[0];
      if (!row) throw notFound('Workout template exercise not found');
      return toTemplateExerciseResponse(row);
    },
  );

  fastify.delete(
    '/v1/workout-template-exercises/:id',
    {
      preHandler: requireAuth,
      schema: { params: templateExerciseParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedTemplateExercise(db, request.params.id, request.userId!);
      await db.delete(workoutTemplateExercise).where(eq(workoutTemplateExercise.id, request.params.id));
      reply.status(204);
      return null;
    },
  );
};
