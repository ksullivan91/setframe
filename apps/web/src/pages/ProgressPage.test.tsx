import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { ProgressPage } from './ProgressPage';

let mockGet: (path: string) => Promise<unknown> = () => new Promise(() => {});

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

type Overview = Record<string, unknown>;

/* Anchored to the real current week rather than a fixed past date. The charts
   window by calendar range now, so a fixture stranded in 2025 would fall
   outside every range and render as empty — a green suite proving nothing. */
function mondayOffsetWeeks(weeksAgo: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() || 7) - 1) - weeksAgo * 7);
  return date;
}

function weeks(counts: (number | null)[], volumes: (number | null)[] = []) {
  return counts.map((completedCount, index) => ({
    weekStart: mondayOffsetWeeks(counts.length - 1 - index).toISOString().slice(0, 10),
    completedCount: completedCount ?? 0,
    plannedCount: null,
    completionRatio: null,
    volume: volumes[index] ?? null,
    restCount: 0,
    isRestWeek: false,
    isCurrent: index === counts.length - 1,
  }));
}

/**
 * The daily rollup the charts actually bucket from, derived from the same
 * counts as `weeks` so the two cannot disagree — which is the property the
 * API guarantees and the fixture must not quietly break.
 */
function days(counts: (number | null)[], volumes: (number | null)[] = []) {
  const rows: { localDate: string; completedCount: number; volume: number | null }[] = [];
  counts.forEach((completedCount, index) => {
    const total = completedCount ?? 0;
    const weekVolume = volumes[index] ?? null;
    const monday = mondayOffsetWeeks(counts.length - 1 - index);
    for (let session = 0; session < total; session += 1) {
      const date = new Date(monday);
      date.setUTCDate(date.getUTCDate() + session);
      rows.push({
        localDate: date.toISOString().slice(0, 10),
        completedCount: 1,
        volume: weekVolume == null ? null : Math.round(weekVolume / total),
      });
    }
  });
  return rows;
}

function trainingFixture(counts: (number | null)[], volumes: (number | null)[] = []) {
  const dayRows = days(counts, volumes);
  return {
    weeks: weeks(counts, volumes),
    days: dayRows,
    firstActivityDate: dayRows[0]?.localDate ?? null,
  };
}

/**
 * Composition weeks aligned to the same Mondays as `weeks`, so the two views
 * of one window cannot disagree. Values are per *detailed* pattern — the
 * grouping into Legs/Push/Pull happens in the component, which is exactly
 * what these tests need to exercise.
 */
function compositionFixture(
  perWeek: (Record<string, number> | null)[],
  extras: { unclassifiedTotal?: number; unclassifiedExerciseCount?: number } = {},
) {
  const weekRows = perWeek.map((values, index) => ({
    weekStart: mondayOffsetWeeks(perWeek.length - 1 - index).toISOString().slice(0, 10),
    values: values ?? {},
    total: Object.values(values ?? {}).reduce((sum, value) => sum + value, 0),
    isCurrent: index === perWeek.length - 1,
  }));
  const totals = new Map<string, number>();
  for (const week of weekRows) {
    for (const [key, value] of Object.entries(week.values)) {
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }
  const classified = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return {
    unit: 'lb' as const,
    patterns: [...totals.entries()]
      .map(([key, total]) => ({ key, total, share: classified > 0 ? total / classified : 0 }))
      .sort((a, b) => b.total - a.total),
    weeks: weekRows,
    unclassifiedTotal: extras.unclassifiedTotal ?? 0,
    unclassifiedExerciseCount: extras.unclassifiedExerciseCount ?? 0,
  };
}

const emptyComposition = compositionFixture([]);

function baseOverview(overrides: Overview = {}): Overview {
  return {
    training: {
      ...trainingFixture([2, 0, 3, 1, 0, 2, 3, 2, 1, 0, 2, 1]),
      weeksTrained: 9,
      windowWeeks: 12,
      currentStreakWeeks: 3,
      longestStreakWeeks: 5,
      totalCompleted: 17,
      averageSessionsPerWeek: 1.4,
      volumeUnit: 'lb',
    },
    bodyWeight: {
      unit: 'lb',
      sufficiency: 'none',
      checkInCount: 0,
      currentAverage: null,
      latestCheckIn: null,
      ratePerWeek: null,
      direction: null,
      windowWeeks: 4,
      points: [],
      weeks: [],
    },
    composition: emptyComposition,
    exercises: [],
    recentSessions: [],
    ...overrides,
  };
}

function renderProgress(overview: Overview) {
  mockGet = () => Promise.resolve(overview);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/progress']}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <ProgressPage />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigate.mockClear();
});

