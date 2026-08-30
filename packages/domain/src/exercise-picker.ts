import {
  movementPatternGroupLabel,
  movementPatternGroupOf,
  movementPatternLabel,
  movementPatternGroups,
  type MovementPatternGroup,
} from './movement-pattern';

/**
 * Search, filtering and ordered multi-select for the exercise picker.
 *
 * One picker, used by the session logger, the workout editor and guided
 * setup. The teardown's finding it answers, verbatim: *today's picker adds
 * one and closes, so building a day means reopening it per exercise*.
 *
 * The state that matters is the **order** of selection, not a set of ids.
 * The footer promises "they are added in the order you picked them", so the
 * picker has to remember that order and the badge has to show it — a
 * checkmark would make the promise unverifiable.
 *
 * ## On the filters
 *
 * The Figma frame draws anatomical filters — Chest, Back, Legs, Arms. **No
 * muscle field exists**: `exercise` carries `movement_pattern` and
 * `equipment`, and nothing else describing what a lift trains. Rather than
 * invent an anatomy column or hard-code a name-to-muscle table that would be
 * wrong for every custom exercise, the filters here are the movement-pattern
 * groups the product already classifies by, and which the Progress
 * composition chart already renders. Adding real muscle data is a catalogue
 * question, tracked separately.
 */

export interface PickableExercise {
  id: string;
  name: string;
  movementPattern: string | null;
  equipment: string | null;
}

/** `All` plus the pattern groups actually present in the catalogue. */
export interface PickerFilter {
  key: string;
  label: string;
}

export const ALL_FILTER: PickerFilter = { key: 'all', label: 'All' };

/**
 * Filters offered for a given catalogue.
 *
 * Only groups with at least one exercise are offered — a filter that can only
 * ever return nothing is a dead control, and on a phone it costs a whole row
 * of horizontal space.
 */
export function availableFilters(exercises: readonly PickableExercise[]): PickerFilter[] {
  const present = new Set<MovementPatternGroup>();
  let hasUngrouped = false;
  for (const item of exercises) {
    const group = item.movementPattern ? movementPatternGroupOf(item.movementPattern) : null;
    if (group) present.add(group);
    else hasUngrouped = true;
  }
  const groups = movementPatternGroups
    .filter((group) => present.has(group))
    .map((group) => ({ key: group, label: movementPatternGroupLabel(group) }));
  /* "Other" only when something would actually land in it. */
  return hasUngrouped ? [ALL_FILTER, ...groups, { key: 'other', label: 'Other' }] : [ALL_FILTER, ...groups];
}

/** The subtitle under an exercise name: `Push · Barbell`. */
export function describeExercise(item: PickableExercise): string {
  const segments: string[] = [];
  if (item.movementPattern) {
    const group = movementPatternGroupOf(item.movementPattern);
    segments.push(group ? movementPatternGroupLabel(group) : movementPatternLabel(item.movementPattern));
  }
  if (item.equipment) segments.push(titleCase(item.equipment));
  return segments.join(' · ');
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export interface FilterOptions {
  exercises: readonly PickableExercise[];
  query: string;
  /** `all`, a movement-pattern group, or `other`. */
  filter: string;
}

/**
 * Search and filter, in that order.
 *
 * Matching is case-insensitive and matches **anywhere** in the name, not just
 * at the start: someone looking for a Bulgarian split squat types "split",
 * and a prefix match would find nothing. Equipment is searchable too, so
 * "dumbbell" narrows to dumbbell work without a filter chip for it.
 */
export function filterExercises(options: FilterOptions): PickableExercise[] {
  const needle = options.query.trim().toLowerCase();
  return options.exercises.filter((item) => {
    if (options.filter !== ALL_FILTER.key) {
      const group = item.movementPattern ? movementPatternGroupOf(item.movementPattern) : null;
      const key = group ?? 'other';
      if (key !== options.filter) return false;
    }
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) ||
      (item.equipment?.toLowerCase().includes(needle) ?? false)
    );
  });
}

/**
 * Adds or removes an id, preserving pick order.
 *
 * Re-selecting removes, and the remaining picks **renumber** — leaving a gap
 * would contradict the badge, which shows position rather than identity.
 */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

/** 1-based pick order, or `null` when unselected. */
export function selectionOrder(selected: readonly string[], id: string): number | null {
  const index = selected.indexOf(id);
  return index === -1 ? null : index + 1;
}

/**
 * The footer's label.
 *
 * Names the count so the button says what it will do, and singularises —
 * "Add 1 exercises" in the most-used control on the screen reads as a bug.
 */
export function formatAddLabel(count: number): string {
  if (count === 0) return 'Add exercises';
  return count === 1 ? 'Add 1 exercise' : `Add ${count} exercises`;
}

/**
 * Selected ids resolved back to exercises, in pick order.
 *
 * Ids with no matching exercise are dropped rather than yielding holes — a
 * stale selection surviving a catalogue refresh must not crash the caller.
 */
export function selectedExercises(
  exercises: readonly PickableExercise[],
  selected: readonly string[],
): PickableExercise[] {
  const byId = new Map(exercises.map((item) => [item.id, item]));
  return selected.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
}
