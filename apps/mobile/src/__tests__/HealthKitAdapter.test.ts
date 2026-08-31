declare const __dirname: string;

interface NodeFs {
  readdirSync(dir: string): string[];
  readFileSync(file: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

import type {
  DailyHealthMetrics,
  HealthAuthorizationState,
  HealthConnectionState,
  HealthSnapshot,
} from '../healthkit/HealthKitAdapter';

/**
 * Adapter unit tests.
 *
 * These matter more than usual: the real queries cannot be verified here or
 * on the Simulator (no health data exists there), so the query *shape* —
 * units, day boundary, per-metric isolation — is checked against the mocked
 * native module instead.
 */

const mockQueryStatisticsForQuantity = jest.fn();
const mockQueryCategorySamples = jest.fn();
const mockGetMostRecentQuantitySample = jest.fn();
const mockGetBiologicalSex = jest.fn();
const mockGetDateOfBirth = jest.fn();
const mockGetRequestStatusForAuthorization = jest.fn();
const mockRequestAuthorization = jest.fn();
const mockIsHealthDataAvailable = jest.fn(() => true);

jest.mock(
  '@kingstinct/react-native-healthkit',
  () => ({
    isHealthDataAvailable: () => mockIsHealthDataAvailable(),
    getRequestStatusForAuthorization: (...args: unknown[]) =>
      mockGetRequestStatusForAuthorization(...args),
    requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
    queryStatisticsForQuantity: (...args: unknown[]) => mockQueryStatisticsForQuantity(...args),
    queryCategorySamples: (...args: unknown[]) => mockQueryCategorySamples(...args),
    getMostRecentQuantitySample: (...args: unknown[]) => mockGetMostRecentQuantitySample(...args),
    getBiologicalSex: () => mockGetBiologicalSex(),
    getDateOfBirth: () => mockGetDateOfBirth(),
  }),
  { virtual: true },
);

/**
 * `await import()` is not available under jest's CJS runtime; `require`
 * after `resetModules` gives a genuinely fresh instance, which matters
 * because the adapter memoizes its native-module load in a singleton.
 *
 * Typed structurally rather than as `typeof import(...)`: the exported
 * instance is an anonymous class with private fields, which TypeScript
 * refuses to name in an inferred return type.
 */
interface Adapter {
  getConnectionState(): Promise<HealthConnectionState>;
  hasUnaskedTypes(): Promise<boolean>;
  getTodayMetrics(): Promise<DailyHealthMetrics>;
  getSnapshot(): Promise<HealthSnapshot>;
  requestAuthorization(): Promise<HealthAuthorizationState>;
  isAvailable(): Promise<boolean>;
}

async function freshAdapter(): Promise<Adapter> {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../healthkit/HealthKitAdapter');
  return mod.healthKit as Adapter;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsHealthDataAvailable.mockReturnValue(true);
  // Quiet defaults so a test that cares about one metric is not tripped by
  // the others; each test overrides what it is actually asserting.
  mockQueryCategorySamples.mockResolvedValue([]);
  mockGetMostRecentQuantitySample.mockResolvedValue(undefined);
  mockGetBiologicalSex.mockReturnValue(0);
  mockGetDateOfBirth.mockReturnValue(undefined);
});

describe('getConnectionState', () => {
  it('reads shouldRequest as "we have never asked"', async () => {
    mockGetRequestStatusForAuthorization.mockResolvedValue(1);
    await expect((await freshAdapter()).getConnectionState()).resolves.toBe('not_asked');
  });

  it('reads unnecessary as "we already asked" — not as "granted"', async () => {
    /* The distinction the whole flow rests on. `unnecessary` means iOS will
       never show the sheet again, whatever the user chose; it is emphatically
       not a grant, and nothing downstream may treat it as one. */
    mockGetRequestStatusForAuthorization.mockResolvedValue(2);
    await expect((await freshAdapter()).getConnectionState()).resolves.toBe('asked');
  });

  it('reports unavailable where HealthKit does not exist', async () => {
    mockIsHealthDataAvailable.mockReturnValue(false);
    await expect((await freshAdapter()).getConnectionState()).resolves.toBe('unavailable');
  });

  it('never throws when the native call rejects', async () => {
    mockGetRequestStatusForAuthorization.mockRejectedValue(new Error('nope'));
    await expect((await freshAdapter()).getConnectionState()).resolves.toBe('error');
  });
});

describe('getTodayMetrics', () => {
  function sum(quantity: number) {
    return { sumQuantity: { quantity, unit: 'count' }, sources: [] };
  }

  it('sums each metric over the local day in the unit the UI renders', async () => {
    mockQueryStatisticsForQuantity.mockImplementation((identifier: string) => {
      const values: Record<string, number> = {
        HKQuantityTypeIdentifierStepCount: 8432,
        HKQuantityTypeIdentifierActiveEnergyBurned: 612.4,
        HKQuantityTypeIdentifierAppleExerciseTime: 47.6,
        HKQuantityTypeIdentifierDietaryEnergyConsumed: 2180,
        HKQuantityTypeIdentifierDietaryProtein: 165.2,
        HKQuantityTypeIdentifierDietaryCarbohydrates: 209.8,
        HKQuantityTypeIdentifierDietaryFatTotal: 70,
      };
      return Promise.resolve(sum(values[identifier] ?? 0));
    });

    const metrics = await (await freshAdapter()).getTodayMetrics();

    expect(metrics).toEqual({
      steps: 8432,
      activeEnergyKcal: 612,
      exerciseMinutes: 48,
      caloriesConsumedKcal: 2180,
      proteinG: 165,
      carbsG: 210,
      fatG: 70,
    });

    /* Units are the whole ballgame: ask for the wrong one and HealthKit
       returns a plausible number in the wrong scale, which nothing
       downstream can detect. */
    const units = new Map(
      mockQueryStatisticsForQuantity.mock.calls.map((call) => [call[0], call[2].unit]),
    );
    expect(units.get('HKQuantityTypeIdentifierStepCount')).toBe('count');
    expect(units.get('HKQuantityTypeIdentifierActiveEnergyBurned')).toBe('kcal');
    expect(units.get('HKQuantityTypeIdentifierAppleExerciseTime')).toBe('min');
    expect(units.get('HKQuantityTypeIdentifierDietaryEnergyConsumed')).toBe('kcal');
    expect(units.get('HKQuantityTypeIdentifierDietaryProtein')).toBe('g');
    expect(units.get('HKQuantityTypeIdentifierDietaryCarbohydrates')).toBe('g');
    expect(units.get('HKQuantityTypeIdentifierDietaryFatTotal')).toBe('g');
    expect(units.get('HKQuantityTypeIdentifierHeartRateVariabilitySDNN')).toBe('ms');
    expect(units.get('HKQuantityTypeIdentifierRestingHeartRate')).toBe('count/min');
    expect(mockQueryStatisticsForQuantity.mock.calls[0]![1]).toEqual(['cumulativeSum']);
  });

  it('bounds the window at local midnight, not UTC midnight', async () => {
    /* Every daily record is keyed on local_date per architecture §5. A UTC
       boundary would attribute an evening walk to tomorrow for anyone west
       of Greenwich. */
    mockQueryStatisticsForQuantity.mockResolvedValue(sum(1));
    await (await freshAdapter()).getTodayMetrics();

    const { startDate, endDate } = mockQueryStatisticsForQuantity.mock.calls[0]![2].filter.date;
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);
    expect(startDate.getSeconds()).toBe(0);
    expect(startDate.toDateString()).toBe(new Date().toDateString());
    expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
  });

  it('keeps granted metrics when a refused one throws', async () => {
    /* A refused read behaves like an empty store — or throws. Either way it
       must not take the three the user did grant down with it, which is why
       each query is settled on its own. */
    mockQueryStatisticsForQuantity.mockImplementation((identifier: string) =>
      identifier === 'HKQuantityTypeIdentifierActiveEnergyBurned'
        ? Promise.reject(new Error('not authorized'))
        : Promise.resolve(sum(100)),
    );

    const metrics = await (await freshAdapter()).getTodayMetrics();

    expect(metrics.activeEnergyKcal).toBeNull();
    expect(metrics.steps).toBe(100);
    expect(metrics.exerciseMinutes).toBe(100);
    expect(metrics.caloriesConsumedKcal).toBe(100);
  });

  it('reports a metric with no samples as null, never as zero', async () => {
    /* Zero is a claim that the user walked no steps. Null is the truth: we
       have nothing. The card renders them differently and must. */
    mockQueryStatisticsForQuantity.mockResolvedValue({ sources: [] });
    const metrics = await (await freshAdapter()).getTodayMetrics();
    expect(metrics).toEqual({
      steps: null,
      activeEnergyKcal: null,
      exerciseMinutes: null,
      caloriesConsumedKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });
});

describe('mockRequestAuthorization', () => {
  it('asks for read access only — Setframe never writes to HealthKit', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    await (await freshAdapter()).requestAuthorization();

    const payload = mockRequestAuthorization.mock.calls[0]![0];
    /* The load-bearing half: `toShare` must stay absent. Asking to write
       would put Setframe in the position of being able to alter someone's
       health record, which the product has never wanted and the priming
       screen explicitly promises against. */
    expect(payload.toShare).toBeUndefined();
    expect(payload.toRead).toEqual(expect.arrayContaining([
      'HKQuantityTypeIdentifierStepCount',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKQuantityTypeIdentifierAppleExerciseTime',
      'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      'HKQuantityTypeIdentifierDietaryProtein',
      'HKCategoryTypeIdentifierSleepAnalysis',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'HKQuantityTypeIdentifierBodyMass',
      'HKCharacteristicTypeIdentifierBiologicalSex',
      'HKCharacteristicTypeIdentifierDateOfBirth',
    ]));
  });
});

describe('sleep', () => {
  /** A night crosses midnight, so evening hours belong to yesterday.
   *  Building them all on today's date makes 23:00 → 01:00 a negative
   *  interval, which the merge correctly discards — and the fixture then
   *  silently tests nothing. */
  const H = (hour: number, minute = 0) => {
    const d = new Date();
    if (hour >= 18) d.setDate(d.getDate() - 1);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  /** value 1/3/4/5 are asleep; 0 is inBed and 2 is awake. */
  const sample = (value: number, start: Date, end: Date) => ({
    value,
    startDate: start,
    endDate: end,
  });

  it('counts time asleep, not time in bed', async () => {
    /* Counting `inBed` inflates the number in exactly the way that would
       have a coach tell an exhausted person they are well rested. */
    mockQueryCategorySamples.mockResolvedValue([
      sample(0, H(22), H(23)), // inBed, an hour of reading
      sample(3, H(23), H(1)), // asleepCore, 2h
      sample(2, H(1), H(1, 30)), // awake, 30m
      sample(5, H(1, 30), H(3, 30)), // asleepREM, 2h
    ]);
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.recovery.sleepMinutes).toBe(240);
  });

  it('merges overlapping samples instead of adding them', async () => {
    /* A phone and a watch both writing the same night is normal. Summing
       naively reports 16 hours of sleep for an 8-hour night. */
    mockQueryCategorySamples.mockResolvedValue([
      sample(3, H(23), H(3)),
      sample(4, H(23, 30), H(3)),
      sample(1, H(0), H(3)),
    ]);
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.recovery.sleepMinutes).toBe(240);
  });

  it('reports no sleep data as null rather than zero minutes', async () => {
    mockQueryCategorySamples.mockResolvedValue([]);
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.recovery.sleepMinutes).toBeNull();
  });