describe('loading and empty states', () => {
  it('shows a skeleton rather than an empty page while loading', () => {
    mockGet = () => new Promise(() => {});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={getTheme('light')}>
            <ToastProvider>
              <ProgressPage />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('progress-skeleton')).toBeTruthy();
  });

  it('does not fabricate charts for a brand new user', async () => {
    renderProgress(
      baseOverview({
        training: {
          ...trainingFixture([0, 0, 0, 0]),
          weeksTrained: 0,
          windowWeeks: 4,
          currentStreakWeeks: 0,
          longestStreakWeeks: 0,
          totalCompleted: 0,
          averageSessionsPerWeek: 0,
          volumeUnit: 'lb',
        },
      }),
    );
    await waitFor(() => expect(screen.getByText('Nothing to chart yet')).toBeTruthy());
    expect(screen.queryByTestId('sessions-chart')).toBeNull();
  });
});

describe('training summary', () => {
  it('leads with weeks trained rather than a streak', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('weeks-trained')).toBeTruthy());
    expect(screen.getByTestId('weeks-trained').textContent).toContain('9');
    expect(screen.getByTestId('weeks-trained').textContent).toContain('of 12');
  });

  it('keeps the best streak visible alongside the current one', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('current-streak')).toBeTruthy());
    expect(screen.getByTestId('current-streak').textContent).toBe('3');
    expect(screen.getByText('Best: 5 weeks')).toBeTruthy();
  });

  it('says the plan is unknown instead of claiming 100% completion', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByText('No plan set for this week')).toBeTruthy());
  });

  // Story 14: the old chart omitted untrained weeks entirely, so an "8 week"
  // view could render as a single dot.
  it('renders a column for every week in the window, including empty ones', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());
    const columns = screen.getAllByTestId(/^chart-column/);
    /* The fixture trains in 9 of its 12 weeks. The exact column count follows
       the selected range's window rather than the payload length, so this
       pins the property that matters: a week with no training still occupies
       the axis. Omitting them would give exactly 9. */
    expect(columns.length).toBeGreaterThan(9);
    const zeroCells = screen
      .getAllByRole('row')
      .filter((row) => row.querySelector('td')?.textContent === '0');
    expect(zeroCells.length).toBeGreaterThanOrEqual(3);
  });

  it('distinguishes the current week', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());
    expect(screen.getAllByTestId('chart-column-current')).toHaveLength(1);
  });

  it('hides the volume chart entirely when no weighted work was logged', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());
    expect(screen.queryByTestId('volume-chart')).toBeNull();
  });

  it('shows the volume chart once weighted work exists', async () => {
    renderProgress(
      baseOverview({
        training: {
          ...(baseOverview().training as Record<string, unknown>),
          ...trainingFixture([2, 3], [4000, 8005]),
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('volume-chart')).toBeTruthy());
  });
});

