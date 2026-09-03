import type { Prescription } from '@setframe/schemas';
import type { CompletedExerciseSet } from './completed-exercise';
import {
  countsTowardVolume,
  isSessionSetLogged,
  summaryMetricFor,
  type SummaryMetric,
} from './prescription-fields';

/**
 * Session-level figures for the v2 logger's completion banner.
 *
 * The per-exercise readout in `completed-exercise.ts` answers "how did this
 * exercise go"; this answers "how did the session go", and the banner is the
 * strongest reward in the hierarchy so its numbers have to be right.
 *
 * Shared rather than computed per platform: web and mobile render the same
 * banner, and a session total that disagreed between them would be the worst
 * possible bug in the most prominent place.
 */

export interface CompletedSessionExercise {
  prescription: Prescription | null | undefined;
  sets: readonly CompletedExerciseSet[];
  previousSession?: { sets: readonly CompletedExerciseSet[] } | null;
}

export interface CompletedSessionReadout {
  /** Total volume across every exercise that counts toward volume. */
  totalVolume: number;
  /** Sets that meet the canonical logged rule — warm-ups included. */
  loggedSetCount: number;
  personalRecordCount: number;
  /**
   * Volume delta against the last time each exercise was performed, summed.
   *
   * `null` when no exercise has history — the same rule the per-exercise
   * comparison follows. A session with nothing to compare against shows one
   * fewer figure rather than a fabricated "+0".
   */
  volumeDelta: number | null;
  /** Exercises that contributed to the comparison, for the honest label. */
  comparedExerciseCount: number;
  /**
   * What this session actually measured.
   *
   * There are eight prescription kinds and every consumer of this readout
   * assumed the first. A treadmill walk reported `1 set · 0 volume lb ·
   * 0 PRs`, which is worse than useless after forty minutes of work: it
   * reads as a failure rather than as a session the app cannot describe.
   *
   * `mixed` is a real session — accessories logged alongside a carry — and
   * falls back to volume, which is the metric most of it will be in.
   */
  summaryMetric: SummaryMetric | 'mixed';
  /** Seconds across every timed or duration set. */
  totalDurationSeconds: number;
  /** Miles across every distance set. */
  totalDistanceMiles: number;
  /** Reps across every set, for bodyweight work where volume is always zero. */
  totalReps: number;
}

/** Pounds per kilogram, for the rare set logged in metric. */
const LB_PER_KG = 2.20462;

/**
 * A set's duration in seconds.
 *
 * `duration` and `distanceDuration` are prescribed in minutes while `timed`
 * is in seconds — `prescriptionDefinitions` carries that per kind, and
 * ignoring it would report a 42-minute walk as 42 seconds.
 */
function durationSecondsOf(
  prescription: Prescription | null | undefined,
  set: CompletedExerciseSet,
): number {
  const raw = set.durationSeconds;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  return raw;
}

/** A set's distance in miles, converting the rare kilometre entry. */
function distanceMilesOf(set: CompletedExerciseSet): number {
  const raw = set.distanceValue;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  return set.distanceUnit === 'km' ? raw * 0.621371 : raw;
}

/**
 * One set's contribution to volume, in pounds.
 *
 * Units matter here and were handled two different wrong ways. This
 * function ignored `weightUnit` entirely, so a kilogram set was silently
 * added as though it were pounds. Today's screen had its own copy that
 * required `weightUnit === 'lb'` — and since the logger never sends a unit
 * and the API stores `loadUnit: weightUnit ?? null`, *every* set is null,
 * so that copy discarded all of them and reported no volume at all while
 * the session header showed the real figure.
 *
 * Null means "the app's own unit", which is pounds. An explicit kilogram
 * set is converted rather than dropped: dropping it understates the day,
 * and adding it raw overstates it by 2.2x.
 */
function setVolumeLb(set: CompletedExerciseSet): number {
  const weight = set.weightValue;
  const reps = set.reps;
  if (weight == null || reps == null) return 0;
  const unit = (set.weightUnit ?? 'lb').toLowerCase();
  if (unit === 'kg') return weight * LB_PER_KG * reps;
  if (unit !== 'lb') return 0;
  return weight * reps;
}

const volumeOf = (
  prescription: Prescription | null | undefined,
  sets: readonly CompletedExerciseSet[],
): number =>
  countsTowardVolume(prescription)
    ? sets.reduce((sum, set) => sum + setVolumeLb(set), 0)
    : 0;

