import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { progressConsistencyWeekSchema, progressOverviewResponseSchema } from '@setframe/schemas';
import type { Prescription } from '@setframe/schemas';
import {
  completionRatio,
  computeWeightTrend,
  getPrescriptionDefinition,
  plannedDaysForWeek,
  getProgressMetricKeys,
  summarizeConsistency,
  summarizeExerciseSets,
  summarizeTrainingTrends,
  weekStart,
  type DistanceUnit,
  type LoadUnit,
  type ProgressSet,
} from '@setframe/domain';
import {
  dailyManualEntry,
  exercise,
  programScheduleSlot,
  programVersion,
  restDay,
  trainingProgram,
  workoutExerciseLog,
  workoutSession,
  workoutSet,
} from '@setframe/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

/**
 * Week start for a `Date`. The shared `weekStart` takes a calendar-date
 * string; this only adapts the argument, so the boundary itself still has
 * exactly one definition (`packages/domain/src/week.ts`).
 */
function weekStartOfDate(date: Date): string {
  return weekStart(date.toISOString().slice(0, 10));
}

/**
 * Computes the "since" cutoff date-string for a "last N weeks" window.
 * Accepts an optional client-supplied `localDate` (the requesting user's
 * current local calendar date, e.g. "2025-08-22") so the boundary reflects
 * the user's actual "today" rather than the server's UTC clock — the same
 * pattern used by /dashboard/today and /me/daily-entries/:localDate.
 * Falls back to server UTC "today" only if the client omits it (e.g. older
 * clients not yet updated), which can drift by up to a day for users far
 * from UTC.
 */
