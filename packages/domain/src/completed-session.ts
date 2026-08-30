import type { Prescription } from '@setframe/schemas';
import type { CompletedExerciseSet } from './completed-exercise';
import { countsTowardVolume, isSessionSetLogged } from './prescription-fields';

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
}

const volumeOf = (
  prescription: Prescription | null | undefined,
  sets: readonly CompletedExerciseSet[],
): number =>
  countsTowardVolume(prescription)
    ? sets.reduce((sum, set) => sum + (set.weightValue ?? 0) * (set.reps ?? 0), 0)
    : 0;

export function buildCompletedSessionReadout(
  exercises: readonly CompletedSessionExercise[],
): CompletedSessionReadout {
  let totalVolume = 0;
  let loggedSetCount = 0;
  let personalRecordCount = 0;
  let previousVolume = 0;
  let comparedExerciseCount = 0;

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

    const previous = exercise.previousSession?.sets;
    if (previous && previous.length > 0 && countsTowardVolume(exercise.prescription)) {
      previousVolume += volumeOf(exercise.prescription, previous);
      comparedExerciseCount += 1;
    }
  }

  return {
    totalVolume,
    loggedSetCount,
    personalRecordCount,
    volumeDelta: comparedExerciseCount > 0 ? totalVolume - previousVolume : null,
    comparedExerciseCount,
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
  if (readout.volumeDelta == null) return 'lb total';
  const rounded = Math.round(readout.volumeDelta);
  if (rounded === 0) return 'lb total · matched last session';
  const sign = rounded > 0 ? '+' : '−';
  return `lb total · ${sign}${Math.abs(rounded).toLocaleString('en-US')} lb vs last session`;
}
