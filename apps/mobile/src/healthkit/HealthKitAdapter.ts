import { Platform } from 'react-native';

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
] as const;

export const ALL_READ_TYPES = [...CORE_READ_TYPES, ...EXTENDED_READ_TYPES] as const;

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
    recovery.restingHeartRateBpm != null
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  /** Local midnight to now — the day boundary every daily record uses. */
  private todayWindow() {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate: new Date() };
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
  async getSnapshot(): Promise<HealthSnapshot> {
    const mod = await this.load();
    if (!mod) return EMPTY_SNAPSHOT;

    const window = this.todayWindow();
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
        this.getRecoveryMetrics(mod),
        this.getBodyProfile(mod),
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
  ): Promise<RecoveryMetrics> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(18, 0, 0, 0);
    const window = { startDate, endDate };

    const [sleepMinutes, hrvMs, restingHeartRateBpm] = await Promise.all([
      this.getSleepMinutes(mod, window),
      this.averageQuantity(mod, 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms', window),
      this.averageQuantity(mod, 'HKQuantityTypeIdentifierRestingHeartRate', 'count/min', window),
    ]);

    return {
      sleepMinutes,
      hrvMs: hrvMs == null ? null : Math.round(hrvMs),
      restingHeartRateBpm: restingHeartRateBpm == null ? null : Math.round(restingHeartRateBpm),
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

  /** Body measurements and characteristics — context, not daily data. */
  private async getBodyProfile(
    mod: NonNullable<HealthKitAdapter['module']>,
  ): Promise<BodyProfile> {
    const [weightKg, heightM, bodyFatFraction] = await Promise.all([
      this.mostRecent(mod, 'HKQuantityTypeIdentifierBodyMass', 'kg'),
      this.mostRecent(mod, 'HKQuantityTypeIdentifierHeight', 'm'),
      this.mostRecent(mod, 'HKQuantityTypeIdentifierBodyFatPercentage', '%'),
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

export const healthKit = new HealthKitAdapter();
