import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import {
  additionalActivity,
  additionalActivityPreset,
  dailyActivitySummary,
  dailyManualEntry,
  dailyNutritionSnapshot,
  dayType,
  dayTypeExercise,
  dayTypeExercisePlannedSet,
  exercise,
  exerciseMuscle,
  integrationSyncState,
  programDayType,
  programScheduleSlot,
  programVersion,
  restDay,
  scheduleOverride,
  sessionWatchSeries,
  sessionWatchWorkout,
  trainingProgram,
  user,
  userNotificationPreference,
  workoutExerciseLog,
  workoutSession,
  workoutSet,
} from '@setframe/database';
import type { Database } from '@setframe/database';

/**
 * Every table this user's data lives in, most dependent first.
 *
 * Order is not cosmetic. All 15 user foreign keys are ON DELETE NO ACTION,
 * so `DELETE FROM "user"` fails outright for any account that has ever
 * logged anything — children must go first, and several are grandchildren
 * reached only through a parent.
 *
 * Making the constraints CASCADE instead was considered and rejected: one
 * accidental user delete would then take everything silently, and altering
 * fifteen constraints is a riskier change than this list.
 *
 * `deleteAccountTables` is exported so a test can check it against the
 * live schema. The real hazard here is not the order — a wrong order fails
 * loudly with a foreign key violation — it is someone adding a table with
 * a `user_id` in six months and not adding it here.
 */
export const deleteAccountTables = [
  'workout_set',
  'workout_exercise_log',
  'session_watch_series',
  'session_watch_workout',
  'workout_session',
  'day_type_exercise_planned_set',
  'day_type_exercise',
  'program_schedule_slot',
  'program_day_type',
  'schedule_override',
  'program_version',
  'day_type',
  'training_program',
  'exercise_muscle',
  'exercise',
  'additional_activity',
  'additional_activity_preset',
  'daily_activity_summary',
  'daily_manual_entry',
  'daily_nutrition_snapshot',
  'integration_sync_state',
  'rest_day',
  'user_notification_preference',
  'user',
] as const;

/**
 * Deletes everything belonging to one user, atomically.
 *
 * `db.batch` maps to Neon's transaction API, so the whole graph goes or
 * none of it does — a half-deleted account would leave the user signed in
 * to a hollowed-out profile with no way to finish the job.
 */
export async function deleteAccountData(db: Database, userId: string): Promise<void> {
  const sessions = db.select({ id: workoutSession.id }).from(workoutSession)
    .where(eq(workoutSession.userId, userId));
  const logs = db.select({ id: workoutExerciseLog.id }).from(workoutExerciseLog)
    .where(inArray(workoutExerciseLog.sessionId, sessions));
  const dayTypes = db.select({ id: dayType.id }).from(dayType).where(eq(dayType.userId, userId));
  const dayTypeExercises = db.select({ id: dayTypeExercise.id }).from(dayTypeExercise)
    .where(inArray(dayTypeExercise.dayTypeId, dayTypes));
  const programs = db.select({ id: trainingProgram.id }).from(trainingProgram)
    .where(eq(trainingProgram.userId, userId));
  const versions = db.select({ id: programVersion.id }).from(programVersion)
    .where(inArray(programVersion.trainingProgramId, programs));
  /* Only the user's OWN exercises, and note the column: ownership here is
     `created_by_user_id`, not `user_id` like everywhere else. The system
     catalogue has it null and is shared, so this filter is the difference
     between deleting one account and emptying the exercise library for
     every user. */
  const customExercises = db.select({ id: exercise.id }).from(exercise)
    .where(and(eq(exercise.createdByUserId, userId), isNotNull(exercise.createdByUserId)));

  await db.batch([
    db.delete(workoutSet).where(inArray(workoutSet.exerciseLogId, logs)),
    db.delete(workoutExerciseLog).where(inArray(workoutExerciseLog.sessionId, sessions)),
    db.delete(sessionWatchSeries).where(eq(sessionWatchSeries.userId, userId)),
    db.delete(sessionWatchWorkout).where(eq(sessionWatchWorkout.userId, userId)),
    db.delete(workoutSession).where(eq(workoutSession.userId, userId)),
    db.delete(dayTypeExercisePlannedSet)
      .where(inArray(dayTypeExercisePlannedSet.dayTypeExerciseId, dayTypeExercises)),
    db.delete(dayTypeExercise).where(inArray(dayTypeExercise.dayTypeId, dayTypes)),
    db.delete(programScheduleSlot).where(inArray(programScheduleSlot.programVersionId, versions)),
    db.delete(programDayType).where(inArray(programDayType.trainingProgramId, programs)),
    db.delete(scheduleOverride).where(eq(scheduleOverride.userId, userId)),
    db.delete(programVersion).where(inArray(programVersion.trainingProgramId, programs)),
    db.delete(dayType).where(eq(dayType.userId, userId)),
    db.delete(trainingProgram).where(eq(trainingProgram.userId, userId)),
    db.delete(exerciseMuscle).where(inArray(exerciseMuscle.exerciseId, customExercises)),
    db.delete(exercise).where(eq(exercise.createdByUserId, userId)),
    db.delete(additionalActivity).where(eq(additionalActivity.userId, userId)),
    db.delete(additionalActivityPreset).where(eq(additionalActivityPreset.userId, userId)),
    db.delete(dailyActivitySummary).where(eq(dailyActivitySummary.userId, userId)),
    db.delete(dailyManualEntry).where(eq(dailyManualEntry.userId, userId)),
    db.delete(dailyNutritionSnapshot).where(eq(dailyNutritionSnapshot.userId, userId)),
    db.delete(integrationSyncState).where(eq(integrationSyncState.userId, userId)),
    db.delete(restDay).where(eq(restDay.userId, userId)),
    db.delete(userNotificationPreference).where(eq(userNotificationPreference.userId, userId)),
    db.delete(user).where(eq(user.id, userId)),
  ]);
}
