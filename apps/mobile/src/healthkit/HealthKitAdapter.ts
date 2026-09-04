import { Platform } from 'react-native';
import {
  accumulateSamples,
  emptyHistogram,
  roundHistogram,
  HISTOGRAM_VERSION,
  type HeartRateHistogram,
  type HeartRateSample,
} from '@setframe/domain';
import {
  mapWorkoutType,
  workoutTitle,
  type DiscoveredWorkout,
} from './workout-discovery';

/**
 * Normalized health snapshot shape the rest of the app consumes. Mirrors
 * the "adapter DTO -> normalized TS health model" boundary described in
 * docs/adr/0001-healthkit-adapter.md — UI/domain code should only ever
 * see this shape, never raw HKQuantity/HKSample types.
 *
 * Totals for the local calendar day.
 */
export interface DailyHealthMetrics {
  steps: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
  caloriesConsumedKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/**
 * Last night's recovery signals. These are the numbers an AI coach needs to
 * distinguish "this athlete is under-recovered" from "this athlete is
 * sandbagging", which no amount of set data can tell it.
 */
export interface RecoveryMetrics {
  sleepMinutes: number | null;
  hrvMs: number | null;
  restingHeartRateBpm: number | null;
  /**
   * Cardio fitness, in ml/(kg·min).
   *
   * Unlike everything else here this is NOT read over last night's window.
   * watchOS only estimates VO2 max during a qualifying outdoor walk, run
   * or hike, so most days have no sample at all and a windowed read would
   * show a dash to someone whose fitness is perfectly well known. It is
   * the most recent sample of all time instead.
   */
  vo2Max: number | null;
  /**
   * When that sample was taken, ISO.
   *
   * Carried because a VO2 max from four months ago is not today's, and a
   * bare number invites the reader to assume it is. The tile says how old
   * it is; nothing else can, since the value alone cannot.
   */
  vo2MaxAt: string | null;
}

/**
 * Slow-changing context. Read as the most recent sample of all time rather
 * than today's, because a height from 2019 is still your height.
 *
 * Canonical units (kg, cm) — display converts. Storing whatever unit the
 * phone happened to prefer is how you end up with a 70 lb human.
 */
export interface BodyProfile {
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  biologicalSex: 'female' | 'male' | 'other' | null;
  dateOfBirth: string | null;
  ageYears: number | null;
}

export interface HealthSnapshot {
  daily: DailyHealthMetrics;
  recovery: RecoveryMetrics;
  body: BodyProfile;
  /**
   * Whichever app wrote today's nutrition, read from the sample's own
   * source metadata — "MyFitnessPal", "Cronometer", "Lose It!", anything.
   * Setframe has no nutrition integration and does not care which; it
   * reports what it found.
   */
  nutritionSource: string | null;
}

export type HealthAuthorizationState =
  | 'authorized'
  | 'not_granted'
  | 'unavailable'
  | 'error';

/**
 * What we are allowed to know about our own permission state.
 *
 * `not_asked` and `asked` are the ONLY two states iOS will tell a
 * read-only app apart, and the distinction is deliberately not
 * "granted vs. denied" — see `getConnectionState` below.
 */
export type HealthConnectionState =
  | 'unavailable'
  | 'not_asked'
  | 'asked'
  | 'error';

/**
 * The metrics that drive Today's card. Connection state is computed from
 * *these only*: adding new types below must never flip an existing user
 * back to "Not connected" just because the newcomers are undetermined.
 */
export const CORE_READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
] as const;

/**
 * Everything else worth having. Kept separate so a user who already granted
 * the core four gets a second, smaller sheet for just these rather than a
 * confusing re-ask for everything — iOS only prompts for undetermined types.
 */
export const EXTENDED_READ_TYPES = [
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKCharacteristicTypeIdentifierBiologicalSex',
  'HKCharacteristicTypeIdentifierDateOfBirth',
  // Story 44. Workouts are their own HealthKit type, so someone who
  // connected before this shipped still has to grant it — which is why it
  // sits here and rides hasUnaskedTypes() rather than a second prompt path.
  'HKWorkoutTypeIdentifier',
  /* Story 45. The curve itself, and the basal half of a true total-calorie
     figure. HeartRateVariabilitySDNN and RestingHeartRate above are
     different types — neither one grants the beat-by-beat series, and
     without this the workout heart-rate query returns nothing at all while
     appearing to work. */
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  // Cardio fitness. Its own type, so anyone who connected before this
  // shipped has not granted it and rides hasUnaskedTypes() like the rest.
  'HKQuantityTypeIdentifierVO2Max',
] as const;

export const ALL_READ_TYPES = [...CORE_READ_TYPES, ...EXTENDED_READ_TYPES] as const;

/**
 * The extended types grouped as a person would describe them.
 *
 * Exists so the "there is more we could read" button can name what is
 * actually missing. A static label goes stale the moment a type is added:
 * anyone who granted sleep and body data last week was being offered
 * "sleep, heart and body data" again purely because workouts were new.
 */
