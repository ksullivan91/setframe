import type { Prescription } from '@setframe/schemas';
import { getPrescriptionDefinition, type PrescriptionKind } from './prescription-fields';
import {
  convertDistance,
  convertLoad,
  resolveDistanceUnit,
  resolveLoadUnit,
  type DistanceUnit,
  type LoadUnit,
} from './units';

/**
 * Progress metric semantics — the single source of truth for *which* numbers
 * are meaningful for a given exercise, and how to compute them.
 *
 * The bug this exists to kill: Progress used to compute estimated 1RM, top
 * set and load volume for every exercise regardless of what the exercise
 * actually was, so an Outdoor Cycle rendered as "0 lb est. 1RM / Top set
 * 0 x 0 / volume 0 lb". Those are not zeroes, they are *not applicable* —
 * and a zero is a lie that also drags averages and comparisons down.
 *
 * Rules:
 * 1. A metric is only computed if the exercise's prescription declares it
 *    valid. `progressMetrics` lives on the shared `PrescriptionDefinition`
 *    (packages/domain/src/prescription-fields.ts) so Progress cannot drift
 *    from the session logger.
 * 2. An applicable metric with no qualifying data yields `null`, never 0.
 *    Callers must render "not enough data", not a zero.
 * 3. An inapplicable metric is absent from the result entirely, so a UI that
 *    maps over the results physically cannot render it.
 * 4. Warm-ups never contribute to "top"/"best" metrics, and drop/failure sets
 *    are excluded from them too because they measure fatigue, not capacity.
 *    They *do* count toward cumulative totals (volume, total reps), which are
 *    measures of work done rather than of capacity.
 * 5. Only `completed` sets count. Program-seeded planned sets carry planned
 *    numbers but were not performed.
 */

export type ProgressMetricKey =
  | 'estimatedOneRepMax'
  | 'topSetLoad'
  | 'loadVolume'
  | 'topReps'
  | 'totalReps'
  | 'longestSetDuration'
  | 'totalDuration'
  | 'farthestDistance'
  | 'totalDistance'
  | 'averagePace';

/** How a metric's value should be formatted and understood. */
export type ProgressMetricUnit = 'load' | 'reps' | 'seconds' | 'distance' | 'pace';

export interface ProgressMetricDefinition {
  key: ProgressMetricKey;
  /** Full label, e.g. for a card heading. */
  label: string;
  /** Compact label for chart axes and dense rows. */
  shortLabel: string;
  unit: ProgressMetricUnit;
  /**
   * Whether the metric measures *capacity* (best single effort) or
   * *work done* (cumulative). Capacity metrics exclude warm-up/drop/failure
   * sets; cumulative metrics include every completed set.
   */
  aggregation: 'best' | 'total' | 'derived';
  /**
   * Minimum number of sessions before a trend line or delta may be claimed.
   * Below this the UI must show the raw points and say more data is needed —
   * two observations are a difference, not a trend.
   */
  minimumSessionsForTrend: number;
  /** Plain-language answer to "what is this?", for the metric's tooltip. */
  explanation: string;
  /** Plain-language answer to "how is it worked out?", for the tooltip. */
  calculation: string;
  /**
   * An honest caveat shown in the tooltip. Every estimate we display has
   * one; hiding it would overclaim precision we do not have.
   */
  limitation: string | null;
}