describe('body weight', () => {
  const points = Array.from({ length: 20 }, (_, index) => ({
    localDate: new Date(Date.UTC(2025, 6, 1) + index * 86_400_000).toISOString().slice(0, 10),
    raw: 180 - index * 0.15,
    trend: 180 - index * 0.12,
    rollingAverage: index >= 6 ? 179 - index * 0.1 : null,
  }));

  it('invites a first check-in without drawing anything', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByText(/No morning weigh-ins yet/)).toBeTruthy());
    expect(screen.queryByTestId('body-weight-chart')).toBeNull();
  });

  // The user's core concern: a single weigh-in must not imply a trend.
  it('does not claim a trend from one check-in', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'establishing',
          checkInCount: 1,
          currentAverage: null,
          latestCheckIn: { localDate: '2025-07-01', weightValue: 166.8 },
          ratePerWeek: null,
          direction: null,
          windowWeeks: 4,
          points: [points[0]!],
          weeks: [],
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('body-weight-establishing')).toBeTruthy());
    expect(screen.getByTestId('body-weight-establishing').textContent).toContain('not a trend');
    expect(screen.queryByTestId('chart-trend-line')).toBeNull();
  });

  it('leads with the 7-day average once there is enough data', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'ready',
          checkInCount: points.length,
          currentAverage: 177.4,
          latestCheckIn: { localDate: '2025-07-20', weightValue: 177.1 },
          ratePerWeek: -0.84,
          direction: 'falling',
          windowWeeks: 4,
          points,
          weeks: [
            { weekStart: '2025-06-30', average: 179.8, low: 178.9, high: 180.2, checkInCount: 6 },
            { weekStart: '2025-07-07', average: 178.6, low: 177.4, high: 179.5, checkInCount: 7 },
          ],
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('body-weight-average')).toBeTruthy());
    expect(screen.getByTestId('body-weight-average').textContent).toContain('177.4');
    expect(screen.getAllByText('7-day average').length).toBeGreaterThan(0);
  });

  it('describes change as a weekly rate, never as a day-over-day delta', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'ready',
          checkInCount: points.length,
          currentAverage: 177.4,
          latestCheckIn: { localDate: '2025-07-20', weightValue: 177.1 },
          ratePerWeek: -0.84,
          direction: 'falling',
          windowWeeks: 4,
          points,
          weeks: [],
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('body-weight-rate')).toBeTruthy());
    const rate = screen.getByTestId('body-weight-rate').textContent ?? '';
    expect(rate).toContain('a week');
    expect(rate).not.toMatch(/today|yesterday/i);
  });

  it('draws the smoothed trend line only once the data supports it', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'ready',
          checkInCount: points.length,
          currentAverage: 177.4,
          latestCheckIn: { localDate: '2025-07-20', weightValue: 177.1 },
          ratePerWeek: -0.84,
          direction: 'falling',
          windowWeeks: 4,
          points,
          weeks: [],
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('chart-trend-line')).toBeTruthy());
  });

  /**
   * Story 32 — Start/Current/Change framing for the selected range, built
   * from the raw check-ins actually visible, not the prior period's value.
   */
  it('shows Start, Current (with date), and Change for the visible range', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'ready',
          checkInCount: points.length,
          currentAverage: 177.4,
          latestCheckIn: { localDate: '2025-07-20', weightValue: 177.1 },
          ratePerWeek: -0.84,
          direction: 'falling',
          windowWeeks: 4,
          points,
          weeks: [],
        },
      }),
    );

    await waitFor(() => expect(screen.getByTestId('body-weight-range-summary')).toBeTruthy());
    expect(screen.getByTestId('body-weight-range-start')).toHaveTextContent('180.0');
    expect(screen.getByTestId('body-weight-range-current')).toHaveTextContent('177.2');
    // 20 points at -0.15/day = a 2.85 lb drop, direction down.
    expect(screen.getByTestId('body-weight-range-change')).toHaveTextContent('↓ 2.8 lb');
  });

  it('shows only Current, with no Start or Change, for a single check-in', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'establishing',
          checkInCount: 1,
          currentAverage: null,
          latestCheckIn: { localDate: '2025-07-20', weightValue: 180 },
          ratePerWeek: null,
          direction: null,
          windowWeeks: 4,
          points: [{ localDate: '2025-07-20', raw: 180, trend: null, rollingAverage: null }],
          weeks: [],
        },
      }),
    );

    await waitFor(() => expect(screen.getByTestId('body-weight-range-current')).toBeTruthy());
    expect(screen.queryByTestId('body-weight-range-start')).toBeNull();
    expect(screen.queryByTestId('body-weight-range-change')).toBeNull();
  });
});