export const READ_GROUPS: readonly { label: string; types: readonly string[] }[] = [
  {
    label: 'workouts and heart rate',
    types: [
      'HKWorkoutTypeIdentifier',
      'HKQuantityTypeIdentifierHeartRate',
      'HKQuantityTypeIdentifierBasalEnergyBurned',
    ],
  },
  {
    label: 'sleep and heart data',
    types: [
      'HKCategoryTypeIdentifierSleepAnalysis',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'HKQuantityTypeIdentifierRestingHeartRate',
    ],
  },
  {
    label: 'cardio fitness',
    types: ['HKQuantityTypeIdentifierVO2Max'],
  },
  {
    label: 'body measurements',
    types: [
      'HKQuantityTypeIdentifierBodyMass',
      'HKQuantityTypeIdentifierHeight',
      'HKQuantityTypeIdentifierBodyFatPercentage',
    ],
  },
  {
    label: 'age and sex',
    types: [
      'HKCharacteristicTypeIdentifierBiologicalSex',
      'HKCharacteristicTypeIdentifierDateOfBirth',
    ],
  },
  {
    label: 'macros',
    types: [
      'HKQuantityTypeIdentifierDietaryProtein',
      'HKQuantityTypeIdentifierDietaryCarbohydrates',
      'HKQuantityTypeIdentifierDietaryFatTotal',
    ],
  },
];

/** Back-compat alias — the core set is what "the metrics" used to mean. */
export const HEALTH_READ_TYPES = CORE_READ_TYPES;

export const EMPTY_DAILY: DailyHealthMetrics = {
  steps: null,
  activeEnergyKcal: null,
  exerciseMinutes: null,
  caloriesConsumedKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

export const EMPTY_RECOVERY: RecoveryMetrics = {
  sleepMinutes: null,
  hrvMs: null,
  restingHeartRateBpm: null,
  vo2Max: null,
  vo2MaxAt: null,
};

export const EMPTY_BODY: BodyProfile = {
  weightKg: null,
  heightCm: null,
  bodyFatPercent: null,
  biologicalSex: null,
  dateOfBirth: null,
  ageYears: null,
};

export const EMPTY_SNAPSHOT: HealthSnapshot = {
  daily: EMPTY_DAILY,
  recovery: EMPTY_RECOVERY,
  body: EMPTY_BODY,
  nutritionSource: null,
};

/**
 * The app that wrote a sample, or null if we cannot tell.
 *
 * `SourceProxy` extends BOTH nitro's `HybridObject` and HealthKit's
 * `Source`, and both declare `name`. Nitro's wins at runtime and returns
 * the *type* name, so reading `.name` directly yields the literal string
 * "SourceProxy" — which we cheerfully printed to users as the app that
 * logged their food. `toJSON()` returns the plain `Source`, where `name`
 * means what it says.
 *
 * Anything that still smells like the proxy is discarded rather than
 * shown: a wrong attribution is worse than no attribution.
 */
export function readSourceName(source: unknown): string | null {
  const candidates: unknown[] = [];
  try {
    const proxy = source as { toJSON?: () => { name?: unknown } };
    if (typeof proxy?.toJSON === 'function') candidates.push(proxy.toJSON()?.name);
  } catch {
    /* Hybrid objects can throw on access once the native side is gone. */
  }
  try {
    candidates.push((source as { name?: unknown })?.name);
  } catch {
    /* As above. */
  }
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const name = candidate.trim();
    if (!name) continue;
    if (/^(source)?proxy$/i.test(name)) continue;
    if (/^hybrid/i.test(name)) continue;
    return name;
  }
  return null;
}

/** True when at least one of the four headline metrics came back. */
export function hasAnyMetric(metrics: DailyHealthMetrics): boolean {
  return (
    metrics.steps != null ||
    metrics.activeEnergyKcal != null ||
    metrics.exerciseMinutes != null ||
    metrics.caloriesConsumedKcal != null
  );
}

export function hasAnyRecovery(recovery: RecoveryMetrics): boolean {
  return (
    recovery.sleepMinutes != null ||
    recovery.hrvMs != null ||
    recovery.restingHeartRateBpm != null ||
    // Without this, someone whose only reading is a cardio-fitness estimate
    // gets the whole row hidden — including the one number they have.
    recovery.vo2Max != null
  );
}

export function hasAnyBody(body: BodyProfile): boolean {
  return (
    body.weightKg != null ||
    body.heightCm != null ||
    body.bodyFatPercent != null ||
    body.biologicalSex != null ||
    body.ageYears != null
  );
}

/**
 * HealthKit adapter, per ADR 0001. `@kingstinct/react-native-healthkit`
 * requires a native module that only exists in an Expo *development
 * build* (not Expo Go), so every method feature-detects the native
 * module and returns an "unavailable" result instead of throwing — the
 * app boots fine in Expo Go, the simulator, on Android, and on web.
 *
 * **Read permission is deliberately unknowable.** Apple's docs for
 * `HKHealthStore.authorizationStatus(for:)` are explicit: an app cannot
 * determine whether the user granted *read* access, because knowing a
 * user refused is itself a disclosure about their health. A refused type
 * behaves exactly as if the store were empty. `HKAuthorizationStatus`
 * (`sharingDenied` etc.) describes *write* permission only, and we never
 * write, so it tells us nothing at all.
 *
 * The one thing we can ask is `getRequestStatusForAuthorization`, which
 * reports whether the system *would* show a prompt. That gives us
 * "not_asked" vs. "asked" — nothing more. Every piece of UI built on top
 * of this must therefore treat "no data" as ambiguous between "refused"
 * and "nothing recorded today", and must never tell the user their
 * access is off as though we knew it.
 */
