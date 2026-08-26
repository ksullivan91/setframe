import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { TodayPage } from './TodayPage';

// TodayPage calls useApiClient() (Clerk-token-authenticated fetch), so we
// mock it here to avoid needing a real ClerkProvider + network in this
// smoke test, per the same pattern used for other API-backed pages.
// `mockGet` is reassigned per-test so different specs can return different
// fixture data without re-mocking the module.
let mockGet: (path: string) => Promise<unknown> = () => new Promise(() => {});
vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}));

function renderTodayPage() {
  const queryClient = new QueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <TodayPage />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Smoke test: renders TodayPage inside its required providers without crashing. */
describe('TodayPage', () => {
  it('renders without crashing', () => {
    mockGet = () => new Promise(() => {}); // never resolves — page renders its loading state
    renderTodayPage();

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});

/** A minimal scheduled-day dashboard payload. */
function baseToday() {
  return {
    localDate: '2026-08-22',
    dayTypeId: 'day-1',
    dayLabel: 'Push',
    weekLabel: 'Week 3',
    sessions: [],
    manualEntry: null,
    activitySummary: null,
    nutritionSnapshot: null,
    syncState: null,
  };
}

/**
 * The page presents one loading state, not several racing each other.
 *
 * Additional activity and Today summary each owned their own readiness:
 * Additional activity painted its card shell the moment the page mounted
 * (it fetches separately), and Today summary rendered straight from
 * still-undefined dashboard data. The result was a finished card and a
 * summary claiming "0 of 5 steps complete" sitting above the skeleton that
 * stood in for everything else.
 */
describe('TodayPage loading state', () => {
  it('shows nothing but the header and skeleton while Today is loading', async () => {
    mockGet = () => new Promise(() => {}); // never resolves
    renderTodayPage();

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.queryByText('Additional activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Today summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/of 5 steps complete/)).not.toBeInTheDocument();
  });

  it('keeps them hidden while only the additional-activity request is outstanding', async () => {
    /* The dashboard resolving first is the ordering that produced the
       screenshot: Today had data, so its skeleton cleared, while Additional
       activity was still fetching and drew its empty shell. */
    mockGet = (path: string) => {
      if (path.startsWith('/additional-activities')) return new Promise(() => {});
      if (path.startsWith('/dashboard/today')) return Promise.resolve(baseToday());
      if (path === '/programs') return Promise.resolve([{ id: 'p1', isActive: true }]);
      return Promise.resolve(null);
    };
    renderTodayPage();

    await screen.findByText('Today');
    expect(screen.queryByText('Additional activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Today summary')).not.toBeInTheDocument();
  });

  it('shows both once everything has loaded', async () => {
    mockGet = (path: string) => {
      if (path.startsWith('/additional-activities')) return Promise.resolve({ items: [] });
      if (path.startsWith('/dashboard/today')) return Promise.resolve(baseToday());
      if (path === '/programs') return Promise.resolve([{ id: 'p1', isActive: true }]);
      return Promise.resolve(null);
    };
    renderTodayPage();

    expect(await screen.findByText('Additional activity')).toBeInTheDocument();
    expect(await screen.findByText('Today summary')).toBeInTheDocument();
  });
});

/** Story 06: a completed-but-not-active session must show the completed
 * review state instead of the Start/Preview/Change/Skip action row — it
 * previously fell through to the "scheduled" state because
 * todayWorkoutState never checked completedSession. */
describe('TodayPage completed-workout state', () => {
  it('shows the completed review and hides scheduled actions when a completed session exists', async () => {
    mockGet = (path: string) => {
      if (path.startsWith('/dashboard/today')) {
        return Promise.resolve({
          localDate: '2026-08-22',
          dayTypeId: 'day-1',
          dayLabel: 'Push',
          weekLabel: 'Week 3',
          sessions: [
            {
              id: 'session-1',
              status: 'completed',
              completedAt: '2026-08-22T14:00:00.000Z',
              updatedAt: '2026-08-22T14:00:00.000Z',
            },
          ],
        });
      }
      if (path.startsWith('/workout-sessions/')) {
        return Promise.resolve({ exercises: [], sets: [] });
      }
      return Promise.resolve([]);
    };

    renderTodayPage();

    expect(await screen.findByText('Workout complete!')).toBeInTheDocument();
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
    expect(screen.queryByText("Change today's workout")).not.toBeInTheDocument();
    expect(screen.queryByText('Skip today')).not.toBeInTheDocument();
    expect(screen.getByText('Review workout')).toBeInTheDocument();
  });
});

/**
 * Story 24 — the dashboard could previously only recognize "zero
 * programs"; archiving the sole active program (or every program) while
 * others still exist left Today silently unable to resolve a schedule
 * with no explanation.
 */
describe('TodayPage no active program state', () => {
  it('offers to choose a program (not guided setup) when programs exist but none is active', async () => {
    mockGet = (path: string) => {
      if (path.startsWith('/dashboard/today')) {
        return Promise.resolve({ localDate: '2026-08-24', dayTypeId: null, dayLabel: null, weekLabel: null, sessions: [] });
      }
      if (path === '/programs') return Promise.resolve([{ id: 'program-1', isActive: false }]);
      return Promise.resolve([]);
    };

    renderTodayPage();

    expect(await screen.findByText(/none is set active/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a program' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start guided setup' })).not.toBeInTheDocument();
  });
});

function todayPayload(overrides: Record<string, unknown> = {}) {
  return {
    localDate: '2026-08-24',
    dayTypeId: null,
    dayLabel: null,
    weekLabel: null,
    sessions: [],
    restDay: null,
    ...overrides,
  };
}

describe('rest days', () => {
  it('offers a rest day alongside choosing a workout when nothing is scheduled', async () => {
    mockGet = (path: string) => {
      if (path.startsWith('/dashboard/today')) return Promise.resolve(todayPayload());
      if (path === '/programs') return Promise.resolve([{ id: 'program-1', isActive: true }]);
      return Promise.resolve([]);
    };

    renderTodayPage();

    expect(await screen.findByText('Choose workout')).toBeInTheDocument();
    expect(screen.getByText('Take a rest day')).toBeInTheDocument();
  });

  it('offers a rest day on a day that has a workout scheduled', async () => {
    mockGet = (path: string) => {
      if (path.startsWith('/dashboard/today'))
        return Promise.resolve(todayPayload({ dayTypeId: 'day-1', dayLabel: 'Push' }));
      if (path === '/programs') return Promise.resolve([{ id: 'program-1', isActive: true }]);
      return Promise.resolve([]);
    };

    renderTodayPage();

    expect(await screen.findByText('Start workout')).toBeInTheDocument();
    expect(screen.getByText('Take a rest day')).toBeInTheDocument();
  });

  // The completion state must not be the workout one: there is nothing to
  // review, and offering a review link would be a dead end.
  it('shows a rest completion state with no workout to review', async () => {
    mockGet = (path: string) =>
      path.startsWith('/dashboard/today')
        ? Promise.resolve(
            todayPayload({
              dayTypeId: 'day-1',
              dayLabel: 'Push',
              restDay: {
                id: 'rest-1',
                localDate: '2026-08-24',
                timezone: 'America/Chicago',
                note: null,
                createdAt: '2026-08-24T12:00:00.000Z',
              },
            }),
          )
        : Promise.resolve([]);

    renderTodayPage();

    expect(await screen.findByText('Rest day')).toBeInTheDocument();
    expect(screen.queryByText('Review workout')).not.toBeInTheDocument();
    expect(screen.queryByText('Workout complete!')).not.toBeInTheDocument();
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
    expect(screen.getByText('Undo rest day')).toBeInTheDocument();
  });

  it('tells the user a rest day will not count against them', async () => {
    mockGet = (path: string) =>
      path.startsWith('/dashboard/today')
        ? Promise.resolve(
            todayPayload({
              restDay: {
                id: 'rest-1',
                localDate: '2026-08-24',
                timezone: 'America/Chicago',
                note: null,
                createdAt: '2026-08-24T12:00:00.000Z',
              },
            }),
          )
        : Promise.resolve([]);

    renderTodayPage();

    expect(await screen.findByText(/will not count against your training/)).toBeInTheDocument();
  });

  /**
   * Story 27 \u2014 Rest Day previously sat as a fifth equal-weight button
   * beside Start/Preview/Change with no explanation of what it does.
   */
  it('explains what taking a rest day does before the user commits', async () => {
    mockGet = (path: string) => {
      if (path.startsWith('/dashboard/today')) return Promise.resolve(todayPayload({ dayTypeId: 'day-1', dayLabel: 'Push' }));
      if (path === '/programs') return Promise.resolve([{ id: 'program-1', isActive: true }]);
      return Promise.resolve([]);
    };

    renderTodayPage();

    expect(await screen.findByText('Need a day off?')).toBeInTheDocument();
    expect(
      screen.getByText(/without changing your program or breaking your consistency/),
    ).toBeInTheDocument();
  });

  it('counts the rest day toward the day\u2019s steps', async () => {
    mockGet = (path: string) =>
      path.startsWith('/dashboard/today')
        ? Promise.resolve(
            todayPayload({
              restDay: {
                id: 'rest-1',
                localDate: '2026-08-24',
                timezone: 'America/Chicago',
                note: null,
                createdAt: '2026-08-24T12:00:00.000Z',
              },
            }),
          )
        : Promise.resolve([]);

    renderTodayPage();

    expect(await screen.findByText('1 of 5 steps complete.')).toBeInTheDocument();
  });
});
