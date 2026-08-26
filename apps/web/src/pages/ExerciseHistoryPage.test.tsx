import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { ExerciseHistoryPage } from './ExerciseHistoryPage';

const patch = vi.fn(() => Promise.resolve({}));
let exercises: unknown[] = [];

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => {
      if (path === '/exercises') return Promise.resolve(exercises);
      if (path.endsWith('/history')) return Promise.resolve({ items: [], nextCursor: null });
      if (path.endsWith('/progress')) return Promise.resolve({ exerciseId: 'x', points: [] });
      return Promise.resolve(null);
    },
    post: vi.fn(),
    patch,
    del: vi.fn(),
  }),
}));

const custom = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Backyard Sled Push',
  movementPattern: null,
  isCustom: true,
};
const system = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Barbell Back Squat',
  movementPattern: 'squat',
  isCustom: false,
};

function renderPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/history/${id}`]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <Routes>
              <Route path="/history/:exerciseId" element={<ExerciseHistoryPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  exercises = [custom, system];
});

/**
 * Story 57 — before this, an unclassified exercise could not be fixed from
 * inside the product, and its volume was reported as ungrouped forever.
 */
describe('ExerciseHistoryPage movement pattern', () => {
  it('offers a movement pattern for the user’s own custom exercise', async () => {
    renderPage(custom.id);
    const select = await screen.findByTestId('movement-pattern-select');
    expect(select).toHaveValue('');
    // The curated pattern list, not raw free text.
    expect(screen.getByRole('option', { name: 'Hinge' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not set' })).toBeInTheDocument();
  });

  it('hides the control for a system exercise the API would refuse to edit', async () => {
    renderPage(system.id);
    await waitFor(() => expect(screen.getByText(/Barbell Back Squat history/)).toBeInTheDocument());
    // Showing a control that always fails is worse than showing none.
    expect(screen.queryByTestId('movement-pattern-select')).not.toBeInTheDocument();
  });

  it('saves the chosen pattern', async () => {
    renderPage(custom.id);
    const select = await screen.findByTestId('movement-pattern-select');
    fireEvent.change(select, { target: { value: 'hinge' } });
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/exercises/${custom.id}`, { movementPattern: 'hinge' }),
    );
  });

  it('sends null when cleared, rather than an empty string', async () => {
    /* `''` is not "unset" — storing it would create a nameless pattern key
       that groups as its own band on the composition chart. */
    exercises = [{ ...custom, movementPattern: 'hinge' }, system];
    renderPage(custom.id);
    const select = await screen.findByTestId('movement-pattern-select');
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/exercises/${custom.id}`, { movementPattern: null }),
    );
  });

  it('tells the user that leaving it unset is legitimate', async () => {
    renderPage(custom.id);
    expect(await screen.findByTestId('movement-pattern-help')).toHaveTextContent(
      /Leave it unset rather than guessing/,
    );
  });
});