/**
 * Local-day boundaries, parsed field by field.
 *
 * `new Date('2026-09-01')` is UTC midnight, which lands on the previous day
 * anywhere west of Greenwich — the same trap the read window hit. These use
 * the device's own zone, which is the zone the day was lived in.
 */
/** Longest gap between heart-rate samples that still counts as continuous. */
const HISTOGRAM_MAX_GAP_SECONDS = 60;

/** Join windows that touch or overlap, so an effort is one span. */
function mergeWindows(
  windows: readonly { startDate: Date; endDate: Date }[],
): { startDate: Date; endDate: Date }[] {
  const sorted = [...windows].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const merged: { startDate: Date; endDate: Date }[] = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    /* A minute's tolerance: Apple's exercise-time pieces frequently abut
       with a second's rounding between them, and treating those as separate
       efforts would restart the gap cap sixty times an hour. */
    if (last && window.startDate.getTime() - last.endDate.getTime() <= 60_000) {
      if (window.endDate > last.endDate) last.endDate = window.endDate;
      continue;
    }
    merged.push({ startDate: window.startDate, endDate: window.endDate });
  }
  return merged;
}

function startOfLocalDayLocal(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfLocalDayLocal(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

class HealthKitAdapter {
  private module: typeof import('@kingstinct/react-native-healthkit') | null = null;
  private loadAttempted = false;

  private isSupportedPlatform(): boolean {
    return Platform.OS === 'ios';
  }

  /**
   * Lazily requires the native module. Wrapped in try/catch because
   * requiring a native-module package with no native code linked (Expo
   * Go, or a bare JS/web preview) throws synchronously rather than
   * rejecting a promise.
   *
   * `require`, not `await import()`: Metro bundles both identically, but
   * jest's CJS runtime cannot execute a dynamic import without
   * `--experimental-vm-modules`, so the import form silently failed and
   * every adapter test passed against a null module — green, and testing
   * nothing. Each caller still guards its own native calls, so a module
   * that loads without a working native binding behaves as before.
   */
  private async load() {
    if (this.loadAttempted) return this.module;
    this.loadAttempted = true;
    if (!this.isSupportedPlatform()) return null;
    try {
       
      this.module = require('@kingstinct/react-native-healthkit');
    } catch {
      this.module = null;
    }
    return this.module;
  }

  async isAvailable(): Promise<boolean> {
    const mod = await this.load();
    if (!mod) return false;
    try {
      // Synchronous in v14 despite the name; `await` on a boolean is a
      // no-op and keeps this tolerant if it ever becomes a promise.
      return await mod.isHealthDataAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Whether we have ever put the permission sheet in front of this user.
   *
   * `shouldRequest` means at least one of our types has never been
   * asked about, so tapping Connect will actually show Apple's sheet.
   * `unnecessary` means every type has been asked — and iOS will never
   * show the sheet again for them, whatever the user chose. That is the
   * one-shot constraint the whole flow is built around.
   */
  /**
   * Whether we have ever put the permission sheet in front of this user,
   * for the CORE metrics only.
   *
   * `shouldRequest` means at least one core type has never been asked
   * about. `unnecessary` means every core type has been asked — and iOS
   * will never show the sheet again for them, whatever the user chose.
   * That is the one-shot constraint the whole flow is built around.
   */
  async getConnectionState(): Promise<HealthConnectionState> {
    return this.requestStatusFor([...CORE_READ_TYPES]);
  }

  /**
   * True when some type in the full set has never been asked about.
   *
   * Drives the "there is more we could read" affordance. Without this,
   * anyone who granted access before the extended types existed would
   * never be offered them, and their sleep and HRV tiles would sit empty
   * forever with no explanation.
   */
  async hasUnaskedTypes(): Promise<boolean> {
    return (await this.requestStatusFor([...ALL_READ_TYPES])) === 'not_asked';
  }

  /**
   * Which groups of readable data have never been asked about.
   *
   * Used to label the second-sheet affordance truthfully. Returned in
   * READ_GROUPS order so the wording is stable between reads.
   */
  async unaskedGroups(): Promise<string[]> {
    const results = await Promise.all(
      READ_GROUPS.map(async (group) => ({
        label: group.label,
        unasked: (await this.requestStatusFor([...group.types])) === 'not_asked',
      })),
    );
    return results.filter((r) => r.unasked).map((r) => r.label);
  }

  private async requestStatusFor(types: string[]): Promise<HealthConnectionState> {
    const mod = await this.load();
    if (!mod) return 'unavailable';
    try {
      if (!(await mod.isHealthDataAvailable())) return 'unavailable';
      const status = await mod.getRequestStatusForAuthorization({ toRead: types as never });
      // 1 = shouldRequest, 2 = unnecessary, 0 = unknown.
      if (status === 1) return 'not_asked';
      if (status === 2) return 'asked';
      return 'error';
    } catch {
      return 'error';
    }
  }

  /**
   * Shows Apple's permission sheet — once, ever, per type.
   *
   * Asks for everything at once. iOS only lists types it has not already
   * resolved, so a returning user sees a short sheet of just the new ones
   * rather than a confusing re-ask.
   *
   * The resolved boolean says only that the sheet completed, never what
   * the user chose, so we report `authorized` to mean "the ask happened".
   * Callers must confirm by re-reading, not by trusting this.
   */
  async requestAuthorization(): Promise<HealthAuthorizationState> {
    const mod = await this.load();
    if (!mod) return 'unavailable';
    try {
      const available = await mod.isHealthDataAvailable();
      if (!available) return 'unavailable';
      // Read-only permissions only — Setframe never writes to HealthKit
      // (see app.json NSHealthUpdateUsageDescription).
      await mod.requestAuthorization({ toRead: [...ALL_READ_TYPES] as never });
      return 'authorized';
    } catch {
      return 'error';
    }
  }

  /**
   * The window for one local day.
   *
   * Defaults to today, midnight to now. Given a `YYYY-MM-DD` it is that
   * day's local midnight to its local end — which is what makes browsing
   * back on Log show that day's steps rather than today's. Before this the
   * window was always today, so a past date could only ever show whatever
   * the server had already reconciled, and showed dashes when it had not.
   *
   * Parsed field by field rather than `new Date(localDate)`, because the
   * latter is UTC midnight and lands on the previous day west of Greenwich.
   */
  private dayWindow(localDate?: string) {
    if (!localDate) {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate: new Date() };
    }
    const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
    const startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
    const now = new Date();
    /* Today is bounded by now, not by midnight tonight: a partial day's
       steps are the truth so far, and reading to the future adds nothing. */
    return { startDate, endDate: endOfDay < now ? endOfDay : now };
  }

  /**
   * Sums one cumulative quantity over a window.
   *
   * Every call is individually caught: a type the user refused throws or
   * returns nothing, and that must not zero out the ones they did grant.
   */
  private async sumQuantity(
    mod: NonNullable<HealthKitAdapter['module']>,
    identifier: string,
    unit: string,
    window: { startDate: Date; endDate: Date },
  ): Promise<{ value: number | null; sources: string[] }> {
    try {
      const result = await mod.queryStatisticsForQuantity(
        identifier as never,
        ['cumulativeSum'],
        { unit, filter: { date: window } } as never,
      );
      const quantity = result?.sumQuantity?.quantity;
      const value =
        typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
      const sources = (result?.sources ?? [])
        .map((source) => readSourceName(source))
        .filter((name): name is string => Boolean(name));
      return { value, sources };
    } catch {
      return { value: null, sources: [] };
    }
  }

  /** Averages a discrete quantity over a window (HRV, resting HR). */
  private async averageQuantity(
    mod: NonNullable<HealthKitAdapter['module']>,
    identifier: string,
    unit: string,
    window: { startDate: Date; endDate: Date },
  ): Promise<number | null> {
    try {
      const result = await mod.queryStatisticsForQuantity(
        identifier as never,
        ['discreteAverage'],
        { unit, filter: { date: window } } as never,
      );
      const quantity = result?.averageQuantity?.quantity;
      return typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
    } catch {
      return null;
    }
  }

  /**
   * Minutes at each heart rate during the day's *active* time.
   *
   * There is no time-in-zone metric in HealthKit — Apple shows zones in the
   * Fitness app and does not export them — so this computes the underlying
   * distribution and the server slices it into zones at read time.
   *
   * Active rather than all-day: sleep and desk time dominate the clock, and
   * an all-day chart is mostly zone 1 with the training signal buried.
   * "Active" is Apple's own Exercise Time, whose samples carry windows that
   * intersect with heart rate — it catches the brisk walk you never started
   * a workout for, which a workouts-only definition drops entirely.
   */
  async getActiveHeartRateHistogram(localDate: string): Promise<HeartRateHistogram | null> {
    const mod = await this.load();
    if (!mod) return null;

    const attribution = {
      source: 'exerciseTime' as const,
      maxGapSeconds: HISTOGRAM_MAX_GAP_SECONDS,
      version: HISTOGRAM_VERSION,
    };
    const dayWindow = {
      startDate: startOfLocalDayLocal(localDate),
      endDate: endOfLocalDayLocal(localDate),
    };

    try {
      const activeWindows = await this.activeWindows(mod, dayWindow);
      if (activeWindows.length === 0) return null;

      const histogram = emptyHistogram(attribution);
      for (const window of activeWindows) {
        const samples = await this.heartRateSamples(mod, window);
        /* Per window rather than per day: the gap cap must not bridge two
           workouts hours apart, which would bank the whole afternoon at
           whatever the first one ended on. */
        accumulateSamples(histogram, samples, HISTOGRAM_MAX_GAP_SECONDS);
      }
      return roundHistogram(histogram);
    } catch {
      return null;
    }
  }

  /** The windows Apple counts as exercise within a day. */
  private async activeWindows(
    mod: NonNullable<HealthKitAdapter['module']>,
    window: { startDate: Date; endDate: Date },
  ): Promise<{ startDate: Date; endDate: Date }[]> {
    const samples = await mod.queryQuantitySamples(
      'HKQuantityTypeIdentifierAppleExerciseTime' as never,
      { limit: 0, ascending: true, unit: 'min', filter: { date: window } } as never,
    );
    const windows: { startDate: Date; endDate: Date }[] = [];
    for (const sample of samples ?? []) {
      const start = new Date(sample?.startDate ?? '');
      const end = new Date(sample?.endDate ?? '');
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end <= start) continue;
      windows.push({ startDate: start, endDate: end });
    }
    /* Exercise time arrives in one-minute pieces. Merged so a continuous
       hour is one heart-rate query rather than sixty, and so the gap cap
       applies across the whole effort rather than resetting each minute. */
    return mergeWindows(windows);
  }

  private async heartRateSamples(
    mod: NonNullable<HealthKitAdapter['module']>,
    window: { startDate: Date; endDate: Date },
  ): Promise<HeartRateSample[]> {
    const samples = await mod.queryQuantitySamples(
      'HKQuantityTypeIdentifierHeartRate' as never,
      { limit: 0, ascending: true, unit: 'count/min', filter: { date: window } } as never,
    );
    const out: HeartRateSample[] = [];
    for (const sample of samples ?? []) {
      const at = new Date(sample?.startDate ?? '').getTime();
      const bpm = Number(sample?.quantity);
      if (!Number.isFinite(at) || !Number.isFinite(bpm) || bpm <= 0) continue;
      out.push({ at: at / 1000, bpm });
    }
    return out;
  }

  /**
   * The last value recorded *within* a window.
   *
   * `mostRecent` answers "of all time", which is right for a live screen and
   * wrong for a day in the past: backfilling with it stamps today's weight
   * onto every historical day, which is indistinguishable from the data
   * being broken. `discreteMostRecent` keeps the read inside the day, and a
   * day with no weigh-in correctly returns null rather than borrowing one.
   */
  private async latestInWindow(
    mod: NonNullable<HealthKitAdapter['module']>,
    identifier: string,
    unit: string,
    window: { startDate: Date; endDate: Date },
  ): Promise<number | null> {
    try {
      const result = await mod.queryStatisticsForQuantity(
        identifier as never,
        ['mostRecent'],
        { unit, filter: { date: window } } as never,
      );
      const quantity =
        (result as { mostRecentQuantity?: { quantity?: number } } | null)?.mostRecentQuantity
          ?.quantity;
      return typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
    } catch {
      return null;
    }
  }

  /** Most recent sample of all time — for values that change rarely. */
  private async mostRecent(
    mod: NonNullable<HealthKitAdapter['module']>,
    identifier: string,
    unit: string,
  ): Promise<number | null> {
    try {
      const sample = await mod.getMostRecentQuantitySample(identifier as never, unit as never);
      const quantity = sample?.quantity;
      return typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
    } catch {
      return null;
    }
  }

  /**
   * The most recent sample of a type, with the date it was taken.
   *
   * `mostRecentQuantity` discards the date, which is fine for a height and
   * wrong for anything that goes stale.
   */
  private async mostRecentDatedQuantity(
    mod: NonNullable<HealthKitAdapter['module']>,
    identifier: string,
    unit: string,
  ): Promise<{ value: number | null; at: string | null }> {
    try {
      const sample = await mod.getMostRecentQuantitySample(identifier as never, unit as never);
      const quantity = sample?.quantity;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return { value: null, at: null };
      const raw = (sample as { startDate?: string | Date } | null)?.startDate ?? null;
      const at = raw ? new Date(raw) : null;
      return {
        value: quantity,
        at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
      };
    } catch {
      return { value: null, at: null };
    }
  }

  /**
   * Today's totals, summed over the local calendar day.
   *
   * Local midnight (not UTC) defines the day, matching the `local_date`
   * rule in docs/architecture.md §5 — a UTC boundary would file an evening
   * walk under tomorrow for anyone west of Greenwich.
   */
  async getTodayMetrics(): Promise<DailyHealthMetrics> {
    return (await this.getSnapshot()).daily;
  }

  /**
   * Everything, in one pass.
   *
   * Nutrition is read generically: we sum whatever is in HealthKit for the
   * dietary types and report the source app's own name. Setframe has no
   * nutrition integration and never had one — any tracker that syncs to
   * Apple Health works identically, which is the entire point.
   */
  async getSnapshot(localDate?: string): Promise<HealthSnapshot> {
    const mod = await this.load();
    if (!mod) return EMPTY_SNAPSHOT;

    const window = this.dayWindow(localDate);
    const round = (value: number | null) => (value == null ? null : Math.round(value));

    try {
      const [
        steps,
        activeEnergy,
        exerciseTime,
        dietaryEnergy,
        protein,
        carbs,
        fat,
        recovery,
        body,
      ] = await Promise.all([
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierStepCount', 'count', window),
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', window),
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierAppleExerciseTime', 'min', window),
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', window),
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierDietaryProtein', 'g', window),
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', window),
        this.sumQuantity(mod, 'HKQuantityTypeIdentifierDietaryFatTotal', 'g', window),
        this.getRecoveryMetrics(mod, localDate),
        this.getBodyProfile(mod, localDate),
      ]);

      /* Whichever app wrote the food. Calories first because every tracker
         writes those; macros as a fallback for one that only writes those. */
      const nutritionSource =
        dietaryEnergy.sources[0] ?? protein.sources[0] ?? carbs.sources[0] ?? fat.sources[0] ?? null;

      return {
        daily: {
          steps: round(steps.value),
          activeEnergyKcal: round(activeEnergy.value),
          exerciseMinutes: round(exerciseTime.value),
          caloriesConsumedKcal: round(dietaryEnergy.value),
          proteinG: round(protein.value),
          carbsG: round(carbs.value),
          fatG: round(fat.value),
        },
        recovery,
        body,
        nutritionSource,
      };
    } catch {
      return EMPTY_SNAPSHOT;
    }
  }

  /**
   * Last night's sleep, plus this morning's HRV and resting heart rate.
   *
   * The sleep window runs from 18:00 yesterday to now rather than midnight
   * to midnight, because sleep straddles the date boundary — a midnight
   * window reports roughly half a night and calls it a full one.
   */
  private async getRecoveryMetrics(
    mod: NonNullable<HealthKitAdapter['module']>,
    localDate?: string,
  ): Promise<RecoveryMetrics> {
    /* The night that belongs to this day: the evening before, through the
       day's own end. Hardcoding "yesterday 18:00 → now" is right for today
       and wrong for every other day — a backfill would have written last
       night's sleep against all of them. */
    const dayEnd = localDate ? endOfLocalDayLocal(localDate) : new Date();
    const startDate = new Date(dayEnd);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(18, 0, 0, 0);
    const endDate = localDate ? dayEnd : new Date();
    const window = { startDate, endDate };

    const [sleepMinutes, hrvMs, restingHeartRateBpm, vo2] = await Promise.all([
      this.getSleepMinutes(mod, window),
      this.averageQuantity(mod, 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms', window),
      this.averageQuantity(mod, 'HKQuantityTypeIdentifierRestingHeartRate', 'count/min', window),
      /* Unwindowed for a live read — see RecoveryMetrics.vo2Max — but a
         past day must not inherit a reading taken after it. */
      localDate
        ? this.latestInWindow(mod, 'HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)', window).then(
            (value) => ({ value, at: null as string | null }),
          )
        : this.mostRecentDatedQuantity(mod, 'HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)'),
    ]);

    return {
      sleepMinutes,
      hrvMs: hrvMs == null ? null : Math.round(hrvMs),
      restingHeartRateBpm: restingHeartRateBpm == null ? null : Math.round(restingHeartRateBpm),
      // One decimal: HealthKit reports ~38.7, and rounding to 39 throws
      // away most of the change anyone would ever see year to year.
      vo2Max: vo2.value == null ? null : Math.round(vo2.value * 10) / 10,
      vo2MaxAt: vo2.at,
    };
  }

  /**
   * Total time actually asleep in the window.
   *
   * `inBed` (0) and `awake` (2) are excluded deliberately: time in bed is
   * not sleep, and counting it inflates the number in exactly the way that
   * would make a coach tell an exhausted person they are well rested.
   * Overlapping samples from several sources (phone + watch + a sleep app)
   * are merged rather than added, or a night gets counted twice.
   */
  private async getSleepMinutes(
    mod: NonNullable<HealthKitAdapter['module']>,
    window: { startDate: Date; endDate: Date },
  ): Promise<number | null> {
    try {
      const samples = await mod.queryCategorySamples(
        'HKCategoryTypeIdentifierSleepAnalysis' as never,
        { limit: 0, filter: { date: window }, ascending: true } as never,
      );
      const ASLEEP = new Set([1, 3, 4, 5]); // unspecified, core, deep, REM
      const intervals = (samples ?? [])
        .filter((sample) => ASLEEP.has(Number(sample?.value)))
        .map((sample) => ({
          start: new Date(sample.startDate).getTime(),
          end: new Date(sample.endDate).getTime(),
        }))
        .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
        .sort((a, b) => a.start - b.start);

      if (intervals.length === 0) return null;

      let total = 0;
      let cursorStart = intervals[0]!.start;
      let cursorEnd = intervals[0]!.end;
      for (const interval of intervals.slice(1)) {
        if (interval.start <= cursorEnd) {
          cursorEnd = Math.max(cursorEnd, interval.end);
        } else {
          total += cursorEnd - cursorStart;
          cursorStart = interval.start;
          cursorEnd = interval.end;
        }
      }
      total += cursorEnd - cursorStart;
      return Math.round(total / 60000);
    } catch {
      return null;
    }
  }

  /**
   * Whether the user has been asked about workouts specifically.
   *
   * Separate from `getConnectionState` because workouts are a separate
   * type: "connected to Apple Health" does not imply "workouts shared",
   * and telling someone their Watch data is unavailable when they never
   * declined it would be a false accusation.
   */
  async canReadWorkouts(): Promise<boolean> {
    return (await this.requestStatusFor(['HKWorkoutTypeIdentifier'])) === 'asked';
  }

  /**
   * Today's Apple Health workouts, normalized.
   *
   * Read through `toJSON()` wherever possible: these are nitro hybrid
   * objects whose own members shadow the sample's, the same collision that
   * had us telling users their nutrition came from an app called
   * "SourceProxy".
   */
  async getTodayWorkouts(): Promise<DiscoveredWorkout[]> {
    const mod = await this.load();
    if (!mod) return [];
    const { startDate, endDate } = this.dayWindow();
    try {
      const proxies = await mod.queryWorkoutSamples({
        limit: 0,
        filter: { date: { startDate, endDate } },
      } as never);
      const out: DiscoveredWorkout[] = [];
      for (const proxy of proxies ?? []) {
        const workout = readWorkout(proxy);
        if (!workout) continue;
        out.push({ ...workout, ...(await readWorkoutHeartRateStats(proxy)) });
      }
      return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    } catch {
      return [];
    }
  }

  /**
   * The heart-rate series recorded during one workout, plus its own
   * statistics.
   *
   * Read per workout rather than per day: `WorkoutProxy.getStatistic()`
   * scopes to that workout, so a lift and the run after it get their own
   * averages instead of one figure smeared across the evening.
   *
   * Offsets are seconds from the workout's start, matching how the series
   * is stored (ADR 0012) — absolute timestamps are recovered by addition
   * rather than repeated once per sample.
   */
  async getWorkoutHeartRate(
    startedAt: Date,
    endedAt: Date,
  ): Promise<{ offsets: number[]; values: number[] }> {
    const mod = await this.load();
    if (!mod) return { offsets: [], values: [] };
    try {
      const samples = await mod.queryQuantitySamples(
        'HKQuantityTypeIdentifierHeartRate' as never,
        {
          limit: 0,
          ascending: true,
          unit: 'count/min',
          filter: { date: { startDate: startedAt, endDate: endedAt } },
        } as never,
      );
      const start = startedAt.getTime();
      const offsets: number[] = [];
      const values: number[] = [];
      for (const sample of samples ?? []) {
        const at = new Date(sample?.startDate ?? '').getTime();
        const bpm = Number(sample?.quantity);
        if (!Number.isFinite(at) || !Number.isFinite(bpm) || bpm <= 0) continue;
        const offset = Math.round((at - start) / 1000);
        if (offset < 0) continue;
        offsets.push(offset);
        // Stored as int2, so a nonsensical reading is dropped rather than
        // silently wrapping when it is written.
        values.push(Math.min(300, Math.round(bpm)));
      }
      return { offsets, values };
    } catch {
      return { offsets: [], values: [] };
    }
  }

  /**
   * Whether a Watch workout appears to be running right now.
   *
   * There is no API for this: `HKWorkout` is written on finish, and no
   * phone-side call observes another app's in-progress session. What can be
   * seen is the *cadence* of heart-rate samples — a Watch samples every few
   * seconds while recording and every several minutes at rest — so a run of
   * closely-spaced recent samples is the signal.
   *
   * A heuristic, deliberately. It will occasionally read "recording" for
   * someone who walked upstairs, which is why the UI states what it sees
   * and starts nothing.
   */
  async getLiveHeartRate(
    { windowSeconds = 300, minSamples = 8 }: { windowSeconds?: number; minSamples?: number } = {},
  ): Promise<{ recording: boolean; currentBpm: number | null; avgBpm: number | null }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - windowSeconds * 1000);
    const { values } = await this.getWorkoutHeartRate(startDate, endDate);
    if (values.length === 0) return { recording: false, currentBpm: null, avgBpm: null };
    const sum = values.reduce((n, v) => n + v, 0);
    return {
      // Cadence, not presence: a handful of readings over five minutes is
      // ordinary background sampling, not a workout.
      recording: values.length >= minSamples,
      currentBpm: values[values.length - 1] ?? null,
      avgBpm: Math.round(sum / values.length),
    };
  }

  /** Body measurements and characteristics — context, not daily data. */
  private async getBodyProfile(
    mod: NonNullable<HealthKitAdapter['module']>,
    localDate?: string,
  ): Promise<BodyProfile> {
    const window = localDate
      ? { startDate: startOfLocalDayLocal(localDate), endDate: endOfLocalDayLocal(localDate) }
      : null;
    const [weightKg, heightM, bodyFatFraction] = await Promise.all([
      window
        ? this.latestInWindow(mod, 'HKQuantityTypeIdentifierBodyMass', 'kg', window)
        : this.mostRecent(mod, 'HKQuantityTypeIdentifierBodyMass', 'kg'),
      /* Height is genuinely a standing fact, not a daily measurement. */
      this.mostRecent(mod, 'HKQuantityTypeIdentifierHeight', 'm'),
      window
        ? this.latestInWindow(mod, 'HKQuantityTypeIdentifierBodyFatPercentage', '%', window)
        : this.mostRecent(mod, 'HKQuantityTypeIdentifierBodyFatPercentage', '%'),
    ]);

    let biologicalSex: BodyProfile['biologicalSex'] = null;
    try {
      // 0 notSet, 1 female, 2 male, 3 other.
      const value = Number(mod.getBiologicalSex());
      biologicalSex = value === 1 ? 'female' : value === 2 ? 'male' : value === 3 ? 'other' : null;
    } catch {
      biologicalSex = null;
    }

    let dateOfBirth: string | null = null;
    let ageYears: number | null = null;
    try {
      const dob = mod.getDateOfBirth();
      if (dob instanceof Date && !Number.isNaN(dob.getTime())) {
        dateOfBirth = dob.toISOString().slice(0, 10);
        const now = new Date();
        let age = now.getFullYear() - dob.getFullYear();
        const monthDelta = now.getMonth() - dob.getMonth();
        // Not yet had this year's birthday.
        if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
        ageYears = age >= 0 && age < 130 ? age : null;
      }
    } catch {
      dateOfBirth = null;
    }

    return {
      weightKg: weightKg == null ? null : Math.round(weightKg * 10) / 10,
      heightCm: heightM == null ? null : Math.round(heightM * 100),
      /* HealthKit returns body fat as a 0–1 fraction under the "%" unit,
         which is a trap: 0.14 means 14%, not 0.14%. */
      bodyFatPercent:
        bodyFatFraction == null ? null : Math.round(bodyFatFraction * 1000) / 10,
      biologicalSex,
      dateOfBirth,
      ageYears,
    };
  }
}

/**
 * Normalize one workout proxy, or null if it is unusable.
 *
 * Distances arrive in whatever unit HealthKit chose; metres are converted
 * to miles here because that is what the app displays and what
 * `distanceUnit` accepts. Anything without a usable start time is dropped
 * rather than shown at an invented hour.
 */
function readWorkout(proxy: unknown): DiscoveredWorkout | null {
  const source = (() => {
    try {
      const p = proxy as { toJSON?: () => unknown };
      if (typeof p?.toJSON === 'function') return p.toJSON();
    } catch {
      /* fall through to the proxy itself */
    }
    return proxy;
  })() as Record<string, unknown> | null;
  if (!source) return null;

  const externalId = typeof source.uuid === 'string' ? source.uuid : null;
  const start = source.startDate ? new Date(source.startDate as string) : null;
  const end = source.endDate ? new Date(source.endDate as string) : null;
  if (!externalId || !start || Number.isNaN(start.getTime())) return null;

  const appleType = Number(source.workoutActivityType);
  if (!Number.isFinite(appleType)) return null;

  const metadata = (source.metadata ?? {}) as Record<string, unknown>;
  const isIndoor = metadata.HKIndoorWorkout === true || metadata.HKIndoorWorkout === 1;

  const durationQuantity = source.duration as { quantity?: number; unit?: string } | undefined;
  const endMs = end && !Number.isNaN(end.getTime()) ? end.getTime() : start.getTime();
  const durationSeconds = Math.round(
    typeof durationQuantity?.quantity === 'number' && durationQuantity.quantity > 0
      ? durationQuantity.quantity
      : Math.max(0, (endMs - start.getTime()) / 1000),
  );

  const distance = source.totalDistance as { quantity?: number; unit?: string } | undefined;
  let distanceValue: number | null = null;
  let distanceUnit: 'mi' | 'km' | null = null;
  if (typeof distance?.quantity === 'number' && distance.quantity > 0) {
    const unit = (distance.unit ?? 'm').toLowerCase();
    const miles =
      unit === 'mi' ? distance.quantity
      : unit === 'km' ? distance.quantity * 0.621371
      : distance.quantity / 1609.344;
    distanceValue = Math.round(miles * 100) / 100;
    distanceUnit = 'mi';
  }

  const energy = source.totalEnergyBurned as { quantity?: number } | undefined;
  const caloriesKcal =
    typeof energy?.quantity === 'number' && energy.quantity > 0
      ? Math.round(energy.quantity)
      : null;

  return {
    externalId,
    appleType,
    activityType: mapWorkoutType(appleType, isIndoor),
    title: workoutTitle(appleType, isIndoor),
    startedAt: start.toISOString(),
    endedAt: new Date(endMs).toISOString(),
    durationSeconds,
    distanceValue,
    distanceUnit,
    caloriesKcal,
    /* Filled in by `readWorkoutHeartRateStats` — `getStatistic` is async
       and this reader is not. */
    avgHeartRateBpm: null,
    peakHeartRateBpm: null,
  };
}

/**
 * A workout's own average and peak heart rate.
 *
 * `getStatistic` scoped to the proxy, so an evening's lift and the run
 * after it get their own figures rather than one average smeared across
 * both. Returns nulls rather than throwing: a workout with no heart rate
 * (a pool swim, a manually-logged session) is ordinary, not an error.
 */
async function readWorkoutHeartRateStats(
  proxy: unknown,
): Promise<{ avgHeartRateBpm: number | null; peakHeartRateBpm: number | null }> {
  const none = { avgHeartRateBpm: null, peakHeartRateBpm: null };
  const p = proxy as {
    getStatistic?: (type: string, unit?: string) => Promise<unknown>;
  } | null;
  if (typeof p?.getStatistic !== 'function') return none;
  try {
    const stat = (await p.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min')) as {
      averageQuantity?: { quantity?: number };
      maximumQuantity?: { quantity?: number };
    } | null;
    if (!stat) return none;
    return {
      avgHeartRateBpm: bpm(stat.averageQuantity?.quantity),
      peakHeartRateBpm: bpm(stat.maximumQuantity?.quantity),
    };
  } catch {
    return none;
  }
}

/** A heart rate we are willing to store: positive, and inside int2. */
function bpm(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(300, Math.round(value));
}

export const healthKit = new HealthKitAdapter();
