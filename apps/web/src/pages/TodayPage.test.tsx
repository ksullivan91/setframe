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
