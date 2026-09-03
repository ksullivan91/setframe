import { describe, expect, it } from 'vitest';
import {
  buildCompletedSessionReadout,
  formatSessionDuration,
  formatSessionMeta,
  formatSessionTotalSuffix,
  type CompletedSessionExercise,
  sessionHeadlineStats,
} from './completed-session';

const set = (over: Partial<CompletedSessionExercise['sets'][number]> = {}) => ({
  setType: 'working' as const,
  weightValue: 100,
  reps: 10,
  durationSeconds: null,
  distanceValue: null,
  rpe: null,
  isPrWeight: false,
  isPrReps: false,
  ...over,
});

const strength = (
  sets: CompletedSessionExercise['sets'],
  previous?: CompletedSessionExercise['sets'],
): CompletedSessionExercise => ({
  prescription: { kind: 'sets_reps', sets: sets.length },
  sets,
  previousSession: previous ? { sets: previous } : null,
});

describe('buildCompletedSessionReadout', () => {
  it('sums volume across exercises', () => {
    const readout = buildCompletedSessionReadout([
      strength([set(), set()]),
      strength([set({ weightValue: 50, reps: 20 })]),
    ]);
    expect(readout.totalVolume).toBe(100 * 10 * 2 + 50 * 20);
  });

  it('counts logged sets by the canonical rule, warm-ups included', () => {
    const readout = buildCompletedSessionReadout([
      strength([set(), set({ setType: 'warmup' }), set({ weightValue: null, reps: null })]),
    ]);
    /* Two are logged; the third has neither required field and is not. */
    expect(readout.loggedSetCount).toBe(2);
  });

  it('counts personal records per set, not per exercise', () => {
    const readout = buildCompletedSessionReadout([
      strength([set({ isPrWeight: true }), set({ isPrReps: true })]),
    ]);
    expect(readout.personalRecordCount).toBe(2);
  });

  it('compares against each exercise previous session', () => {
    const readout = buildCompletedSessionReadout([
      strength([set({ weightValue: 110 })], [set({ weightValue: 100 })]),
    ]);
    expect(readout.volumeDelta).toBe(110 * 10 - 100 * 10);
    expect(readout.comparedExerciseCount).toBe(1);
  });

  it('returns a null delta when nothing has history, rather than a fabricated zero', () => {
    /* The rule the per-exercise readout follows: never render a comparison
       that no data supports. A first-ever session shows one fewer figure. */
    const readout = buildCompletedSessionReadout([strength([set()])]);
    expect(readout.volumeDelta).toBeNull();
    expect(formatSessionTotalSuffix(readout)).toBe('lb total');
  });

  it('excludes kinds that do not count toward volume from the comparison', () => {
    const plank: CompletedSessionExercise = {
      prescription: { kind: 'timed' },
      sets: [set({ weightValue: null, reps: null, durationSeconds: 60 })],
      previousSession: { sets: [set({ weightValue: null, reps: null, durationSeconds: 30 })] },
    };
    const readout = buildCompletedSessionReadout([plank]);
    /* A plank has no volume, so it must not drag the session delta to zero
       and must not count as an exercise we compared. */
    expect(readout.totalVolume).toBe(0);
    expect(readout.volumeDelta).toBeNull();
    expect(readout.comparedExerciseCount).toBe(0);
  });
});

describe('formatSessionDuration', () => {
  it('reads mm:ss under an hour', () => {
    const start = '2026-08-29T10:00:00.000Z';
    const end = '2026-08-29T10:52:10.000Z';
    expect(formatSessionDuration(start, end)).toBe('52:10');
  });

  it('reads h:mm:ss over an hour, because 72:30 is ambiguous', () => {
    const start = '2026-08-29T10:00:00.000Z';
    const end = '2026-08-29T11:12:30.000Z';
    expect(formatSessionDuration(start, end)).toBe('1:12:30');
  });

  it('is null when either timestamp is missing', () => {
    expect(formatSessionDuration(null, '2026-08-29T10:00:00.000Z')).toBeNull();
    expect(formatSessionDuration('2026-08-29T10:00:00.000Z', null)).toBeNull();
  });
});

