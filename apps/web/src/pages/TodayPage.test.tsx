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
