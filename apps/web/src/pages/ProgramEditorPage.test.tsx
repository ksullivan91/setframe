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

  /**
   * With zero programs, `selectedProgramId` is `null` — the workout-create
   * form used to render anyway, and submitting it sent `programId: null`
   * to an API schema that only accepts `string | undefined`, so every
   * attempt 400ed with no way to recover short of using guided setup.
   */
  it('does not offer to create a workout with no program selected', async () => {
    renderTraining([]);

    expect(await screen.findByText(/Create a program first/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Workout name')).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('removes a workout from the program via the membership endpoint, not a global delete', async () => {
    const user = userEvent.setup();
    renderTraining();
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    await user.click(await screen.findByRole('button', { name: /Actions for Upper A/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove from this program' }));
    // Destructive, so it confirms first.
    await user.click(await screen.findByTestId('confirm-workout-action'));

    expect(mockDel).toHaveBeenCalledWith(`/programs/${program.id}/day-types/day-1`);
  });

  /**
   * Both workout actions destroy something and neither confirmed — one click
   * on "Delete permanently" removed a workout from *every* program that used
   * it, with no undo anywhere on this screen. Mobile has always confirmed
   * both; this is web catching up.
   */
  it('confirms before deleting a workout permanently', async () => {
    const user = userEvent.setup();
    renderTraining();
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    await user.click(await screen.findByRole('button', { name: /Actions for Upper A/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete permanently' }));

    // Nothing is destroyed on the menu click alone.
    expect(mockDel).not.toHaveBeenCalled();
    // The copy has to say what makes this different from the option beside it.
    expect(await screen.findByText(/every program that uses it/)).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-workout-action'));
    expect(mockDel).toHaveBeenCalledWith('/day-types/day-1');
  });

  it('destroys nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderTraining();
    await dayTypesRequested;
    resolveDayTypes(dayTypes);
    await screen.findAllByText('Upper A');

    await user.click(await screen.findByRole('button', { name: /Actions for Upper A/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete permanently' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockDel).not.toHaveBeenCalled();
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

/**
 * Story 26 — largely a verification pass: Story 25's program-scoped
 * workout list already flows straight into `WeekScheduleEditor`'s
 * `workouts` prop, and the `selectedDayTypeId` reset effect already
 * covers Schedule the same way it covers Workouts. These tests exercise
 * the Schedule tab specifically, which the Story 24/25 tests above don't
 * touch.
 */
describe('ProgramEditorPage program-aware schedule', () => {
  const secondProgramDayType = { ...dayTypes[0], id: 'day-2', name: 'Lower B' };
  const secondProgramSlot = {
    id: 'slot-2',
    programVersionId: 'version-2',
    dayTypeId: 'day-2',
    weekNumber: null,
    dayIndex: 1,
    sortOrder: 0,
    createdAt: '2026-08-02T00:00:00.000Z',
  };

  function renderTwoProgramSchedule() {
    mockGet = (path: string) => {
      if (path === '/programs') return Promise.resolve([program, secondProgram]);
      if (path === `/programs/${program.id}/day-types`) return Promise.resolve(dayTypes);
      if (path === `/programs/${secondProgram.id}/day-types`) return Promise.resolve([secondProgramDayType]);
      if (path === `/programs/${program.id}/schedule-slots`) return Promise.resolve([]);
      if (path === `/programs/${secondProgram.id}/schedule-slots`) return Promise.resolve([secondProgramSlot]);
      if (path === '/day-types') return Promise.resolve([]);
      if (path.startsWith('/day-types/')) {
        const dayTypeId = path.slice('/day-types/'.length);
        const match = [...dayTypes, secondProgramDayType].find((d) => d.id === dayTypeId);
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

  it('offers only the selected program’s workouts as schedule assignment options', async () => {
    const user = userEvent.setup();
    renderTwoProgramSchedule();
    await screen.findAllByText('Upper A');

    await user.click(screen.getByRole('tab', { name: 'Schedule' }));
    const schedulePanel = screen.getByRole('tabpanel', { name: 'Schedule' });

    expect(within(schedulePanel).getByTitle('Upper A')).toBeInTheDocument();
    expect(within(schedulePanel).queryByTitle('Lower B')).not.toBeInTheDocument();
  });

  it('updates the schedule view when switching the selected program', async () => {
    const user = userEvent.setup();
    renderTwoProgramSchedule();
    await screen.findAllByText('Upper A');

    await user.click(screen.getByRole('tab', { name: 'Programs' }));
    await user.click(within(screen.getByRole('tabpanel', { name: 'Programs' })).getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('tab', { name: 'Schedule' }));
    const schedulePanel = screen.getByRole('tabpanel', { name: 'Schedule' });

    expect((await within(schedulePanel).findAllByTitle('Lower B')).length).toBeGreaterThan(0);
    expect(within(schedulePanel).queryByTitle('Upper A')).not.toBeInTheDocument();
  });

  it('does not leak a selected workout from one program into another', async () => {
    const user = userEvent.setup();
    renderTwoProgramSchedule();
    await screen.findAllByText('Upper A');

    // Select Upper A (Program 1's only workout) in the Workouts tab.
    await user.click(within(screen.getByRole('tabpanel', { name: 'Workouts' })).getByText('Upper A'));
    await screen.findByRole('heading', { name: 'Upper A' });

    await user.click(screen.getByRole('tab', { name: 'Programs' }));
    await user.click(within(screen.getByRole('tabpanel', { name: 'Programs' })).getByRole('button', { name: 'View' }));

    // Program 2 doesn't have Upper A at all — its detail pane must not
    // still be showing the previous program's selected workout.
    expect(screen.queryByRole('heading', { name: 'Upper A' })).not.toBeInTheDocument();
  });
});
