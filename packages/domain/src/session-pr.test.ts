import { describe, expect, it } from 'vitest';
import { isPrEligible, resolveSessionPRs, toPrBaseline, type PRCandidateSet } from './index';

function set(id: string, weightValue: number | null, reps: number | null, setType = 'working'): PRCandidateSet {
  return { id, weightValue, reps, setType };
}

function flagsFor(history: { weightValue: number | null; reps: number | null }[], sets: PRCandidateSet[]) {
  const resolved = resolveSessionPRs({ history, sets });
  return sets.map((s) => ({
    id: s.id,
    weight: resolved.get(s.id)!.isPrWeight,
    reps: resolved.get(s.id)!.isPrReps,
  }));
}

/**
 * The exact sequence from the August 22 gym test, which is what this module
 * exists to fix: an opening 85 × 6, a heavier 105 × 6, and a deliberate
 * 1 lb × 1 probe all showed both Weight PR and Rep PR simultaneously.
 */
describe('resolveSessionPRs — the gym regression', () => {
  const gymSets = [set('a', 85, 6), set('b', 105, 6), set('c', 1, 1)];

  it('awards no badges at all when the exercise has no history', () => {
    expect(flagsFor([], gymSets)).toEqual([
      { id: 'a', weight: false, reps: false },
      { id: 'b', weight: false, reps: false },
      { id: 'c', weight: false, reps: false },
    ]);
  });

  it('gives the weight PR to 105 x 6 and nothing to the 1 x 1 probe', () => {
    const history = [{ weightValue: 95, reps: 5 }];
    expect(flagsFor(history, gymSets)).toEqual([
      // 85 never beat the 95 baseline.
      { id: 'a', weight: false, reps: false },
      // A weight PR, but not a rep PR — 105 has never been lifted before, so
      // there is no rep count at that load to beat.
      { id: 'b', weight: true, reps: false },
      { id: 'c', weight: false, reps: false },
    ]);
  });

  it('never leaves a stale badge on a superseded set', () => {
    const history = [{ weightValue: 80, reps: 5 }];
    const flags = flagsFor(history, gymSets);
    // 85 briefly held the record but 105 took it; only one holder remains.
    expect(flags.filter((f) => f.weight).map((f) => f.id)).toEqual(['b']);
  });
});

describe('resolveSessionPRs — record semantics', () => {
  const history = [{ weightValue: 100, reps: 5 }];

  it('requires a strictly greater load for a weight PR', () => {
    expect(flagsFor(history, [set('a', 100, 5)])[0]!).toEqual({ id: 'a', weight: false, reps: false });
    expect(flagsFor(history, [set('a', 101, 5)])[0]!.weight).toBe(true);
  });

  it('awards a rep PR for more reps at the same weight', () => {
    expect(flagsFor(history, [set('a', 100, 6)])[0]!).toEqual({ id: 'a', weight: false, reps: true });
  });

  it('awards a weight PR but not a rep PR for a higher weight at the same reps', () => {
    // Reps did not improve, and 110 has never been lifted before — a single
    // weight badge is the honest signal.
    expect(flagsFor(history, [set('a', 110, 5)])[0]!).toEqual({ id: 'a', weight: true, reps: false });
  });

  it('withholds a rep PR for high reps at a lighter, never-before-used load', () => {
    // 20 reps at 45 lb is not a strength record over 5 reps at 100 lb.
    expect(flagsFor(history, [set('a', 45, 20)])[0]!).toEqual({ id: 'a', weight: false, reps: false });
  });

  it('awards a rep PR once the lighter load has its own history', () => {
    const withLightHistory = [...history, { weightValue: 45, reps: 12 }];
    expect(flagsFor(withLightHistory, [set('a', 45, 20)])[0]!.reps).toBe(true);
    expect(flagsFor(withLightHistory, [set('a', 45, 12)])[0]!.reps).toBe(false);
  });

  it('compares against earlier sets in the same session, not just history', () => {
    const flags = flagsFor(history, [set('a', 105, 5), set('b', 110, 5), set('c', 107, 5)]);
    expect(flags).toEqual([
      { id: 'a', weight: false, reps: false },
      { id: 'b', weight: true, reps: false },
      // 107 beat the baseline but not the 110 logged moments earlier.
      { id: 'c', weight: false, reps: false },
    ]);
  });
});

