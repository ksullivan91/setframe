import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdditionalActivity } from '@setframe/schemas';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from './Toast';
import { TodayAdditionalActivitySection } from './TodayAdditionalActivitySection';

let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve({ items: [] });
const mockPost = vi.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockPatch = vi.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockDel = vi.fn((_path: string) => Promise.resolve(undefined));

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: (path: string, body?: unknown) => mockPatch(path, body),
    del: (path: string) => mockDel(path),
  }),
}));

function walkActivity(overrides: Partial<AdditionalActivity> = {}): AdditionalActivity {
  return {
    id: 'activity-1',
    localDate: '2026-08-24',
    timezone: 'America/Chicago',
    startedAt: '2026-08-24T18:45:00.000Z',
    durationSeconds: 1080,
    activityType: 'walk',
    source: 'manual',
    title: null,
    distanceValue: null,
    distanceUnit: null,
    caloriesKcal: null,
    notes: null,
    externalSourceId: null,
    createdAt: '2026-08-24T18:45:00.000Z',
    updatedAt: '2026-08-24T18:45:00.000Z',
    ...overrides,
  };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme('light')}>
        <ToastProvider>
          <TodayAdditionalActivitySection localDate="2026-08-24" />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/**
 * Story 41 — Today's Additional Activity section: a distinct, visually
 * secondary area for supplemental movement, independent of the scheduled
 * workout card's own data.
 */
describe('TodayAdditionalActivitySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains what the section is for when empty', async () => {
    mockGet = () => Promise.resolve({ items: [] });
    renderSection();

    expect(
      await screen.findByText(/Add walks, mobility, yoga, or anything else you do outside/),
    ).toBeInTheDocument();
  });

  it('shows type, duration, time, and distance for a logged activity', async () => {
    mockGet = () =>
      Promise.resolve({
        items: [walkActivity({ distanceValue: 0.8, distanceUnit: 'mi' })],
      });
    renderSection();

    expect(await screen.findByText('Walk')).toBeInTheDocument();
    expect(screen.getByText(/18 min/)).toBeInTheDocument();
    expect(screen.getByText(/0\.8 mi/)).toBeInTheDocument();
  });

  it('flags an Apple Health–sourced activity', async () => {
    mockGet = () => Promise.resolve({ items: [walkActivity({ source: 'apple_health' })] });
    renderSection();

    expect(await screen.findByText(/Apple Health/)).toBeInTheDocument();
  });

  it('degrades independently on a failed fetch, without throwing', async () => {
    mockGet = () => Promise.reject(new Error('network error'));
    renderSection();

    expect(await screen.findByText("Couldn't load additional activity.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('adds a manual activity and closes the form on save', async () => {
    const user = userEvent.setup();
    mockGet = () => Promise.resolve({ items: [] });
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Add activity' }));
    await user.type(screen.getByLabelText('Duration (min)'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/additional-activities',
        expect.objectContaining({ localDate: '2026-08-24', activityType: 'walk', durationSeconds: 900 }),
      ),
    );
    expect(screen.queryByLabelText('Duration (min)')).not.toBeInTheDocument();
  });

  it('sends a UTC-qualified startedAt, not a bare local-time string the API would reject', async () => {
    const user = userEvent.setup();
    mockGet = () => Promise.resolve({ items: [] });
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Add activity' }));
    await user.type(screen.getByLabelText('Duration (min)'), '15');
    // <input type="time"> doesn't accept literal colon keystrokes the way
    // userEvent.type simulates them — set the value directly instead.
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:30' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [, body] = mockPost.mock.calls[0]!;
    expect((body as { startedAt: string }).startedAt).toMatch(/Z$/);
  });

  it('shows an existing activity’s start time converted to local, not its raw UTC hour', async () => {
    const user = userEvent.setup();
    const startedAt = '2026-08-24T18:45:00.000Z';
    mockGet = () => Promise.resolve({ items: [walkActivity({ startedAt })] });
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Edit Walk' }));
    const expectedLocal = new Date(startedAt);
    const expected = `${String(expectedLocal.getHours()).padStart(2, '0')}:${String(expectedLocal.getMinutes()).padStart(2, '0')}`;
    expect(screen.getByLabelText('Start time')).toHaveValue(expected);
  });

  it('deletes an activity after confirming', async () => {
    const user = userEvent.setup();
    mockGet = () => Promise.resolve({ items: [walkActivity()] });
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Delete Walk' }));
    expect(screen.getByText("Remove this activity?")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(mockDel).toHaveBeenCalledWith('/additional-activities/activity-1'));
  });
});
