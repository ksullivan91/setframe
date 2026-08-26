/**
 * Movement patterns — the taxonomy that turns "you lifted 12,000 lb" into
 * "you squatted, hinged and pressed, and never pulled".
 *
 * `exercise.movement_pattern` is free text, not an enum, so this module does
 * not pretend to know every value. It formats whatever arrives and gives the
 * known ones a stable order, which is the part that matters: a stacked chart
 * whose bands reshuffle between renders is unreadable even when every number
 * in it is right.
 */

/** The remainder bucket's key. Chosen not to collide with a real pattern. */
export const remainderPatternKey = '__remainder__';

/**
 * Canonical draw order, bottom of the stack up. Lower body first, then push,
 * then pull, then everything smaller — so the stack reads in roughly the
 * order a program is usually built, and the heaviest bands sit at the base
 * where their length is easiest to judge against the axis.
 */
const canonicalOrder = [
  'squat',
  'hinge',
  'lunge',
  'horizontal-push',
  'vertical-push',
  'horizontal-pull',
  'vertical-pull',
  'carry',
  'core',
  'isolation-arm',
  'isolation-leg',
  'isolation-shoulder',
  'cardio',
] as const;

const explicitLabels: Record<string, string> = {
  'isolation-arm': 'Arm isolation',
  'isolation-leg': 'Leg isolation',
  'isolation-shoulder': 'Shoulder isolation',
};

/**
 * A display label for a pattern key. Unknown keys are title-cased rather than
 * dropped or shown raw, so a pattern added to the library later reads
 * acceptably without a code change here.
 */
