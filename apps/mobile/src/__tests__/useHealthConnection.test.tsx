import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { useHealthConnection, type HealthConnection } from '../healthkit/useHealthConnection';

/**
 * Regression cover for the "granted everything, still says Connect" bug.
 *
 * Apple's permission sheet is presented *inside* the app, so granting
 * access never moves AppState away from 'active'; and returning from the
 * priming screen is in-app navigation that never unmounts Today. With
 * mount + AppState as the only triggers, the card kept its stale
 * `not_asked` state until the app was killed and relaunched.
 */

/** Captures the callback expo-router would invoke on screen focus. */
let focusCallback: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    focusCallback = cb;
  },
}));

const mockGetConnectionState = jest.fn();
const mockGetSnapshot = jest.fn();
const mockHasUnaskedTypes = jest.fn();

jest.mock('../healthkit/HealthKitAdapter', () => {
  const daily = {
    steps: null,
    activeEnergyKcal: null,
    exerciseMinutes: null,
    caloriesConsumedKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
  const snapshot = {
    daily,
    recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null },
    body: {
      weightKg: null,
      heightCm: null,
      bodyFatPercent: null,
      biologicalSex: null,
      dateOfBirth: null,
      ageYears: null,
    },
    nutritionSource: null,
  };
  return {
    healthKit: {
      getConnectionState: () => mockGetConnectionState(),
      getSnapshot: () => mockGetSnapshot(),
      hasUnaskedTypes: () => mockHasUnaskedTypes(),
      requestAuthorization: () => Promise.resolve('authorized'),
    },
    hasAnyMetric: (m: Record<string, unknown>) =>
      Object.values(m ?? {}).some((v) => v != null),
    EMPTY_SNAPSHOT: snapshot,
  };
});

function grantedSnapshot() {
  return {
    daily: {
      steps: 8432,
      activeEnergyKcal: 612,
      exerciseMinutes: 48,
      caloriesConsumedKcal: 2180,
      proteinG: null,
      carbsG: null,
      fatG: null,
    },
    recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null },
    body: {
      weightKg: null,
      heightCm: null,
      bodyFatPercent: null,
      biologicalSex: null,
      dateOfBirth: null,
      ageYears: null,
    },
    nutritionSource: null,
  };
}

let latest: HealthConnection | null = null;
let tree: ReactTestRenderer | null = null;

function Probe() {
  latest = useHealthConnection();
  return <Text>{latest.state}</Text>;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  focusCallback = null;
  latest = null;
  mockHasUnaskedTypes.mockResolvedValue(false);
});

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

it('picks up a grant when the screen regains focus, without a relaunch', async () => {
  // Before: never asked.
  mockGetConnectionState.mockResolvedValue('not_asked');
  mockGetSnapshot.mockResolvedValue(grantedSnapshot());

  await act(async () => {
    tree = create(<Probe />);
  });
  await flush();
  act(() => {
    focusCallback?.();
  });
  await flush();
  expect(latest!.state).toBe('not_connected');

  // The user grants everything in Apple's sheet and navigates back. No
  // AppState transition happens, and Today never unmounted.
  mockGetConnectionState.mockResolvedValue('asked');

  act(() => {
    focusCallback?.();
  });
  await flush();

  expect(latest!.state).toBe('connected');
  expect(latest!.metrics.steps).toBe(8432);
});

it('registers a focus handler at all', () => {
  /* The bug was the absence of this subscription, so its presence is the
     thing worth asserting: mount and AppState alone left the card stale. */
  mockGetConnectionState.mockResolvedValue('not_asked');
  mockGetSnapshot.mockResolvedValue(grantedSnapshot());
  act(() => {
    tree = create(<Probe />);
  });
  expect(typeof focusCallback).toBe('function');
});
