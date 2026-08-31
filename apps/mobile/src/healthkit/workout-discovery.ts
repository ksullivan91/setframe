import type { AdditionalActivityType } from '@setframe/schemas';

/**
 * Story 44 — turning Apple Health workouts into Additional Activity
 * suggestions. Pure and framework-free so the mapping and the suppression
 * rule can be tested without a phone; the adapter supplies the raw
 * workouts and the Today screen renders whatever comes back.
 */

/** A workout Apple Health knows about, normalized off the nitro proxy. */
export interface DiscoveredWorkout {
  /** HealthKit's own UUID — the dedupe key, stored as externalSourceId. */
  externalId: string;
  appleType: number;
  activityType: AdditionalActivityType;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceValue: number | null;
  distanceUnit: 'mi' | 'km' | null;
  caloriesKcal: number | null;
}

/** A workout we are not offering, and the reason, so the UI can say so. */
export interface SuppressedWorkout {
  workout: DiscoveredWorkout;
  reason: string;
}

export interface LoggedSession {
  label: string;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * HKWorkoutActivityType → our activity type.
 *
 * One explicit table, per the story's steering note. Anything unlisted
 * degrades to `other` rather than guessing: a wrong type is a wrong claim
 * about the user's day, and they can correct it in the prefilled sheet.
 */
const TYPE_MAP: Record<number, AdditionalActivityType> = {
  52: 'walk', // walking
  24: 'walk', // hiking
  37: 'run', // running
  13: 'outdoor_cycle', // cycling — refined by the indoor flag below
  57: 'yoga', // yoga
  62: 'stretching', // flexibility
  33: 'stretching', // preparationAndRecovery
  80: 'stretching', // cooldown
  29: 'mobility', // mindAndBody
  66: 'mobility', // pilates
};

/**
 * Types that could plausibly *be* a Setframe session as the Watch saw it.
 *
 * Deliberately loose. These only ever suppress a workout that also overlaps
 * a logged session in time, and the cost of being wrong is asymmetric:
 * a suppressed activity can still be added by hand, whereas a duplicate
 * silently inflates the training volume the whole app is built to measure.
 */
const TRAINING_TYPES = new Set([
  11, // crossTraining
  20, // functionalStrengthTraining
  50, // traditionalStrengthTraining
  59, // coreTraining
  63, // highIntensityIntervalTraining
  3000, // other — genuinely ambiguous, and ambiguity should not double-count
]);

export function mapWorkoutType(appleType: number, isIndoor = false): AdditionalActivityType {
  if (appleType === 13) return isIndoor ? 'indoor_cycle' : 'outdoor_cycle';
  return TYPE_MAP[appleType] ?? 'other';
}

export function isTrainingType(appleType: number): boolean {
  return TRAINING_TYPES.has(appleType);
}

/** Human-facing name for a workout, matching what Health shows. */
const TITLES: Record<number, string> = {
  52: 'Outdoor Walk',
  24: 'Hike',
  37: 'Run',
  13: 'Cycle',
  57: 'Yoga',
  62: 'Flexibility',
  33: 'Recovery',
  80: 'Cooldown',
  29: 'Mind and Body',
  66: 'Pilates',
  11: 'Cross Training',
  20: 'Functional Strength Training',
  50: 'Traditional Strength Training',
  59: 'Core Training',
  63: 'High Intensity Interval Training',
};

export function workoutTitle(appleType: number, isIndoor = false): string {
  if (appleType === 13) return isIndoor ? 'Indoor Cycle' : 'Outdoor Cycle';
  return TITLES[appleType] ?? 'Workout';
}

function span(startedAt: string | null, endedAt: string | null) {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(start, end) };
}

/** True when two time ranges share any instant. Touching ends do not count. */
export function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface PartitionResult {
  suggestions: DiscoveredWorkout[];
  suppressed: SuppressedWorkout[];
}

/**
 * Decide what to offer.
 *
 * Three things are held back, for three different reasons:
 *
 * - **Already imported** — exact `externalId` match against activities we
 *   already saved. This is the story's authoritative dedupe.
 * - **Dismissed** — the user said no. Offering it again on the next
 *   foreground is the nagging the story explicitly rules out.
 * - **Already your session** — the Watch recorded the strength workout the
 *   user logged here by hand. Exact-id dedupe cannot catch this: it is a
 *   different record that was never imported. Without the check, every
 *   logged session would be offered back as "additional" activity and
 *   double-count the very thing Today is built around.
 *
 * Only the last is reported back, because only that one looks like a bug if
 * it happens silently — the user can see the workout in Health and would
 * otherwise wonder why Setframe ignored it.
 */
export function partitionWorkouts(
  workouts: DiscoveredWorkout[],
  sessions: LoggedSession[],
  options: { dismissedIds?: readonly string[]; importedExternalIds?: readonly string[] } = {},
): PartitionResult {
  const dismissed = new Set(options.dismissedIds ?? []);
  const imported = new Set(options.importedExternalIds ?? []);
  const sessionSpans = sessions
    .map((session) => ({ label: session.label, at: span(session.startedAt, session.completedAt) }))
    .filter((s): s is { label: string; at: { start: number; end: number } } => s.at != null);

  const suggestions: DiscoveredWorkout[] = [];
  const suppressed: SuppressedWorkout[] = [];

  for (const workout of workouts) {
    if (imported.has(workout.externalId) || dismissed.has(workout.externalId)) continue;

    const at = span(workout.startedAt, workout.endedAt);
    const clash =
      at && isTrainingType(workout.appleType)
        ? sessionSpans.find((session) => overlaps(at, session.at))
        : undefined;

    if (clash) {
      suppressed.push({
        workout,
        reason: `Not offered — this is your ${clash.label} session, already logged here.`,
      });
      continue;
    }
    suggestions.push(workout);
  }

  return { suggestions, suppressed };
}

/** The body for POST /v1/additional-activities, per the story's import rule. */
export function toCreateBody(
  workout: DiscoveredWorkout,
  localDate: string,
  timezone: string,
) {
  return {
    localDate,
    timezone,
    startedAt: workout.startedAt,
    durationSeconds: workout.durationSeconds > 0 ? workout.durationSeconds : null,
    activityType: workout.activityType,
    title: workout.title,
    distanceValue: workout.distanceValue,
    distanceUnit: workout.distanceUnit,
    caloriesKcal: workout.caloriesKcal,
    // Provenance survives the import: the row stays identifiable as
    // Apple Health's months later, and the external id is what stops it
    // being imported twice.
    source: 'apple_health' as const,
    externalSourceId: workout.externalId,
  };
}