describe('prescription-aware exercise metrics', () => {
  const cycling = {
    exerciseId: '11111111-1111-4111-8111-111111111111',
    exerciseName: 'Outdoor Cycle',
    prescriptionKind: 'distanceDuration',
    metricKeys: ['totalDistance', 'totalDuration', 'averagePace'],
    sessionCount: 1,
    points: [
      {
        sessionId: '22222222-2222-4222-8222-222222222222',
        localDate: '2025-07-10',
        sessionName: 'Cardio',
        metrics: [
          { key: 'totalDistance', value: 12.4, distanceUnit: 'mi' },
          { key: 'totalDuration', value: 2700 },
          { key: 'averagePace', value: 217 },
        ],
        isWeightPr: false,
        isRepPr: false,
      },
    ],
  };

  // Story 15's headline regression: cycling used to render "0 lb est. 1RM",
  // "Top set 0 x 0" and "volume 0 lb".
  it('never shows load metrics for a cycling activity', async () => {
    renderProgress(baseOverview({ exercises: [cycling] }));
    await waitFor(() => expect(screen.getByText('Outdoor Cycle')).toBeTruthy());
    expect(screen.queryByText(/1RM/)).toBeNull();
    expect(screen.queryByText(/Top set/)).toBeNull();
    expect(screen.queryByText(/0 lb/)).toBeNull();
  });

  it('shows activity-appropriate units', async () => {
    renderProgress(baseOverview({ exercises: [cycling] }));
    await waitFor(() => expect(screen.getByText('Outdoor Cycle')).toBeTruthy());
    expect(screen.getByText('12.4 mi')).toBeTruthy();
    expect(screen.getByText('45m')).toBeTruthy();
  });

  it('says a metric is not logged rather than printing zero', async () => {
    renderProgress(
      baseOverview({
        exercises: [
          {
            ...cycling,
            points: [
              {
                ...cycling.points[0],
                metrics: [
                  { key: 'totalDistance', value: null, distanceUnit: 'mi' },
                  { key: 'totalDuration', value: null },
                  { key: 'averagePace', value: null },
                ],
              },
            ],
          },
        ],
      }),
    );
    await waitFor(() => expect(screen.getByText('Outdoor Cycle')).toBeTruthy());
    expect(screen.getAllByText('Not logged').length).toBeGreaterThan(0);
  });

  it('refuses to draw a trend from too few sessions', async () => {
    renderProgress(baseOverview({ exercises: [cycling] }));
    await waitFor(() => expect(screen.getByTestId('exercise-insufficient')).toBeTruthy());
    expect(screen.getByTestId('exercise-insufficient').textContent).toContain('at least 3');
  });
});

describe('metric explanations', () => {
  it('explains a metric on demand rather than on hover', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('weeks-trained')).toBeTruthy());
    expect(screen.queryByTestId('metric-info-panel')).toBeNull();

    const trigger = screen.getAllByTestId('metric-info-trigger')[0]!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);

    const panels = screen.getAllByTestId('metric-info-panel');
    expect(panels.length).toBe(1);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('explains why weeks trained is shown instead of a streak', async () => {
    renderProgress(baseOverview());
    await waitFor(() => expect(screen.getByTestId('weeks-trained')).toBeTruthy());
    fireEvent.click(screen.getAllByTestId('metric-info-trigger')[0]!);
    expect(screen.getByTestId('metric-info-panel').textContent).toContain('streak drops to zero');
  });
});

describe('drill-down', () => {
  it('opens the underlying session from a recent session row', async () => {
    renderProgress(
      baseOverview({
        recentSessions: [
          {
            sessionId: '33333333-3333-4333-8333-333333333333',
            localDate: '2025-07-20',
            completedAt: '2025-07-20T12:00:00.000Z',
            sessionName: 'Upper A',
            exerciseCount: 5,
            setCount: 18,
            volume: 8005,
            prCount: 2,
          },
        ],
      }),
    );
    await waitFor(() => expect(screen.getByTestId('recent-session')).toBeTruthy());
    fireEvent.click(screen.getByTestId('recent-session'));
    expect(navigate).toHaveBeenCalledWith('/workout/33333333-3333-4333-8333-333333333333');
  });

  it('omits volume from a session that recorded none rather than showing 0 lb', async () => {
    renderProgress(
      baseOverview({
        recentSessions: [
          {
            sessionId: '44444444-4444-4444-8444-444444444444',
            localDate: '2025-07-20',
            completedAt: null,
            sessionName: 'Cardio',
            exerciseCount: 1,
            setCount: 1,
            volume: null,
            prCount: 0,
          },
        ],
      }),
    );
    await waitFor(() => expect(screen.getByTestId('recent-session')).toBeTruthy());
    expect(screen.getByTestId('recent-session').textContent).not.toContain('0 lb');
  });
});

