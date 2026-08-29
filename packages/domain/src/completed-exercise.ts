/**
 * What a completed exercise says about itself.
 *
 * Story 42. The first attempt at a completed state kept the active card and
 * added success styling plus one dense line:
 *
 *     5 sets · 135lb · 8 reps → 195lb · 6 reps
 *
 * That string is accurate and nearly useless mid-workout. It has to be parsed
 * rather than read, it leads with the least interesting figure, and it forces
 * every representation through weight × reps notation. This module replaces it
 * with a small set of *labelled* metrics, chosen by representation, so a
 * renderer can lay them out as tiles and a lifter can read the one they care
 * about at a glance.
 *
 * Two rules run through everything here:
 *
 * - **Derived, never fabricated.** Every figure comes from sets the server has
 *   actually stored. When history cannot support a comparison, the comparison
 *   is `null` and the card shows one fewer thing — it never renders `vs last —`
 *   to preserve a layout.
 * - **Representation decides.** `summaryMetric` on the prescription definition
 *   already encodes what a kind is *about*; metrics follow it rather than
 *   re-deciding per screen. A run reports distance and pace; it never reports
 *   a volume of 0 lb.
 */

import type { Prescription } from '@setframe/schemas';
import {
  getPrescriptionDefinition,
  isSessionSetLogged,
  type PrescriptionKind,
  type SessionSetValues,
} from './prescription-fields';
import { calculateVolume } from './volume';

/** A set as this module needs to see it. */
export interface CompletedExerciseSet extends SessionSetValues {
  weightUnit?: string | null;
  distanceUnit?: string | null;
  isPrWeight?: boolean;
  isPrReps?: boolean;
}

export interface CompletedMetric {
  /** Stable identity for keys and tests; never shown to the user. */
  key: 'sets' | 'topSet' | 'volume' | 'totalReps' | 'bestSet' | 'duration' | 'longest' | 'distance' | 'pace';
  /** Short column heading, e.g. "Top set". */
  label: string;
  /** Preformatted value, e.g. "195 lb × 6". */
  value: string;
}

export type ComparisonDirection = 'up' | 'down' | 'same';

export interface CompletedComparison {
  direction: ComparisonDirection;
  /**
   * Compact label for the card, e.g. "+10 lb vs last". Carries no arrow
   * glyph — direction is a separate field precisely so the renderer can pair
   * an icon with it and screen readers are not handed "↑".
   */
  label: string;
  /** Spelled out for assistive tech, e.g. "Up 10 lb versus last session". */
  accessibleLabel: string;
  /**
   * Just the delta, e.g. "+10 lb", for surfaces where "vs last" is already
   * implied by context — the v2 result pill sits inside the exercise it
   * describes, so the comparison target needs no naming.
   */
  compactLabel: string;
}

export interface CompletedExerciseReadout {
  /** Two or three labelled figures, most important first. */
  metrics: CompletedMetric[];
  /** Only present when real history supports it. */
  comparison: CompletedComparison | null;
  /** True when the server flagged any set in this exercise as a PR. */
  isPersonalRecord: boolean;
  /** Completed sets by the canonical rule — every type, warmups included. */
  completedSetCount: number;
}

const numberFormat = new Intl.NumberFormat('en-US');

function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number): string {
  return numberFormat.format(round(value));
}

/**
 * Durations read as `45s` under a minute and `12:30` above it.
 *
 * Minutes-and-seconds rather than the decimal minutes used in planning: a
 * plank held for 90 seconds is `1:30`, and `1.5 min` reads like a spreadsheet.
 */
