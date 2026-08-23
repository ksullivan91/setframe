import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Prescription } from '@setframe/schemas';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { WorkoutSessionPage } from './WorkoutSessionPage';

let mockGet: (path: string) => Promise<unknown> = () => new Promise(() => {});
const mockPost = vi.fn();
vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}));

type SetOverrides = Partial<{
  weightValue: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
  rpe: number | null;
}>;

function buildSession(prescription: Prescription | null, setOverrides: SetOverrides = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    localDate: '2026-08-22',
    status: 'in_progress',
    startedAt: '2026-08-22T15:00:00.000Z',
    completedAt: null,
    dayTypeId: 'day-1',
    notes: null,
    createdAt: '2026-08-22T15:00:00.000Z',
    updatedAt: '2026-08-22T15:00:00.000Z',
    exercises: [
      {
        id: 'log-1',
        workoutSessionId: 'session-1',
        exerciseId: 'exercise-1',
        sortOrder: 0,
        notes: null,
        createdAt: '2026-08-22T15:00:00.000Z',
        updatedAt: '2026-08-22T15:00:00.000Z',
        exercise: {
          id: 'exercise-1',
          name: 'Outdoor Cycle',
          isCustom: false,
          ownerUserId: null,
          archivedAt: null,
          createdAt: '2026-08-22T15:00:00.000Z',
          updatedAt: '2026-08-22T15:00:00.000Z',
        },
        prescription,
        previousSession: null,
        sets: [
          {
            id: 'set-1',
            exerciseLogId: 'log-1',
            clientId: '11111111-1111-4111-8111-111111111111',
            sortOrder: 0,
            setType: 'working',
            weightValue: null,
            weightUnit: null,
            reps: null,
            durationSeconds: null,
            distanceValue: null,
            distanceUnit: null,
            rpe: null,
            isPrWeight: false,
            isPrReps: false,
            createdAt: '2026-08-22T15:00:00.000Z',
            updatedAt: '2026-08-22T15:00:00.000Z',
            ...setOverrides,
          },
        ],
      },
    ],
  };
}

const catalog = [
  {
    id: 'exercise-2',
    name: 'Barbell Back Squat',
    isCustom: false,
    ownerUserId: null,
    archivedAt: null,
    createdAt: '2026-08-22T15:00:00.000Z',
    updatedAt: '2026-08-22T15:00:00.000Z',
  },
];

