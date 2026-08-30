import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import {
  createWorkoutSessionSchema,
  createWorkoutSetSchema,
  quickLogSetsSchema,
  prescriptionSchema,
  workoutExerciseLogSchema,
  workoutSessionDetailSchema,
  workoutSessionSchema,
  workoutSetSchema,
  dayTypeSchema,
  type Prescription,
} from '@setframe/schemas';
import {
  deriveWorkoutFromSession,
  resolveSessionPRs,
  toPrBaseline,
  type HistoricalSet,
} from '@setframe/domain';
import {
  dayType,
  dayTypeExercise,
  dayTypeExercisePlannedSet,
  exercise,
  workoutExerciseLog,
  workoutSession,
  restDay,
  workoutSet,
} from '@setframe/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';

type LoggedSetType = 'warmup' | 'working' | 'top' | 'backoff' | 'drop' | 'failure';

function toSessionResponse(row: typeof workoutSession.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    templateId: row.templateId,
    localDate: row.localDate,
    timezone: row.timezone,
    status: row.status === 'planned' ? 'in_progress' : row.status,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toExerciseLogResponse(row: typeof workoutExerciseLog.$inferSelect) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    templateExerciseId: null,
    sortOrder: row.sortOrder,
    skipped: row.skipped,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSetResponse(row: typeof workoutSet.$inferSelect) {
  return {
    id: row.id,
    exerciseLogId: row.exerciseLogId,
    clientId: row.clientId,
    sortOrder: row.sortOrder,
    setType: row.setType as LoggedSetType,
    weightValue: row.loadValue != null ? Number(row.loadValue) : null,
    weightUnit: row.loadUnit,
    reps: row.reps,
    durationSeconds: row.durationSeconds,
    distanceValue: row.distanceValue != null ? Number(row.distanceValue) : null,
    distanceUnit: row.distanceUnit,
    rpe: row.rpe != null ? Number(row.rpe) : null,
    isPrWeight: row.isPrWeight,
    isPrReps: row.isPrReps,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Expand a day-type's planned prescription into a list of draft sets to
 * pre-populate when a session is created from a template. Weight is left
 * blank (that's what the user logs), but set type / target reps / target
 * duration / target distance are filled in from the plan so the user is
 * editing a pre-built structure rather than starting from a blank screen.
 *
 * Every planned value is optional (Story 19 — "open prescription", no
 * target set yet). An absent `sets`/`topSets`/`backoffSets` count means
 * `Array.from({ length: 0 }, ...)` — the correct behavior falls out
 * naturally, since there's no target count to expand: zero pre-filled
 * sets, same as any other ad-hoc exercise the user adds sets to by hand.
 * `duration`/`distanceDuration` have no "how many" field, so the
 * equivalent is skipping the single draft row entirely rather than
 * computing `undefined * 60` into a stored `NaN` — that's why those two
 * cases use an explicit `if (... == null) return [];` guard instead of
 * the `?? 0`-into-`Array.from` idiom the other five cases share. A new
 * kind added to this switch needs one or the other, deliberately: `?? 0`
 * only produces the right "skip it" behavior for a field that's an
 * `Array.from` *length*, not for one multiplied into a stored value.
 */
export function expandPrescriptionToSetDrafts(prescription: Prescription): Array<{
  setType: LoggedSetType;
  reps: number | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
}> {
  /* Story 42.1 — this returns the *shape* of the work, never its values.
   *
   * It used to copy the plan's reps/duration/distance straight onto the set
   * rows it creates, which persisted a planned value as though it were logged
   * performance. Completion is derived from whether a set carries its
   * representation's required fields, so for every representation whose
   * required fields the plan can supply, starting a workout marked the
   * exercise complete before the user had done anything:
   *
   *   bodyweight_reps  requires reps                 → prefilled → complete
   *   timed            requires duration             → prefilled → complete
   *   distance         requires distance             → prefilled → complete
   *   duration         requires duration             → prefilled → complete
   *   distanceDuration requires distance + duration  → prefilled → complete
   *
   * Five of eight. The three weight-bearing kinds escaped only because weight
   * happened not to be copied — an accident, not a design.
   *
   * The plan is not lost by this: it lives on the exercise log's snapshotted
   * `prescription`, which is the single source of truth for intent (ADR 0005).
   * The UI seeds its draft inputs from there. A seeded draft is not a logged
   * actual, and that distinction is the whole point of the fix.
   *
   * `setType` stays, because it is structure rather than performance: a
   * top_set_backoff plan genuinely produces top sets and backoff sets, and
   * that shape is what the user is about to fill in.
   */
  const structureOnly = (setType: LoggedSetType) => ({
    setType,
    reps: null,
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
  });

  switch (prescription.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps':
      return Array.from({ length: prescription.sets ?? 0 }, () => structureOnly('working'));
    case 'top_set_backoff':
      return [
        ...Array.from({ length: prescription.topSets ?? 0 }, () => structureOnly('top')),
        ...Array.from({ length: prescription.backoffSets ?? 0 }, () => structureOnly('backoff')),
      ];
    case 'timed':
    case 'distance':
      return Array.from({ length: prescription.sets ?? 0 }, () => structureOnly('working'));
    case 'duration':
      // A single continuous effort still needs a row to log into.
      return prescription.durationMinutes == null ? [] : [structureOnly('working')];
    case 'distanceDuration':
      return prescription.durationMinutes == null && prescription.distanceMiles == null
        ? []
        : [structureOnly('working')];
  }
}

/**
 * Resolves one field of a partial set update.
 *
 * Three cases, and conflating any two of them is a bug we have shipped: the
 * key is **absent** (leave the stored value alone), the key is **null**
 * (clear it), or it carries a value (write it).
 */
function pick<T>(body: object, key: string, incoming: T | null | undefined, current: T | null): T | null {
  if (!(key in body)) return current;
  return incoming ?? null;
}

/** Same three cases, for the numeric columns Drizzle models as strings. */
function pickNumeric(
  body: object,
  key: string,
  incoming: number | null | undefined,
  current: string | null,
): string | null {
  if (!(key in body)) return current;
  return incoming == null ? null : incoming.toString();
}

/** Whether a create-set body carries any performance value at all. */
function hasPerformedValue(body: {
  weightValue?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceValue?: number | null;
}): boolean {
  return (
    body.weightValue != null ||
    body.reps != null ||
    body.durationSeconds != null ||
    body.distanceValue != null
  );
}

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });
const exerciseLogParamsSchema = z.object({ id: z.string().uuid() });
const setParamsSchema = z.object({ setId: z.string().uuid() });
const exerciseLogSetsParamsSchema = z.object({ exerciseLogId: z.string().uuid() });

/** Body for saving a performed session as a reusable workout. */
const saveAsWorkoutSchema = z.object({
  name: z.string().min(1).max(120),
});

const addExerciseLogSchema = z.object({
  exerciseId: z.string().uuid(),
  notes: z.string().nullable().optional(),
  /* Story 08: an exercise added mid-session has no day-type row to inherit
     a prescription from, so the client sends the one the user configured.
     Optional, so older clients keep working and simply get a null snapshot. */
  prescription: prescriptionSchema.optional(),
});

async function getOwnedSession(db: ReturnType<typeof getDb>, sessionId: string, userId: string) {
  const rows = await db
    .select()
    .from(workoutSession)
    .where(and(eq(workoutSession.id, sessionId), eq(workoutSession.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Workout session not found');
  return row;
}

async function getOwnedExerciseLog(db: ReturnType<typeof getDb>, id: string, userId: string) {
  const rows = await db
    .select({ log: workoutExerciseLog, session: workoutSession })
    .from(workoutExerciseLog)
    .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
    .where(eq(workoutExerciseLog.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Exercise log not found');
  if (row.session.userId !== userId) throw forbidden('Not allowed to access this exercise log');
  return row.log;
}

async function getOwnedSet(db: ReturnType<typeof getDb>, setId: string, userId: string) {
  const rows = await db
    .select({ set: workoutSet, session: workoutSession, log: workoutExerciseLog })
    .from(workoutSet)
    .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
    .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
    .where(eq(workoutSet.id, setId))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Set not found');
  if (row.session.userId !== userId) throw forbidden('Not allowed to access this set');
  return row;
}

/**
 * All-time PR baseline for one exercise: every qualifying set from the user's
 * previously completed sessions.
 *
 * `excludeSessionId` keeps a session out of its own baseline. Without it,
 * editing a set after the session was completed would compare that set
 * against itself and never register a record.
 */
async function getHistoricalSets(
  db: ReturnType<typeof getDb>,
  userId: string,
  exerciseId: string,
  excludeSessionId?: string,
): Promise<HistoricalSet[]> {
  const conditions = [
    eq(workoutSession.userId, userId),
    eq(workoutSession.status, 'completed'),
    eq(workoutExerciseLog.exerciseId, exerciseId),
    // Story 34: an exercise removed from a session (soft-deleted via
    // `skipped`) never entered the record book, so it can't seed one.
    eq(workoutExerciseLog.skipped, false),
    isNotNull(workoutSet.loadValue),
    isNotNull(workoutSet.reps),
    // Sets pre-populated from a program template carry a planned load but
    // were never performed, so they must not enter the baseline.
    eq(workoutSet.completed, true),
  ];
  if (excludeSessionId) conditions.push(ne(workoutSession.id, excludeSessionId));

  const rows = await db
    .select({ loadValue: workoutSet.loadValue, reps: workoutSet.reps, setType: workoutSet.setType })
    .from(workoutSet)
    .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
    .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
    .where(and(...conditions));

  return toPrBaseline(
    rows.map((row) => ({
      setType: row.setType,
      weightValue: row.loadValue != null ? Number(row.loadValue) : null,
      reps: row.reps,
    })),
  );
}

async function getPreviousCompletedSessionForExercises(
  db: ReturnType<typeof getDb>,
  userId: string,
  sessionId: string,
  exerciseIds: string[],
) {
  if (!exerciseIds.length) return new Map<string, { sessionId: string; localDate: string; completedAt: string | null; sets: ReturnType<typeof toSetResponse>[] }>();

  const previousLogs = await db
    .select({ log: workoutExerciseLog, session: workoutSession })
    .from(workoutExerciseLog)
    .innerJoin(workoutSession, eq(workoutSession.id, workoutExerciseLog.sessionId))
    .where(
      and(
        eq(workoutSession.userId, userId),
        eq(workoutSession.status, 'completed'),
        inArray(workoutExerciseLog.exerciseId, exerciseIds),
        ne(workoutSession.id, sessionId),
        // Story 34: a removed exercise's sets shouldn't resurface as "last time"
        eq(workoutExerciseLog.skipped, false),
      ),
    )
    .orderBy(workoutSession.completedAt, workoutSession.updatedAt, workoutExerciseLog.sortOrder);

  const latestByExerciseId = new Map<string, { logId: string; sessionId: string; localDate: string; completedAt: string | null }>();
  for (const row of previousLogs.reverse()) {
    if (!latestByExerciseId.has(row.log.exerciseId)) {
      latestByExerciseId.set(row.log.exerciseId, {
        logId: row.log.id,
        sessionId: row.session.id,
        localDate: row.session.localDate,
        completedAt: row.session.completedAt ? row.session.completedAt.toISOString() : null,
      });
    }
  }

  const logIds = [...latestByExerciseId.values()].map((value) => value.logId);
  if (!logIds.length) return new Map();

  const previousSetRows = await db.select().from(workoutSet).where(inArray(workoutSet.exerciseLogId, logIds));
  const setsByLogId = new Map<string, ReturnType<typeof toSetResponse>[]>();
  for (const row of previousSetRows) {
    const list = setsByLogId.get(row.exerciseLogId) ?? [];
    list.push(toSetResponse(row));
    setsByLogId.set(row.exerciseLogId, list);
  }

  const result = new Map<string, { sessionId: string; localDate: string; completedAt: string | null; sets: ReturnType<typeof toSetResponse>[] }>();
  for (const [exerciseId, value] of latestByExerciseId) {
    result.set(exerciseId, {
      sessionId: value.sessionId,
      localDate: value.localDate,
      completedAt: value.completedAt,
      sets: (setsByLogId.get(value.logId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }
  return result;
}

/**
 * Recomputes PR flags for every set of one exercise log and persists any that
 * changed.
 *
 * PR state is derived, never incremental: a set is only a record relative to
 * the sets logged before it, so creating, editing, deleting or reordering any
 * set can promote or demote any other. Resolving the whole log from scratch
 * is the only way the badges stay consistent, and it means the persisted
 * flags always match what `resolveSessionPRs` renders in the apps.
 *
 * The read and the writes are not serialized — neon-http has no interactive
 * transactions — so two concurrent mutations on the same exercise could race
 * and leave one stale flag. It self-heals on the next mutation, and both
 * clients await a session refetch between saves, so the window is small.
 */
async function recalculateLogPrFlags(params: {
  db: ReturnType<typeof getDb>;
  userId: string;
  exerciseId: string;
  sessionId: string;
}) {
  const { db, exerciseId, sessionId } = params;

  // Scope the candidates to the exercise, not the log: an exercise can be
  // added to a session twice, and those logs share one record progression.
  // `getHistoricalSets` excludes the whole session, so anything in-session
  // has to come from here or it would drop out of its own baseline.
  const [history, rows] = await Promise.all([
    getHistoricalSets(db, params.userId, exerciseId, sessionId),
    db
      .select({ set: workoutSet, logSortOrder: workoutExerciseLog.sortOrder })
      .from(workoutSet)
      .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
      .where(and(eq(workoutExerciseLog.sessionId, sessionId), eq(workoutExerciseLog.exerciseId, exerciseId))),
  ]);

  // `sortOrder` is not reassigned on delete, so duplicates are possible. The
  // fold is order-sensitive, so break ties deterministically — otherwise the
  // same log could resolve to different badges on successive recomputes.
  const ordered = [...rows].sort(
    (a, b) =>
      a.logSortOrder - b.logSortOrder ||
      a.set.sortOrder - b.set.sortOrder ||
      a.set.createdAt.getTime() - b.set.createdAt.getTime() ||
      a.set.id.localeCompare(b.set.id),
  );

  const flags = resolveSessionPRs({
    history,
    sets: ordered.map(({ set }) => ({
      id: set.id,
      setType: set.setType,
      completed: set.completed,
      weightValue: set.loadValue != null ? Number(set.loadValue) : null,
      reps: set.reps,
    })),
  });

  await Promise.all(
    ordered
      .map(({ set }) => ({ set, next: flags.get(set.id)! }))
      .filter(({ set, next }) => set.isPrWeight !== next.isPrWeight || set.isPrReps !== next.isPrReps)
      .map(({ set, next }) =>
        db
          .update(workoutSet)
          .set({ isPrWeight: next.isPrWeight, isPrReps: next.isPrReps })
          .where(eq(workoutSet.id, set.id)),
      ),
  );

  return flags;
}

export const workoutSessionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/workout-sessions',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({
          localDate: z.string().date().optional(),
          status: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().int().positive().max(100).default(20),
        }),
        response: { 200: z.object({ items: z.array(workoutSessionSchema), nextCursor: z.string().nullable() }) },
      },
    },
    async (request) => {
      const db = getDb();
      const conditions = [eq(workoutSession.userId, request.userId!)];
      if (request.query.localDate) conditions.push(eq(workoutSession.localDate, request.query.localDate));
      if (request.query.status) conditions.push(eq(workoutSession.status, request.query.status as (typeof workoutSession.status.enumValues)[number]));
      const rows = await db
        .select()
        .from(workoutSession)
        .where(and(...conditions))
        .limit(request.query.limit);
      return { items: rows.map(toSessionResponse), nextCursor: null };
    },
  );

  fastify.post(
    '/v1/workout-sessions',
    {
      preHandler: requireAuth,
      schema: { body: createWorkoutSessionSchema, response: { 201: workoutSessionSchema } },
    },
    async (request, reply) => {
      const db = getDb();
      let sessionNameSnapshot = 'Ad hoc workout';
      if (request.body.templateId) {
        const templateRows = await db
          .select()
          .from(dayType)
          .where(eq(dayType.id, request.body.templateId))
          .limit(1);
        if (!templateRows[0]) throw badRequest('templateId does not exist');
        sessionNameSnapshot = templateRows[0].name;
      }
      const rows = await db
        .insert(workoutSession)
        .values({
          userId: request.userId!,
          templateId: request.body.templateId ?? null,
          localDate: request.body.localDate,
          timezone: request.body.timezone,
          startedAt: new Date(),
          status: 'in_progress',
          sessionNameSnapshot,
        })
        .returning();

      const session = rows[0]!;

      // Starting a workout supersedes an earlier decision to rest, so the
      // day cannot end up claiming both.
      await db
        .delete(restDay)
        .where(
          and(
            eq(restDay.userId, request.userId!),
            eq(restDay.localDate, request.body.localDate),
          ),
        );

      if (request.body.templateId) {
        const templateExercises = await db
          .select({ dayTypeExercise, exercise })
          .from(dayTypeExercise)
          .innerJoin(exercise, eq(exercise.id, dayTypeExercise.exerciseId))
          .where(eq(dayTypeExercise.dayTypeId, request.body.templateId));

        if (templateExercises.length) {
          const plannedSetRows = await db
            .select()
            .from(dayTypeExercisePlannedSet)
            .where(
              inArray(
                dayTypeExercisePlannedSet.dayTypeExerciseId,
                templateExercises.map(({ dayTypeExercise: t }) => t.id),
              ),
            )
            .orderBy(dayTypeExercisePlannedSet.sortOrder, dayTypeExercisePlannedSet.createdAt);
          const plannedSetsByExerciseId = new Map<string, (typeof plannedSetRows)[number][]>();
          for (const row of plannedSetRows) {
            const list = plannedSetsByExerciseId.get(row.dayTypeExerciseId) ?? [];
            list.push(row);
            plannedSetsByExerciseId.set(row.dayTypeExerciseId, list);
          }

          const insertedLogs = await db
            .insert(workoutExerciseLog)
            .values(
              templateExercises.map(({ dayTypeExercise: templateExercise, exercise: exerciseRow }) => ({
                sessionId: session.id,
                exerciseId: exerciseRow.id,
                exerciseNameSnapshot: exerciseRow.name,
                sortOrder: templateExercise.sortOrder,
                prescriptionSnapshot: templateExercise.prescription,
                notes: templateExercise.notes ?? null,
              })),
            )
            .returning();

          // Correlate each inserted log back to its source dayTypeExercise via
          // the (exerciseId, sortOrder) pair rather than relying on INSERT ...
          // RETURNING preserving input array order, which Postgres/Drizzle
          // don't formally guarantee.
          const templateExerciseByKey = new Map(
            templateExercises.map(({ dayTypeExercise: t, exercise: e }) => [`${e.id}::${t.sortOrder}`, t]),
          );
          const setDrafts = insertedLogs.flatMap((log) => {
            const templateExercise = templateExerciseByKey.get(`${log.exerciseId}::${log.sortOrder}`);
            const plannedSets = templateExercise ? plannedSetsByExerciseId.get(templateExercise.id) : undefined;
            if (plannedSets?.length) {
              /* Individually-specified planned sets take precedence over the
                 summary prescription when present
                 (user-experience-redesign.md §9).
       
                 **Structure only, never values** — the same rule
                 `expandPrescriptionToSetDrafts` documents at length above.
                 This branch was missed when that fix landed and kept copying
                 `reps` and `loadValue` onto the rows it created. Completion is
                 derived from whether a set carries its representation's
                 required fields, so a `sets_reps` exercise with planned sets
                 arrived at the gym already marked complete, before the user
                 had lifted anything. Reported from production against a
                 5 x 8 deadlift.
       
                 `setType` stays, because it is structure rather than
                 performance. */
              return plannedSets.map((planned, setIndex) => ({
                exerciseLogId: log.id,
                clientId: randomUUID(),
                sortOrder: setIndex,
                setType: planned.setType,
                reps: null as number | null,
                loadValue: null as string | null,
                loadUnit: planned.loadUnit,
                durationSeconds: null as number | null,
                distanceValue: null as string | null,
                distanceUnit: planned.distanceUnit,
                rpe: null,
                completed: false,
              }));
            }
            const prescription = log.prescriptionSnapshot as Prescription | null;
            if (!prescription) return [];
            return expandPrescriptionToSetDrafts(prescription).map((draft, setIndex) => ({
              exerciseLogId: log.id,
              clientId: randomUUID(),
              sortOrder: setIndex,
              setType: draft.setType,
              reps: draft.reps,
              loadValue: null,
              loadUnit: null,
              durationSeconds: draft.durationSeconds,
              distanceValue: draft.distanceValue?.toString() ?? null,
              distanceUnit: draft.distanceUnit,
              rpe: null,
              completed: false,
            }));
          });

          if (setDrafts.length) {
            await db.insert(workoutSet).values(setDrafts);
          }
        }
      }

      reply.status(201);
      return toSessionResponse(session);
    },
  );

  fastify.get(
    '/v1/workout-sessions/:sessionId',
    {
      preHandler: requireAuth,
      schema: { params: sessionParamsSchema, response: { 200: workoutSessionDetailSchema } },
    },
    async (request) => {
      const db = getDb();
      const session = await getOwnedSession(db, request.params.sessionId, request.userId!);
      const exerciseRows = await db
        .select({ log: workoutExerciseLog, exercise })
        .from(workoutExerciseLog)
        .innerJoin(exercise, eq(exercise.id, workoutExerciseLog.exerciseId))
        .where(eq(workoutExerciseLog.sessionId, request.params.sessionId));
      const setRows = await db
        .select()
        .from(workoutSet)
        .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.id, workoutSet.exerciseLogId))
        .where(eq(workoutExerciseLog.sessionId, request.params.sessionId));
      const previousSessionByExerciseId = await getPreviousCompletedSessionForExercises(
        db,
        request.userId!,
        request.params.sessionId,
        exerciseRows.map(({ log }) => log.exerciseId),
      );

      return {
        ...toSessionResponse(session),
        exercises: exerciseRows
          .sort((a, b) => a.log.sortOrder - b.log.sortOrder)
          .map(({ log, exercise: exerciseRow }) => ({
            ...toExerciseLogResponse(log),
            exercise: {
              id: exerciseRow.id,
              name: exerciseRow.name,
              isCustom: !exerciseRow.isSystem,
              ownerUserId: exerciseRow.createdByUserId,
              archivedAt: exerciseRow.archivedAt ? exerciseRow.archivedAt.toISOString() : null,
              createdAt: exerciseRow.createdAt.toISOString(),
              updatedAt: exerciseRow.updatedAt.toISOString(),
            },
            prescription: log.prescriptionSnapshot ?? null,
            sets: setRows
              .filter(({ workout_set }) => workout_set.exerciseLogId === log.id)
              .map(({ workout_set }) => toSetResponse(workout_set))
              .sort((a, b) => a.sortOrder - b.sortOrder),
            previousSession: (() => {
              const previous = previousSessionByExerciseId.get(log.exerciseId);
              if (!previous) return null;
              return {
                sessionId: previous.sessionId,
                localDate: previous.localDate,
                completedAt: previous.completedAt,
                sets: previous.sets.map((set: ReturnType<typeof toSetResponse>) => ({
                  sessionId: previous.sessionId,
                  localDate: previous.localDate,
                  completedAt: previous.completedAt,
                  setType: set.setType,
                  weightValue: set.weightValue,
                  weightUnit: set.weightUnit,
                  reps: set.reps,
                  durationSeconds: set.durationSeconds,
                  distanceValue: set.distanceValue,
                  distanceUnit: set.distanceUnit,
                  rpe: set.rpe,
                })),
              };
            })(),
          })),
      };
    },
  );

  fastify.patch(
    '/v1/workout-sessions/:sessionId',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParamsSchema,
        body: z.object({
          notes: z.string().nullable().optional(),
          status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
        }),
        response: { 200: workoutSessionSchema },
      },
    },
    async (request) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);
      const rows = await db
        .update(workoutSession)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(workoutSession.id, request.params.sessionId))
        .returning();
      return toSessionResponse(rows[0]!);
    },
  );

  /**
   * Save a performed session as a reusable workout.
   *
   * The only new backend surface Training v2 needed. This is **intent
   * authored from fact** — the reverse of the usual direction, and the reason
   * "Just start training" was a design question rather than a button.
   *
   * ADR 0005 is the constraint: this creates a NEW `day_type` and never
   * writes back into one the session started from. A session with a
   * `templateId` can still be saved this way; it produces a separate workout
   * rather than mutating the original, which is exactly the separation the
   * ADR exists to preserve.
   *
   * `day_type` has no program reference — it is keyed on `userId` alone — so
   * the saved workout needs no plan to live in, and none is created.
   */
  fastify.post(
    '/v1/workout-sessions/:sessionId/save-as-workout',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParamsSchema,
        body: saveAsWorkoutSchema,
        response: { 201: dayTypeSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);

      const rows = await db
        .select({
          logId: workoutExerciseLog.id,
          exerciseId: workoutExerciseLog.exerciseId,
          sortOrder: workoutExerciseLog.sortOrder,
          skipped: workoutExerciseLog.skipped,
          setType: workoutSet.setType,
          reps: workoutSet.reps,
          loadValue: workoutSet.loadValue,
          completed: workoutSet.completed,
        })
        .from(workoutExerciseLog)
        .leftJoin(workoutSet, eq(workoutSet.exerciseLogId, workoutExerciseLog.id))
        .where(eq(workoutExerciseLog.sessionId, request.params.sessionId))
        .orderBy(workoutExerciseLog.sortOrder, workoutSet.sortOrder);

      /* Group sets under their exercise, preserving log order. A skipped
         exercise never happened (story 34) and must not reach the template. */
      const grouped = new Map<string, { exerciseId: string; sets: { setType: string; reps: number | null; weightValue: number | null; completed: boolean }[] }>();
      for (const row of rows) {
        if (row.skipped) continue;
        const entry = grouped.get(row.logId) ?? { exerciseId: row.exerciseId, sets: [] };
        if (row.setType) {
          entry.sets.push({
            setType: row.setType,
            reps: row.reps,
            weightValue: row.loadValue == null ? null : Number(row.loadValue),
            completed: row.completed ?? true,
          });
        }
        grouped.set(row.logId, entry);
      }

      const derived = deriveWorkoutFromSession([...grouped.values()]);
      if (derived.length === 0) {
        throw badRequest('This session has no performed sets to save as a workout');
      }

      const [created] = await db
        .insert(dayType)
        .values({ userId: request.userId!, name: request.body.name })
        .returning();

      await db.insert(dayTypeExercise).values(
        derived.map((item) => ({
          dayTypeId: created!.id,
          exerciseId: item.exerciseId,
          sortOrder: item.sortOrder,
          prescription: item.prescription,
        })),
      );

      reply.status(201);
      return {
        id: created!.id,
        userId: created!.userId,
        name: created!.name,
        description: created!.description,
        estimatedDurationMinutes: created!.estimatedDurationMinutes,
        createdAt: created!.createdAt.toISOString(),
        updatedAt: created!.updatedAt.toISOString(),
        exerciseCount: derived.length,
      };
    },
  );

  fastify.post(
    '/v1/workout-sessions/:sessionId/complete',
    {
      preHandler: requireAuth,
      schema: { params: sessionParamsSchema, response: { 200: workoutSessionSchema } },
    },
    async (request) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);
      const rows = await db
        .update(workoutSession)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(workoutSession.id, request.params.sessionId))
        .returning();
      return toSessionResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-sessions/:sessionId/exercises',
    {
      preHandler: requireAuth,
      schema: {
        params: sessionParamsSchema,
        body: addExerciseLogSchema,
        response: { 201: workoutExerciseLogSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      await getOwnedSession(db, request.params.sessionId, request.userId!);
      const exerciseRows = await db
        .select()
        .from(exercise)
        .where(eq(exercise.id, request.body.exerciseId))
        .limit(1);
      if (!exerciseRows[0]) throw badRequest('exerciseId does not exist');
      const existing = await db
        .select()
        .from(workoutExerciseLog)
        .where(eq(workoutExerciseLog.sessionId, request.params.sessionId));
      const rows = await db
        .insert(workoutExerciseLog)
        .values({
          sessionId: request.params.sessionId,
          exerciseId: request.body.exerciseId,
          exerciseNameSnapshot: exerciseRows[0].name,
          notes: request.body.notes ?? null,
          prescriptionSnapshot: request.body.prescription ?? null,
          sortOrder: existing.length,
        })
        .returning();
      reply.status(201);
      return toExerciseLogResponse(rows[0]!);
    },
  );

  fastify.patch(
    '/v1/workout-exercise-logs/:id',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogParamsSchema,
        body: z.object({
          notes: z.string().nullable().optional(),
          skipped: z.boolean().optional(),
          sortOrder: z.number().int().nonnegative().optional(),
        }),
        response: { 200: workoutExerciseLogSchema },
      },
    },
    async (request) => {
      const db = getDb();
      const log = await getOwnedExerciseLog(db, request.params.id, request.userId!);

      // Story 34: the UI only offers session-only removal/undo while a
      // session is in progress — enforce that server-side too, so a
      // completed session's exercise/set counts, volume and PR history
      // can't be changed after the fact via a direct request.
      if (request.body.skipped !== undefined) {
        const session = await getOwnedSession(db, log.sessionId, request.userId!);
        if (session.status === 'completed') {
          throw badRequest('Cannot change exercise removal state on a completed session');
        }
      }

      const rows = await db
        .update(workoutExerciseLog)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(workoutExerciseLog.id, request.params.id))
        .returning();

      // Removing/restoring an exercise changes whether its sets count
      // toward PR history (see the `skipped` filters added to
      // getHistoricalSets/getPreviousCompletedSessionForExercises above),
      // so its own badges need to be resolved fresh against that history —
      // the same "recompute after any mutation" invariant every other
      // set/log mutation in this file already follows.
      if (request.body.skipped !== undefined) {
        await recalculateLogPrFlags({
          db,
          userId: request.userId!,
          exerciseId: rows[0]!.exerciseId,
          sessionId: rows[0]!.sessionId,
        });
      }

      return toExerciseLogResponse(rows[0]!);
    },
  );

  fastify.post(
    '/v1/workout-exercise-logs/:exerciseLogId/sets',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogSetsParamsSchema,
        body: createWorkoutSetSchema,
        response: { 200: workoutSetSchema, 201: workoutSetSchema },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const log = await getOwnedExerciseLog(db, request.params.exerciseLogId, request.userId!);

      const existingRows = await db
        .select()
        .from(workoutSet)
        .where(
          and(
            eq(workoutSet.exerciseLogId, request.params.exerciseLogId),
            eq(workoutSet.clientId, request.body.clientId),
          ),
        )
        .limit(1);
      if (existingRows[0]) {
        return toSetResponse(existingRows[0]);
      }

      const existing = await db
        .select()
        .from(workoutSet)
        .where(eq(workoutSet.exerciseLogId, request.params.exerciseLogId));
      /* One past the highest, NOT the row count.
      
         `existing.length` collides the moment a set has been deleted: sets at
         0, 1, 2 minus the middle one leaves 0 and 2, and the next add takes
         sortOrder 2 as well. The session reads back ordered by sortOrder, so
         two rows sharing one puts them in an arbitrary order — which is how a
         newly added set appears somewhere other than the end of the list. */
      const nextSortOrder = existing.reduce(
        (highest, row) => Math.max(highest, row.sortOrder + 1),
        0,
      );
      const rows = await db
        .insert(workoutSet)
        .values({
          exerciseLogId: request.params.exerciseLogId,
          clientId: request.body.clientId,
          sortOrder: nextSortOrder,
          setType: request.body.setType,
          loadValue: request.body.weightValue?.toString() ?? null,
          loadUnit: request.body.weightUnit ?? null,
          reps: request.body.reps ?? null,
          durationSeconds: request.body.durationSeconds ?? null,
          distanceValue: request.body.distanceValue?.toString() ?? null,
          distanceUnit: request.body.distanceUnit ?? null,
          rpe: request.body.rpe?.toString() ?? null,
          /* A set created with no values has not been performed. Storing it
             as completed marked empty rows as done the moment they appeared,
             which is the same "complete before you lifted anything" defect
             the planned-set expansion had. Completion for display is derived
             from field presence, so this column only has to stop lying. */
          completed: hasPerformedValue(request.body),
          isPrWeight: false,
          isPrReps: false,
          notes: null,
        })
        .returning();

      const flags = await recalculateLogPrFlags({
        db,
        userId: request.userId!,
        exerciseId: log.exerciseId,
        sessionId: log.sessionId,
      });
      reply.status(201);
      return toSetResponse({ ...rows[0]!, ...(flags.get(rows[0]!.id) ?? {}) });
    },
  );

  fastify.patch(
    '/v1/workout-sets/:setId',
    {
      preHandler: requireAuth,
      schema: {
        params: setParamsSchema,
        body: createWorkoutSetSchema.partial().omit({ clientId: true }),
        response: { 200: workoutSetSchema },
      },
    },
    async (request) => {
      const db = getDb();
      const ownedSet = await getOwnedSet(db, request.params.setId, request.userId!);
      const nextSetType = (request.body.setType ?? ownedSet.set.setType) as LoggedSetType;
      const rows = await db
        .update(workoutSet)
        .set({
          setType: nextSetType,
          /* Absent leaves the stored value alone; an explicit null clears it.
             `??` alone conflated the two, which made an optional value
             impossible to remove once set. */
          loadValue: pickNumeric(request.body, 'weightValue', request.body.weightValue, ownedSet.set.loadValue),
          loadUnit: pick(request.body, 'weightUnit', request.body.weightUnit, ownedSet.set.loadUnit),
          reps: pick(request.body, 'reps', request.body.reps, ownedSet.set.reps),
          durationSeconds: pick(request.body, 'durationSeconds', request.body.durationSeconds, ownedSet.set.durationSeconds),
          distanceValue: pickNumeric(request.body, 'distanceValue', request.body.distanceValue, ownedSet.set.distanceValue),
          distanceUnit: pick(request.body, 'distanceUnit', request.body.distanceUnit, ownedSet.set.distanceUnit),
          rpe: pickNumeric(request.body, 'rpe', request.body.rpe, ownedSet.set.rpe),
          // Saving a set is the act of logging it, so an edit marks it
          // performed unless the client says otherwise. Without this, sets
          // seeded from a program would stay `completed: false` forever and
          // never become PR-eligible.
          completed: request.body.completed ?? true,
          updatedAt: new Date(),
        })
        .where(eq(workoutSet.id, request.params.setId))
        .returning();

      const flags = await recalculateLogPrFlags({
        db,
        userId: request.userId!,
        exerciseId: ownedSet.log.exerciseId,
        sessionId: ownedSet.log.sessionId,
      });
      return toSetResponse({ ...rows[0]!, ...(flags.get(request.params.setId) ?? {}) });
    },
  );

  /**
   * Quick Log — write one set of exercise-level values across several sets.
   *
   * Story 59. Replaces N sequential client PATCHes, which serialised the user
   * behind the network for the most common case in the product: an exercise
   * whose planned sets all share the same weight and reps.
   *
   * Three properties worth stating, because each is load-bearing:
   *
   * - **Idempotent.** These rows already exist (session start creates one per
   *   planned set), so this only ever updates. Repeating the request converges
   *   rather than duplicating, which is what makes a double tap in a gym
   *   harmless without a dedup token.
   * - **Ownership is checked per set, not just on the log.** A caller could
   *   otherwise pass set ids belonging to someone else's log alongside their
   *   own; every id must resolve to *this* log.
   * - **PR flags recalculate once, after all writes.** Doing it per set would
   *   compute flags against a half-written exercise and be both wrong and N
   *   times more work.
   */
  fastify.post(
    '/v1/workout-exercise-logs/:exerciseLogId/quick-log',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogSetsParamsSchema,
        body: quickLogSetsSchema,
        response: { 200: z.array(workoutSetSchema) },
      },
    },
    async (request) => {
      const db = getDb();
      const log = await getOwnedExerciseLog(db, request.params.exerciseLogId, request.userId!);

      const existing = await db
        .select()
        .from(workoutSet)
        .where(eq(workoutSet.exerciseLogId, log.id));
      const byId = new Map(existing.map((row) => [row.id, row]));

      const targets = request.body.setIds.map((setId) => {
        const row = byId.get(setId);
        // Not `forbidden`: from this log's perspective the set does not exist,
        // and saying which of the two it is would leak whether it exists at all.
        if (!row) throw notFound('Set not found on this exercise');
        return row;
      });

      const { values } = request.body;
      const updated = [];
      for (const row of targets) {
        const rows = await db
          .update(workoutSet)
          .set({
            /* Absent means "not part of this representation", so the stored
               value is kept rather than nulled — a bodyweight quick log must
               not wipe a weight someone entered by hand. `setType` is never
               touched: it is per-set by definition. */
            loadValue: values.weightValue?.toString() ?? row.loadValue,
            loadUnit: values.weightUnit ?? row.loadUnit,
            reps: values.reps ?? row.reps,
            durationSeconds: values.durationSeconds ?? row.durationSeconds,
            distanceValue: values.distanceValue?.toString() ?? row.distanceValue,
            distanceUnit: values.distanceUnit ?? row.distanceUnit,
            // Quick Log *is* the act of logging, so these become performed —
            // the same rule the single-set PATCH applies.
            completed: true,
            updatedAt: new Date(),
          })
          .where(eq(workoutSet.id, row.id))
          .returning();
        updated.push(rows[0]!);
      }

      const flags = await recalculateLogPrFlags({
        db,
        userId: request.userId!,
        exerciseId: log.exerciseId,
        sessionId: log.sessionId,
      });
      return updated.map((row) => toSetResponse({ ...row, ...(flags.get(row.id) ?? {}) }));
    },
  );

  fastify.delete(
    '/v1/workout-sets/:setId',
    {
      preHandler: requireAuth,
      schema: { params: setParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const db = getDb();
      const ownedSet = await getOwnedSet(db, request.params.setId, request.userId!);
      await db.delete(workoutSet).where(eq(workoutSet.id, request.params.setId));
      // Removing a set can hand a record back to an earlier one.
      await recalculateLogPrFlags({
        db,
        userId: request.userId!,
        exerciseId: ownedSet.log.exerciseId,
        sessionId: ownedSet.log.sessionId,
      });
      reply.status(204);
      return null;
    },
  );

  fastify.post(
    '/v1/workout-exercise-logs/:exerciseLogId/sets/reorder',
    {
      preHandler: requireAuth,
      schema: {
        params: exerciseLogSetsParamsSchema,
        body: z.object({ setIdsInOrder: z.array(z.string().uuid()) }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      const db = getDb();
      const log = await getOwnedExerciseLog(db, request.params.exerciseLogId, request.userId!);
      await Promise.all(
        request.body.setIdsInOrder.map((setId, index) =>
          db
            .update(workoutSet)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(and(eq(workoutSet.id, setId), eq(workoutSet.exerciseLogId, request.params.exerciseLogId))),
        ),
      );
      // PRs are order-dependent, so a reorder can move a badge to another set.
      await recalculateLogPrFlags({
        db,
        userId: request.userId!,
        exerciseId: log.exerciseId,
        sessionId: log.sessionId,
      });
      return { ok: true as const };
    },
  );
};