  it('looks back to yesterday evening, not to midnight', async () => {
    /* Sleep straddles the date boundary. A midnight-to-now window reports
       roughly half a night and calls it a full one. */
    mockQueryCategorySamples.mockResolvedValue([]);
    await (await freshAdapter()).getSnapshot();
    const { startDate } = mockQueryCategorySamples.mock.calls[0]![1].filter.date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(startDate.getHours()).toBe(18);
    expect(startDate.toDateString()).toBe(yesterday.toDateString());
  });
});

describe('body profile', () => {
  it('reads body fat as a percentage, not the raw fraction', async () => {
    /* HealthKit returns 0.14 under the "%" unit, meaning 14%. Rendering it
       raw shows a bodybuilder as 0.1% body fat. */
    mockGetMostRecentQuantitySample.mockImplementation((identifier: string) =>
      Promise.resolve(
        identifier === 'HKQuantityTypeIdentifierBodyFatPercentage'
          ? { quantity: 0.142 }
          : undefined,
      ),
    );
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.body.bodyFatPercent).toBe(14.2);
  });

  it('converts height from metres to centimetres', async () => {
    mockGetMostRecentQuantitySample.mockImplementation((identifier: string) =>
      Promise.resolve(
        identifier === 'HKQuantityTypeIdentifierHeight' ? { quantity: 1.803 } : undefined,
      ),
    );
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.body.heightCm).toBe(180);
  });

  it('maps biological sex and leaves notSet as null', async () => {
    mockGetBiologicalSex.mockReturnValue(2);
    expect((await (await freshAdapter()).getSnapshot()).body.biologicalSex).toBe('male');
    mockGetBiologicalSex.mockReturnValue(0);
    expect((await (await freshAdapter()).getSnapshot()).body.biologicalSex).toBeNull();
  });

  it('does not count a birthday that has not happened yet this year', async () => {
    const now = new Date();
    const dob = new Date(now.getFullYear() - 30, now.getMonth(), now.getDate() + 1);
    // Guard: only meaningful when tomorrow is still in the same month.
    if (dob.getMonth() === now.getMonth()) {
      mockGetDateOfBirth.mockReturnValue(dob);
      const snapshot = await (await freshAdapter()).getSnapshot();
      expect(snapshot.body.ageYears).toBe(29);
    }
  });

  it('survives a phone that has no body data at all', async () => {
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.body).toEqual({
      weightKg: null,
      heightCm: null,
      bodyFatPercent: null,
      biologicalSex: null,
      dateOfBirth: null,
      ageYears: null,
    });
  });
});