describe('regressions', () => {
  const twoConsecutiveMornings = {
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

  // The exact artefact the user objected to, arriving via the range summary.
  it('will not summarise two consecutive mornings as a change', async () => {
    renderProgress(baseOverview({ bodyWeight: twoConsecutiveMornings }));
    await waitFor(() => expect(screen.getByTestId('body-weight-chart')).toBeTruthy());
    expect(screen.queryByTestId('body-weight-range-delta')).toBeNull();
  });

  it('labels a stale weekly average with its real week', async () => {
    renderProgress(
      baseOverview({
        bodyWeight: {
          ...twoConsecutiveMornings,
          weeks: [
            { weekStart: '2025-06-30', average: 167.7, low: 166.8, high: 168.6, checkInCount: 2 },
          ],
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('body-weight-week-range')).toBeTruthy());
    const text = screen.getByTestId('body-weight-week-range').textContent ?? '';
    expect(text).toContain('Week of');
    expect(text).not.toContain('This week');
  });

  /*
   * Story 49 — at 3M a mark is a week's mean, not a morning's weigh-in.
   * Labelling it with a single date told the user they weighed that value on
   * a day they may never have logged, so the mark has to name its own span.
   * Seeded relative to today because the page reads the real clock; the
   * assertions are on the shape of the label, not on particular dates.
   */
  it('labels a bucketed mark with its period and sample count, not a single date', async () => {
    // Every morning for ~4 months, so 3M is offered and buckets by week.
    const today = new Date();
    const daily = Array.from({ length: 120 }, (_, index) => {
      const day = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
          (119 - index) * 86_400_000,
      );
      return {
        localDate: day.toISOString().slice(0, 10),
        raw: 180 - index * 0.05,
        trend: 180 - index * 0.04,
        rollingAverage: index >= 6 ? 179.5 - index * 0.04 : null,
      };
    });

    renderProgress(
      baseOverview({
        bodyWeight: {
          unit: 'lb',
          sufficiency: 'ready',
          checkInCount: daily.length,
          currentAverage: 174.1,
          latestCheckIn: { localDate: daily.at(-1)!.localDate, weightValue: 174.05 },
          ratePerWeek: -0.35,
          direction: 'falling',
          windowWeeks: 4,
          points: daily,
          weeks: [],
        },
      }),
    );

    await waitFor(() => expect(screen.getAllByTestId('chart-range-selector').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: '3M' })[0]!);

    // The accessible data table mirrors the marks, so it is the stable
    // surface for what each mark claims to represent. An en dash means the
    // label names a span; a bare date would mean it names one morning.
    await waitFor(() => {
      const headers = screen.getAllByRole('rowheader').map((cell) => cell.textContent ?? '');
      expect(headers.length).toBeGreaterThan(0);
      expect(headers.every((header) => header.includes('\u2013'))).toBe(true);
    });

    const marks = screen
      .getAllByRole('button')
      .map((mark) => mark.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes('\u2013'));
    expect(marks.some((label) => /average of \d+ check-ins/.test(label))).toBe(true);
  });

  /*
   * Story 49 — "vs previous 7 days" context, but only where the comparison is
   * real. A gap between the two weeks must not be bridged: three weeks of
   * drift labelled "vs previous week" attributes it all to seven days.
   */
  it('compares this week to the previous one only when the two are adjacent', async () => {
    const adjacent = {
      ...twoConsecutiveMornings,
      weeks: [
        { weekStart: '2025-06-23', average: 168.2, low: 167.4, high: 169.0, checkInCount: 4 },
        { weekStart: '2025-06-30', average: 167.7, low: 166.8, high: 168.6, checkInCount: 3 },
      ],
    };
    const { unmount } = renderProgress(baseOverview({ bodyWeight: adjacent }));
    await waitFor(() => expect(screen.getByTestId('body-weight-week-change')).toBeTruthy());
    expect(screen.getByTestId('body-weight-week-change')).toHaveTextContent(
      '\u22120.5 lb vs previous week',
    );
    unmount();

    renderProgress(
      baseOverview({
        bodyWeight: {
          ...adjacent,
          weeks: [
            { weekStart: '2025-06-02', average: 168.2, low: 167.4, high: 169.0, checkInCount: 4 },
            { weekStart: '2025-06-30', average: 167.7, low: 166.8, high: 168.6, checkInCount: 3 },
          ],
        },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('body-weight-week-range')).toBeTruthy());
    expect(screen.queryByTestId('body-weight-week-change')).toBeNull();
  });
});

describe('API version skew', () => {
  // The client deploys separately from the API, so it can outrun it. This is
  // the literal payload the previous API build returned, which crashed the
  // page on `training.weeks` of undefined.
  it('shows the error state rather than crashing on a previous response shape', async () => {
    renderProgress({
      cards: [{ key: 'weekly-sessions', label: 'Sessions this week', value: '1' }],
      consistency: { weeks: [], summary: { currentStreakWeeks: 1 } },
      bodyWeight: { points: [], trendLabel: '+1.4 lb over 2 check-ins' },
      featuredExercise: { exerciseId: 'x', exerciseName: 'Outdoor Cycle', points: [] },
      recentSessions: [],
    });
    await waitFor(() => expect(screen.getByText(/could not load your progress/)).toBeTruthy());
    // The offending copy must not leak through from the stale payload either.
    expect(screen.queryByText(/over 2 check-ins/)).toBeNull();
  });

  it('shows the error state on a null payload', async () => {
    renderProgress(null as never);
    await waitFor(() => expect(screen.getByText(/could not load your progress/)).toBeTruthy());
  });
});

/**
 * Story 51 — the insight strip, wired into the real page rather than tested
 * only in isolation. The fixtures above are dated to 2025, so the current
 * week's window is empty and no insight can be stated; these date their weeks
 * relative to today so the strip has something to compare.
 */
describe('insight strip', () => {
  /* Weeks and days built from the same counts, so the strip and the charts
     below it are describing one history rather than two. */
  function withRecentWeeks(counts: number[]) {
    return baseOverview({
      training: {
        ...(baseOverview().training as Record<string, unknown>),
        ...trainingFixture(counts),
      },
    });
  }

  it('states a week-over-week comparison above the charts', async () => {
    renderProgress(withRecentWeeks([3, 3, 1]));

    await waitFor(() => expect(screen.getByTestId('progress-insights')).toBeTruthy());
    expect(screen.getByTestId('progress-insight-training_frequency')).toHaveTextContent(
      /1 session so far, compared with 3 last week\./,
    );
  });

  /**
   * The story's premise. With no previous week to compare against there is
   * nothing to say, and the strip must be absent rather than empty.
   */
  it('renders no strip at all when nothing can be compared', async () => {
    /* A single week of history: there is no previous week, so no comparison
       exists to state. (This used to lean on the base fixture being dated to
       2025 and therefore out of every window — an accident of the fixture
       rather than the condition the story is about.) */
    renderProgress(withRecentWeeks([1]));
    await waitFor(() => expect(screen.getByTestId('weeks-trained')).toBeTruthy());
    expect(screen.queryByTestId('progress-insights')).toBeNull();
  });

  it('scrolls to the supporting chart when an insight is followed', async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    renderProgress(withRecentWeeks([3, 3, 1]));

    await waitFor(() => expect(screen.getByTestId('progress-insights')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /1 session so far/ }));

    expect(scrollIntoView).toHaveBeenCalled();
  });
});

