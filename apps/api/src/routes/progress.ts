import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, desc, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { progressConsistencyWeekSchema, progressOverviewResponseSchema } from '@setframe/schemas';
import { calculateVolume, estimateOneRepMax, summarizeConsistency } from '@setframe/domain';
import { dailyManualEntry, workoutExerciseLog, workoutSession, workoutSet } from '@setframe/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

function isoWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
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

/**
 * GET /v1/progress/consistency — backs the Progress screen's "Consistency
 * (last N weeks)" widget (docs/api.md "Progress", data-model.md §8
 * decision 4). Computed on read from workout_session rows; uses
 * summarizeConsistency from packages/domain for the shaping/ratio logic.
 *
 * TODO(phase-4): derive `plannedCount` from the active program_version's
 * workout_template count per week (currently 0 — completed-only until
 * program-activation querying lands).
 */
export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/progress/overview',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({
          weeks: z.coerce.number().int().positive().max(52).default(8),
          localDate: z.string().date().optional(),
        }),
        response: { 200: progressOverviewResponseSchema },
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
        )
        .orderBy(workoutSession.localDate, workoutSession.completedAt);

      const completedByWeek = new Map<string, number>();
      for (const session of sessions) {
        const week = isoWeekStart(new Date(session.localDate));
        completedByWeek.set(week, (completedByWeek.get(week) ?? 0) + 1);
      }

      const rawWeeks = Array.from(completedByWeek.entries()).map(([weekStart, completedCount]) => ({
        weekStart,
        plannedCount: completedCount,
        completedCount,
      }));
      const weeks = summarizeConsistency(rawWeeks).map((week) => ({
        weekStart: week.weekStart,
        plannedCount: week.plannedCount,
        completedCount: week.completedCount,
        completionRatio: week.completionRatio,
      }));

      const totalCompleted = weeks.reduce((sum, week) => sum + week.completedCount, 0);
      const totalPlanned = weeks.reduce((sum, week) => sum + week.plannedCount, 0);
      let currentStreakWeeks = 0;
      let longestStreakWeeks = 0;
      let runningStreak = 0;
      for (const week of weeks) {
        if (week.completedCount > 0) {
          runningStreak += 1;
          longestStreakWeeks = Math.max(longestStreakWeeks, runningStreak);
        } else {
          runningStreak = 0;
        }
      }
      for (let index = weeks.length - 1; index >= 0; index -= 1) {
        if (weeks[index]!.completedCount > 0) currentStreakWeeks += 1;
        else break;
      }

      const sessionRows = await db
        .select({
          sessionId: workoutSession.id,
          localDate: workoutSession.localDate,
          completedAt: workoutSession.completedAt,
          sessionName: workoutSession.sessionNameSnapshot,
          exerciseId: workoutExerciseLog.exerciseId,
          exerciseName: workoutExerciseLog.exerciseNameSnapshot,
          setId: workoutSet.id,
          loadValue: workoutSet.loadValue,
          reps: workoutSet.reps,
          isPrWeight: workoutSet.isPrWeight,
          isPrReps: workoutSet.isPrReps,
        })
        .from(workoutSession)
        .innerJoin(workoutExerciseLog, eq(workoutExerciseLog.sessionId, workoutSession.id))
        .innerJoin(workoutSet, eq(workoutSet.exerciseLogId, workoutExerciseLog.id))
        .where(
          and(
            eq(workoutSession.userId, request.userId!),
            eq(workoutSession.status, 'completed'),
            gte(workoutSession.localDate, sinceLocalDate),
          ),
        )
        .orderBy(workoutSession.localDate, workoutSession.completedAt, workoutSet.sortOrder);

      const weeklyVolumeMap = new Map<string, number>();
      const exerciseSessions = new Map<string, Array<{
        sessionId: string;
        localDate: string;
        sessionName: string;
        topWeight: number | null;
        topReps: number | null;
        estimatedOneRepMax: number | null;
        volume: number;
        isWeightPr: boolean;
        isRepPr: boolean;
      }>>();
      const recentSessionMap = new Map<string, {
        sessionId: string; localDate: string; completedAt: string | null; sessionName: string; exerciseIds: Set<string>; setCount: number; volume: number; prCount: number;
      }>();

      for (const row of sessionRows) {
        const week = isoWeekStart(new Date(row.localDate));
        const setVolume = row.loadValue != null && row.reps != null ? Number(row.loadValue) * row.reps : 0;
        weeklyVolumeMap.set(week, (weeklyVolumeMap.get(week) ?? 0) + setVolume);

        const recent = recentSessionMap.get(row.sessionId) ?? {
          sessionId: row.sessionId,
          localDate: row.localDate,
          completedAt: row.completedAt ? row.completedAt.toISOString() : null,
          sessionName: row.sessionName,
          exerciseIds: new Set<string>(),
          setCount: 0,
          volume: 0,
          prCount: 0,
        };
        recent.exerciseIds.add(row.exerciseId);
        recent.setCount += 1;
        recent.volume += setVolume;
        if (row.isPrWeight || row.isPrReps) recent.prCount += 1;
        recentSessionMap.set(row.sessionId, recent);
      }

      const groupedByExerciseSession = new Map<string, typeof sessionRows>();
      for (const row of sessionRows) {
        const key = `${row.exerciseId}:${row.sessionId}`;
        const list = groupedByExerciseSession.get(key) ?? [];
        list.push(row);
        groupedByExerciseSession.set(key, list);
      }
      for (const rows of groupedByExerciseSession.values()) {
        const sorted = [...rows];
        const topStrengthSet = sorted.reduce<(typeof sorted)[number] | null>((best, row) => {
          if (row.loadValue == null || row.reps == null) return best;
          const estimate = estimateOneRepMax(Number(row.loadValue), row.reps);
          if (!best) return row;
          const bestEstimate = estimateOneRepMax(Number(best.loadValue!), best.reps!);
          return estimate > bestEstimate ? row : best;
        }, null);
        const point = {
          sessionId: sorted[0]!.sessionId,
          localDate: sorted[0]!.localDate,
          sessionName: sorted[0]!.sessionName,
          topWeight: topStrengthSet?.loadValue != null ? Number(topStrengthSet.loadValue) : null,
          topReps: topStrengthSet?.reps ?? null,
          estimatedOneRepMax:
            topStrengthSet?.loadValue != null && topStrengthSet.reps != null
              ? Math.round(estimateOneRepMax(Number(topStrengthSet.loadValue), topStrengthSet.reps))
              : null,
          volume: calculateVolume(sorted.map((row) => ({
            weightValue: row.loadValue != null ? Number(row.loadValue) : null,
            reps: row.reps,
          }))),
          isWeightPr: sorted.some((row) => row.isPrWeight),
          isRepPr: sorted.some((row) => row.isPrReps),
        };
        const list = exerciseSessions.get(sorted[0]!.exerciseId) ?? [];
        list.push(point);
        exerciseSessions.set(sorted[0]!.exerciseId, list);
      }

      const featuredExerciseEntry = [...exerciseSessions.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? null;
      const featuredExercise = featuredExerciseEntry
        ? (() => {
            const exerciseId = featuredExerciseEntry[0];
            const points = featuredExerciseEntry[1].sort((a, b) => a.localDate.localeCompare(b.localDate));
            const name = sessionRows.find((row) => row.exerciseId === exerciseId)?.exerciseName ?? 'Exercise';
            if (points.length < 2) {
              return { exerciseId, exerciseName: name, trendLabel: null, points: points.slice(-8) };
            }
            const first = points[0]!.estimatedOneRepMax;
            const last = points[points.length - 1]!.estimatedOneRepMax;
            const trendLabel = first != null && last != null ? `${last >= first ? '+' : ''}${last - first} lb over ${points.length} sessions` : null;
            return { exerciseId, exerciseName: name, trendLabel, points: points.slice(-8) };
          })()
        : null;

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

      const bodyWeightPoints = bodyWeightRows
        .filter((row) => row.weightValue != null && row.weightUnit != null)
        .map((row) => ({
          localDate: row.localDate,
          weightValue: Number(row.weightValue),
          weightUnit: row.weightUnit!,
        }));
      const bodyWeightTrendLabel =
        bodyWeightPoints.length >= 2
          ? `${bodyWeightPoints.at(-1)!.weightValue >= bodyWeightPoints[0]!.weightValue ? '+' : ''}${(
              bodyWeightPoints.at(-1)!.weightValue - bodyWeightPoints[0]!.weightValue
            ).toFixed(1)} ${bodyWeightPoints.at(-1)!.weightUnit} over ${bodyWeightPoints.length} check-ins`
          : null;

      const weeklyVolume = weeks.map((week) => weeklyVolumeMap.get(week.weekStart) ?? 0);
      const averageWeeklySessions = weeks.length ? totalCompleted / weeks.length : 0;
      const latestWeek = weeks.at(-1)?.completedCount ?? 0;
      const previousWeek = weeks.at(-2)?.completedCount ?? 0;
      const cards: {
        key: string;
        label: string;
        value: string;
        detail: string | null;
        trend: number[];
        status: 'neutral' | 'positive' | 'informational';
      }[] = [
        {
          key: 'weekly-sessions',
          label: 'Sessions this week',
          value: String(latestWeek),
          detail: weeks.length > 1 ? `${latestWeek - previousWeek >= 0 ? '+' : ''}${latestWeek - previousWeek} vs last week` : null,
          trend: weeks.map((week) => week.completedCount),
          status: latestWeek >= previousWeek ? 'positive' : 'neutral' as const,
        },
        {
          key: 'consistency-streak',
          label: 'Current streak',
          value: `${currentStreakWeeks} week${currentStreakWeeks === 1 ? '' : 's'}`,
          detail: longestStreakWeeks ? `Longest streak: ${longestStreakWeeks} weeks` : null,
          trend: weeks.map((week) => week.completedCount > 0 ? 1 : 0),
          status: currentStreakWeeks > 0 ? 'positive' : 'informational' as const,
        },
        {
          key: 'weekly-volume',
          label: 'Weekly volume',
          value: `${(weeklyVolume.at(-1) ?? 0).toLocaleString()} lb`,
          detail: weeklyVolume.some((value) => value > 0) ? `${Math.round(weeklyVolume.reduce((sum, value) => sum + value, 0) / Math.max(weeklyVolume.length, 1)).toLocaleString()} lb avg` : null,
          trend: weeklyVolume,
          status: 'informational' as const,
        },
        {
          key: 'body-weight',
          label: 'Body weight',
          value: bodyWeightPoints.at(-1) ? `${bodyWeightPoints.at(-1)!.weightValue.toFixed(1)} ${bodyWeightPoints.at(-1)!.weightUnit}` : 'No check-ins',
          detail: bodyWeightTrendLabel,
          trend: bodyWeightPoints.slice(-8).map((point) => point.weightValue),
          status: 'neutral' as const,
        },
        {
          key: 'strength-trend',
          label: featuredExercise ? `${featuredExercise.exerciseName} est. 1RM` : 'Strength trend',
          value:
            featuredExercise?.points.at(-1)?.estimatedOneRepMax != null
              ? `${featuredExercise.points.at(-1)!.estimatedOneRepMax} lb`
              : 'Need more strength sets',
          detail: featuredExercise?.trendLabel ?? null,
          trend: featuredExercise?.points.map((point) => point.estimatedOneRepMax ?? 0) ?? [],
          status: featuredExercise?.trendLabel ? 'positive' as const : 'informational' as const,
        },
      ];

      return {
        cards,
        consistency: {
          weeks,
          summary: {
            currentStreakWeeks,
            longestStreakWeeks,
            totalCompleted,
            totalPlanned,
          },
        },
        bodyWeight: {
          points: bodyWeightPoints,
          trendLabel: bodyWeightTrendLabel,
        },
        featuredExercise,
        recentSessions: [...recentSessionMap.values()]
          .sort((a, b) => (b.completedAt ?? b.localDate).localeCompare(a.completedAt ?? a.localDate))
          .slice(0, 4)
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
        const week = isoWeekStart(new Date(session.localDate));
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