export function formatCompletedDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return `${minutes}:${String(remainder).padStart(2, '0')}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/**
 * The canonical completed-set rule.
 *
 * Story 42.8. One function, used everywhere a completed-set total is shown, so
 * a card and its own progress line cannot disagree — they did.
 *
 * A set counts when it carries the data its representation requires. That is
 * the *only* condition: set type is not part of it.
 *
 * What this replaces, and why it was wrong twice over:
 *
 *     sets.filter(set => set.setType !== 'warmup').length
 *
 * First, it dropped warmups. Five planned Romanian deadlifts plus one added
 * mid-workout, two of them warmups, reported "4 sets completed" for six sets
 * the user had performed and saved. A warmup is preparation rather than
 * training volume, which is a defensible thing to say about *volume* — it is
 * not a reason to tell someone they did fewer sets than they did.
 *
 * Second, it never checked whether a set was logged at all, so it counted
 * planned-but-empty rows as completed. That stayed invisible only because the
 * caption renders when everything is already logged.
 */
export function completedSessionSets(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly CompletedExerciseSet[],
): CompletedExerciseSet[] {
  return sets.filter((set) => isSessionSetLogged(prescription, set));
}

/**
 * The sets every figure on the card is derived from.
 *
 * I first kept warmups out of volume while counting them as sets, on the
 * argument that a warmup is not training volume. Rendering it disproved that:
 * the Session summary above the card already sums *every* set, so the same
 * work read "Volume 8,635 lb" at the top of the screen and "7,200 lb" on the
 * card. Two numbers for one thing is worse than either convention, and the
 * product had already picked one.
 *
 * So the card follows the session: one rule, warmups included, no special
 * cases to explain.
 */
function performedSets(sets: readonly CompletedExerciseSet[]): CompletedExerciseSet[] {
  return [...sets];
}

/** PR flags never belong to a warmup, whatever the figures include. */
function prCandidates(sets: readonly CompletedExerciseSet[]): CompletedExerciseSet[] {
  return sets.filter((set) => set.setType !== 'warmup');
}

function setLabel(count: number): string {
  return `${count} ${count === 1 ? 'set' : 'sets'}`;
}

/**
 * The heaviest set, decided by weight and then by reps at that weight.
 *
 * `>` rather than `>=` on the reps tie-break keeps the *first* set of an equal
 * pair, so a lifter who repeats 195 × 6 twice sees the same figure either way.
 */
function topSet(sets: readonly CompletedExerciseSet[]): CompletedExerciseSet | null {
  let best: CompletedExerciseSet | null = null;
  for (const set of sets) {
    if (set.weightValue == null) continue;
    if (best == null || set.weightValue > best.weightValue!) {
      best = set;
      continue;
    }
    if (set.weightValue === best.weightValue && (set.reps ?? 0) > (best.reps ?? 0)) best = set;
  }
  return best;
}

function bestRepSet(sets: readonly CompletedExerciseSet[]): CompletedExerciseSet | null {
  let best: CompletedExerciseSet | null = null;
  for (const set of sets) {
    if (set.reps == null) continue;
    if (best == null || set.reps > best.reps!) best = set;
  }
  return best;
}

function sumBy(
  sets: readonly CompletedExerciseSet[],
  read: (set: CompletedExerciseSet) => number | null | undefined,
): number | null {
  let total = 0;
  let seen = false;
  for (const set of sets) {
    const value = read(set);
    // `!= null` and not a truthiness check: a legitimately logged 0 (an
    // assisted rep count, a bodyweight set) must count as data, not absence.
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

function weightUnitOf(sets: readonly CompletedExerciseSet[]): string {
  return sets.find((set) => set.weightUnit != null)?.weightUnit ?? 'lb';
}

function distanceUnitOf(
  sets: readonly CompletedExerciseSet[],
  fallback: string,
): string {
  return sets.find((set) => set.distanceUnit != null)?.distanceUnit ?? fallback;
}

/**
 * Pace, but only when it is honestly derivable.
 *
 * Requires both a positive distance and a positive duration. Dividing by a
 * zero or absent value yields `Infinity`/`NaN`, and a card reading `∞ /mi` is
 * worse than a card with one fewer tile.
 */
function paceMetric(
  distance: number | null,
  seconds: number | null,
  unit: string,
): CompletedMetric | null {
  if (distance == null || seconds == null || distance <= 0 || seconds <= 0) return null;
  return {
    key: 'pace',
    label: 'Pace',
    value: `${formatCompletedDuration(seconds / distance)} /${unit}`,
  };
}

/** The single figure a comparison is drawn from, per representation. */
interface LeadMetric {
  value: number;
  /** How a delta in this metric is written, e.g. `(n) => `${n} lb`` . */
  format: (magnitude: number) => string;
  noun: string;
}

function leadMetricOf(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly CompletedExerciseSet[],
): LeadMetric | null {
  const definition = getPrescriptionDefinition(prescription);
  const performed = performedSets(sets);
  if (!performed.length) return null;

  switch (definition.summaryMetric) {
    case 'volume': {
      if (!definition.countsTowardVolume) return null;
      const volume = calculateVolume(performed.map((set) => ({ weightValue: set.weightValue ?? null, reps: set.reps ?? null })));
      if (volume <= 0) return null;
      const unit = weightUnitOf(performed);
      return { value: volume, format: (n) => `${formatNumber(n)} ${unit}`, noun: 'volume' };
    }
    case 'reps': {
      const reps = sumBy(performed, (set) => set.reps);
      if (reps == null || reps <= 0) return null;
      return { value: reps, format: (n) => `${formatNumber(n)} reps`, noun: 'reps' };
    }
    case 'duration': {
      const seconds = sumBy(performed, (set) => set.durationSeconds);
      if (seconds == null || seconds <= 0) return null;
      return { value: seconds, format: (n) => formatCompletedDuration(n), noun: 'time' };
    }
    case 'distance': {
      const distance = sumBy(performed, (set) => set.distanceValue);
      if (distance == null || distance <= 0) return null;
      const unit = distanceUnitOf(performed, definition.units.distance);
      return { value: distance, format: (n) => `${round(n, 2)} ${unit}`, noun: 'distance' };
    }
  }
}

/**
 * How this exercise compares with the last time it was performed.
 *
 * Compares the representation's lead metric and nothing else. Comparing
 * several metrics at once invites the card to report "volume up, top set
 * down", which is a coaching conversation rather than a glanceable summary —
 * and this story explicitly defers coaching.
 *
 * Returns `null` whenever the comparison would be meaningless: no previous
 * session, or either side missing the metric. "No history yet" is
 * communicated by the absence of the row, never by a placeholder.
 */
export function compareWithPreviousSession(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly CompletedExerciseSet[],
  previousSets: readonly CompletedExerciseSet[] | null | undefined,
): CompletedComparison | null {
  if (!previousSets?.length) return null;
  const current = leadMetricOf(prescription, sets);
  const previous = leadMetricOf(prescription, previousSets);
  if (!current || !previous) return null;

  const delta = current.value - previous.value;
  // A hair of floating-point drift on distance should read as "matched",
  // not as a 0.0001-mile improvement.
  const epsilon = current.noun === 'distance' ? 0.005 : 0.5;

  if (Math.abs(delta) < epsilon) {
    return {
      direction: 'same',
      label: 'Matched last session',
      accessibleLabel: `Matched last session on ${current.noun}`,
      /* No delta to shorten, and "Matched" alone loses what was matched. */
      compactLabel: 'Matched last session',
    };
  }

  const magnitude = current.format(Math.abs(delta));
  const up = delta > 0;
  return {
    direction: up ? 'up' : 'down',
    label: `${up ? '+' : '−'}${magnitude} vs last`,
    compactLabel: `${up ? '+' : '−'}${magnitude}`,
    accessibleLabel: `${up ? 'Up' : 'Down'} ${magnitude} versus last session`,
  };
}

/**
 * The metrics a completed exercise should show, in priority order.
 *
 * Callers render the first two or three; the order here is the product
 * decision about which matter most, so a narrow card truncates sensibly
 * instead of each platform picking its own favourites.
 *
 * The set *count* is deliberately absent. It belongs to the card's caption
 * ("3 sets completed"), and repeating it as a tile directly underneath both
 * wasted a third of a narrow row and made the two figures look like different
 * measurements of different things.
 */
export function completedExerciseMetrics(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly CompletedExerciseSet[],
): CompletedMetric[] {
  const definition = getPrescriptionDefinition(prescription);
  const performed = performedSets(sets);
  if (!performed.length) return [];

  const metrics: CompletedMetric[] = [];
  const count = performed.length;

  switch (definition.summaryMetric) {
    case 'volume': {
      const heaviest = topSet(performed);
      if (heaviest?.weightValue != null) {
        const unit = heaviest.weightUnit ?? weightUnitOf(performed);
        metrics.push({
          key: 'topSet',
          label: 'Top set',
          value:
            heaviest.reps != null
              ? `${formatNumber(heaviest.weightValue)} ${unit} × ${heaviest.reps}`
              : `${formatNumber(heaviest.weightValue)} ${unit}`,
        });
      }
      if (definition.countsTowardVolume) {
        const volume = calculateVolume(
          performed.map((set) => ({ weightValue: set.weightValue ?? null, reps: set.reps ?? null })),
        );
        if (volume > 0) {
          metrics.push({ key: 'volume', label: 'Volume', value: `${formatNumber(volume)} ${weightUnitOf(performed)}` });
        }
      }
      return metrics;
    }

    case 'reps': {
      const totalReps = sumBy(performed, (set) => set.reps);
      const best = bestRepSet(performed);
      if (totalReps != null) {
        metrics.push({ key: 'totalReps', label: 'Total reps', value: formatNumber(totalReps) });
      }
      // A "best set" identical to the only set is noise, not information.
      if (best?.reps != null && count > 1) {
        metrics.push({ key: 'bestSet', label: 'Best set', value: `${best.reps} reps` });
      }
      return metrics;
    }

    case 'duration': {
      const seconds = sumBy(performed, (set) => set.durationSeconds);
      /* `duration` is one continuous effort, so a set count would always read
         "1 set" and say nothing. Timed sets are intervals, where the count is
         the point. */
      const isIntervals = definition.kind === 'timed';
      if (seconds != null) {
        metrics.push({
          key: 'duration',
          label: isIntervals ? 'Total time' : 'Duration',
          value: formatCompletedDuration(seconds),
        });
      }
      if (isIntervals && count > 1) {
        const longest = performed.reduce<number | null>(
          (max, set) => (set.durationSeconds != null && (max == null || set.durationSeconds > max) ? set.durationSeconds : max),
          null,
        );
        if (longest != null) {
          metrics.push({ key: 'longest', label: 'Longest', value: formatCompletedDuration(longest) });
        }
      }
      return metrics;
    }

    case 'distance': {
      const distance = sumBy(performed, (set) => set.distanceValue);
      const seconds = sumBy(performed, (set) => set.durationSeconds);
      const unit = distanceUnitOf(performed, definition.units.distance);
      if (distance != null) {
        metrics.push({ key: 'distance', label: 'Distance', value: `${round(distance, 2)} ${unit}` });
      }
      if (seconds != null) {
        metrics.push({ key: 'duration', label: 'Duration', value: formatCompletedDuration(seconds) });
      }
      const pace = paceMetric(distance, seconds, unit);
      if (pace) metrics.push(pace);
      return metrics;
    }
  }
}

/**
 * Everything the completed card needs, in one derived object.
 *
 * Deliberately a plain data structure rather than formatted markup: web and
 * mobile render very different primitives from it, and the *decisions* — which
 * metrics, what they are called, whether a comparison is honest — must be
 * identical on both.
 */
export function buildCompletedExerciseReadout(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly CompletedExerciseSet[],
  previousSets?: readonly CompletedExerciseSet[] | null,
): CompletedExerciseReadout {
  const performed = performedSets(sets);
  return {
    metrics: completedExerciseMetrics(prescription, sets),
    comparison: compareWithPreviousSession(prescription, sets, previousSets),
    isPersonalRecord: prCandidates(performed).some(
      (set) => set.isPrWeight === true || set.isPrReps === true,
    ),
    completedSetCount: completedSessionSets(prescription, sets).length,
  };
}

/**
 * How many sets were completed, for the card's secondary line.
 *
 * Reads the canonical rule, so this caption and the "n of m sets complete"
 * progress line above it can no longer disagree about the same exercise.
 */
export function completedSetCountLabel(
  prescription: Prescription | PrescriptionKind | null | undefined,
  sets: readonly CompletedExerciseSet[],
): string {
  return `${setLabel(completedSessionSets(prescription, sets).length)} completed`;
}
