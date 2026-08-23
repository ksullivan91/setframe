import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { ProgramEditorPage } from './ProgramEditorPage';

let resolveDayTypes: (value: unknown) => void = () => {};
let mockGet: (path: string) => Promise<unknown> = () => new Promise(() => {});

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}));

const program = {
  id: 'program-1',
  userId: 'user-1',
  name: 'Base',
  isActive: true,
  cycleLengthWeeks: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const dayTypes = [
  {
    id: 'day-1',
    userId: 'user-1',
    name: 'Upper A',
    estimatedDurationMinutes: 45,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

function renderTraining() {
  mockGet = (path: string) => {
    if (path === '/programs') return Promise.resolve([program]);
    // Held open so the assertions run while the page is still loading.
    if (path === '/day-types') return new Promise((resolve) => (resolveDayTypes = resolve));
    return Promise.resolve([]);
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/training']}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <ProgramEditorPage />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/**
 * The Training page had no loading state at all. `dayTypes` defaults to an
 * empty array, so during the initial fetch the page confidently rendered
 * "No workouts yet" and the new-user guided-setup banner to people who
 * already had a full program, then snapped to the real list.
 */
describe('ProgramEditorPage loading state', () => {
  it('shows a content-shaped skeleton instead of the empty state while loading', async () => {
    renderTraining();

    expect(await screen.findByTestId('training-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/No workouts yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Build your training program/i)).not.toBeInTheDocument();
  });

  it('announces that it is busy for screen readers', async () => {
    renderTraining();

    const skeleton = await screen.findByTestId('training-skeleton');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/Loading your training program/i)).toBeInTheDocument();
  });

  it('replaces the skeleton with the real workouts once loaded', async () => {
    renderTraining();
    await screen.findByTestId('training-skeleton');

    resolveDayTypes(dayTypes);

    expect(await screen.findByText('Upper A')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('training-skeleton')).not.toBeInTheDocument());
    expect(screen.queryByText(/No workouts yet/i)).not.toBeInTheDocument();
  });
});
