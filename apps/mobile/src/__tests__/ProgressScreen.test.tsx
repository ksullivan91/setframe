import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { ProgressOverviewResponse } from '@setframe/schemas';
import { ThemeProvider } from '../theme/ThemeProvider';
import { BodyWeightSection, ExerciseCard } from '../../app/(tabs)/progress';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// The screen module imports the Clerk-backed api-client at the top level;
// these tests exercise the presentational sections in isolation, so the
// network client is stubbed to keep native Clerk dependencies out of the run.
jest.mock('../lib/api-client', () => ({
  useApiClient: () => ({ get: jest.fn() }),
}));

let tree: ReactTestRenderer | null = null;

function renderTree(element: React.ReactElement): ReactTestRenderer {
  act(() => {
    tree = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

function pressablesByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  );
}

function press(rendered: ReactTestRenderer, testID: string, nth = 0) {
  const node = pressablesByTestId(rendered, testID)[nth]!;
  act(() => {
    node.props.onPress();
  });
}

function rectOf(node: ReactTestInstance): { left: number; width: number } {
  return Object.assign({}, ...[node.props.style].flat(2));
}

// The x a point lands on with the 320px fallback width and LineChart's 40/10
// left/right padding, for an evenly-spaced daily/weekly series.
function expectedX(index: number, count: number): number {
  const plotX = 40;
  const plotWidth = 320 - 40 - 10;
  const ratio = count <= 1 ? 0.5 : index / (count - 1);
  return plotX + ratio * plotWidth;
}

function tapAt(pressables: ReturnType<typeof pressablesByTestId>, x: number) {
  const covering = pressables.find((node) => {
    const rect = rectOf(node);
    return x >= rect.left && x <= rect.left + rect.width;
  })!;
  act(() => {
    covering.props.onPress();
  });
}

function textOf(rendered: ReactTestRenderer, testID: string): string {
  const node = hostsByTestId(rendered, testID)[0]!;
  return JSON.stringify(node.props.children);
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  jest.clearAllMocks();
});

type Exercise = ProgressOverviewResponse['exercises'][number];
type BodyWeight = ProgressOverviewResponse['bodyWeight'];

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: '11111111-1111-1111-1111-111111111111',
    exerciseName: 'Back Squat',
    prescriptionKind: 'sets_reps',
    metricKeys: ['estimatedOneRepMax', 'topSetLoad'],
    sessionCount: 1,
    points: [
      {
        sessionId: '22222222-2222-2222-2222-222222222222',
        localDate: '2026-01-05',
        sessionName: 'Lower A',
        metrics: [
          { key: 'estimatedOneRepMax', value: 225, loadUnit: 'lb' },
          { key: 'topSetLoad', value: null, loadUnit: 'lb' },
        ],
        isWeightPr: false,
        isRepPr: false,
      },
    ],
    ...overrides,
  };
}

function bodyWeight(overrides: Partial<BodyWeight> = {}): BodyWeight {
  return {
    unit: 'lb',
    sufficiency: 'ready',
    checkInCount: 20,
    currentAverage: 170.4,
    latestCheckIn: { localDate: '2026-01-20', weightValue: 170.1 },
    ratePerWeek: -0.3,
    direction: 'falling',
    windowWeeks: 8,
    points: [
      { localDate: '2026-01-01', raw: 172.0, trend: 172.0, rollingAverage: null },
      { localDate: '2026-01-08', raw: 171.0, trend: 171.6, rollingAverage: 171.5 },
      { localDate: '2026-01-15', raw: 170.2, trend: 171.0, rollingAverage: 170.9 },
      { localDate: '2026-01-20', raw: 170.1, trend: 170.6, rollingAverage: 170.4 },
    ],
    weeks: [
      { weekStart: '2026-01-05', average: 171.0, low: 170.2, high: 172.0, checkInCount: 3 },
      { weekStart: '2026-01-12', average: 170.3, low: 170.1, high: 170.6, checkInCount: 4 },
    ],
    ...overrides,
  };
}