export const progressMetricDefinitions: Record<ProgressMetricKey, ProgressMetricDefinition> = {
  estimatedOneRepMax: {
    key: 'estimatedOneRepMax',
    label: 'Estimated 1RM',
    shortLabel: 'Est. 1RM',
    unit: 'load',
    aggregation: 'best',
    minimumSessionsForTrend: 3,
    explanation:
      'An estimate of the heaviest weight you could lift for a single rep, based on the sets you actually did.',
    calculation:
      'Taken from your best working set using the Epley formula: weight x (1 + reps / 30). We use whichever set gives the highest estimate.',
    limitation:
      'It is an estimate, not a tested max, and it gets less accurate above about 10 reps. Treat small changes as noise.',
  },
  topSetLoad: {
    key: 'topSetLoad',
    label: 'Heaviest set',
    shortLabel: 'Top set',
    unit: 'load',
    aggregation: 'best',
    minimumSessionsForTrend: 3,
    explanation: 'The heaviest weight you lifted for this exercise in a session.',
    calculation:
      'The highest weight across your working, top and backoff sets. Warm-ups, drop sets and sets taken to failure are excluded.',
    limitation:
      'It ignores how many reps you did, so a heavy single and a heavy set of five look the same here.',
  },
  loadVolume: {
    key: 'loadVolume',
    label: 'Volume',
    shortLabel: 'Volume',
    unit: 'load',
    aggregation: 'total',
    minimumSessionsForTrend: 3,
    explanation: 'The total amount of weight you moved: every set added up.',
    calculation: 'Weight x reps for each completed set, summed across the session.',
    limitation:
      'Volume is a measure of work done, not of strength. It normally falls when you train heavier for fewer reps, or during a deload week, and that is not a step backwards.',
  },
  topReps: {
    key: 'topReps',
    label: 'Best set',
    shortLabel: 'Best set',
    unit: 'reps',
    aggregation: 'best',
    minimumSessionsForTrend: 3,
    explanation: 'The most reps you managed in a single set.',
    calculation: 'The highest rep count across your working sets. Warm-ups are excluded.',
    limitation: null,
  },
  totalReps: {
    key: 'totalReps',
    label: 'Total reps',
    shortLabel: 'Reps',
    unit: 'reps',
    aggregation: 'total',
    minimumSessionsForTrend: 3,
    explanation: 'Every rep you completed for this exercise, added up across the session.',
    calculation: 'The sum of reps across all completed sets.',
    limitation: null,
  },
  longestSetDuration: {
    key: 'longestSetDuration',
    label: 'Longest hold',
    shortLabel: 'Longest',
    unit: 'seconds',
    aggregation: 'best',
    minimumSessionsForTrend: 3,
    explanation: 'The longest single effort you held for this exercise.',
    calculation: 'The longest completed set, excluding warm-ups.',
    limitation: null,
  },
  totalDuration: {
    key: 'totalDuration',
    label: 'Total time',
    shortLabel: 'Time',
    unit: 'seconds',
    aggregation: 'total',
    minimumSessionsForTrend: 3,
    explanation: 'How long you spent working on this exercise.',
    calculation: 'The sum of every completed set duration.',
    limitation: null,
  },
  farthestDistance: {
    key: 'farthestDistance',
    label: 'Farthest',
    shortLabel: 'Farthest',
    unit: 'distance',
    aggregation: 'best',
    minimumSessionsForTrend: 3,
    explanation: 'The longest single distance you covered in one effort.',
    calculation: 'The greatest distance in any completed set.',
    limitation: null,
  },
  totalDistance: {
    key: 'totalDistance',
    label: 'Total distance',
    shortLabel: 'Distance',
    unit: 'distance',
    aggregation: 'total',
    minimumSessionsForTrend: 3,
    explanation: 'The full distance you covered in this session.',
    calculation: 'The sum of distance across all completed sets.',
    limitation: null,
  },
  averagePace: {
    key: 'averagePace',
    label: 'Average pace',
    shortLabel: 'Pace',
    unit: 'pace',
    aggregation: 'derived',
    minimumSessionsForTrend: 3,
    explanation: 'How long it took you to cover each unit of distance.',
    calculation: 'Total time divided by total distance, using only sets that recorded both.',
    limitation:
      'Pace is affected by terrain, weather and whether you were doing intervals, so compare like with like.',
  },
};

/**
 * Prescription kind -> the metrics that are mathematically meaningful for it.
 * Order matters: the first entry is the headline metric for that kind.
 */
