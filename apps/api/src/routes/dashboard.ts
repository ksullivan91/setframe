import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  dailyActivitySummary,
  dailyManualEntry,
  dailyNutritionSnapshot,
  dayType,
  integrationSyncState,
  programScheduleSlot,
  programVersion,
  scheduleOverride,
  trainingProgram,
  workoutSession,
} from '@setline/database';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../plugins/auth.js';

async function resolveScheduledDayType(db: ReturnType<typeof getDb>, userId: string, localDate: string) {
  const override = await db
    .select({ override: scheduleOverride, dayType })
    .from(scheduleOverride)
    .innerJoin(dayType, eq(dayType.id, scheduleOverride.dayTypeId))
    .where(and(eq(scheduleOverride.userId, userId), eq(scheduleOverride.date, localDate)))
    .limit(1);
  if (override[0]) return override[0].dayType;

  const programs = await db
    .select()
    .from(trainingProgram)
    .where(and(eq(trainingProgram.userId, userId), eq(trainingProgram.isActive, true)))
    .limit(1);
  const program = programs[0];
  if (!program) return null;

  const versions = await db
    .select()
    .from(programVersion)
    .where(eq(programVersion.trainingProgramId, program.id));
  const version = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  if (!version) return null;

  const slots = await db
    .select({ slot: programScheduleSlot, dayType })
    .from(programScheduleSlot)
    .innerJoin(dayType, eq(dayType.id, programScheduleSlot.dayTypeId))
    .where(eq(programScheduleSlot.programVersionId, version.id));
  if (!slots.length) return null;

  const target = new Date(`${localDate}T00:00:00Z`);
  // dayIndex is always the actual day-of-week (0=Sun..6=Sat), matching how
  // the Training page's schedule grid assigns slots — it is NOT an offset
  // from the program start date.
  const dayIndex = target.getUTCDay();
  const start = program.startDate ? new Date(`${program.startDate}T00:00:00Z`) : target;
  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000);
  const weekNumber = program.cycleLengthWeeks
    ? ((Math.floor(Math.max(diffDays, 0) / 7) % program.cycleLengthWeeks) + 1)
    : null;

  return (
    slots
      .filter(({ slot }) => slot.dayIndex === dayIndex && (program.cycleLengthWeeks ? slot.weekNumber === weekNumber : slot.weekNumber === null))
      .sort((a, b) => a.slot.sortOrder - b.slot.sortOrder)[0]?.dayType ?? null
  );
}

function toSessionResponse(row: typeof workoutSession.$inferSelect) {
  return {
    id: row.id,
    status: row.status === 'planned' ? 'in_progress' : row.status,
    templateId: row.templateId,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSyncStateResponse(row: typeof integrationSyncState.$inferSelect | undefined) {
  if (!row) return null;
  return {
    status: row.status,
    lastSuccessfulSyncAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    latestCompleteLocalDate: row.latestCompleteLocalDate,
  };
}

export const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/dashboard/today',
    {
      preHandler: requireAuth,
      schema: {
        querystring: z.object({ localDate: z.string().date() }),
        response: { 200: z.object({}).passthrough() },
      },
    },
    async (request) => {
      const db = getDb();
      const userId = request.userId!;
      const { localDate } = request.query;

      const [sessions, manual, activity, nutrition, syncState, nextDayType, override] = await Promise.all([
        db
          .select()
          .from(workoutSession)
          .where(and(eq(workoutSession.userId, userId), eq(workoutSession.localDate, localDate))),
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
        db
          .select()
          .from(integrationSyncState)
          .where(and(eq(integrationSyncState.userId, userId), eq(integrationSyncState.integrationType, 'apple_health')))
          .limit(1),
        resolveScheduledDayType(db, userId, localDate),
        db
          .select()
          .from(scheduleOverride)
          .where(and(eq(scheduleOverride.userId, userId), eq(scheduleOverride.date, localDate)))
          .limit(1),
      ]);

      return {
        localDate,
        sessions: sessions.map(toSessionResponse),
        manualEntry: manual[0] ?? null,
        activitySummary: activity[0] ?? null,
        nutritionSnapshot: nutrition[0] ?? null,
        syncState: toSyncStateResponse(syncState[0]),
        weekLabel: null,
        dayLabel: nextDayType?.name ?? null,
        dayTypeId: nextDayType?.id ?? null,
        estimatedDurationMinutes: nextDayType?.estimatedDurationMinutes ?? null,
        scheduleSource: override[0] ? 'override' : nextDayType ? 'program' : 'none',
        override: override[0]
          ? {
              id: override[0].id,
              date: override[0].date,
              dayTypeId: override[0].dayTypeId,
              note: override[0].note,
              createdAt: override[0].createdAt.toISOString(),
            }
          : null,
      };
    },
  );
};