describe('ExerciseCard', () => {
  it('renders an applicable-but-empty metric as "Not logged", never as 0', () => {
    const rendered = renderTree(<ExerciseCard exercise={exercise()} localDate="2026-01-21" />);
    expect(textOf(rendered, 'metric-topSetLoad')).toContain('Not logged');
    expect(textOf(rendered, 'metric-topSetLoad')).not.toContain('0');
  });

  it('withholds the chart and explains when there are too few sessions for a trend', () => {
    const rendered = renderTree(<ExerciseCard exercise={exercise({ sessionCount: 2 })} localDate="2026-01-21" />);
    expect(hostsByTestId(rendered, 'exercise-insufficient')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'exercise-chart-11111111-1111-1111-1111-111111111111')).toHaveLength(0);
    expect(textOf(rendered, 'exercise-insufficient')).toContain('at least 3');
  });

  it('draws the trend chart once there are enough qualifying sessions', () => {
    const points: Exercise['points'] = [1, 2, 3].map((n) => ({
      sessionId: `3333333${n}-3333-3333-3333-333333333333`,
      localDate: `2026-01-0${n}`,
      sessionName: `Session ${n}`,
      metrics: [{ key: 'estimatedOneRepMax', value: 200 + n * 5, loadUnit: 'lb' }],
      isWeightPr: false,
      isRepPr: false,
    }));
    const rendered = renderTree(
      <ExerciseCard
        exercise={exercise({ metricKeys: ['estimatedOneRepMax'], sessionCount: 3, points })}
        localDate="2026-01-21"
      />,
    );
    expect(hostsByTestId(rendered, 'exercise-chart-11111111-1111-1111-1111-111111111111')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'exercise-insufficient')).toHaveLength(0);
  });

  it('drills into the range-filtered session, not the same index of the full series', () => {
    // Three old points (dropped by a 1-month range) then three recent ones.
    const dates = ['2025-05-01', '2025-05-02', '2025-05-03', '2025-07-10', '2025-07-20', '2025-07-30'];
    const points: Exercise['points'] = dates.map((localDate, n) => ({
      sessionId: `session-${n}`,
      localDate,
      sessionName: `Session ${n}`,
      metrics: [{ key: 'estimatedOneRepMax', value: 200 + n, loadUnit: 'lb' }],
      isWeightPr: false,
      isRepPr: false,
    }));
    const rendered = renderTree(
      <ExerciseCard
        exercise={exercise({ metricKeys: ['estimatedOneRepMax'], sessionCount: 6, points })}
        localDate="2025-07-31"
      />,
    );

    // Narrow to the last month, which leaves only the three July sessions.
    press(rendered, 'chart-range-M');
    // Tapping the first visible point must open the first *July* session,
    // not the first of the unfiltered series.
    press(rendered, 'chart-point');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/session-summary', params: { sessionId: 'session-3' } });
  });

  it('drills into the session under the finger on a dense weekly series', () => {
    // 24 weekly sessions: ~7px apart, so a fixed 44px overlay would resolve a
    // tap several sessions to the right of the one aimed at.
    const points: Exercise['points'] = Array.from({ length: 24 }, (_, i) => ({
      sessionId: `sess-${i}`,
      localDate: new Date(Date.UTC(2025, 0, 6) + i * 7 * 86_400_000).toISOString().slice(0, 10),
      sessionName: `Session ${i}`,
      metrics: [{ key: 'estimatedOneRepMax', value: 200 + i, loadUnit: 'lb' }],
      isWeightPr: false,
      isRepPr: false,
    }));
    const rendered = renderTree(
      <ExerciseCard
        exercise={exercise({ metricKeys: ['estimatedOneRepMax'], sessionCount: 24, points })}
        localDate="2025-06-30"
      />,
    );
    const hits = pressablesByTestId(rendered, 'chart-point');
    expect(hits).toHaveLength(24);

    for (const target of [1, 12, 23]) {
      mockPush.mockClear();
      tapAt(hits, expectedX(target, points.length));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/session-summary',
        params: { sessionId: `sess-${target}` },
      });
    }
  });
});