describe('resolveSessionPRs — set-type eligibility', () => {
  const history = [{ weightValue: 100, reps: 5 }];

  it('never awards a PR to a warm-up', () => {
    expect(flagsFor(history, [set('a', 200, 8, 'warmup')])[0]!).toEqual({ id: 'a', weight: false, reps: false });
  });

  it('excludes drop and failure sets, which are performed under fatigue', () => {
    expect(flagsFor(history, [set('a', 200, 8, 'drop')])[0]!.weight).toBe(false);
    expect(flagsFor(history, [set('a', 200, 8, 'failure')])[0]!.weight).toBe(false);
  });

  it('accepts working, top and backoff sets', () => {
    for (const type of ['working', 'top', 'backoff']) {
      expect(flagsFor(history, [set('a', 200, 8, type)])[0]!.weight).toBe(true);
    }
  });

  it('does not let an ineligible set poison the running baseline', () => {
    const flags = flagsFor(history, [set('a', 500, 20, 'warmup'), set('b', 105, 5)]);
    expect(flags[1]!.weight).toBe(true);
  });

  it('ignores incomplete sets', () => {
    expect(flagsFor(history, [set('a', null, 5)])[0]!.weight).toBe(false);
    expect(flagsFor(history, [set('a', 200, null)])[0]!.weight).toBe(false);
  });
});

/**
 * The resolver is a pure function of history plus the current set list, so
 * editing or deleting a set is just a re-run — there is no incremental state
 * that can be left stale.
 */
describe('resolveSessionPRs — edits and deletions', () => {
  const history = [{ weightValue: 100, reps: 5 }];

  it('moves the badge back when the record-holding set is deleted', () => {
    const before = flagsFor(history, [set('a', 105, 5), set('b', 115, 5)]);
    expect(before[1]!.weight).toBe(true);

    const after = flagsFor(history, [set('a', 105, 5)]);
    expect(after[0]!.weight).toBe(true);
  });

  it('drops the badge when the record-holding set is edited downward', () => {
    const after = flagsFor(history, [set('a', 105, 5), set('b', 90, 5)]);
    expect(after).toEqual([
      { id: 'a', weight: true, reps: false },
      { id: 'b', weight: false, reps: false },
    ]);
  });

  it('is deterministic — re-running produces identical flags', () => {
    const sets = [set('a', 105, 5), set('b', 115, 6)];
    expect(flagsFor(history, sets)).toEqual(flagsFor(history, sets));
  });
});

describe('toPrBaseline', () => {
  it('drops warm-ups and incomplete sets from the baseline', () => {
    expect(
      toPrBaseline([
        { setType: 'warmup', weightValue: 500, reps: 10 },
        { setType: 'working', weightValue: 100, reps: 5 },
        { setType: 'working', weightValue: null, reps: 5 },
      ]),
    ).toEqual([{ weightValue: 100, reps: 5 }]);
  });

  it('keeps untyped legacy rows rather than shrinking an established baseline', () => {
    expect(toPrBaseline([{ weightValue: 100, reps: 5 }])).toEqual([{ weightValue: 100, reps: 5 }]);
  });
});

describe('isPrEligible', () => {
  it('requires an eligible type and both metrics', () => {
    expect(isPrEligible({ setType: 'working', weightValue: 100, reps: 5 })).toBe(true);
    expect(isPrEligible({ setType: 'warmup', weightValue: 100, reps: 5 })).toBe(false);
    expect(isPrEligible({ setType: 'working', weightValue: 100, reps: null })).toBe(false);
  });
});

describe('resolveSessionPRs — rep records are scoped to a load', () => {
  it('keeps a heavier rep record when a later, lighter rep record is set', () => {
    // Regression: a single "last rep PR wins" rule stole the badge from A,
    // whose 6 reps at 100 lb is still the standing record at that load.
    const history = [
      { weightValue: 100, reps: 5 },
      { weightValue: 80, reps: 10 },
    ];
    const flags = flagsFor(history, [set('a', 100, 6), set('b', 80, 11)]);
    expect(flags.filter((f) => f.reps).map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('revokes a rep record beaten later at an equal or heavier load', () => {
    const history = [{ weightValue: 100, reps: 5 }];
    const flags = flagsFor(history, [set('a', 100, 6), set('b', 100, 8)]);
    expect(flags.filter((f) => f.reps).map((f) => f.id)).toEqual(['b']);
  });
});

describe('resolveSessionPRs — only performed sets count', () => {
  const history = [{ weightValue: 100, reps: 5 }];

  it('ignores a set that has not been ticked off', () => {
    // Sessions built from a program pre-populate planned sets with a weight
    // and reps but `completed: false`. Those are prescriptions, not lifts.
    const planned = { ...set('a', 315, 8), completed: false };
    expect(flagsFor(history, [planned])[0]!).toEqual({ id: 'a', weight: false, reps: false });
  });

  it('does not let a planned set suppress the badge on a performed one', () => {
    const planned = { ...set('a', 315, 8), completed: false };
    const performed = { ...set('b', 105, 5), completed: true };
    expect(flagsFor(history, [planned, performed])[1]!.weight).toBe(true);
  });
});