function sinceLocalDateFor(weeksBack: number, localDate?: string): string {
  const base = localDate ? new Date(`${localDate}T00:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() - weeksBack * 7);
  return base.toISOString().slice(0, 10);
}

function todayLocalDate(localDate?: string): string {
  return localDate ?? new Date().toISOString().slice(0, 10);
}

function toNumber(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * GET /v1/progress/overview — backs the Progress screen.
 *
 * Every number returned here is either a real series with dates and units,
 * or an explicit "not enough data" state. Two rules are load-bearing:
 *
 * 1. Metrics are computed from the exercise's own prescription snapshot via
 *    `summarizeExerciseSets`, so a cycling activity simply has no 1RM key
 *    rather than a 0. An applicable metric with no data is `null`.
 * 2. Weekly volume only counts prescriptions where weight x reps means
 *    something (`countsTowardVolume`). A week of cardio reports `null`
 *    volume, not 0, so it does not read as a failed week.
 *
 * 3. `plannedCount` comes from the active program version's schedule slots,
 *    using the same day-of-week/cycle rule as `dashboard.ts`'s
 *    `resolveScheduledDayType`, so the ratio can never disagree with the
 *    user's own calendar. A week the program did not cover reports `null`,
 *    never `0` — before a plan existed there was nothing to fall short of.
 */
export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/progress/overview',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({
          /* Capped at five years rather than one: Story 50's Y range needs 53
             weeks to cover a full year plus the partial current one, and ALL
             needs to reach whatever history exists. The cost is bounded by
             how much the user has actually logged, not by the cap. */
          weeks: z.coerce.number().int().positive().max(260).default(12),
          localDate: z.string().date().optional(),
        }),
        response: { 200: progressOverviewResponseSchema },
      },
    },
    async (request) => {
      const db = getDb();
      const windowWeeks = request.query.weeks;
      const endLocalDate = todayLocalDate(request.query.localDate);
      const sinceLocalDate = sinceLocalDateFor(windowWeeks, request.query.localDate);

      const setRows = await db
        .select({
          sessionId: workoutSession.id,
          localDate: workoutSession.localDate,
          completedAt: workoutSession.completedAt,
          sessionName: workoutSession.sessionNameSnapshot,
          logId: workoutExerciseLog.id,
          exerciseId: workoutExerciseLog.exerciseId,
          exerciseName: workoutExerciseLog.exerciseNameSnapshot,
          prescription: workoutExerciseLog.prescriptionSnapshot,
          setId: workoutSet.id,
          setType: workoutSet.setType,
          completed: workoutSet.completed,
          loadValue: workoutSet.loadValue,
          loadUnit: workoutSet.loadUnit,
          reps: workoutSet.reps,
          durationSeconds: workoutSet.durationSeconds,
          distanceValue: workoutSet.distanceValue,
          distanceUnit: workoutSet.distanceUnit,
          isPrWeight: workoutSet.isPrWeight,
          isPrReps: workoutSet.isPrReps,
          /* Read live from `exercise`, deliberately *not* snapshotted onto the
             log row like name and prescription are. ADR 0005 snapshots the
             things that describe what the session *was* — rename a template
             later and an old session must still render as it happened. A
             movement pattern is not that: it is a taxonomy label on the
             exercise itself, and correcting a mislabelled squat should
             reclassify its whole history, which is the behaviour a user
             fixing a typo expects. */
          movementPattern: exercise.movementPattern,
        })
        .from(workoutSession)
        .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.sessionId, workoutSession.id))
        .innerJoin(workoutSet, eq(workoutSet.exerciseLogId, workoutExerciseLog.id))
        .leftJoin(exercise, eq(exercise.id, workoutExerciseLog.exerciseId))
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
            gte(workoutSession.localDate, sinceLocalDate),
            // Story 34: an exercise removed from its session never happened,
            // so it can't contribute to a trend.
            eq(workoutExerciseLog.skipped, false),
          ),
        )
        .orderBy(workoutSession.localDate, workoutSession.completedAt, workoutSet.sortOrder);

      type Row = (typeof setRows)[number];

      const toProgressSet = (row: Row): ProgressSet => ({
        setType: row.setType,
        completed: row.completed,
        loadValue: toNumber(row.loadValue),
        loadUnit: (row.loadUnit as LoadUnit | null) ?? null,
        reps: row.reps,
        durationSeconds: row.durationSeconds,
        distanceValue: toNumber(row.distanceValue),
        distanceUnit: (row.distanceUnit as DistanceUnit | null) ?? null,
      });

      // Sessions first, so the training window is built from sessions that
      // exist rather than from sessions that happen to contain sets.
      const sessionMeta = new Map<
        string,
        {
          sessionId: string;
          localDate: string;
          completedAt: string | null;
          sessionName: string;
          exerciseIds: Set<string>;
          setCount: number;
          volume: number | null;
          prCount: number;
        }
      >();

      // Keyed by `${exerciseId}:${sessionId}` so an exercise logged twice in
      // one session is summarised once, not split into two points.
      const exerciseSessionRows = new Map<string, Row[]>();

      /** `weekStart` → `movementPattern` → volume. */
      const compositionWeeks = new Map<string, Map<string, number>>();
      let unclassifiedVolume = 0;
      const unclassifiedExerciseIds = new Set<string>();

      for (const row of setRows) {
        const meta = sessionMeta.get(row.sessionId) ?? {
          sessionId: row.sessionId,
          localDate: row.localDate,
          completedAt: row.completedAt ? row.completedAt.toISOString() : null,
          sessionName: row.sessionName,
          exerciseIds: new Set<string>(),
          setCount: 0,
          volume: null,
          prCount: 0,
        };
        meta.exerciseIds.add(row.exerciseId);
        meta.setCount += 1;
        if (row.isPrWeight || row.isPrReps) meta.prCount += 1;

        // Volume is only meaningful where the prescription says load x reps
        // is a real quantity; cardio and bodyweight work contribute nothing
        // rather than contributing a zero.
        const definition = getPrescriptionDefinition(row.prescription as Prescription | null);
        if (definition.countsTowardVolume && row.completed) {
          const load = toNumber(row.loadValue);
          if (load != null && row.reps != null) {
            meta.volume = (meta.volume ?? 0) + load * row.reps;
          }
        }
        sessionMeta.set(row.sessionId, meta);

        /* Composition uses the identical volume rule as the session total
           above — same `countsTowardVolume` gate, same `completed` gate, same
           load x reps. That is not incidental: the stacked chart's promise is
           that its segments sum to the week's volume, and two subtly
           different rules would break that silently, in a way no test of
           either number alone would catch. */
        if (definition.countsTowardVolume && row.completed) {
          const load = toNumber(row.loadValue);
          if (load != null && row.reps != null) {
            const contribution = load * row.reps;
            const week = weekStart(row.localDate);
            const pattern = row.movementPattern?.trim();
            if (pattern) {
              const byPattern = compositionWeeks.get(week) ?? new Map<string, number>();
              byPattern.set(pattern, (byPattern.get(pattern) ?? 0) + contribution);
              compositionWeeks.set(week, byPattern);
            } else {
              unclassifiedVolume += contribution;
              unclassifiedExerciseIds.add(row.exerciseId);
            }
          }
        }

        const key = `${row.exerciseId}:${row.sessionId}`;
        exerciseSessionRows.set(key, [...(exerciseSessionRows.get(key) ?? []), row]);
      }

      const sessions = [...sessionMeta.values()];

      const restRows = await db
        .select({ localDate: restDay.localDate })
        .from(restDay)
        .where(
          and(eq(restDay.userId, request.userId!), gte(restDay.localDate, sinceLocalDate)),
        );

      /* The user's first-ever completed session, deliberately *not* bounded by
         `sinceLocalDate`. This answers "had they started logging by then",
         which bounds where a chart may honestly draw an empty period as zero
         — so it has to be able to predate the requested window. Reading it
         from `sessions` instead would pin it to the window's own start and
         make every range look like the user began at its left edge. */
      const [firstSessionRow] = await db
        .select({ localDate: workoutSession.localDate })
        .from(workoutSession)
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
          ),
        )
        .orderBy(workoutSession.localDate)
        .limit(1);

      /* The active program's schedule, for planned-vs-actual. Same selection
         rule as dashboard.ts: the active program, its highest version. */
      const [activeProgram] = await db
        .select({
          id: trainingProgram.id,
          startDate: trainingProgram.startDate,
          cycleLengthWeeks: trainingProgram.cycleLengthWeeks,
        })
        .from(trainingProgram)
        .where(
          and(eq(trainingProgram.userId, request.userId!), eq(trainingProgram.isActive, true)),
        )
        .limit(1);

      let scheduleSlots: { dayIndex: number; weekNumber: number | null }[] = [];
      let effectiveFrom: string | null = null;
      let effectiveTo: string | null = null;
      if (activeProgram) {
        const versions = await db
          .select({
            id: programVersion.id,
            versionNumber: programVersion.versionNumber,
            effectiveFrom: programVersion.effectiveFrom,
            effectiveTo: programVersion.effectiveTo,
          })
          .from(programVersion)
          .where(eq(programVersion.trainingProgramId, activeProgram.id));
        const version = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
        if (version) {
          effectiveFrom = version.effectiveFrom;
          effectiveTo = version.effectiveTo;
          scheduleSlots = await db
            .select({
              dayIndex: programScheduleSlot.dayIndex,
              weekNumber: programScheduleSlot.weekNumber,
            })
            .from(programScheduleSlot)
            .where(eq(programScheduleSlot.programVersionId, version.id));
        }
      }

      const trends = summarizeTrainingTrends(
        sessions.map((session) => ({ localDate: session.localDate, volume: session.volume })),
        endLocalDate,
        windowWeeks,
        {
          restDates: restRows.map((row) => row.localDate),
          firstActivityDate: firstSessionRow?.localDate ?? null,
        },
      );

      const exerciseMap = new Map<
        string,
        {
          exerciseId: string;
          exerciseName: string;
          prescriptionKind: string;
          metricKeys: string[];
          points: {
            sessionId: string;
            localDate: string;
            sessionName: string;
            metrics: {
              key: string;
              value: number | null;
              loadUnit?: LoadUnit;
              distanceUnit?: DistanceUnit;
            }[];
            isWeightPr: boolean;
            isRepPr: boolean;
          }[];
        }
      >();

      for (const rows of exerciseSessionRows.values()) {
        const first = rows[0]!;
        const prescription = first.prescription as Prescription | null;
        const definition = getPrescriptionDefinition(prescription);
        const metrics = summarizeExerciseSets(rows.map(toProgressSet), prescription);

        const entry = exerciseMap.get(first.exerciseId) ?? {
          exerciseId: first.exerciseId,
          // Snapshots can drift if an exercise is renamed; the most recent
          // session wins because rows arrive in date order.
          exerciseName: first.exerciseName,
          prescriptionKind: definition.kind,
          metricKeys: [...getProgressMetricKeys(prescription)],
          points: [],
        };
        entry.exerciseName = first.exerciseName;
        entry.points.push({
          sessionId: first.sessionId,
          localDate: first.localDate,
          sessionName: first.sessionName,
          metrics,
          isWeightPr: rows.some((row) => row.isPrWeight),
          isRepPr: rows.some((row) => row.isPrReps),
        });
        exerciseMap.set(first.exerciseId, entry);
      }

      const exercises = [...exerciseMap.values()]
        .map((entry) => ({
          ...entry,
          points: entry.points.sort((a, b) => a.localDate.localeCompare(b.localDate)),
          sessionCount: entry.points.length,
        }))
        .sort((a, b) => b.sessionCount - a.sessionCount || a.exerciseName.localeCompare(b.exerciseName));

      const bodyWeightRows = await db
        .select({
          localDate: dailyManualEntry.localDate,
          weightValue: dailyManualEntry.morningWeightValue,
          weightUnit: dailyManualEntry.morningWeightUnit,
        })
        .from(dailyManualEntry)
        .where(
          and(
            eq(dailyManualEntry.userId, request.userId!),
            gte(dailyManualEntry.localDate, sinceLocalDate),
          ),
        )
        .orderBy(dailyManualEntry.localDate);

      const weightTrend = computeWeightTrend(
        bodyWeightRows.flatMap((row) => {
          const value = toNumber(row.weightValue);
          if (value == null || value <= 0 || row.weightUnit == null) return [];
          return [{ localDate: row.localDate, weightValue: value, weightUnit: row.weightUnit as LoadUnit }];
        }),
      );

      // Volume is reported in pounds because that is the unit load is stored
      // and displayed in across the app today; per-set unit normalisation
      // happens inside summarizeExerciseSets for the per-exercise metrics.
      const volumeUnit: LoadUnit = 'lb';

      /* Composition weeks mirror `trends.weeks` exactly rather than being
         derived from whichever weeks happen to contain volume. A stacked bar
         chart drawn over a sparse week list silently closes its own gaps, so
         three trained weeks either side of a month off render as six
         consecutive weeks of training — the absence, which is the most
         informative thing in the window, disappears. */
      const compositionByWeek = trends.weeks.map((week) => {
        const byPattern = compositionWeeks.get(week.weekStart);
        const values: Record<string, number> = {};
        let total = 0;
        if (byPattern) {
          for (const [pattern, value] of byPattern) {
            if (value > 0) {
              values[pattern] = value;
              total += value;
            }
          }
        }
        return { weekStart: week.weekStart, values, total, isCurrent: week.isCurrent };
      });

      const patternTotals = new Map<string, number>();
      for (const byPattern of compositionWeeks.values()) {
        for (const [pattern, value] of byPattern) {
          patternTotals.set(pattern, (patternTotals.get(pattern) ?? 0) + value);
        }
      }
      const classifiedTotal = [...patternTotals.values()].reduce((sum, value) => sum + value, 0);
      const patterns = [...patternTotals.entries()]
        .filter(([, total]) => total > 0)
        .map(([key, total]) => ({
          key,
          total,
          share: classifiedTotal > 0 ? total / classifiedTotal : 0,
        }))
        .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

      const weeksWithPlan = trends.weeks.map((week) => {
        const plannedCount = plannedDaysForWeek({
          weekStart: week.weekStart,
          slots: scheduleSlots,
          cycleLengthWeeks: activeProgram?.cycleLengthWeeks ?? null,
          programStartDate: activeProgram?.startDate ?? null,
          effectiveFrom,
          effectiveTo,
        });
        return {
          ...week,
          plannedCount,
          completionRatio: completionRatio(week.completedCount, plannedCount),
        };
      });

      return {
        training: {
          weeks: weeksWithPlan,
          days: trends.days,
          firstActivityDate: trends.firstActivityDate,
          weeksTrained: trends.weeksTrained,
          windowWeeks: trends.windowWeeks,
          currentStreakWeeks: trends.currentStreakWeeks,
          longestStreakWeeks: trends.longestStreakWeeks,
          totalCompleted: trends.totalCompleted,
          totalRestDays: trends.totalRestDays,
          averageSessionsPerWeek: trends.averageSessionsPerWeek,
          volumeUnit,
        },
        bodyWeight: {
          unit: weightTrend.unit,
          sufficiency: weightTrend.sufficiency,
          checkInCount: weightTrend.checkInCount,
          currentAverage: weightTrend.currentAverage,
          latestCheckIn: weightTrend.latestCheckIn
            ? {
                localDate: weightTrend.latestCheckIn.localDate,
                weightValue: weightTrend.latestCheckIn.weightValue,
              }
            : null,
          ratePerWeek: weightTrend.ratePerWeek,
          direction: weightTrend.direction,
          windowWeeks: weightTrend.windowWeeks,
          points: weightTrend.points,
          weeks: weightTrend.weeks,
        },
        composition: {
          unit: volumeUnit,
          patterns,
          weeks: compositionByWeek,
          unclassifiedTotal: unclassifiedVolume,
          unclassifiedExerciseCount: unclassifiedExerciseIds.size,
        },
        exercises,
        recentSessions: sessions
          .sort((a, b) => (b.completedAt ?? b.localDate).localeCompare(a.completedAt ?? a.localDate))
          .slice(0, 5)
          .map((session) => ({
            sessionId: session.sessionId,
            localDate: session.localDate,
            completedAt: session.completedAt,
            sessionName: session.sessionName,
            exerciseCount: session.exerciseIds.size,
            setCount: session.setCount,
            volume: session.volume,
            prCount: session.prCount,
          })),
      };
    },
  );

  fastify.get(
    '/v1/progress/consistency',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({
          weeks: z.coerce.number().int().positive().max(52).default(8),
          localDate: z.string().date().optional(),
        }),
        response: {
          200: z.array(progressConsistencyWeekSchema),
        },
      },
    },
    async (request) => {
      const db = getDb();
      const weeksBack = request.query.weeks;
      const sinceLocalDate = sinceLocalDateFor(weeksBack, request.query.localDate);

      const sessions = await db
        .select()
        .from(workoutSession)
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
            gte(workoutSession.localDate, sinceLocalDate),
          ),
        );

      const completedByWeek = new Map<string, number>();
      for (const session of sessions) {
        const week = weekStartOfDate(new Date(session.localDate));
        completedByWeek.set(week, (completedByWeek.get(week) ?? 0) + 1);
      }

      const weeks = Array.from(completedByWeek.entries()).map(([weekStart, completedCount]) => ({
        weekStart,
        plannedCount: 0,
        completedCount,
      }));

      return summarizeConsistency(weeks);
    },
  );
};
