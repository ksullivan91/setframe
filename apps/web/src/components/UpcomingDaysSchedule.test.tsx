import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from './Toast';
import { UpcomingDaysSchedule } from './UpcomingDaysSchedule';

const mockPost = vi.fn(async (_path: string, _body?: unknown) => ({}));
const mockDel = vi.fn(async (_path: string) => ({}));
let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve(null);

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: vi.fn(),
    del: (path: string) => mockDel(path),
  }),
}));

function render21() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme('light')}>
        <ToastProvider>
          <UpcomingDaysSchedule />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function dateParam(path: string): string {
  return new URLSearchParams(path.split('?')[1]).get('localDate')!;
}

/**
 * Story 21 — planning rest ahead or correcting a past day, directly from
 * the Training schedule page, using the exact `GET /dashboard/today`
 * resolution and `POST`/`DELETE /rest-days` endpoints Today already uses
 * for the current date, generalized to a window of dates.
 */
describe('UpcomingDaysSchedule', () => {
  it('renders a row per date in the window, including a marked Today row', async () => {
    mockGet = async (path) => ({
      localDate: dateParam(path),
      dayLabel: null,
      sessions: [],
      restDay: null,
    });
    render21();

    // 3 days back + today + 10 forward = 14 rows.
    await waitFor(() => expect(screen.getAllByText(/Mark rest/i).length).toBe(14));
    expect(screen.getByText(/^Today ·/)).toBeInTheDocument();
  });

  it('shows "Trained" with no rest toggle for a day with a real (non-abandoned) session', async () => {
    // Only the first-resolved row (3 days back) reports a session.
    let first = true;
    mockGet = async (path) => {
      const trained = first;
      first = false;
      return {
        localDate: dateParam(path),
        dayLabel: 'Upper A',
        sessions: trained ? [{ status: 'completed' }] : [],
        restDay: null,
      };
    };
    render21();

    await waitFor(() => expect(screen.getByText('Trained')).toBeInTheDocument());
    // Every other row (13 of them) still offers the toggle.
    expect(screen.getAllByText(/Mark rest/i).length).toBe(13);
  });

  // Story 21's own AC: only a *non-abandoned* workout refuses a rest
  // assignment — an abandoned-only day is exactly the "correct a day"
  // case this feature exists for, and must still offer the toggle.
  it('still offers the rest toggle for a day whose only session was abandoned', async () => {
    mockGet = async (path) => ({
      localDate: dateParam(path),
      dayLabel: 'Upper A',
      sessions: [{ status: 'abandoned' }],
      restDay: null,
    });
    render21();

    await waitFor(() => expect(screen.getAllByText(/Mark rest/i).length).toBe(14));
    expect(screen.queryByText('Trained')).not.toBeInTheDocument();
  });

  it('marks a day as rest and reflects the resting state', async () => {
    const user = userEvent.setup();
    mockGet = async (path) => ({ localDate: dateParam(path), dayLabel: null, sessions: [], restDay: null });
    render21();

    const firstToggle = (await screen.findAllByRole('button', { name: /mark rest/i }))[0]!;
    // After marking rest, the refetched payload reports it.
    mockGet = async (path) => ({
      localDate: dateParam(path),
      dayLabel: null,
      sessions: [],
      restDay: { id: 'rest-1', localDate: dateParam(path) },
    });
    await user.click(firstToggle);

    expect(mockPost).toHaveBeenCalledWith('/rest-days', expect.objectContaining({ localDate: expect.any(String) }));
    await waitFor(() => expect(screen.getAllByText('Resting').length).toBeGreaterThan(0));
  });

  it('clears a resting day back to unassigned', async () => {
    const user = userEvent.setup();
    mockGet = async (path) => ({
      localDate: dateParam(path),
      dayLabel: null,
      sessions: [],
      restDay: { id: 'rest-1', localDate: dateParam(path) },
    });
    render21();

    const firstClear = (await screen.findAllByRole('button', { name: /clear rest/i }))[0]!;
    mockGet = async (path) => ({ localDate: dateParam(path), dayLabel: null, sessions: [], restDay: null });
    await user.click(firstClear);

    expect(mockDel).toHaveBeenCalledWith(expect.stringMatching(/^\/rest-days\//));
    await waitFor(() => expect(screen.getAllByText(/Mark rest/i).length).toBeGreaterThan(0));
  });
});