function renderSession(
  prescription: Prescription | null,
  setOverrides: SetOverrides = {},
  exercises: unknown[] = [],
) {
  mockGet = (path: string) => {
    if (path.startsWith('/workout-sessions/')) return Promise.resolve(buildSession(prescription, setOverrides));
    if (path === '/exercises') return Promise.resolve(exercises);
    return Promise.resolve(null);
  };
  return renderPage();
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/workout/session-1']}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <Routes>
              <Route path="/workout/:sessionId" element={<WorkoutSessionPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/**
 * Story 09 — the session logger previously rendered all seven inputs for
 * every exercise, so a bike ride asked for weight/reps/RPE and a pull-up
 * asked for distance. Fields are now driven by the shared prescription
 * definition in `@setframe/domain`.
 */
describe('WorkoutSessionPage prescription-aware fields', () => {
  it('shows only strength fields for a sets + reps exercise', async () => {
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 10 });

    expect(await screen.findByLabelText('Weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toBeInTheDocument();
    expect(screen.getByLabelText('RPE')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Duration/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Distance')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Distance unit')).not.toBeInTheDocument();
  });

  it('shows only distance and duration for a distance + duration exercise', async () => {
    renderSession({ kind: 'distanceDuration', distanceMiles: 12, durationMinutes: 45 });

    expect(await screen.findByLabelText('Distance')).toBeInTheDocument();
    expect(screen.getByLabelText('Distance unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration (min)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Weight')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();
    // A single continuous effort has no set type.
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument();
  });

  it('shows reps but not weight for bodyweight reps', async () => {
    renderSession({ kind: 'bodyweight_reps', sets: 4, repsMin: 8 });

    expect(await screen.findByLabelText('Reps')).toBeInTheDocument();
    expect(screen.queryByLabelText('Weight')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Duration/)).not.toBeInTheDocument();
  });

  it('shows duration in seconds for timed sets', async () => {
    renderSession({ kind: 'timed', sets: 3, durationSeconds: 45 });

    expect(await screen.findByLabelText('Duration (sec)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Weight')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();
  });

  /**
   * Non-destructive guarantee: a cycling exercise logged before this story
   * may still carry stale weight/reps. Hiding those inputs outright would
   * strand values the user can neither see nor clear.
   */
  it('keeps pre-existing values visible even when the prescription omits them', async () => {
    renderSession({ kind: 'distanceDuration', distanceMiles: 12, durationMinutes: 45 }, {
      weightValue: 45,
      weightUnit: 'lb',
      reps: 5,
    } as SetOverrides);

    const weight = await screen.findByLabelText('Weight');
    expect(weight).toHaveValue('45');
    expect(screen.getByLabelText('Reps')).toHaveValue('5');
  });

  it('converts a stored duration into minutes for continuous efforts', async () => {
    renderSession({ kind: 'duration', durationMinutes: 30 }, { durationSeconds: 1800 });

    await waitFor(() => expect(screen.getByLabelText('Duration (min)')).toHaveValue('30'));
  });

  it('falls back to a permissive field set when an exercise has no prescription', async () => {
    renderSession(null);

    expect(await screen.findByLabelText('Weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration (sec)')).toBeInTheDocument();
    expect(screen.getByLabelText('Distance')).toBeInTheDocument();
  });
});


/**
 * Story 08 — the mid-session Add Exercise modal used to filter the catalog
 * down to exercises not already in the session and, when that came back
 * empty, showed a dead-end "No more exercises available". It is now a
 * self-contained search over the canonical catalog that never depends on
 * Training-page state.
 */
describe('WorkoutSessionPage mid-session add exercise', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue({ id: 'log-2' });
  });

  it('searches the canonical catalog without visiting Training first', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, { weightValue: 135, reps: 5 } as SetOverrides, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));

    expect(await screen.findByLabelText('Search exercises')).toBeInTheDocument();
    expect(screen.getByText('Barbell Back Squat')).toBeInTheDocument();
    expect(screen.queryByText(/No more exercises available/i)).not.toBeInTheDocument();
  });

  it('adds a catalog exercise with its prescription and leaves logged sets intact', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, { weightValue: 135, reps: 5 } as SetOverrides, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));
    await user.click(await screen.findByText('Barbell Back Squat'));
    await user.click(await screen.findByRole('button', { name: /add to workout/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/workout-sessions/session-1/exercises', {
        exerciseId: 'exercise-2',
        prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 },
      }),
    );

    // The set logged before the add is untouched.
    expect(screen.getByLabelText('Weight')).toHaveValue('135');
    expect(screen.getByLabelText('Reps')).toHaveValue('5');
  });

  it('creates a custom exercise and adds it without leaving the session', async () => {
    const user = userEvent.setup();
    mockPost.mockImplementation((path: string) => {
      if (path === '/exercises') {
        return Promise.resolve({
          id: 'exercise-custom',
          name: 'Outdoor Cycle',
          isCustom: true,
          ownerUserId: 'user-1',
          archivedAt: null,
          createdAt: '2026-08-22T15:00:00.000Z',
          updatedAt: '2026-08-22T15:00:00.000Z',
        });
      }
      return Promise.resolve({ id: 'log-2' });
    });
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, {}, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));
    await user.click(await screen.findByRole('button', { name: /create custom exercise/i }));
    await user.type(await screen.findByLabelText('Exercise name'), 'Outdoor Cycle');
    await user.click(screen.getByRole('button', { name: /create & add/i }));

    // Lands straight on configure for the new exercise — no navigation away.
    expect(await screen.findByLabelText('Prescription')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add to workout/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/workout-sessions/session-1/exercises',
        expect.objectContaining({ exerciseId: 'exercise-custom' }),
      ),
    );
  });

  // Clearing a numeric prescription field yields `Number('') === 0`, which
  // every branch of `prescriptionSchema` rejects as non-positive. Blocking
  // the button keeps the client from firing a request the API will 400.
  it('blocks the add when a prescription value is cleared to zero', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, {}, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));
    await user.click(await screen.findByText('Barbell Back Squat'));
    await user.clear(await screen.findByLabelText('Sets'));

    expect(screen.getByRole('button', { name: /add to workout/i })).toBeDisabled();
    expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('keeps the picker open and surfaces an error when the add fails', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue(new Error('boom'));
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, {}, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));
    await user.click(await screen.findByText('Barbell Back Squat'));
    await user.click(await screen.findByRole('button', { name: /add to workout/i }));

    expect(await screen.findByText(/Couldn't add that exercise/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to workout/i })).toBeInTheDocument();
  });

  it('shows a distinct empty state when the catalog is genuinely empty', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, {}, []);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));

    expect(await screen.findByText('No exercises available yet.')).toBeInTheDocument();
  });
});

/**
 * Story 10 — in a real session an opening 85 x 6, a heavier 105 x 6 and a
 * deliberate 1 lb x 1 probe all lit up both badges at once. The page used to
 * OR the server's flags with its own guess computed from the previous session
 * alone, so a client-side false positive could never be cleared.
 */
describe('WorkoutSessionPage PR badges', () => {
  function renderSets(sets: { weightValue: number; reps: number; isPrWeight: boolean; isPrReps: boolean }[]) {
    const session = buildSession({ kind: 'sets_reps', sets: 3, repsMin: 5 }) as unknown as {
      exercises: { sets: unknown[]; previousSession: unknown }[];
    };
    session.exercises[0]!.previousSession = {
      sessionId: 'session-0',
      localDate: '2026-08-20',
      completedAt: '2026-08-20T16:00:00.000Z',
      sets: [{ weightValue: 80, reps: 5, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null }],
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `2222222${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightUnit: 'lb',
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      createdAt: '2026-08-22T15:00:00.000Z',
      updatedAt: '2026-08-22T15:00:00.000Z',
      ...set,
    }));

    mockGet = (path: string) => {
      if (path.startsWith('/workout-sessions/')) return Promise.resolve(session);
      if (path === '/exercises') return Promise.resolve([]);
      return Promise.resolve(null);
    };
    return renderPage();
  }

  it('shows one Weight PR badge, on the set the server flagged', async () => {
    renderSets([
      { weightValue: 85, reps: 6, isPrWeight: false, isPrReps: false },
      { weightValue: 105, reps: 6, isPrWeight: true, isPrReps: false },
      { weightValue: 1, reps: 1, isPrWeight: false, isPrReps: false },
    ]);

    expect(await screen.findAllByText('Weight PR')).toHaveLength(1);
    expect(screen.queryByText('Rep PR')).not.toBeInTheDocument();
  });

  it('renders no badges when the server flagged none', async () => {
    renderSets([
      { weightValue: 85, reps: 6, isPrWeight: false, isPrReps: false },
      { weightValue: 105, reps: 6, isPrWeight: false, isPrReps: false },
    ]);

    await screen.findAllByLabelText('Weight');
    expect(screen.queryByText('Weight PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Rep PR')).not.toBeInTheDocument();
  });
});
