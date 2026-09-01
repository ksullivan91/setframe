import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppleHealthCard } from '../components/AppleHealthCard';
import { HealthAccessScreen } from '../screens/HealthAccessScreen';
import type { HealthConnection, HealthCardState } from '../healthkit/useHealthConnection';

/**
 * Copy parity with Figma `🔬 Exploration — Apple Health connection`
 * (node 193:896), frame by frame.
 *
 * The strings below were read out of the Figma nodes, not retyped from
 * memory, so this fails if either side drifts. It is deliberately about
 * *copy and state*, not pixels: the screens cannot be rendered on this
 * machine (no react-native-web, no iOS), and asserting text is the part of
 * "1:1" that can be honestly checked here. Spacing and colour still need a
 * human looking at a real device.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

/* A partial mock of this module is a trap: the card imports pure helpers
   from it, and omitting one throws on render rather than failing an
   assertion, which reads as a component bug that isn't there. */
jest.mock('../healthkit/HealthKitAdapter', () => ({
  healthKit: { requestAuthorization: () => Promise.resolve('unavailable') },
  hasAnyMetric: (m: Record<string, unknown>) =>
    Object.values(m ?? {}).some((v) => v != null),
  hasAnyRecovery: (r: Record<string, unknown>) =>
    Object.values(r ?? {}).some((v) => v != null),
  hasAnyBody: (b: Record<string, unknown>) =>
    Object.values(b ?? {}).some((v) => v != null),
  CORE_READ_TYPES: [],
  EXTENDED_READ_TYPES: [],
  ALL_READ_TYPES: [],
  HEALTH_READ_TYPES: [],
}));

/* Both helpers. A partial module mock is how this suite has been misled
   before: the missing export throws at render, not at import, so the
   failure names the screen rather than the mock. */
jest.mock('../lib/useScreenInsets', () => ({
  useScreenTopPadding: () => 0,
  useStackBottomPadding: () => 0,
}));