export function buildCompletedSessionReadout(
  exercises: readonly CompletedSessionExercise[],
): CompletedSessionReadout {
  let totalVolume = 0;
  let loggedSetCount = 0;
  let personalRecordCount = 0;
  let previousVolume = 0;
  let comparedExerciseCount = 0;
  let totalDurationSeconds = 0;
  let totalDistanceMiles = 0;
  let totalReps = 0;
  const metrics = new Set<SummaryMetric>();

  for (const exercise of exercises) {
    totalVolume += volumeOf(exercise.prescription, exercise.sets);
    loggedSetCount += exercise.sets.filter((set) =>
      isSessionSetLogged(exercise.prescription, set),
    ).length;
    /* PRs are counted per SET, matching the badges the user just saw — an
       exercise can set both a weight and a rep record on different sets. */
    personalRecordCount += exercise.sets.filter(
      (set) => set.isPrWeight === true || set.isPrReps === true,
    ).length;

    const metric = summaryMetricFor(exercise.prescription);
    /* Only exercises the user actually logged get a say in what the session
       was about — an untouched accessory should not make a walk look mixed. */
    if (exercise.sets.some((set) => isSessionSetLogged(exercise.prescription, set))) {
      metrics.add(metric);
    }
    for (const set of exercise.sets) {
      if (!isSessionSetLogged(exercise.prescription, set)) continue;
      totalDurationSeconds += durationSecondsOf(exercise.prescription, set);
      totalDistanceMiles += distanceMilesOf(set);
      totalReps += typeof set.reps === 'number' ? set.reps : 0;
    }

    const previous = exercise.previousSession?.sets;
    if (previous && previous.length > 0 && countsTowardVolume(exercise.prescription)) {
      previousVolume += volumeOf(exercise.prescription, previous);
      comparedExerciseCount += 1;
    }
  }

  return {
    totalVolume: Math.round(totalVolume),
    loggedSetCount,
    personalRecordCount,
    volumeDelta: comparedExerciseCount > 0 ? Math.round(totalVolume - previousVolume) : null,
    comparedExerciseCount,
    summaryMetric: metrics.size === 1 ? [...metrics][0]! : metrics.size === 0 ? 'volume' : 'mixed',
    totalDurationSeconds: Math.round(totalDurationSeconds),
    totalDistanceMiles: Math.round(totalDistanceMiles * 100) / 100,
    totalReps,
  };
}

/**
 * Elapsed session time, as the banner shows it.
 *
 * Derived from the server's timestamps, never a client interval — leaving the
 * screen, backgrounding, or killing the app cannot drift it.
 *
 * Under an hour reads `52:10`; over it reads `1:12:30`, because a bare `72:30`
 * is ambiguous at a glance.
 */
export function formatSessionDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * The banner's meta line: `Upper Body — Push · 52:10 · 11 sets · 1 PR`.
 *
 * Every segment is omitted when its figure is unavailable rather than shown
 * empty, so a session with no recorded start time simply reads
 * `Upper Body — Push · 11 sets`.
 */
export function formatSessionMeta(parts: {
  title?: string | null;
  duration?: string | null;
  loggedSetCount: number;
  personalRecordCount: number;
}): string {
  const segments: string[] = [];
  if (parts.title) segments.push(parts.title);
  if (parts.duration) segments.push(parts.duration);
  segments.push(parts.loggedSetCount === 1 ? '1 set' : `${parts.loggedSetCount} sets`);
  if (parts.personalRecordCount > 0) {
    segments.push(parts.personalRecordCount === 1 ? '1 PR' : `${parts.personalRecordCount} PRs`);
  }
  return segments.join(' · ');
}

/**
 * The banner's total line suffix: `lb total · +340 lb vs last session`.
 *
 * "vs last session", not the design's "vs last week". The comparison is built
 * from each exercise's own previous session, which may have been three days
 * ago or three weeks — calling it a week would be asserting something the
 * data does not support.
 */
export function formatSessionTotalSuffix(readout: CompletedSessionReadout): string {
  /* Only a volume session has a pounds total to compare. A walk has no
     "lb total" and never did — the literal was simply never questioned. */
  if (readout.summaryMetric !== 'volume' && readout.summaryMetric !== 'mixed') return '';
  if (readout.volumeDelta == null) return 'lb total';
  const rounded = Math.round(readout.volumeDelta);
  if (rounded === 0) return 'lb total · matched last session';
  const sign = rounded > 0 ? '+' : '−';
  return `lb total · ${sign}${Math.abs(rounded).toLocaleString('en-US')} lb vs last session`;
}

/** One headline figure on the completed hero. */
export interface SessionHeadlineStat {
  value: string;
  label: string;
  highlight?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * The three figures a finished session leads with.
 *
 * Driven by what the session measured rather than by what strength work
 * happens to have. A duration session has no meaningful volume and a
 * bodyweight one has none at all, so both would otherwise headline a zero.
 */
export function sessionHeadlineStats(readout: CompletedSessionReadout): SessionHeadlineStat[] {
  const prs: SessionHeadlineStat = {
    value: String(readout.personalRecordCount),
    label: readout.personalRecordCount === 1 ? 'PR' : 'PRs',
    highlight: readout.personalRecordCount > 0,
  };

  switch (readout.summaryMetric) {
    case 'duration':
      return [
        { value: formatDuration(readout.totalDurationSeconds), label: 'duration' },
        ...(readout.totalDistanceMiles > 0
          ? [{ value: readout.totalDistanceMiles.toFixed(2), label: 'miles' }]
          : []),
        { value: String(readout.loggedSetCount), label: readout.loggedSetCount === 1 ? 'entry' : 'entries' },
      ];
    case 'distance':
      return [
        { value: readout.totalDistanceMiles.toFixed(2), label: 'miles' },
        ...(readout.totalDurationSeconds > 0
          ? [{ value: formatDuration(readout.totalDurationSeconds), label: 'duration' }]
          : []),
        { value: String(readout.loggedSetCount), label: readout.loggedSetCount === 1 ? 'entry' : 'entries' },
      ];
    case 'reps':
      return [
        { value: String(readout.loggedSetCount), label: 'sets' },
        { value: readout.totalReps.toLocaleString('en-US'), label: 'total reps' },
        prs,
      ];
    case 'volume':
    case 'mixed':
    default:
      return [
        { value: String(readout.loggedSetCount), label: 'sets' },
        { value: readout.totalVolume ? readout.totalVolume.toLocaleString('en-US') : '—', label: 'volume lb' },
        prs,
      ];
  }
}
