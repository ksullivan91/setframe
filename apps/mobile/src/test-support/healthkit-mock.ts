/**
 * A COMPLETE stand-in for the HealthKit adapter module.
 *
 * Exists because partial mocks of this module have broken three separate
 * test files now, and always in the same misleading way: an omitted export
 * throws during render, which reads as a component bug rather than a
 * missing mock. Every consumer imports pure helpers alongside the adapter
 * instance, so the mock has to cover the whole surface — and when the
 * module grows, it grows here once instead of in every test file.
 *
 * Use it as `jest.mock('../healthkit/HealthKitAdapter', () =>
 *   require('./helpers/healthkit-mock').healthKitModuleMock())`, optionally
 * passing overrides.
 */
export const EMPTY_DAILY = {
  steps: null,
  activeEnergyKcal: null,
  exerciseMinutes: null,
  caloriesConsumedKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

export const EMPTY_RECOVERY = { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null };

export const EMPTY_BODY = {
  weightKg: null,
  heightCm: null,
  bodyFatPercent: null,
  biologicalSex: null,
  dateOfBirth: null,
  ageYears: null,
};

export const EMPTY_SNAPSHOT = {
  daily: EMPTY_DAILY,
  recovery: EMPTY_RECOVERY,
  body: EMPTY_BODY,
  nutritionSource: null,
};

const anyNotNull = (o: Record<string, unknown> | null | undefined) =>
  Object.values(o ?? {}).some((v) => v != null);

export function healthKitModuleMock(overrides: Record<string, unknown> = {}) {
  const healthKit = {
    getConnectionState: () => Promise.resolve('unavailable'),
    getSnapshot: () => Promise.resolve(EMPTY_SNAPSHOT),
    getTodayMetrics: () => Promise.resolve(EMPTY_DAILY),
    hasUnaskedTypes: () => Promise.resolve(false),
    unaskedGroups: () => Promise.resolve([]),
    requestAuthorization: () => Promise.resolve('unavailable'),
    isAvailable: () => Promise.resolve(false),
    canReadWorkouts: () => Promise.resolve(false),
    getTodayWorkouts: () => Promise.resolve([]),
    ...(overrides.healthKit as Record<string, unknown> | undefined),
  };
  return {
    healthKit,
    hasAnyMetric: anyNotNull,
    hasAnyRecovery: anyNotNull,
    hasAnyBody: anyNotNull,
    readSourceName: () => null,
    EMPTY_DAILY,
    EMPTY_RECOVERY,
    EMPTY_BODY,
    EMPTY_SNAPSHOT,
    READ_GROUPS: [],
    CORE_READ_TYPES: [],
    EXTENDED_READ_TYPES: [],
    ALL_READ_TYPES: [],
    HEALTH_READ_TYPES: [],
    ...overrides,
  };
}