describe('formatSessionMeta', () => {
  it('joins every available segment', () => {
    expect(
      formatSessionMeta({
        title: 'Upper Body — Push',
        duration: '52:10',
        loggedSetCount: 11,
        personalRecordCount: 1,
      }),
    ).toBe('Upper Body — Push · 52:10 · 11 sets · 1 PR');
  });

  it('omits missing segments rather than showing them empty', () => {
    expect(
      formatSessionMeta({ title: null, duration: null, loggedSetCount: 11, personalRecordCount: 0 }),
    ).toBe('11 sets');
  });

  it('singularises', () => {
    expect(
      formatSessionMeta({ title: null, duration: null, loggedSetCount: 1, personalRecordCount: 1 }),
    ).toBe('1 set · 1 PR');
  });
});

describe('formatSessionTotalSuffix', () => {
  const base = {
    totalVolume: 0,
    loggedSetCount: 0,
    personalRecordCount: 0,
    comparedExerciseCount: 1,
    summaryMetric: 'volume' as const,
    totalDurationSeconds: 0,
    totalDistanceMiles: 0,
    totalReps: 0,
  };

  it('signs an increase and formats thousands', () => {
    expect(formatSessionTotalSuffix({ ...base, volumeDelta: 1340 })).toBe(
      'lb total · +1,340 lb vs last session',
    );
  });

  it('uses a minus sign, not a hyphen, for a decrease', () => {
    expect(formatSessionTotalSuffix({ ...base, volumeDelta: -140 })).toBe(
      'lb total · −140 lb vs last session',
    );
  });

  it('says matched rather than +0', () => {
    expect(formatSessionTotalSuffix({ ...base, volumeDelta: 0 })).toBe(
      'lb total · matched last session',
    );
  });

  it('claims no pounds for a session that was never measured in them', () => {
    // A treadmill walk has no lb total and never did.
    expect(
      formatSessionTotalSuffix({ ...base, summaryMetric: 'duration', volumeDelta: null }),
    ).toBe('');
    expect(formatSessionTotalSuffix({ ...base, summaryMetric: 'distance', volumeDelta: 0 })).toBe('');
  });
});

describe('volume units', () => {
  function exercise(sets: { weightValue: number | null; reps: number | null; weightUnit?: string | null }[]) {
    return {
      prescription: { kind: 'sets_reps', sets: sets.length } as never,
      sets: sets.map((set, i) => ({
        id: `s${i}`,
        clientId: `c${i}`,
        setType: 'working' as const,
        weightValue: set.weightValue,
        weightUnit: set.weightUnit ?? null,
        reps: set.reps,
        durationSeconds: null,
        distanceValue: null,
        distanceUnit: null,
        rpe: null,
      })),
    };
  }

  it('counts a set with no unit, because that is what the app stores', () => {
    /* The load-bearing case. The logger never sends `weightUnit`, and the
       API stores `loadUnit: weightUnit ?? null`, so every real set has a
       null unit. A copy of this on Today required `=== 'lb'` and therefore
       reported no volume at all while Review Workout showed the true
       figure — the mismatch that was reported. */
    const readout = buildCompletedSessionReadout([
      exercise([{ weightValue: 225, reps: 5, weightUnit: null }]),
    ] as never);
    expect(readout.totalVolume).toBe(1125);
  });

  it('converts a kilogram set rather than adding it raw', () => {
    /* The other half. Adding kg as though it were lb overstates the day by
       2.2x; dropping it understates it. */
    const readout = buildCompletedSessionReadout([
      exercise([{ weightValue: 100, reps: 5, weightUnit: 'kg' }]),
    ] as never);
    expect(readout.totalVolume).toBe(1102); // 100kg × 2.20462 × 5
  });

  it('ignores a unit it cannot interpret instead of guessing', () => {
    const readout = buildCompletedSessionReadout([
      exercise([{ weightValue: 100, reps: 5, weightUnit: 'stone' }]),
    ] as never);
    expect(readout.totalVolume).toBe(0);
  });

  it('contributes nothing for a set with no weight or no reps', () => {
    const readout = buildCompletedSessionReadout([
      exercise([
        { weightValue: null, reps: 5 },
        { weightValue: 225, reps: null },
      ]),
    ] as never);
    expect(readout.totalVolume).toBe(0);
  });

  it('rounds once, so two surfaces cannot round differently', () => {
    const readout = buildCompletedSessionReadout([
      exercise([{ weightValue: 100, reps: 3, weightUnit: 'kg' }]),
    ] as never);
    expect(Number.isInteger(readout.totalVolume)).toBe(true);
  });
});