describe('BodyWeightSection regressions', () => {
  const twoConsecutiveMornings: BodyWeight = {
    unit: 'lb',
    sufficiency: 'ready',
    checkInCount: 2,
    currentAverage: 167.7,
    latestCheckIn: { localDate: '2025-07-02', weightValue: 168.6 },
    ratePerWeek: null,
    direction: null,
    windowWeeks: 4,
    points: [
      { localDate: '2025-07-01', raw: 166.8, trend: 166.8, rollingAverage: null },
      { localDate: '2025-07-02', raw: 168.6, trend: 167.0, rollingAverage: null },
    ],
    weeks: [],
  };

  it('will not summarise two consecutive mornings as a change', () => {
    const rendered = renderTree(
      <BodyWeightSection bodyWeight={twoConsecutiveMornings} localDate="2025-07-02" />,
    );
    expect(hostsByTestId(rendered, 'body-weight-chart')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'body-weight-range-delta')).toHaveLength(0);
  });

  it('labels a stale weekly average with its real week, never "This week"', () => {
    const rendered = renderTree(
      <BodyWeightSection
        bodyWeight={{
          ...twoConsecutiveMornings,
          weeks: [{ weekStart: '2025-06-30', average: 167.7, low: 166.8, high: 168.6, checkInCount: 2 }],
        }}
        localDate="2025-07-21"
      />,
    );
    const text = textOf(rendered, 'body-weight-week-range');
    expect(text).toContain('Week of');
    expect(text).not.toContain('This week');
  });

  /*
   * Story 49 — parity with the web assertion of the same name. At 3M a mark
   * is a week's mean, not a morning's weigh-in, so it must name its own span
   * rather than claim a reading on a day that may never have been logged.
   */
  it('labels a bucketed mark with its period and sample count, not a single date', () => {
    // Every morning for ~4 months, so 3M is offered and buckets by week.
    const daily = Array.from({ length: 120 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 20) - (119 - index) * 86_400_000);
      return {
        localDate: day.toISOString().slice(0, 10),
        raw: 180 - index * 0.05,
        trend: 180 - index * 0.04,
        rollingAverage: index >= 6 ? 179.5 - index * 0.04 : null,
      };
    });

    const rendered = renderTree(
      <BodyWeightSection
        bodyWeight={bodyWeight({ checkInCount: daily.length, points: daily, weeks: [] })}
        localDate="2026-01-20"
      />,
    );
    press(rendered, 'chart-range-3M');

    // The visually-hidden table mirrors every mark, so it is the stable
    // surface for what the marks claim to represent.
    const summary = hostsByTestId(rendered, 'chart-table')[0]!.props.accessibilityLabel as string;
    // An en dash means the label names a span; a bare date would name one morning.
    expect(summary).toContain('\u2013');
    expect(summary).toMatch(/average of \d+ check-ins/);
  });

  /*
   * Story 49 — parity with the web assertion of the same name. A gap between
   * the two weeks must not be bridged: three weeks of drift labelled "vs
   * previous week" attributes it all to seven days.
   */
  it('compares this week to the previous one only when the two are adjacent', () => {
    const adjacent = renderTree(
      <BodyWeightSection
        bodyWeight={{
          ...twoConsecutiveMornings,
          weeks: [
            { weekStart: '2025-06-23', average: 168.2, low: 167.4, high: 169.0, checkInCount: 4 },
            { weekStart: '2025-06-30', average: 167.7, low: 166.8, high: 168.6, checkInCount: 3 },
          ],
        }}
        localDate="2025-07-02"
      />,
    );
    expect(textOf(adjacent, 'body-weight-week-range')).toContain(
      '\u22120.5 lb vs previous week',
    );

    const gapped = renderTree(
      <BodyWeightSection
        bodyWeight={{
          ...twoConsecutiveMornings,
          weeks: [
            { weekStart: '2025-06-02', average: 168.2, low: 167.4, high: 169.0, checkInCount: 4 },
            { weekStart: '2025-06-30', average: 167.7, low: 166.8, high: 168.6, checkInCount: 3 },
          ],
        }}
        localDate="2025-07-02"
      />,
    );
    expect(textOf(gapped, 'body-weight-week-range')).not.toContain('vs previous week');
  });
});

describe('BodyWeightSection', () => {
  it('shows an empty state and no chart when there are no weigh-ins', () => {
    const rendered = renderTree(
      <BodyWeightSection
        bodyWeight={bodyWeight({ sufficiency: 'none', checkInCount: 0, currentAverage: null, points: [], weeks: [] })}
        localDate="2026-01-21"
      />,
    );
    expect(hostsByTestId(rendered, 'body-weight-none')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'body-weight-chart')).toHaveLength(0);
  });

  it('leads with the 7-day average and an unvalenced weekly rate when ready', () => {
    const rendered = renderTree(<BodyWeightSection bodyWeight={bodyWeight()} localDate="2026-01-21" />);
    expect(textOf(rendered, 'body-weight-average')).toContain('170.4 lb');
    expect(textOf(rendered, 'body-weight-rate')).toContain('down');
  });

  it('draws the green trend overlay only when sufficiency is ready', () => {
    const ready = renderTree(<BodyWeightSection bodyWeight={bodyWeight()} localDate="2026-01-21" />);
    expect(hostsByTestId(ready, 'chart-trend-line')).toHaveLength(1);

    act(() => {
      tree?.unmount();
    });
    tree = null;

    const establishing = renderTree(
      <BodyWeightSection
        bodyWeight={bodyWeight({ sufficiency: 'establishing', currentAverage: null })}
        localDate="2026-01-21"
      />,
    );
    // The raw points are still drawn, but the smoothed line is withheld.
    expect(hostsByTestId(establishing, 'body-weight-chart')).toHaveLength(1);
    expect(hostsByTestId(establishing, 'chart-trend-line')).toHaveLength(0);
    expect(hostsByTestId(establishing, 'body-weight-establishing')).toHaveLength(1);
  });
});
