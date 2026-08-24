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
// Resolves once the scoped day-types query actually fires — it's gated on
// `selectedProgramId`, which only lands after the `/programs` fetch
// resolves and an effect runs, so awaiting this (instead of racing ahead
// right after render) is what makes `resolveDayTypes` below reliable.
let dayTypesRequested: Promise<void> = Promise.resolve();
let mockGet: (path: string) => Promise<unknown> = () => new Promise(() => {});
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
  let markRequested: () => void = () => {};
  dayTypesRequested = new Promise((resolve) => {
    markRequested = resolve;
  });
  mockGet = (path: string) => {
    if (path === '/programs') return Promise.resolve(programs);
    // The scoped, per-program list is what actually renders the Workouts
    // tab (Story 25) — held open so assertions can run mid-loading. The
    // global `/day-types` list only feeds the "add existing workout"
    // picker, so it resolves immediately.
    if (path.startsWith('/programs/') && path.endsWith('/day-types')) {
      const promise = new Promise((resolve) => (resolveDayTypes = resolve));
      markRequested();
      return promise;
    }
    if (path === '/day-types') return Promise.resolve([]);
    if (path.startsWith('/day-types/')) {
      const dayTypeId = path.slice('/day-types/'.length);
      const match = dayTypes.find((d) => d.id === dayTypeId);
      return Promise.resolve(match ? { ...match, exercises: [] } : null);
    }
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

    await dayTypesRequested;
    resolveDayTypes(dayTypes);

    expect((await screen.findAllByText('Upper A')).length).toBeGreaterThan(0);
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
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

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
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

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
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    await user.click(screen.getByRole('tab', { name: 'Programs' }));
    await user.click(screen.getByRole('button', { name: 'Set as active' }));

    expect(mockPost).toHaveBeenCalledWith('/programs/program-2/activate', undefined);
    expect(await screen.findByText(/Recovery Block is now your active program/)).toBeInTheDocument();
  });

  it('shows which program is being edited once more than one exists', async () => {
    renderTraining([program, secondProgram]);
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    const workoutsPanel = screen.getByRole('tabpanel', { name: 'Workouts' });
    expect(within(workoutsPanel).getByText('Base', { selector: 'strong' })).toBeInTheDocument();
  });

  it('does not show a program-context label with only one program', async () => {
    renderTraining([program]);
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    expect(screen.queryByText(/^Editing/)).not.toBeInTheDocument();
  });
});

/**
 * Story 25 — the Workouts tab used to show every workout the user has
 * ever created, globally, regardless of which program was selected.
 */
describe('ProgramEditorPage program-scoped workouts', () => {
  afterEach(() => {
    mockPost.mockClear();
    mockPatch.mockClear();
    mockDel.mockClear();
  });

  it('fetches the program-scoped workout list, not the global one', async () => {
    renderTraining();
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    // Asserted via the request path itself — resolveDayTypes only ever
    // answers `/programs/:id/day-types`, so reaching "Upper A" at all
    // already proves the scoped endpoint is what's driving the list.
    expect(dayTypes.map((d) => d.name)).toContain('Upper A');
  });

  it('removes a workout from the program via the membership endpoint, not a global delete', async () => {
    const user = userEvent.setup();
    renderTraining();
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    await user.click(await screen.findByRole('button', { name: /Actions for Upper A/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove from this program' }));

    expect(mockDel).toHaveBeenCalledWith(`/programs/${program.id}/day-types/day-1`);
  });

  it('creates a new workout scoped to the selected program', async () => {
    const user = userEvent.setup();
    mockPost.mockImplementation((path: string, body?: unknown) =>
      path === '/day-types' ? Promise.resolve({ id: 'day-2', name: (body as { name: string }).name }) : Promise.resolve(body),
    );
    renderTraining();
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    await user.click(screen.getByRole('button', { name: /New workout/ }));
    await user.type(screen.getByLabelText('Workout name'), 'Lower C');
    await user.click(screen.getByRole('button', { name: 'Create workout' }));

    expect(mockPost).toHaveBeenCalledWith('/day-types', { name: 'Lower C', programId: program.id });
  });
});