/**
 * Story 50 — training frequency and volume as explorable charts rather than
 * static reporting.
 */
describe('training frequency and volume charts', () => {
  /* Pinned to a Thursday so "the current week" is a fixed, half-elapsed week.
     Without this the fixture's session dates depend on the weekday the suite
     happens to run, and the partial-week assertions drift with it. Only Date
     is faked, so react-query's timers still run normally. */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-27T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const withVolume = (counts: number[], volumes: (number | null)[]) =>
    baseOverview({
      training: {
        ...(baseOverview().training as Record<string, unknown>),
        ...trainingFixture(counts, volumes),
      },
    });

  it('requests a full year, so the long ranges are not silently truncated', async () => {
    /* The default was 12 weeks while the selector offers 6M, Y and ALL. The
       MSW fixture ignores the parameter, so nothing on screen revealed that
       every long range was rendering a quarter of what it claimed. */
    const paths: string[] = [];
    const overview = withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]);
    mockGet = (path: string) => {
      paths.push(path);
      return Promise.resolve(overview);
    };
    render(
      <MemoryRouter initialEntries={['/progress']}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ThemeProvider theme={getTheme('light')}>
            <ToastProvider>
              <ProgressPage />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(paths.length).toBeGreaterThan(0));
    expect(paths[0]).toMatch(/weeks=53\b/);
  });

  it('gives both charts the same range selector the rest of Progress uses', async () => {
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    expect(screen.getByRole('group', { name: /Training frequency time range/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: /Training volume time range/i })).toBeTruthy();
  });

  it('re-buckets to days when the week range is selected', async () => {
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    const selector = screen.getByRole('group', { name: /Training frequency time range/i });
    fireEvent.click(within(selector).getByRole('button', { name: 'W' }));

    // A Monday-Sunday week is seven daily marks, never one weekly one.
    await waitFor(() =>
      expect(screen.getByTestId('sessions-range-context')).toHaveTextContent(/one bar per day/),
    );
  });

  it('buckets a month by week, because a daily session count is only ever 0 or 1', async () => {
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    const selector = screen.getByRole('group', { name: /Training frequency time range/i });
    fireEvent.click(within(selector).getByRole('button', { name: 'M' }));

    await waitFor(() =>
      expect(screen.getByTestId('sessions-range-context')).toHaveTextContent(/one bar per week/),
    );
  });

  it('reveals the exact period and value when a bar is selected', async () => {
    // 9,000 over 3 sessions divides evenly, so the assertion is about the
    // readout rather than about how the fixture rounds.
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 9000]));
    await waitFor(() => expect(screen.getByTestId('volume-chart')).toBeTruthy());

    const chart = screen.getByTestId('volume-chart');
    const bars = within(chart).getAllByRole('button');
    fireEvent.click(bars.at(-1)!);

    const readout = within(chart).getByTestId('chart-readout');
    /* A named span rather than a bare start date (Story 49's rule), and the
       exact figure rather than the abbreviated axis label — 7,000 lb, not
       the "7k" the tick shows. */
    expect(readout.textContent).toMatch(/Aug 24\s*–\s*30/);
    expect(readout.textContent).toMatch(/9,000 lb/);
  });

  it('names the current period in words, never by bar colour alone', async () => {
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    // Story 33 fixed this once already: the in-progress bar must carry text.
    expect(screen.getByTestId('sessions-partial-note').textContent).toMatch(
      /still in progress.*not yet comparable/i,
    );
    expect(screen.getByTestId('sessions-current').textContent).toMatch(/so far/);
  });

  it('compares against the previous period', async () => {
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    expect(screen.getByTestId('sessions-previous').textContent).toBe('4');
    expect(screen.getByTestId('sessions-change').textContent).toMatch(/↓\s*1/);
  });

  it('never shows a 0 lb volume for training that carries no load', async () => {
    /* The story's explicit trap: a walk is a completed session, but weight ×
       reps is meaningless for it. It must not be reported as having moved
       zero pounds — the volume chart should not be offered at all. */
    renderProgress(withVolume([2, 3, 2, 1], [null, null, null, null]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    expect(screen.queryByTestId('volume-chart')).toBeNull();
    expect(screen.queryByText(/0 lb/)).toBeNull();
  });

  it('counts only completed sessions, not the days around them', async () => {
    renderProgress(withVolume([3, 2, 4, 3], [9000, 8000, 12000, 7000]));
    await waitFor(() => expect(screen.getByTestId('sessions-chart')).toBeTruthy());

    expect(screen.getByTestId('sessions-total').textContent).toMatch(/12 sessions/);
  });
});