export const progressMetricsByPrescription: Record<PrescriptionKind, readonly ProgressMetricKey[]> = {
  sets_reps: ['estimatedOneRepMax', 'topSetLoad', 'loadVolume', 'totalReps'],
  top_set_backoff: ['estimatedOneRepMax', 'topSetLoad', 'loadVolume', 'totalReps'],
  per_side: ['estimatedOneRepMax', 'topSetLoad', 'loadVolume', 'totalReps'],
  // No external load is recorded, so 1RM and volume are undefined rather
  // than zero. Progress here is more reps, not more weight.
  bodyweight_reps: ['topReps', 'totalReps'],
  timed: ['longestSetDuration', 'totalDuration'],
  duration: ['totalDuration'],
  distance: ['farthestDistance', 'totalDistance'],
  distanceDuration: ['totalDistance', 'totalDuration', 'averagePace'],
};

export function getProgressMetricKeys(
  prescription: Prescription | PrescriptionKind | null | undefined,
): readonly ProgressMetricKey[] {
  // An unprescribed/ad-hoc exercise falls back to the sets_reps definition,
  // which is the permissive case; the aggregation below still yields null
  // rather than 0 when the sets carry no weight, so nothing is fabricated.
  return progressMetricsByPrescription[getPrescriptionDefinition(prescription).kind];
}

export function isProgressMetricValid(
  prescription: Prescription | PrescriptionKind | null | undefined,
  metric: ProgressMetricKey,
): boolean {
  return getProgressMetricKeys(prescription).includes(metric);
}

/** A logged set, in the shape the aggregation needs. */
export interface ProgressSet {
  setType: string;
  completed?: boolean;
  loadValue: number | null;
  loadUnit: LoadUnit | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: DistanceUnit | null;
}

export interface ProgressMetricValue {
  key: ProgressMetricKey;
  /** `null` means "applicable, but not enough data" — never render 0 for it. */
  value: number | null;
  /** Present for load/distance metrics so the UI never guesses. */
  loadUnit?: LoadUnit;
  distanceUnit?: DistanceUnit;
}

/** Set types that represent a maximal-capacity attempt. */
const capacitySetTypes: ReadonlySet<string> = new Set([
  'working',
  'top',
  'backoff',
  'bodyweight',
  'timed',
  'distance',
]);

function isCompleted(set: ProgressSet): boolean {
  return set.completed !== false;
}

function capacitySets(sets: readonly ProgressSet[]): ProgressSet[] {
  return sets.filter((set) => isCompleted(set) && capacitySetTypes.has(set.setType));
}

function completedSets(sets: readonly ProgressSet[]): ProgressSet[] {
  return sets.filter(isCompleted);
}

