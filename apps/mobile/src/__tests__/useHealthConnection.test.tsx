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

/* Built from the shared complete mock with only the three calls this file
   drives overridden. Hand-rolling it here is what broke this test when
   `unaskedGroups` was added: the missing export rejected inside the hook's
   Promise.all, and the symptom was a wrong state rather than an obvious
   TypeError. */
jest.mock('../healthkit/HealthKitAdapter', () =>
  require('../test-support/healthkit-mock').healthKitModuleMock({
    healthKit: {
      getConnectionState: () => mockGetConnectionState(),
      // Forwards the date. Dropping it here would hide the very bug below.
      getSnapshot: (localDate?: string) => mockGetSnapshot(localDate),
      hasUnaskedTypes: () => mockHasUnaskedTypes(),
      unaskedGroups: () => Promise.resolve([]),
      requestAuthorization: () => Promise.resolve('authorized'),
    },
  }),
);

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

describe('reading a past day', () => {
  /**
   * Log shows one date at a time and asks this hook for it. The read used to
   * be a `useCallback(..., [])`, so it closed over whichever date it was
   * created with — always today, because Log opens on today — and every past
   * day rendered today's numbers. Twice shipped, hence the test.
   */
  function DatedProbe({ localDate }: { localDate: string }) {
    latest = useHealthConnection(localDate);
    return <Text>{latest.state}</Text>;
  }

  beforeEach(() => {
    mockGetConnectionState.mockResolvedValue('asked');
    mockGetSnapshot.mockImplementation((localDate?: string) =>
      Promise.resolve({
        ...grantedSnapshot(),
        daily: { ...grantedSnapshot().daily, steps: localDate === '2026-09-01' ? 111 : 999 },
      }),
    );
  });

  it('asks the adapter for the date it was given', async () => {
    await act(async () => {
      tree = create(<DatedProbe localDate="2026-09-01" />);
    });
    // expo-router is mocked to capture the focus callback, not run it.
    await act(async () => { focusCallback?.(); });
    await flush();

    expect(mockGetSnapshot).toHaveBeenCalledWith('2026-09-01');
    expect(latest?.metrics.steps).toBe(111);
  });

  it('re-reads when the date changes, rather than keeping the first one', async () => {
    await act(async () => {
      tree = create(<DatedProbe localDate="2026-09-01" />);
    });
    await act(async () => { focusCallback?.(); });
    await flush();
    expect(latest?.metrics.steps).toBe(111);

    await act(async () => {
      tree!.update(<DatedProbe localDate="2026-09-03" />);
    });
    /* The re-render hands `useFocusEffect` a new callback, because `read`
       now depends on the date. Running the latest one is what the real
       hook does when the effect re-subscribes while focused. */
    await act(async () => { focusCallback?.(); });
    await flush();

    expect(mockGetSnapshot).toHaveBeenCalledWith('2026-09-03');
    expect(latest?.metrics.steps).toBe(999);
  });
});
