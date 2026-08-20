import { Platform } from 'react-native';

/**
 * Normalized health snapshot shape the rest of the app consumes. Mirrors
 * the "adapter DTO -> normalized TS health model" boundary described in
 * docs/adr/0001-healthkit-adapter.md — UI/domain code should only ever
 * see this shape, never raw HKQuantity/HKSample types.
 */
export interface DailyHealthMetrics {
  steps: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
  caloriesConsumedKcal: number | null;
}

export type HealthAuthorizationState =
  | 'authorized'
  | 'not_granted'
  | 'unavailable'
  | 'error';

/**
 * HealthKit adapter, per ADR 0001. `@kingstinct/react-native-healthkit`
 * requires a native module that only exists in an Expo *development
 * build* (not Expo Go) on a real/simulated iOS device — per
 * docs/data-model.md §9, the user hasn't enrolled in the Apple Developer
 * Program yet, so entitlements can't be configured or tested. Every
 * method here feature-detects the native module and gracefully returns a
 * "unavailable" result instead of throwing, so the app boots fine in
 * Expo Go / the simulator / Android with no HealthKit at all.
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
   */
  private async load() {
    if (this.loadAttempted) return this.module;
    this.loadAttempted = true;
    if (!this.isSupportedPlatform()) return null;
    try {
      this.module = await import('@kingstinct/react-native-healthkit');
    } catch {
      this.module = null;
    }
    return this.module;
  }

  async isAvailable(): Promise<boolean> {
    const mod = await this.load();
    if (!mod) return false;
    try {
      return await mod.isHealthDataAvailable();
    } catch {
      return false;
    }
  }

  async requestAuthorization(): Promise<HealthAuthorizationState> {
    const mod = await this.load();
    if (!mod) return 'unavailable';
    try {
      const available = await mod.isHealthDataAvailable();
      if (!available) return 'unavailable';
      // Read-only permissions only — Setline never writes to HealthKit
      // (see app.json NSHealthUpdateUsageDescription).
      await mod.requestAuthorization({
        toRead: [
          'HKQuantityTypeIdentifierStepCount',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          'HKQuantityTypeIdentifierAppleExerciseTime',
          'HKQuantityTypeIdentifierDietaryEnergyConsumed',
        ],
      });
      return 'authorized';
    } catch {
      return 'error';
    }
  }

  /**
   * Returns today's normalized metrics, or all-null values if HealthKit
   * is unavailable/unauthorized. Never throws — callers (e.g. the Today
   * screen) should render a "Connect Apple Health" state on all-null
   * rather than handling a rejected promise.
   */
  async getTodayMetrics(): Promise<DailyHealthMetrics> {
    const empty: DailyHealthMetrics = {
      steps: null,
      activeEnergyKcal: null,
      exerciseMinutes: null,
      caloriesConsumedKcal: null,
    };
    const mod = await this.load();
    if (!mod) return empty;
    try {
      // Real per-metric statistics queries land in Phase 7 once a
      // physical-device spike confirms the exact query shape (ADR 0001
      // "Uncertainties to resolve"); structurally wired but mocked here.
      return empty;
    } catch {
      return empty;
    }
  }
}

export const healthKit = new HealthKitAdapter();
