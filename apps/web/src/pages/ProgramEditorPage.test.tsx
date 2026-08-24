import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { ProgramEditorPage } from './ProgramEditorPage';

let resolveDayTypes: (value: unknown) => void = () => {};
let mockGet: (path: string) => Promise<unknown> = () => new Promise(() => {});
const mockPost = vi.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockPatch = vi.fn((_path: string, body?: unknown) => Promise.resolve(body));

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: (path: string, body?: unknown) => mockPatch(path, body),
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

const secondProgram = {
  id: 'program-2',
  userId: 'user-1',
  name: 'Recovery Block',
  isActive: false,
  cycleLengthWeeks: null,
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
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

function renderTraining(programs: unknown[] = [program]) {
  mockGet = (path: string) => {
    if (path === '/programs') return Promise.resolve(programs);
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

/**
 * Story 24 — Training previously had no Programs tab at all: no way to see
 * every program, no way to tell which one is active, and no way to
 * inspect a non-active program without an effect silently snapping the
 * selection back to whichever program is active.
 */
describe('ProgramEditorPage Programs tab', () => {
  afterEach(() => {
    mockPost.mockClear();
    mockPatch.mockClear();
  });

  it('lists every program and marks the active one', async () => {
    const user = userEvent.setup();
    renderTraining([program, secondProgram]);
    resolveDayTypes(dayTypes);
    await screen.findByText('Upper A');

    await user.click(screen.getByRole('tab', { name: 'Programs' }));
    const panel = screen.getByRole('tabpanel', { name: 'Programs' });

    expect(within(panel).getByText('Base')).toBeInTheDocument();
    expect(within(panel).getByText('Recovery Block')).toBeInTheDocument();
    // Base's "Set as active" button is disabled (already active);
    // Recovery Block's is enabled — the one place activity actually
    // matters functionally, distinct from the Badge's decorative "Active" text.
    expect(within(panel).getAllByRole('button', { name: /active/i }).filter((btn) => (btn as HTMLButtonElement).disabled)).toHaveLength(1);
    expect(within(panel).getByRole('button', { name: 'Set as active' })).toBeEnabled();
  });

  it('viewing a non-active program does not activate it', async () => {
    const user = userEvent.setup();
    renderTraining([program, secondProgram]);
    resolveDayTypes(dayTypes);
    await screen.findByText('Upper A');

    await user.click(screen.getByRole('tab', { name: 'Programs' }));
    await user.click(screen.getAllByRole('button', { name: 'View' })[0]!);

    expect(mockPost).not.toHaveBeenCalledWith(expect.stringContaining('/activate'), expect.anything());
  });

  it('explicitly setting a program active calls the activate endpoint and confirms it', async () => {
    const user = userEvent.setup();
    mockPost.mockImplementationOnce((path: string) =>
      path === '/programs/program-2/activate' ? Promise.resolve({ ...secondProgram, isActive: true }) : Promise.resolve(undefined),
    );
    renderTraining([program, secondProgram]);
    resolveDayTypes(dayTypes);
    await screen.findByText('Upper A');

    await user.click(screen.getByRole('tab', { name: 'Programs' }));
    await user.click(screen.getByRole('button', { name: 'Set as active' }));

    expect(mockPost).toHaveBeenCalledWith('/programs/program-2/activate', undefined);
    expect(await screen.findByText(/Recovery Block is now your active program/)).toBeInTheDocument();
  });

  it('shows which program is being edited once more than one exists', async () => {
    renderTraining([program, secondProgram]);
    resolveDayTypes(dayTypes);
    await screen.findByText('Upper A');

    const workoutsPanel = screen.getByRole('tabpanel', { name: 'Workouts' });
    expect(within(workoutsPanel).getByText('Base', { selector: 'strong' })).toBeInTheDocument();
  });

  it('does not show a program-context label with only one program', async () => {
    renderTraining([program]);
    resolveDayTypes(dayTypes);
    await screen.findByText('Upper A');

    expect(screen.queryByText(/^Editing/)).not.toBeInTheDocument();
  });
});
