import { describe, expect, it } from 'vitest';
import {
  availableFilters,
  describeExercise,
  filterExercises,
  formatAddLabel,
  selectedExercises,
  selectionOrder,
  toggleSelection,
  type PickableExercise,
} from './exercise-picker';

const ex = (
  id: string,
  name: string,
  movementPattern: string | null = 'horizontal-push',
  equipment: string | null = 'barbell',
): PickableExercise => ({ id, name, movementPattern, equipment });

const CATALOGUE = [
  ex('1', 'Bench Press', 'horizontal-push', 'barbell'),
  ex('2', 'Incline Bench Press', 'horizontal-push', 'dumbbell'),
  ex('3', 'Back Squat', 'squat', 'barbell'),
  ex('4', 'Bulgarian Split Squat', 'lunge', 'dumbbell'),
  ex('5', 'Farmer Carry', 'carry', null),
  ex('6', 'Sled Push', null, null),
];

describe('filterExercises', () => {
  it('matches anywhere in the name, not just the start', () => {
    /* Someone looking for a Bulgarian split squat types "split". A prefix
       match finds nothing, which is the failure this pins. */
    const found = filterExercises({ exercises: CATALOGUE, query: 'split', filter: 'all' });
    expect(found.map((e) => e.name)).toEqual(['Bulgarian Split Squat']);
  });

  it('is case-insensitive', () => {
    const found = filterExercises({ exercises: CATALOGUE, query: 'BENCH', filter: 'all' });
    expect(found).toHaveLength(2);
  });

  it('searches equipment, so "dumbbell" narrows without a filter chip', () => {
    const found = filterExercises({ exercises: CATALOGUE, query: 'dumbbell', filter: 'all' });
    expect(found.map((e) => e.id)).toEqual(['2', '4']);
  });

  it('filters by movement pattern group', () => {
    const found = filterExercises({ exercises: CATALOGUE, query: '', filter: 'legs' });
    expect(found.map((e) => e.name)).toEqual(['Back Squat', 'Bulgarian Split Squat']);
  });

  it('puts an unclassified exercise under "other" rather than losing it', () => {
    /* movementPattern is nullable and free text. An exercise we cannot
       classify must still be reachable — dropping it would make a custom
       lift invisible in the only screen that adds one. */
    const found = filterExercises({ exercises: CATALOGUE, query: '', filter: 'other' });
    expect(found.map((e) => e.name)).toEqual(['Sled Push']);
  });

  it('combines a filter and a query', () => {
    const found = filterExercises({ exercises: CATALOGUE, query: 'squat', filter: 'legs' });
    expect(found).toHaveLength(2);
  });
});

describe('availableFilters', () => {
  it('offers only groups that have exercises in them', () => {
    /* A filter that can only ever return nothing is a dead control, and on a
       phone it costs a whole row of horizontal space. */
    const filters = availableFilters([ex('1', 'Bench Press', 'horizontal-push')]);
    expect(filters.map((f) => f.key)).toEqual(['all', 'push']);
  });

  it('adds "Other" only when something would land in it', () => {
    const withUnknown = availableFilters(CATALOGUE);
    expect(withUnknown.map((f) => f.key)).toContain('other');
    const withoutUnknown = availableFilters(CATALOGUE.filter((e) => e.movementPattern));
    expect(withoutUnknown.map((f) => f.key)).not.toContain('other');
  });

  it('always leads with All', () => {
    expect(availableFilters(CATALOGUE)[0]).toEqual({ key: 'all', label: 'All' });
  });
});

describe('describeExercise', () => {
  it('reads group then equipment', () => {
    expect(describeExercise(ex('1', 'Bench Press', 'horizontal-push', 'barbell'))).toBe(
      'Push · Barbell',
    );
  });

  it('omits a half it does not have rather than printing a bare separator', () => {
    expect(describeExercise(ex('5', 'Farmer Carry', 'carry', null))).toBe('Core & carry');
    expect(describeExercise(ex('6', 'Sled Push', null, 'sled'))).toBe('Sled');
    expect(describeExercise(ex('7', 'Mystery', null, null))).toBe('');
  });
});

describe('toggleSelection and selectionOrder', () => {
  it('preserves the order things were picked in', () => {
    /* The footer promises "they are added in the order you picked them", so
       the order is the state — a Set would silently break that promise. */
    let selected: string[] = [];
    selected = toggleSelection(selected, '3');
    selected = toggleSelection(selected, '1');
    expect(selected).toEqual(['3', '1']);
    expect(selectionOrder(selected, '3')).toBe(1);
    expect(selectionOrder(selected, '1')).toBe(2);
  });

  it('renumbers the rest when one is removed, leaving no gap', () => {
    /* The badge shows position, not identity. A gap would contradict it. */
    let selected = ['a', 'b', 'c'];
    selected = toggleSelection(selected, 'b');
    expect(selected).toEqual(['a', 'c']);
    expect(selectionOrder(selected, 'c')).toBe(2);
  });

  it('reports null for anything unselected', () => {
    expect(selectionOrder(['a'], 'b')).toBeNull();
  });
});

describe('formatAddLabel', () => {
  it('singularises, because "Add 1 exercises" reads as a bug', () => {
    expect(formatAddLabel(1)).toBe('Add 1 exercise');
    expect(formatAddLabel(2)).toBe('Add 2 exercises');
  });

  it('names the action when nothing is picked yet', () => {
    expect(formatAddLabel(0)).toBe('Add exercises');
  });
});

describe('selectedExercises', () => {
  it('resolves ids back in pick order, not catalogue order', () => {
    expect(selectedExercises(CATALOGUE, ['3', '1']).map((e) => e.name)).toEqual([
      'Back Squat',
      'Bench Press',
    ]);
  });

  it('drops an id the catalogue no longer has rather than yielding a hole', () => {
    /* A stale selection surviving a catalogue refresh must not crash the
       caller with an undefined in the middle of its list. */
    expect(selectedExercises(CATALOGUE, ['1', 'gone', '3'])).toHaveLength(2);
  });
});
