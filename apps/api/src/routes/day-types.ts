import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, max } from 'drizzle-orm';
import { z } from 'zod';
import {
  dayType,
  dayTypeExercise,
  dayTypeExercisePlannedSet,
  programDayType,
  programScheduleSlot,
  programVersion,
  scheduleOverride,
  trainingProgram,
  workoutSession,
} from '@setframe/database';
import {
  createPlannedSetSchema,
  dayTypeExercisePlannedSetSchema,
  dayTypeExerciseSchema,
  dayTypeSchema,
  prescriptionSchema,
  programScheduleSlotSchema,
  reorderPlannedSetsSchema,
  scheduleOverrideSchema,
} from '@setframe/schemas';
import { getDb } from '../lib/db.js';
import { forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../plugins/auth.js';

function toDayTypeResponse(row: typeof dayType.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDayTypeExerciseResponse(row: typeof dayTypeExercise.$inferSelect) {
  return {
    id: row.id,
    dayTypeId: row.dayTypeId,
    exerciseId: row.exerciseId,
    sortOrder: row.sortOrder,
    prescription: row.prescription,
    progressionRuleId: row.progressionRuleId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPlannedSetResponse(row: typeof dayTypeExercisePlannedSet.$inferSelect) {
  return {
    id: row.id,
    dayTypeExerciseId: row.dayTypeExerciseId,
    sortOrder: row.sortOrder,
    setType: row.setType,
    reps: row.reps,
    repsMax: row.repsMax,
    loadValue: row.loadValue != null ? Number(row.loadValue) : null,
    loadUnit: row.loadUnit,
    durationSeconds: row.durationSeconds,
    distanceValue: row.distanceValue != null ? Number(row.distanceValue) : null,
    distanceUnit: row.distanceUnit,
    rpe: row.rpe != null ? Number(row.rpe) : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toScheduleSlotResponse(row: typeof programScheduleSlot.$inferSelect) {
  return {
    id: row.id,
    programVersionId: row.programVersionId,
    dayTypeId: row.dayTypeId,
    weekNumber: row.weekNumber,
    dayIndex: row.dayIndex,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function toScheduleOverrideResponse(row: typeof scheduleOverride.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    dayTypeId: row.dayTypeId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

const dayTypeParamsSchema = z.object({ dayTypeId: z.string().uuid() });
const dayTypeExerciseParamsSchema = z.object({ dayTypeId: z.string().uuid(), exerciseId: z.string().uuid() });
const plannedSetParamsSchema = z.object({
  dayTypeId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  plannedSetId: z.string().uuid(),
});
const programParamsSchema = z.object({ programId: z.string().uuid() });
const dateParamsSchema = z.object({ date: z.string().date() });

const createDayTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  // Story 25 — when creating a workout from within a program's context
  // (Guided Setup, or the Workouts tab's "New workout"), associate it with
  // that program immediately rather than leaving it an orphan only the
  // global list can see.
  programId: z.string().uuid().optional(),
});

const addExistingDayTypeToProgramSchema = z.object({ dayTypeId: z.string().uuid() });

const addDayTypeExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  prescription: prescriptionSchema,
  progressionRuleId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const reorderDayTypeExercisesSchema = z.object({
  exerciseIdsInOrder: z.array(z.string().uuid()).min(1),
});

const upsertScheduleSlotSchema = z.object({
  dayTypeId: z.string().uuid(),
  weekNumber: z.number().int().positive().nullable().optional(),
  dayIndex: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative(),
});

const scheduleResponseSchema = z.object({
  date: z.string().date(),
  override: scheduleOverrideSchema.nullable(),
  scheduledDayType: dayTypeSchema.nullable(),
  source: z.enum(['override', 'program', 'none']),
});

const upsertOverrideSchema = z.object({
  dayTypeId: z.string().uuid(),
  note: z.string().nullable().optional(),
});

async function getOwnedDayType(db: ReturnType<typeof getDb>, dayTypeId: string, userId: string) {
  const rows = await db
    .select()
    .from(dayType)
    .where(and(eq(dayType.id, dayTypeId), eq(dayType.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Day type not found');
  return row;
}

async function getOwnedDayTypeExercise(
  db: ReturnType<typeof getDb>,
  dayTypeId: string,
  exerciseId: string,
  userId: string,
) {
  const rows = await db
    .select({ exercise: dayTypeExercise, owner: dayType })
    .from(dayTypeExercise)
    .innerJoin(dayType, eq(dayType.id, dayTypeExercise.dayTypeId))
    .where(and(eq(dayTypeExercise.id, exerciseId), eq(dayTypeExercise.dayTypeId, dayTypeId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Day type exercise not found');
  if (row.owner.userId !== userId) throw forbidden('Not allowed to access this resource');
  return row.exercise;
}

async function getOwnedPlannedSet(
  db: ReturnType<typeof getDb>,
  dayTypeId: string,
  exerciseId: string,
  plannedSetId: string,
  userId: string,
) {
  await getOwnedDayTypeExercise(db, dayTypeId, exerciseId, userId);
  const rows = await db
    .select()
    .from(dayTypeExercisePlannedSet)
    .where(
      and(eq(dayTypeExercisePlannedSet.id, plannedSetId), eq(dayTypeExercisePlannedSet.dayTypeExerciseId, exerciseId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Planned set not found');
  return row;
}

async function resequencePlannedSets(db: ReturnType<typeof getDb>, dayTypeExerciseId: string) {
  const rows = await db
    .select({ id: dayTypeExercisePlannedSet.id })
    .from(dayTypeExercisePlannedSet)
    .where(eq(dayTypeExercisePlannedSet.dayTypeExerciseId, dayTypeExerciseId))
    .orderBy(
      dayTypeExercisePlannedSet.sortOrder,
      dayTypeExercisePlannedSet.createdAt,
      dayTypeExercisePlannedSet.id,
    );

  await Promise.all(
    rows.map(({ id }, index) =>
      db
        .update(dayTypeExercisePlannedSet)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(dayTypeExercisePlannedSet.id, id)),
    ),
  );
}

async function resequenceDayTypeExercises(db: ReturnType<typeof getDb>, dayTypeId: string) {
  const rows = await db
    .select({ id: dayTypeExercise.id })
    .from(dayTypeExercise)
    .where(eq(dayTypeExercise.dayTypeId, dayTypeId))
    .orderBy(dayTypeExercise.sortOrder, dayTypeExercise.createdAt, dayTypeExercise.id);

  await Promise.all(
    rows.map(({ id }, index) =>
      db
        .update(dayTypeExercise)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(dayTypeExercise.id, id)),
    ),
  );
}

async function getOwnedProgram(db: ReturnType<typeof getDb>, programId: string, userId: string) {
  const rows = await db
    .select()
    .from(trainingProgram)
    .where(and(eq(trainingProgram.id, programId), eq(trainingProgram.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Program not found');
  return row;
}

/**
 * Verifies a workout is both owned by the user and an explicit member of
 * this program (Story 25) — plain ownership alone is what let Schedule
 * offer a workout from a program it doesn't belong to.
 */
async function getOwnedProgramDayType(
  db: ReturnType<typeof getDb>,
  programId: string,
  dayTypeId: string,
  userId: string,
) {
  await getOwnedProgram(db, programId, userId);
  const row = await getOwnedDayType(db, dayTypeId, userId);
  const membership = await db
    .select({ id: programDayType.id })
    .from(programDayType)
    .where(and(eq(programDayType.trainingProgramId, programId), eq(programDayType.dayTypeId, dayTypeId)))
    .limit(1);
  if (!membership[0]) throw notFound('Workout is not part of this program');
  return row;
}

async function getOwnedCurrentVersion(db: ReturnType<typeof getDb>, programId: string, userId: string) {
  const programs = await db
    .select()
    .from(trainingProgram)
    .where(and(eq(trainingProgram.id, programId), eq(trainingProgram.userId, userId)))
    .limit(1);
  if (!programs[0]) throw notFound('Program not found');

  const versions = await db
    .select()
    .from(programVersion)
    .where(eq(programVersion.trainingProgramId, programId))
    .orderBy(desc(programVersion.versionNumber))
    .limit(1);
  if (versions[0]) return versions[0];

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

async function resolveScheduledDayType(
  db: ReturnType<typeof getDb>,
  userId: string,
  date: string,
) {
  const overrideRows = await db
    .select({ override: scheduleOverride, dayType })
    .from(scheduleOverride)
    .innerJoin(dayType, eq(dayType.id, scheduleOverride.dayTypeId))
    .where(and(eq(scheduleOverride.userId, userId), eq(scheduleOverride.date, date)))
    .limit(1);
  if (overrideRows[0]) {
    return {
      date,
      override: toScheduleOverrideResponse(overrideRows[0].override),
      scheduledDayType: toDayTypeResponse(overrideRows[0].dayType),
      source: 'override' as const,
    };
  }

  const programs = await db
    .select()
    .from(trainingProgram)
    .where(and(eq(trainingProgram.userId, userId), eq(trainingProgram.isActive, true)))
    .limit(1);
  const program = programs[0];
  if (!program) return { date, override: null, scheduledDayType: null, source: 'none' as const };

  const version = await getOwnedCurrentVersion(db, program.id, userId);
  const slots = await db
    .select({ slot: programScheduleSlot, dayType })
    .from(programScheduleSlot)
    .innerJoin(dayType, eq(dayType.id, programScheduleSlot.dayTypeId))
    .where(eq(programScheduleSlot.programVersionId, version.id));
  if (!slots.length) return { date, override: null, scheduledDayType: null, source: 'none' as const };

  const start = program.startDate ? new Date(`${program.startDate}T00:00:00Z`) : new Date(`${date}T00:00:00Z`);
  const target = new Date(`${date}T00:00:00Z`);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000);
  const dayIndex = diffDays >= 0 ? diffDays % 7 : ((diffDays % 7) + 7) % 7;
  const weekNumber = program.cycleLengthWeeks
    ? ((Math.floor(Math.max(diffDays, 0) / 7) % program.cycleLengthWeeks) + 1)
    : null;

  const matching = slots
    .filter(({ slot }) => slot.dayIndex === dayIndex && (program.cycleLengthWeeks ? slot.weekNumber === weekNumber : slot.weekNumber === null))
    .sort((a, b) => a.slot.sortOrder - b.slot.sortOrder)[0];

  if (!matching) return { date, override: null, scheduledDayType: null, source: 'none' as const };
  return {
    date,
    override: null,
    scheduledDayType: toDayTypeResponse(matching.dayType),
    source: 'program' as const,
  };
}

export const dayTypeRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/day-types',
    { preHandler: requireAuth, schema: { response: { 200: z.array(dayTypeSchema) } } },
    async (request) => {
      const db = getDb();
      const rows = await db.select().from(dayType).where(eq(dayType.userId, request.userId!));
      return rows.map(toDayTypeResponse);
    },
  );

  fastify.post(
    '/v1/day-types',
    {
      preHandler: requireAuth,
      schema: { body: createDayTypeSchema, response: { 201: dayTypeSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      if (request.body.programId) await getOwnedProgram(db, request.body.programId, request.userId!);
      const rows = await db
        .insert(dayType)
        .values({
          userId: request.userId!,
          name: request.body.name,
          description: request.body.description ?? null,
          estimatedDurationMinutes: request.body.estimatedDurationMinutes ?? null,
        })
        .returning();
      const created = rows[0]!;
      if (request.body.programId) {
        await db.insert(programDayType).values({ trainingProgramId: request.body.programId, dayTypeId: created.id });
      }
      reply.status(201);
      return toDayTypeResponse(created);
    },
  );

  fastify.get(
    '/v1/day-types/:dayTypeId',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeParamsSchema,
        response: { 200: dayTypeSchema.extend({ exercises: z.array(dayTypeExerciseSchema) }) },
      },
    },
    async (request) => {
      const db = getDb();
      const row = await getOwnedDayType(db, request.params.dayTypeId, request.userId!);
      const exercises = await db
        .select()
        .from(dayTypeExercise)
        .where(eq(dayTypeExercise.dayTypeId, row.id))
        .orderBy(dayTypeExercise.sortOrder, dayTypeExercise.createdAt, dayTypeExercise.id);
      return { ...toDayTypeResponse(row), exercises: exercises.map(toDayTypeExerciseResponse) };
    },
  );

  fastify.patch(
    '/v1/day-types/:dayTypeId',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeParamsSchema,
        body: createDayTypeSchema.partial(),
        response: { 200: dayTypeSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedDayType(db, request.params.dayTypeId, request.userId!);
      const rows = await db
        .update(dayType)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(dayType.id, request.params.dayTypeId))
        .returning();
      return toDayTypeResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/day-types/:dayTypeId',
    {
      preHandler: requireAuth,
      schema: { params: dayTypeParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedDayType(db, request.params.dayTypeId, request.userId!);

      // No ON DELETE CASCADE on any of these FKs — clear every referencing
      // row first, mirroring the exercise-delete route below. Workout
      // sessions are historical fact (ADR 0005) and must never be deleted
      // or have their snapshotted fields touched just because the plan
      // that spawned them changed; only the soft `templateId` backlink is
      // nulled out so an old session keeps rendering from its own snapshot
      // instead of blocking this delete with a foreign-key violation.
      const exercises = await db
        .select({ id: dayTypeExercise.id })
        .from(dayTypeExercise)
        .where(eq(dayTypeExercise.dayTypeId, request.params.dayTypeId));
      const exerciseIds = exercises.map((row) => row.id);
      if (exerciseIds.length > 0) {
        await db
          .delete(dayTypeExercisePlannedSet)
          .where(inArray(dayTypeExercisePlannedSet.dayTypeExerciseId, exerciseIds));
      }
      await db.delete(dayTypeExercise).where(eq(dayTypeExercise.dayTypeId, request.params.dayTypeId));
      await db.delete(programScheduleSlot).where(eq(programScheduleSlot.dayTypeId, request.params.dayTypeId));
      await db.delete(scheduleOverride).where(eq(scheduleOverride.dayTypeId, request.params.dayTypeId));
      // Story 25 — program_day_type has no ON DELETE CASCADE either;
      // most existing workouts now have a membership row (the migration
      // backfilled it), so skipping this made a permanent delete 500 on
      // any workout that belongs to a program.
      await db.delete(programDayType).where(eq(programDayType.dayTypeId, request.params.dayTypeId));
      await db
        .update(workoutSession)
        .set({ templateId: null })
        .where(eq(workoutSession.templateId, request.params.dayTypeId));

      await db.delete(dayType).where(eq(dayType.id, request.params.dayTypeId));
      reply.status(204);
      return null;
    },
  );

  fastify.post(
    '/v1/day-types/:dayTypeId/exercises',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeParamsSchema,
        body: addDayTypeExerciseSchema,
        response: { 201: dayTypeExerciseSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedDayType(db, request.params.dayTypeId, request.userId!);
      const existing = await db
        .select()
        .from(dayTypeExercise)
        .where(eq(dayTypeExercise.dayTypeId, request.params.dayTypeId));
      const rows = await db
        .insert(dayTypeExercise)
        .values({
          dayTypeId: request.params.dayTypeId,
          exerciseId: request.body.exerciseId,
          prescription: request.body.prescription,
          progressionRuleId: request.body.progressionRuleId ?? null,
          notes: request.body.notes ?? null,
          sortOrder: existing.length,
        })
        .returning();
      reply.status(201);
      return toDayTypeExerciseResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeExerciseParamsSchema,
        body: addDayTypeExerciseSchema.partial().extend({ sortOrder: z.number().int().nonnegative().optional() }),
        response: { 200: dayTypeExerciseSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedDayTypeExercise(db, request.params.dayTypeId, request.params.exerciseId, request.userId!);
      const rows = await db
        .update(dayTypeExercise)
        .set({ ...request.body, updatedAt: new Date() })
        .where(and(eq(dayTypeExercise.id, request.params.exerciseId), eq(dayTypeExercise.dayTypeId, request.params.dayTypeId)))
        .returning();
      return toDayTypeExerciseResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId',
    {
      preHandler: requireAuth,
      schema: { params: dayTypeExerciseParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedDayTypeExercise(db, request.params.dayTypeId, request.params.exerciseId, request.userId!);
      // No ON DELETE CASCADE on the FK — clear child planned sets first so
      // this doesn't fail with a foreign-key-violation error.
      await db
        .delete(dayTypeExercisePlannedSet)
        .where(eq(dayTypeExercisePlannedSet.dayTypeExerciseId, request.params.exerciseId));
      await db
        .delete(dayTypeExercise)
        .where(and(eq(dayTypeExercise.id, request.params.exerciseId), eq(dayTypeExercise.dayTypeId, request.params.dayTypeId)));
      await resequenceDayTypeExercises(db, request.params.dayTypeId);
      reply.status(204);
      return null;
    },
  );

  fastify.post(
    '/v1/day-types/:dayTypeId/exercises/reorder',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeParamsSchema,
        body: reorderDayTypeExercisesSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedDayType(db, request.params.dayTypeId, request.userId!);

      const existing = await db
        .select({ id: dayTypeExercise.id })
        .from(dayTypeExercise)
        .where(eq(dayTypeExercise.dayTypeId, request.params.dayTypeId))
        .orderBy(dayTypeExercise.sortOrder, dayTypeExercise.createdAt, dayTypeExercise.id);

      const existingIds = existing.map(({ id }) => id).sort();
      const requestedIds = [...request.body.exerciseIdsInOrder].sort();
      if (existingIds.length !== requestedIds.length || existingIds.some((id, index) => id !== requestedIds[index])) {
        throw notFound('Day type exercise list does not match this day type');
      }

      await Promise.all(
        request.body.exerciseIdsInOrder.map((exerciseId, index) =>
          db
            .update(dayTypeExercise)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(and(eq(dayTypeExercise.id, exerciseId), eq(dayTypeExercise.dayTypeId, request.params.dayTypeId))),
        ),
      );

      return { ok: true as const };
    },
  );

  fastify.get(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId/planned-sets',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeExerciseParamsSchema,
        response: { 200: z.array(dayTypeExercisePlannedSetSchema) },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedDayTypeExercise(db, request.params.dayTypeId, request.params.exerciseId, request.userId!);
      const rows = await db
        .select()
        .from(dayTypeExercisePlannedSet)
        .where(eq(dayTypeExercisePlannedSet.dayTypeExerciseId, request.params.exerciseId))
        .orderBy(dayTypeExercisePlannedSet.sortOrder, dayTypeExercisePlannedSet.createdAt);
      return rows.map(toPlannedSetResponse);
    },
  );

  fastify.post(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId/planned-sets',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeExerciseParamsSchema,
        body: createPlannedSetSchema,
        response: { 201: dayTypeExercisePlannedSetSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedDayTypeExercise(db, request.params.dayTypeId, request.params.exerciseId, request.userId!);
      const existing = await db
        .select()
        .from(dayTypeExercisePlannedSet)
        .where(eq(dayTypeExercisePlannedSet.dayTypeExerciseId, request.params.exerciseId));
      const rows = await db
        .insert(dayTypeExercisePlannedSet)
        .values({
          dayTypeExerciseId: request.params.exerciseId,
          sortOrder: existing.length,
          setType: request.body.setType,
          reps: request.body.reps ?? null,
          repsMax: request.body.repsMax ?? null,
          loadValue: request.body.loadValue?.toString() ?? null,
          loadUnit: request.body.loadUnit ?? null,
          durationSeconds: request.body.durationSeconds ?? null,
          distanceValue: request.body.distanceValue?.toString() ?? null,
          distanceUnit: request.body.distanceUnit ?? null,
          rpe: request.body.rpe?.toString() ?? null,
          notes: request.body.notes ?? null,
        })
        .returning();
      reply.status(201);
      return toPlannedSetResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId/planned-sets/:plannedSetId',
    {
      preHandler: requireAuth,
      schema: {
        params: plannedSetParamsSchema,
        body: createPlannedSetSchema.partial(),
        response: { 200: dayTypeExercisePlannedSetSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedPlannedSet(
        db,
        request.params.dayTypeId,
        request.params.exerciseId,
        request.params.plannedSetId,
        request.userId!,
      );
      const { loadValue, distanceValue, rpe, ...rest } = request.body;
      const rows = await db
        .update(dayTypeExercisePlannedSet)
        .set({
          ...rest,
          ...(loadValue !== undefined ? { loadValue: loadValue?.toString() ?? null } : {}),
          ...(distanceValue !== undefined ? { distanceValue: distanceValue?.toString() ?? null } : {}),
          ...(rpe !== undefined ? { rpe: rpe?.toString() ?? null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dayTypeExercisePlannedSet.id, request.params.plannedSetId))
        .returning();
      return toPlannedSetResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId/planned-sets/:plannedSetId',
    {
      preHandler: requireAuth,
      schema: { params: plannedSetParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedPlannedSet(
        db,
        request.params.dayTypeId,
        request.params.exerciseId,
        request.params.plannedSetId,
        request.userId!,
      );
      await db.delete(dayTypeExercisePlannedSet).where(eq(dayTypeExercisePlannedSet.id, request.params.plannedSetId));
      await resequencePlannedSets(db, request.params.exerciseId);
      reply.status(204);
      return null;
    },
  );

  fastify.post(
    '/v1/day-types/:dayTypeId/exercises/:exerciseId/planned-sets/reorder',
    {
      preHandler: requireAuth,
      schema: {
        params: dayTypeExerciseParamsSchema,
        body: reorderPlannedSetsSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedDayTypeExercise(db, request.params.dayTypeId, request.params.exerciseId, request.userId!);

      const existing = await db
        .select({ id: dayTypeExercisePlannedSet.id })
        .from(dayTypeExercisePlannedSet)
        .where(eq(dayTypeExercisePlannedSet.dayTypeExerciseId, request.params.exerciseId))
        .orderBy(
          dayTypeExercisePlannedSet.sortOrder,
          dayTypeExercisePlannedSet.createdAt,
          dayTypeExercisePlannedSet.id,
        );

      const existingIds = existing.map(({ id }) => id).sort();
      const requestedIds = [...request.body.plannedSetIdsInOrder].sort();
      if (existingIds.length !== requestedIds.length || existingIds.some((id, index) => id !== requestedIds[index])) {
        throw notFound('Planned set list does not match this exercise');
      }

      await Promise.all(
        request.body.plannedSetIdsInOrder.map((plannedSetId, index) =>
          db
            .update(dayTypeExercisePlannedSet)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(eq(dayTypeExercisePlannedSet.id, plannedSetId)),
        ),
      );

      return { ok: true as const };
    },
  );

  // --- Story 25: program-to-workout membership -----------------------

  fastify.get(
    '/v1/programs/:programId/day-types',
    {
      preHandler: requireAuth,
      schema: { params: programParamsSchema, response: { 200: z.array(dayTypeSchema) } },
    },
    async (request) => {
      const db = getDb();
      await getOwnedProgram(db, request.params.programId, request.userId!);
      const rows = await db
        .select({ dayType })
        .from(programDayType)
        .innerJoin(dayType, eq(dayType.id, programDayType.dayTypeId))
        .where(eq(programDayType.trainingProgramId, request.params.programId))
        .orderBy(programDayType.sortOrder, programDayType.createdAt);
      return rows.map((row) => toDayTypeResponse(row.dayType));
    },
  );

  fastify.post(
    '/v1/programs/:programId/day-types',
    {
      preHandler: requireAuth,
      schema: { params: programParamsSchema, body: addExistingDayTypeToProgramSchema, response: { 201: dayTypeSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedProgram(db, request.params.programId, request.userId!);
      const owned = await getOwnedDayType(db, request.body.dayTypeId, request.userId!);

      // Adding an already-member workout is a no-op, not an error — and
      // `onConflictDoNothing` (rather than check-then-insert) keeps that
      // true even under a concurrent duplicate request, which would
      // otherwise race the unique constraint into an unhandled 500.
      const [maxSortOrder] = await db
        .select({ value: max(programDayType.sortOrder) })
        .from(programDayType)
        .where(eq(programDayType.trainingProgramId, request.params.programId));
      await db
        .insert(programDayType)
        .values({
          trainingProgramId: request.params.programId,
          dayTypeId: request.body.dayTypeId,
          sortOrder: (maxSortOrder?.value ?? -1) + 1,
        })
        .onConflictDoNothing();
      reply.status(201);
      return toDayTypeResponse(owned);
    },
  );

  fastify.delete(
    '/v1/programs/:programId/day-types/:dayTypeId',
    {
      preHandler: requireAuth,
      schema: { params: programParamsSchema.extend({ dayTypeId: z.string().uuid() }), response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedProgram(db, request.params.programId, request.userId!);
      await getOwnedDayType(db, request.params.dayTypeId, request.userId!);

      // Removing a workout from a program is a membership change, not a
      // deletion (Story 25) — the day_type itself, its exercises, and its
      // presence in any OTHER program are untouched. Only resolve *this*
      // program's own schedule references to it, mirroring the cleanup
      // DELETE /v1/day-types/:dayTypeId does globally.
      const versions = await db
        .select({ id: programVersion.id })
        .from(programVersion)
        .where(eq(programVersion.trainingProgramId, request.params.programId));
      const versionIds = versions.map((v) => v.id);
      if (versionIds.length > 0) {
        await db
          .delete(programScheduleSlot)
          .where(
            and(
              eq(programScheduleSlot.dayTypeId, request.params.dayTypeId),
              inArray(programScheduleSlot.programVersionId, versionIds),
            ),
          );
      }

      await db
        .delete(programDayType)
        .where(
          and(
            eq(programDayType.trainingProgramId, request.params.programId),
            eq(programDayType.dayTypeId, request.params.dayTypeId),
          ),
        );
      reply.status(204);
      return null;
    },
  );

  // ---------------------------------------------------------------------

  fastify.get(
    '/v1/programs/:programId/schedule-slots',
    {
      preHandler: requireAuth,
      schema: { params: programParamsSchema, response: { 200: z.array(programScheduleSlotSchema) } },
    },
    async (request) => {
      const db = getDb();
      const version = await getOwnedCurrentVersion(db, request.params.programId, request.userId!);
      const rows = await db
        .select()
        .from(programScheduleSlot)
        .where(eq(programScheduleSlot.programVersionId, version.id));
      return rows.map(toScheduleSlotResponse);
    },
  );

  fastify.post(
    '/v1/programs/:programId/schedule-slots',
    {
      preHandler: requireAuth,
      schema: {
        params: programParamsSchema,
        body: upsertScheduleSlotSchema,
        response: { 201: programScheduleSlotSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      // Story 26: a schedule slot can only reference a workout that's
      // actually part of *this* program — plain ownership let Schedule
      // silently offer workouts from every other program too.
      await getOwnedProgramDayType(db, request.params.programId, request.body.dayTypeId, request.userId!);
      const version = await getOwnedCurrentVersion(db, request.params.programId, request.userId!);
      const rows = await db
        .insert(programScheduleSlot)
        .values({
          programVersionId: version.id,
          dayTypeId: request.body.dayTypeId,
          weekNumber: request.body.weekNumber ?? null,
          dayIndex: request.body.dayIndex,
          sortOrder: request.body.sortOrder,
        })
        .returning();
      reply.status(201);
      return toScheduleSlotResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/programs/:programId/schedule-slots/:id',
    {
      preHandler: requireAuth,
      schema: {
        params: programParamsSchema.extend({ id: z.string().uuid() }),
        body: upsertScheduleSlotSchema.partial(),
        response: { 200: programScheduleSlotSchema },
      },
    },
    async (request) => {
      const db = getDb();
      const version = await getOwnedCurrentVersion(db, request.params.programId, request.userId!);
      if (request.body.dayTypeId) {
        await getOwnedProgramDayType(db, request.params.programId, request.body.dayTypeId, request.userId!);
      }
      const rows = await db
        .update(programScheduleSlot)
        .set({ ...request.body })
        .where(and(eq(programScheduleSlot.id, request.params.id), eq(programScheduleSlot.programVersionId, version.id)))
        .returning();
      const row = rows[0];
      if (!row) throw notFound('Program schedule slot not found');
      return toScheduleSlotResponse(row);
    },
  );

  fastify.delete(
    '/v1/programs/:programId/schedule-slots/:id',
    {
      preHandler: requireAuth,
      schema: { params: programParamsSchema.extend({ id: z.string().uuid() }), response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      const version = await getOwnedCurrentVersion(db, request.params.programId, request.userId!);
      const rows = await db
        .delete(programScheduleSlot)
        .where(and(eq(programScheduleSlot.id, request.params.id), eq(programScheduleSlot.programVersionId, version.id)))
        .returning({ id: programScheduleSlot.id });
      if (!rows[0]) throw notFound('Program schedule slot not found');
      reply.status(204);
      return null;
    },
  );

  fastify.get(
    '/v1/me/schedule/:date',
    {
      preHandler: requireAuth,
      schema: { params: dateParamsSchema, response: { 200: scheduleResponseSchema } },
    },
    async (request) => resolveScheduledDayType(getDb(), request.userId!, request.params.date),
  );

  fastify.put(
    '/v1/me/schedule/:date/override',
    {
      preHandler: requireAuth,
      schema: {
        params: dateParamsSchema,
        body: upsertOverrideSchema,
        response: { 200: scheduleOverrideSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedDayType(db, request.body.dayTypeId, request.userId!);
      const existing = await db
        .select()
        .from(scheduleOverride)
        .where(and(eq(scheduleOverride.userId, request.userId!), eq(scheduleOverride.date, request.params.date)))
        .limit(1);
      const rows = existing[0]
        ? await db
            .update(scheduleOverride)
            .set({ dayTypeId: request.body.dayTypeId, note: request.body.note ?? null })
            .where(eq(scheduleOverride.id, existing[0].id))
            .returning()
        : await db
            .insert(scheduleOverride)
            .values({
              userId: request.userId!,
              date: request.params.date,
              dayTypeId: request.body.dayTypeId,
              note: request.body.note ?? null,
            })
            .returning();
      return toScheduleOverrideResponse(rows[0]!);
    },
  );

  fastify.delete(
    '/v1/me/schedule/:date/override',
    {
      preHandler: requireAuth,
      schema: { params: dateParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      await db
        .delete(scheduleOverride)
        .where(and(eq(scheduleOverride.userId, request.userId!), eq(scheduleOverride.date, request.params.date)));
      reply.status(204);
      return null;
    },
  );
};