/**
 * Training composition — the first Progress chart that shows what the volume
 * was made of rather than only how much of it there was.
 */
describe('ProgressPage training composition', () => {
  const legDay = { squat: 4000, hinge: 3000 };
  const pushDay = { 'horizontal-push': 2500, 'vertical-push': 1500 };
  const pullDay = { 'horizontal-pull': 2000, 'vertical-pull': 1800 };

  it('rolls detailed patterns up into the planning groups', async () => {
    renderProgress(
      baseOverview({
        composition: compositionFixture([
          { ...legDay, ...pushDay },
          { ...pullDay, core: 500 },
          { ...legDay, ...pullDay },
          { ...pushDay, 'isolation-arm': 400 },
        ]),
      }),
    );

    const legend = await screen.findByTestId('stacked-legend');
    // Groups, not raw pattern slugs — "Squat" and "Vertical push" must not
    // reach the user; five meaningful bands must.
    expect(within(legend).getByText('Legs')).toBeInTheDocument();
    expect(within(legend).getByText('Push')).toBeInTheDocument();
    expect(within(legend).getByText('Pull')).toBeInTheDocument();
    expect(within(legend).queryByText('Squat')).not.toBeInTheDocument();
    expect(within(legend).queryByText('Vertical push')).not.toBeInTheDocument();
  });

  it('stacks segments that sum to the week total', async () => {
    renderProgress(
      baseOverview({ composition: compositionFixture([{ ...legDay, ...pushDay }]) }),
    );

    await screen.findByTestId('composition-chart');
    const columns = screen.getAllByRole('button', { name: /Legs/ });
    // 4000 + 3000 legs, 2500 + 1500 push = 11,000 lb total.
    expect(columns[0]).toHaveAccessibleName(/11,000 lb total/);
    expect(columns[0]).toHaveAccessibleName(/Legs 7,000 lb/);
    expect(columns[0]).toHaveAccessibleName(/Push 4,000 lb/);
  });

  it('names the largest group and its share', async () => {
    renderProgress(
      baseOverview({
        composition: compositionFixture([{ squat: 8000, 'horizontal-push': 2000 }]),
      }),
    );
    // 8000 of 10,000 is 80% legs.
    expect(await screen.findByTestId('composition-summary')).toHaveTextContent(
      /Legs was your largest share at 80% of 10,000 lb/,
    );
  });

  it('discloses volume it could not group rather than hiding it', async () => {
    renderProgress(
      baseOverview({
        composition: compositionFixture([{ squat: 5000 }], {
          unclassifiedTotal: 2400,
          unclassifiedExerciseCount: 3,
        }),
      }),
    );
    expect(await screen.findByTestId('stacked-disclosure')).toHaveTextContent(
      /2,400 lb from 3 exercises without a movement pattern is not shown/,
    );
  });

  it('explains the fixable cause when nothing is classified at all', async () => {
    renderProgress(
      baseOverview({
        composition: compositionFixture([], {
          unclassifiedTotal: 9000,
          unclassifiedExerciseCount: 4,
        }),
      }),
    );
    const note = await screen.findByTestId('composition-unclassified-only');
    expect(note).toHaveTextContent(/None of your exercises has a movement pattern set/);
    // The chart itself must not render an empty axis alongside the message.
    expect(screen.queryByTestId('composition-chart')).not.toBeInTheDocument();
  });

  it('renders nothing at all when there is no volume of any kind', async () => {
    renderProgress(baseOverview({ composition: compositionFixture([]) }));
    await screen.findByTestId('sessions-chart');
    expect(screen.queryByTestId('composition-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('composition-unclassified-only')).not.toBeInTheDocument();
  });

  it('draws an untrained week as a visible zero, not as a gap', async () => {
    renderProgress(
      baseOverview({
        composition: compositionFixture([{ ...legDay }, null, { ...pushDay }]),
      }),
    );
    await screen.findByTestId('composition-chart');
    // A week with nothing logged still gets a stub, so the absence is drawn.
    expect(screen.getAllByTestId('stacked-empty').length).toBeGreaterThan(0);
  });

  it('gives screen readers the composition, not just the totals', async () => {
    renderProgress(
      baseOverview({ composition: compositionFixture([{ ...legDay, ...pullDay }]) }),
    );
    await screen.findByTestId('composition-chart');
    const table = screen.getByRole('table', {
      name: /Training composition by movement pattern/,
    });
    // The text equivalent has to be a matrix; a column of weekly totals would
    // be the text equivalent of a different chart.
    expect(within(table).getByRole('columnheader', { name: 'Legs' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Pull' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
  });

  it('reports the breakdown when a bar is selected', async () => {
    renderProgress(
      baseOverview({ composition: compositionFixture([{ ...legDay, ...pushDay }]) }),
    );
    await screen.findByTestId('composition-chart');
    fireEvent.click(screen.getAllByRole('button', { name: /Legs/ })[0]!);
    const readout = screen.getByTestId('stacked-readout');
    expect(readout).toHaveTextContent(/11,000 lb/);
    expect(readout).toHaveTextContent(/Legs 7,000 lb/);
  });
});