describe('nutrition source', () => {
  function sourced(name: string, quantity: number) {
    return { sumQuantity: { quantity, unit: 'kcal' }, sources: [{ name }] };
  }

  it('names whichever tracker actually wrote the food', async () => {
    /* Setframe has no nutrition integration. Any tracker that syncs to
       Apple Health works identically, and the card reports the one it
       found rather than assuming MyFitnessPal. */
    mockQueryStatisticsForQuantity.mockImplementation((identifier: string) =>
      Promise.resolve(
        identifier === 'HKQuantityTypeIdentifierDietaryEnergyConsumed'
          ? sourced('Cronometer', 2100)
          : { sources: [] },
      ),
    );
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.nutritionSource).toBe('Cronometer');
    expect(snapshot.daily.caloriesConsumedKcal).toBe(2100);
  });

  it('falls back to a macro source when only macros are written', async () => {
    mockQueryStatisticsForQuantity.mockImplementation((identifier: string) =>
      Promise.resolve(
        identifier === 'HKQuantityTypeIdentifierDietaryProtein'
          ? { sumQuantity: { quantity: 150, unit: 'g' }, sources: [{ name: 'MacroFactor' }] }
          : { sources: [] },
      ),
    );
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.nutritionSource).toBe('MacroFactor');
  });

  it('never reports the nitro proxy as the app that logged your food', async () => {
    /* SourceProxy extends both nitro's HybridObject and HealthKit's Source,
       and both declare `name`. Nitro's wins at runtime, so reading `.name`
       returned the literal "SourceProxy" — which shipped to the user as the
       name of their nutrition tracker. */
    mockQueryStatisticsForQuantity.mockResolvedValue({
      sumQuantity: { quantity: 2100, unit: 'kcal' },
      sources: [{ name: 'SourceProxy' }],
    });
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.nutritionSource).toBeNull();
  });

  it('prefers toJSON(), where name means the app name', async () => {
    mockQueryStatisticsForQuantity.mockResolvedValue({
      sumQuantity: { quantity: 2100, unit: 'kcal' },
      sources: [{ name: 'SourceProxy', toJSON: () => ({ name: 'Cronometer' }) }],
    });
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.nutritionSource).toBe('Cronometer');
  });

  it('reports no source when nothing wrote nutrition', async () => {
    mockQueryStatisticsForQuantity.mockResolvedValue({ sources: [] });
    const snapshot = await (await freshAdapter()).getSnapshot();
    expect(snapshot.nutritionSource).toBeNull();
  });
});