function connection(overrides: Partial<HealthConnection> = {}): HealthConnection {
  return {
    state: 'not_connected' as HealthCardState,
    metrics: { steps: null, activeEnergyKcal: null, exerciseMinutes: null, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
    recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null, vo2Max: null, vo2MaxAt: null },
    body: { weightKg: null, heightCm: null, bodyFatPercent: null, biologicalSex: null, dateOfBirth: null, ageYears: null },
    nutritionSource: null,
    lastSyncedAt: null,
    hasMoreToGrant: false,
    unaskedGroups: [],
    connecting: false,
    connect: jest.fn(() => Promise.resolve()),
    refresh: jest.fn(() => Promise.resolve()),
    openHealthApp: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

let tree: ReactTestRenderer | null = null;

function renderNode(node: React.ReactElement): string {
  act(() => {
    tree = create(<ThemeProvider>{node}</ThemeProvider>);
  });
  const parts: string[] = [];
  tree!.root.findAll((n) => {
    if (typeof n.type !== 'string') return false;
    ([] as unknown[]).concat(n.props?.children).forEach((child) => {
      if (typeof child === 'string') parts.push(child);
    });
    return false;
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

/** Every string Figma draws on that frame, excluding the Today header
 *  chrome the card itself does not own. */
const FIGMA = {
  notConnected: [
    'Apple Health',
    'Not connected',
    'Setframe can read your steps, active energy, exercise minutes and calories, so Today and Progress reflect everything you did — not just what you logged here.',
    'Connect Apple Health',
    'Read only. Setframe never writes anything to Apple Health.',
    'WHAT YOU WOULD SEE',
    'Steps',
    'Active energy',
    'Exercise minutes',
    'Calories eaten',
  ],
  connected: [
    'Apple Health',
    'Synced',
    '8,432',
    '612 cal',
    '48 min',
    '2,180 cal',
    'Steps',
    'Active energy',
    'Exercise minutes',
    'Calories eaten',
    'MACROS',
    '165 g',
    '210 g',
    '70 g',
    'RECOVERY',
    '7h 18m',
    '48 ms',
    '54 bpm',
    '34 · male · 180 cm · 82.1 kg · 14.2% body fat',
    'From Apple Health · nutrition via MyFitnessPal · updated',
  ],
  partial: [
    'Apple Health',
    'Synced',
    '8,432',
    '48 min',
    '—',
    'From Apple Health · updated',
    '2 metrics have no data for today.',
    'Check access in Health',
  ],
  noData: [
    'Apple Health',
    'No data yet',
    '—',
    'Nothing has come through from Apple Health today. That happens either when there is nothing recorded yet, or when Setframe was not given access — iOS does not tell us which.',
    'Check access in Health',
    'Setframe works without it. You will just log those numbers yourself.',
  ],
  priming: [
    'Apple Health',
    'What Setframe reads, and why',
    'Everything below is read-only, and Apple asks about each one separately — turn down anything you would rather keep to yourself.',
    'Steps and active energy',
    'So a walk counts toward your week even when you did not log it.',
    'Exercise minutes',
    'Your rings and your training tell one story, not two.',
    'Food and macros',
    'Read from Apple Health, so any tracker that syncs there works — MyFitnessPal, Cronometer, Lose It!, whichever you already use.',
    'Sleep, HRV and resting heart rate',
    'How recovered you are decides whether today should be heavy or easy. Sets alone cannot tell us that.',
    'Weight, height and body composition',
    'Context for your numbers, so progress is read against you and not an average.',
    'Age and biological sex',
    'Used to interpret the metrics above. Never shown to anyone else.',
    'Setframe never writes to Apple Health.',
    'Nothing leaves your phone except the daily totals above, and you can turn any of it off in the Health app at any time.',
    'Continue',
    'Apple will ask next. You choose each metric.',
  ],
};

describe('Apple Health — Figma copy parity', () => {
  it('Health 1 · Not connected', () => {
    const text = renderNode(<AppleHealthCard connection={connection({ state: 'not_connected' })} />);
    FIGMA.notConnected.forEach((s) => expect(text).toContain(s));
  });

  it('Health 2 · Why we are asking', () => {
    const text = renderNode(<HealthAccessScreen />);
    FIGMA.priming.forEach((s) => expect(text).toContain(s));
  });

  it('Health 3 · Connected', () => {
    const text = renderNode(
      <AppleHealthCard
        connection={connection({
          state: 'connected',
          metrics: {
            steps: 8432,
            activeEnergyKcal: 612,
            exerciseMinutes: 48,
            caloriesConsumedKcal: 2180,
            proteinG: 165,
            carbsG: 210,
            fatG: 70,
          },
          recovery: { sleepMinutes: 438, hrvMs: 48, restingHeartRateBpm: 54, vo2Max: 42.3, vo2MaxAt: null },
          body: {
            weightKg: 82.1,
            heightCm: 180,
            bodyFatPercent: 14.2,
            biologicalSex: 'male',
            dateOfBirth: '1992-01-01',
            ageYears: 34,
          },
          nutritionSource: 'MyFitnessPal',
          lastSyncedAt: new Date(),
        })}
      />,
    );
    FIGMA.connected.forEach((s) => expect(text).toContain(s));
  });

  it('Health 4 · Partial data', () => {
    const text = renderNode(
      <AppleHealthCard
        connection={connection({
          state: 'connected',
          metrics: { steps: 8432, activeEnergyKcal: null, exerciseMinutes: 48, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
          lastSyncedAt: new Date(),
        })}
      />,
    );
    FIGMA.partial.forEach((s) => expect(text).toContain(s));
  });

  it('Health 5 · No data yet', () => {
    const text = renderNode(<AppleHealthCard connection={connection({ state: 'no_data' })} />);
    FIGMA.noData.forEach((s) => expect(text).toContain(s));
  });

  it('draws the four metrics in the order Figma lays them out', () => {
    const text = renderNode(<AppleHealthCard connection={connection({ state: 'not_connected' })} />);
    const order = ['Steps', 'Active energy', 'Exercise minutes', 'Calories eaten'].map((label) =>
      text.indexOf(label),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });
});