export function movementPatternLabel(key: string): string {
  if (key === remainderPatternKey) return 'Other';
  const explicit = explicitLabels[key];
  if (explicit) return explicit;
  const words = key.trim().replace(/[-_]+/g, ' ').trim();
  if (!words) return 'Unlabelled';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/**
 * Orders pattern keys for stacking: known patterns in canonical order first,
 * then anything unrecognised alphabetically, then the remainder bucket last
 * so "Other" always sits at the top of the stack.
 */
export function orderMovementPatterns(keys: readonly string[]): string[] {
  const rank = (key: string) => {
    if (key === remainderPatternKey) return Number.MAX_SAFE_INTEGER;
    const index = canonicalOrder.indexOf(key as (typeof canonicalOrder)[number]);
    return index === -1 ? canonicalOrder.length : index;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Higher-level groups, and the default way composition is drawn.
 *
 * Capping the detailed patterns at a palette-sized limit was tried first and
 * looked wrong the moment it was rendered: with eight patterns in play, four
 * got folded and the grey "Other" band became one of the largest things on
 * the chart — a quarter of every column labelled "unspecified". A remainder
 * that big is worse than no breakdown at all.
 *
 * Grouping fixes it at the source rather than by tuning a threshold. These
 * five are the categories training is actually planned in ("push day", "pull
 * day", "leg day"), they are individually meaningful at a glance, and they
 * are stable — a new pattern added to the library lands in an existing group
 * instead of pushing a real one into the remainder.
 *
 * `cardio` is absent deliberately: it carries no load, so it contributes no
 * volume and can never appear on this chart.
 */
export const movementPatternGroups = ['legs', 'push', 'pull', 'core-carry', 'isolation'] as const;
export type MovementPatternGroup = (typeof movementPatternGroups)[number];

const groupByPattern: Record<string, MovementPatternGroup> = {
  squat: 'legs',
  hinge: 'legs',
  lunge: 'legs',
  'horizontal-push': 'push',
  'vertical-push': 'push',
  'horizontal-pull': 'pull',
  'vertical-pull': 'pull',
  core: 'core-carry',
  carry: 'core-carry',
  'isolation-arm': 'isolation',
  'isolation-leg': 'isolation',
  'isolation-shoulder': 'isolation',
};

const groupLabels: Record<MovementPatternGroup, string> = {
  legs: 'Legs',
  push: 'Push',
  pull: 'Pull',
  'core-carry': 'Core & carry',
  isolation: 'Isolation',
};

/**
 * The group a pattern belongs to, or `null` for one we do not recognise.
 * Unrecognised patterns are surfaced as the remainder rather than guessed at:
 * putting an unknown movement in the wrong group is a worse error than
 * admitting it is ungrouped.
 */
export function movementPatternGroupOf(key: string): MovementPatternGroup | null {
  return groupByPattern[key] ?? null;
}

export function movementPatternGroupLabel(group: string): string {
  if (group === remainderPatternKey) return 'Other';
  return groupLabels[group as MovementPatternGroup] ?? movementPatternLabel(group);
}

/** Draw order for groups, bottom of the stack up. */
export function orderMovementPatternGroups(keys: readonly string[]): string[] {
  const rank = (key: string) => {
    if (key === remainderPatternKey) return Number.MAX_SAFE_INTEGER;
    const index = movementPatternGroups.indexOf(key as MovementPatternGroup);
    return index === -1 ? movementPatternGroups.length : index;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Rolls per-pattern values up into group totals. Patterns with no known group
 * are summed into the remainder, so the total is always preserved.
 */
export function groupPatternValues(
  values: Readonly<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!(value > 0)) continue;
    const group = movementPatternGroupOf(key) ?? remainderPatternKey;
    result[group] = (result[group] ?? 0) + value;
  }
  return result;
}

export interface PatternTotal {
  key: string;
  total: number;
}

export interface CollapsedPatterns {
  /** Keys to draw, in stack order, including the remainder if one was made. */
  keys: string[];
  /** How many real patterns the remainder stands for; 0 when none was made. */
  remainderCount: number;
}

/**
 * Collapses a long tail of patterns into a single remainder bucket.
 *
 * The limit is a legibility constraint, not a palette shortage: past five or
 * six bands a stacked column becomes a stripe of colours nobody can map back
 * to a legend, and the small bands at the top are exactly the ones too thin
 * to identify anyway. Collapsing keeps the total honest — the remainder is
 * still drawn, so the stack height never changes — while making the bands
 * that carry the message legible.
 *
 * A remainder is only created for **two or more** leftover patterns. Folding
 * a single pattern into "Other" would hide a real name behind a vaguer one
 * for no gain in legibility.
 */
export function collapsePatterns(
  totals: readonly PatternTotal[],
  limit: number,
): CollapsedPatterns {
  const ranked = [...totals]
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

  if (ranked.length <= limit) {
    return { keys: orderMovementPatterns(ranked.map((entry) => entry.key)), remainderCount: 0 };
  }

  const kept = ranked.slice(0, limit);
  const tail = ranked.slice(limit);
  if (tail.length < 2) {
    return { keys: orderMovementPatterns(ranked.map((entry) => entry.key)), remainderCount: 0 };
  }

  return {
    keys: orderMovementPatterns([...kept.map((entry) => entry.key), remainderPatternKey]),
    remainderCount: tail.length,
  };
}

/**
 * Rewrites a bucket's per-pattern values so everything outside `keys` is
 * summed into the remainder. Returns a new record; the input is untouched.
 */
export function applyRemainder(
  values: Readonly<Record<string, number>>,
  keys: readonly string[],
): Record<string, number> {
  const keep = new Set(keys);
  if (!keep.has(remainderPatternKey)) {
    const filtered: Record<string, number> = {};
    for (const [key, value] of Object.entries(values)) {
      if (keep.has(key) && value > 0) filtered[key] = value;
    }
    return filtered;
  }

  const result: Record<string, number> = {};
  let remainder = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!(value > 0)) continue;
    if (keep.has(key)) result[key] = value;
    else remainder += value;
  }
  if (remainder > 0) result[remainderPatternKey] = remainder;
  return result;
}