describe('the headline stats', () => {
  const statsFor = (exercises: unknown[]) =>
    sessionHeadlineStats(buildCompletedSessionReadout(exercises as never)).map((s) => `${s.value} ${s.label}`);

  it('leads a walk with its duration', () => {
    expect(
      statsFor([
        {
          prescription: { kind: 'duration', durationMinutes: 40 },
          sets: [{ durationSeconds: 2530, distanceValue: 2.1 }],
        },
      ]),
    ).toEqual(['42:10 duration', '2.10 miles', '1 entry']);
  });

  it('leads bodyweight work with reps, never with 0 lb', () => {
    const stats = statsFor([
      { prescription: { kind: 'bodyweight_reps', sets: 3, reps: 12 }, sets: [{ reps: 12 }, { reps: 10 }] },
    ]);
    expect(stats).toContain('22 total reps');
    expect(stats.some((s) => s.includes('volume'))).toBe(false);
  });

  it('leads strength work with volume, as before', () => {
    expect(
      statsFor([
        { prescription: { kind: 'sets_reps', sets: 1, reps: 5 }, sets: [{ weightValue: 225, reps: 5 }] },
      ]),
    ).toEqual(['1 sets', '1,125 volume lb', '0 PRs']);
  });

  it('omits a distance a duration session never recorded', () => {
    const stats = statsFor([
      { prescription: { kind: 'duration', durationMinutes: 20 }, sets: [{ durationSeconds: 1200 }] },
    ]);
    expect(stats.some((s) => s.includes('miles'))).toBe(false);
  });
});

describe('session shapes', () => {
  /* Eight prescription kinds exist and every consumer of this readout used
     to assume the first. These are the other seven. */
  const walk = {
    prescription: { kind: 'duration' as const, durationMinutes: 40 },
    sets: [{ durationSeconds: 2530, reps: null, weightValue: null, distanceValue: 2.1 }],
  };

  it('reports a treadmill walk as time, not as zero pounds', () => {
    const r = buildCompletedSessionReadout([walk as never]);
    expect(r.summaryMetric).toBe('duration');
    expect(r.totalDurationSeconds).toBe(2530);
    expect(r.totalVolume).toBe(0);
    // The bug this story exists for: 0 lb was being shown as the headline.
    expect(formatSessionTotalSuffix(r)).toBe('');
  });

  it('counts reps for bodyweight work, where volume is always zero', () => {
    const r = buildCompletedSessionReadout([
      {
        prescription: { kind: 'bodyweight_reps' as const, sets: 5, reps: 12 },
        sets: [{ reps: 12 }, { reps: 12 }, { reps: 10 }],
      } as never,
    ]);
    expect(r.summaryMetric).toBe('reps');
    expect(r.totalReps).toBe(34);
    expect(r.totalVolume).toBe(0);
  });

  it('adds distance across sets, converting kilometres', () => {
    const r = buildCompletedSessionReadout([
      {
        prescription: { kind: 'distance' as const, distanceMiles: 5 },
        sets: [
          { distanceValue: 3, distanceUnit: 'mi' },
          { distanceValue: 5, distanceUnit: 'km' },
        ],
      } as never,
    ]);
    expect(r.summaryMetric).toBe('distance');
    // 3 + (5km → 3.11mi)
    expect(r.totalDistanceMiles).toBeCloseTo(6.11, 1);
  });

  it('calls a session mixed when it genuinely is', () => {
    const r = buildCompletedSessionReadout([
      { prescription: { kind: 'sets_reps' as const, sets: 3, reps: 5 }, sets: [{ weightValue: 225, reps: 5 }] },
      walk,
    ] as never);
    expect(r.summaryMetric).toBe('mixed');
    expect(r.totalVolume).toBeGreaterThan(0);
    expect(r.totalDurationSeconds).toBe(2530);
  });

  it('ignores an exercise the user never logged when deciding the shape', () => {
    // An untouched accessory should not make a walk look mixed.
    const r = buildCompletedSessionReadout([
      walk,
      { prescription: { kind: 'sets_reps' as const, sets: 3, reps: 5 }, sets: [{ weightValue: null, reps: null }] },
    ] as never);
    expect(r.summaryMetric).toBe('duration');
  });

  it('falls back to volume for a session with nothing logged at all', () => {
    const r = buildCompletedSessionReadout([]);
    expect(r.summaryMetric).toBe('volume');
    expect(r.totalDurationSeconds).toBe(0);
  });
});