describe('extended permissions', () => {
  it('computes connection state from the core types only', async () => {
    /* Adding sleep/HRV/body types must not flip an existing user back to
       "Not connected" just because the newcomers are undetermined. */
    mockGetRequestStatusForAuthorization.mockImplementation((payload: { toRead: string[] }) =>
      Promise.resolve(payload.toRead.length <= 4 ? 2 : 1),
    );
    const adapter = await freshAdapter();
    await expect(adapter.getConnectionState()).resolves.toBe('asked');
  });

  it('reports that a shorter second sheet is available', async () => {
    mockGetRequestStatusForAuthorization.mockImplementation((payload: { toRead: string[] }) =>
      Promise.resolve(payload.toRead.length <= 4 ? 2 : 1),
    );
    await expect((await freshAdapter()).hasUnaskedTypes()).resolves.toBe(true);
  });

  it('stops offering the second sheet once everything has been asked', async () => {
    mockGetRequestStatusForAuthorization.mockResolvedValue(2);
    await expect((await freshAdapter()).hasUnaskedTypes()).resolves.toBe(false);
  });
});

describe('read-only guarantee', () => {
  /**
   * A source-level guard, not a behavioural one.
   *
   * Setframe must never write to Apple Health — the priming screen promises
   * it in writing, and the user's own weigh-in must stay in our DB rather
   * than being pushed into their health record. Every other test here can
   * only prove that the code paths we happen to call do not write; this one
   * proves the capability is absent from the module entirely, so a future
   * "just sync the weight back" change fails loudly instead of quietly
   * shipping.
   */
  it('imports no HealthKit write API at all', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as NodeFs;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as NodePath;

    const dir = path.join(__dirname, '..', 'healthkit');
    const sources = fs
      .readdirSync(dir)
      .filter((file: string) => file.endsWith('.ts') || file.endsWith('.tsx'))
      .map((file: string) => fs.readFileSync(path.join(dir, file), 'utf8'));

    expect(sources.length).toBeGreaterThan(0);

    const WRITE_APIS = [
      'saveQuantitySample',
      'saveCategorySample',
      'saveCorrelationSample',
      'saveWorkoutSample',
      'saveStateOfMindSample',
      'deleteObjects',
      'toShare',
    ];
    const offenders: string[] = [];
    for (const source of sources) {
      // Strip comments so the prose explaining *why* we don't write does
      // not itself trip the guard.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const api of WRITE_APIS) {
        if (code.includes(api)) offenders.push(api);
      }
    }
    expect(offenders).toEqual([]);
  });
});
