import { describe, expect, it } from 'vitest';
import {
  applyRemainder,
  collapsePatterns,
  groupPatternValues,
  movementPatternGroupLabel,
  movementPatternGroupOf,
  movementPatternLabel,
  orderMovementPatternGroups,
  orderMovementPatterns,
  remainderPatternKey,
} from './movement-pattern';

describe('movementPatternLabel', () => {
  it('formats kebab-case keys as sentence case', () => {
    expect(movementPatternLabel('vertical-push')).toBe('Vertical push');
    expect(movementPatternLabel('hinge')).toBe('Hinge');
  });

  it('uses a readable label where the slug reads badly', () => {
    expect(movementPatternLabel('isolation-arm')).toBe('Arm isolation');
  });

  it('formats an unknown pattern rather than dropping it', () => {
    expect(movementPatternLabel('sled-drag')).toBe('Sled drag');
  });

  it('names the remainder bucket', () => {
    expect(movementPatternLabel(remainderPatternKey)).toBe('Other');
  });
});

describe('orderMovementPatterns', () => {
  it('is stable regardless of input order, so bands never reshuffle', () => {
    const a = orderMovementPatterns(['vertical-pull', 'squat', 'hinge']);
    const b = orderMovementPatterns(['hinge', 'vertical-pull', 'squat']);
    expect(a).toEqual(b);
    expect(a).toEqual(['squat', 'hinge', 'vertical-pull']);
  });

  it('always puts the remainder at the top of the stack', () => {
    const ordered = orderMovementPatterns([remainderPatternKey, 'squat', 'cardio']);
    expect(ordered.at(-1)).toBe(remainderPatternKey);
  });

  it('places unknown patterns after known ones instead of dropping them', () => {
    const ordered = orderMovementPatterns(['sled-drag', 'squat']);
    expect(ordered).toEqual(['squat', 'sled-drag']);
  });
});

describe('collapsePatterns', () => {
  const totals = [
    { key: 'squat', total: 100 },
    { key: 'hinge', total: 90 },
    { key: 'horizontal-push', total: 80 },
    { key: 'vertical-pull', total: 70 },
    { key: 'core', total: 60 },
    { key: 'cardio', total: 50 },
    { key: 'carry', total: 40 },
  ];

  it('keeps every pattern when they fit within the limit', () => {
    const result = collapsePatterns(totals.slice(0, 4), 5);
    expect(result.remainderCount).toBe(0);
    expect(result.keys).not.toContain(remainderPatternKey);
  });

  it('collapses the smallest patterns into a remainder past the limit', () => {
    const result = collapsePatterns(totals, 5);
    expect(result.remainderCount).toBe(2);
    expect(result.keys).toContain(remainderPatternKey);
    // The two smallest are the ones folded away.
    expect(result.keys).not.toContain('cardio');
    expect(result.keys).not.toContain('carry');
    expect(result.keys).toContain('squat');
  });

  it('does not hide a single pattern behind a vaguer "Other"', () => {
    const six = totals.slice(0, 6);
    const result = collapsePatterns(six, 5);
    expect(result.remainderCount).toBe(0);
    expect(result.keys).toContain('cardio');
  });

  it('ignores patterns with no volume', () => {
    const result = collapsePatterns([{ key: 'squat', total: 100 }, { key: 'carry', total: 0 }], 5);
    expect(result.keys).toEqual(['squat']);
  });
});

describe('applyRemainder', () => {
  it('sums everything outside the kept keys into the remainder', () => {
    const values = { squat: 100, hinge: 50, cardio: 20, carry: 10 };
    const result = applyRemainder(values, ['squat', 'hinge', remainderPatternKey]);
    expect(result).toEqual({ squat: 100, hinge: 50, [remainderPatternKey]: 30 });
  });

  it('preserves the total, so collapsing never changes a stack height', () => {
    const values = { squat: 100, hinge: 50, cardio: 20, carry: 10 };
    const before = Object.values(values).reduce((sum, value) => sum + value, 0);
    const after = Object.values(
      applyRemainder(values, ['squat', 'hinge', remainderPatternKey]),
    ).reduce((sum, value) => sum + value, 0);
    expect(after).toBe(before);
  });

  it('drops unkept patterns when no remainder bucket exists', () => {
    const result = applyRemainder({ squat: 100, cardio: 20 }, ['squat']);
    expect(result).toEqual({ squat: 100 });
  });

  it('writes no remainder key when nothing falls outside', () => {
    const result = applyRemainder({ squat: 100 }, ['squat', remainderPatternKey]);
    expect(result).toEqual({ squat: 100 });
  });
});

describe('movement pattern groups', () => {
  it('rolls the detailed patterns up into the five planning categories', () => {
    expect(movementPatternGroupOf('squat')).toBe('legs');
    expect(movementPatternGroupOf('hinge')).toBe('legs');
    expect(movementPatternGroupOf('vertical-push')).toBe('push');
    expect(movementPatternGroupOf('horizontal-pull')).toBe('pull');
    expect(movementPatternGroupOf('carry')).toBe('core-carry');
    expect(movementPatternGroupOf('isolation-arm')).toBe('isolation');
  });

  it('admits an unrecognised pattern is ungrouped rather than guessing', () => {
    expect(movementPatternGroupOf('sled-drag')).toBeNull();
  });

  it('preserves the total when grouping, so a stack height never changes', () => {
    const values = {
      squat: 100, hinge: 50, 'vertical-push': 40,
      'horizontal-pull': 30, carry: 10, 'sled-drag': 5,
    };
    const grouped = groupPatternValues(values);
    const before = Object.values(values).reduce((sum, v) => sum + v, 0);
    const after = Object.values(grouped).reduce((sum, v) => sum + v, 0);
    expect(after).toBe(before);
    expect(grouped).toEqual({
      legs: 150, push: 40, pull: 30, 'core-carry': 10, [remainderPatternKey]: 5,
    });
  });

  it('never produces more groups than the palette can distinguish', () => {
    // Every known pattern at once must still fit the five named groups plus
    // the remainder — this is the property that stopped "Other" from becoming
    // the largest band on the chart.
    const everything = Object.fromEntries(
      ['squat', 'hinge', 'lunge', 'horizontal-push', 'vertical-push',
       'horizontal-pull', 'vertical-pull', 'core', 'carry',
       'isolation-arm', 'isolation-leg', 'isolation-shoulder'].map((k) => [k, 10]),
    );
    const grouped = groupPatternValues(everything);
    expect(Object.keys(grouped)).toHaveLength(5);
    expect(Object.keys(grouped)).not.toContain(remainderPatternKey);
  });

  it('orders groups so the remainder is always on top', () => {
    const ordered = orderMovementPatternGroups([remainderPatternKey, 'pull', 'legs']);
    expect(ordered).toEqual(['legs', 'pull', remainderPatternKey]);
  });

  it('labels groups readably', () => {
    expect(movementPatternGroupLabel('core-carry')).toBe('Core & carry');
    expect(movementPatternGroupLabel(remainderPatternKey)).toBe('Other');
  });
});
