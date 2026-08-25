import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function weeks(counts: (number | null)[], volumes: (number | null)[] = []) {
  return counts.map((completedCount, index) => ({
    weekStart: new Date(Date.UTC(2025, 5, 2) + index * 7 * 86_400_000).toISOString().slice(0, 10),
    completedCount: completedCount ?? 0,
    plannedCount: null,
    completionRatio: null,
    volume: volumes[index] ?? null,
    isCurrent: index === counts.length - 1,
  }));
}

function baseOverview(overrides: Overview = {}): Overview {
  return {
    training: {
      weeks: weeks([2, 0, 3, 1, 0, 2, 3, 2, 1, 0, 2, 1]),
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
          weeks: weeks([0, 0, 0, 0]),
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
    expect(columns.length).toBe(12);
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
          weeks: weeks([2, 3], [4000, 8005]),
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