/** `null` when the list is empty, so callers can distinguish "none" from 0. */
function maxOrNull(values: readonly number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

function sumOrNull(values: readonly number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function computeMetric(
  metric: ProgressMetricKey,
  sets: readonly ProgressSet[],
  preferredLoadUnit: LoadUnit,
  preferredDistanceUnit: DistanceUnit,
): ProgressMetricValue {
  const capacity = capacitySets(sets);
  const all = completedSets(sets);

  const loadUnit = resolveLoadUnit(
    all.flatMap((set) => (set.loadValue != null && set.loadUnit ? [set.loadUnit] : [])),
    preferredLoadUnit,
  );
  const distanceUnit = resolveDistanceUnit(
    all.flatMap((set) => (set.distanceValue != null && set.distanceUnit ? [set.distanceUnit] : [])),
    preferredDistanceUnit,
  );

  const loadOf = (set: ProgressSet): number | null =>
    set.loadValue != null ? convertLoad(set.loadValue, set.loadUnit ?? loadUnit, loadUnit) : null;
  const distanceOf = (set: ProgressSet): number | null =>
    set.distanceValue != null
      ? convertDistance(set.distanceValue, set.distanceUnit ?? distanceUnit, distanceUnit)
      : null;

  switch (metric) {
    case 'estimatedOneRepMax': {
      // Epley, inlined against normalised load so mixed-unit histories do not
      // produce a discontinuity in the trend.
      const estimates = capacity.flatMap((set) => {
        const load = loadOf(set);
        if (load == null || load <= 0 || set.reps == null || set.reps <= 0) return [];
        return [set.reps === 1 ? load : load * (1 + set.reps / 30)];
      });
      return { key: metric, value: maxOrNull(estimates), loadUnit };
    }
    case 'topSetLoad': {
      const loads = capacity.flatMap((set) => {
        const load = loadOf(set);
        return load != null && load > 0 && set.reps != null ? [load] : [];
      });
      return { key: metric, value: maxOrNull(loads), loadUnit };
    }
    case 'loadVolume': {
      const volumes = all.flatMap((set) => {
        const load = loadOf(set);
        return load != null && set.reps != null ? [load * set.reps] : [];
      });
      return { key: metric, value: sumOrNull(volumes), loadUnit };
    }
    case 'topReps': {
      const reps = capacity.flatMap((set) => (set.reps != null ? [set.reps] : []));
      return { key: metric, value: maxOrNull(reps) };
    }
    case 'totalReps': {
      const reps = all.flatMap((set) => (set.reps != null ? [set.reps] : []));
      return { key: metric, value: sumOrNull(reps) };
    }
    case 'longestSetDuration': {
      const durations = capacity.flatMap((set) =>
        set.durationSeconds != null && set.durationSeconds > 0 ? [set.durationSeconds] : [],
      );
      return { key: metric, value: maxOrNull(durations) };
    }
    case 'totalDuration': {
      const durations = all.flatMap((set) =>
        set.durationSeconds != null && set.durationSeconds > 0 ? [set.durationSeconds] : [],
      );
      return { key: metric, value: sumOrNull(durations) };
    }
    case 'farthestDistance': {
      const distances = capacity.flatMap((set) => {
        const distance = distanceOf(set);
        return distance != null && distance > 0 ? [distance] : [];
      });
      return { key: metric, value: maxOrNull(distances), distanceUnit };
    }
    case 'totalDistance': {
      const distances = all.flatMap((set) => {
        const distance = distanceOf(set);
        return distance != null && distance > 0 ? [distance] : [];
      });
      return { key: metric, value: sumOrNull(distances), distanceUnit };
    }
    case 'averagePace': {
      // Only sets carrying *both* legs may contribute, otherwise a warm-up
      // lap with no timer would inflate the distance and flatter the pace.
      const paired = all.flatMap((set) => {
        const distance = distanceOf(set);
        if (distance == null || distance <= 0) return [];
        if (set.durationSeconds == null || set.durationSeconds <= 0) return [];
        return [{ distance, seconds: set.durationSeconds }];
      });
      if (!paired.length) return { key: metric, value: null, distanceUnit };
      const totalDistance = paired.reduce((sum, entry) => sum + entry.distance, 0);
      const totalSeconds = paired.reduce((sum, entry) => sum + entry.seconds, 0);
      return { key: metric, value: totalSeconds / totalDistance, distanceUnit };
    }
  }
}

export interface SummarizeOptions {
  preferredLoadUnit?: LoadUnit;
  preferredDistanceUnit?: DistanceUnit;
}

/**
 * Computes every metric that is valid for the exercise's prescription, and
 * only those. An inapplicable metric is absent from the array; an applicable
 * metric with no data has `value: null`.
 */
export function summarizeExerciseSets(
  sets: readonly ProgressSet[],
  prescription: Prescription | PrescriptionKind | null | undefined,
  options: SummarizeOptions = {},
): ProgressMetricValue[] {
  const preferredLoadUnit = options.preferredLoadUnit ?? 'lb';
  const preferredDistanceUnit = options.preferredDistanceUnit ?? 'mi';
  return getProgressMetricKeys(prescription).map((metric) =>
    computeMetric(metric, sets, preferredLoadUnit, preferredDistanceUnit),
  );
}

/**
 * The one metric to lead with for this exercise. Returns `null` when the
 * headline metric has no data, so a card can fall back to an empty state
 * rather than printing a zero.
 */
export function primaryProgressMetric(
  sets: readonly ProgressSet[],
  prescription: Prescription | PrescriptionKind | null | undefined,
  options: SummarizeOptions = {},
): ProgressMetricValue | null {
  const [primary] = summarizeExerciseSets(sets, prescription, options);
  return primary ?? null;
}
