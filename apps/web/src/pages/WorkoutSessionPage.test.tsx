import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const mockPatch = vi.fn((_path: string, body?: unknown) => Promise.resolve(body));
vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: (path: string, body?: unknown) => mockPatch(path, body),
    del: vi.fn(),
  }),
}));

type SetOverrides = Partial<{
  weightValue: number | null;
  weightUnit: 'lb' | 'kg' | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
  rpe: number | null;
}>;

function buildSession(prescription: Prescription | null, setOverrides: SetOverrides = {}, status: 'in_progress' | 'completed' = 'in_progress') {
  return {
    id: 'session-1',
    userId: 'user-1',
    localDate: '2026-08-22',
    status,
    startedAt: '2026-08-22T15:00:00.000Z',
    completedAt: status === 'completed' ? '2026-08-22T16:00:00.000Z' : null,
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
        skipped: false,
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
  status: 'in_progress' | 'completed' = 'in_progress',
) {
  mockGet = (path: string) => {
    if (path.startsWith('/workout-sessions/')) return Promise.resolve(buildSession(prescription, setOverrides, status));
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

    /* Scoped to the detailed set editor. Quick Log's visible labels are
       deliberately short — the panel above them already says "Quick log" —
       so an unscoped `getByLabelText('Reps')` now matches both regions. The
       accessible names still differ ("Quick log: Reps"), which is what a
       screen reader uses. */
    const setEditor = (await screen.findAllByTestId('set-row'))[0]!;
    expect(within(setEditor).getByLabelText(/^Weight/)).toBeInTheDocument();
    expect(within(setEditor).getByLabelText('Reps')).toBeInTheDocument();
    expect(within(setEditor).getByLabelText('RPE')).toBeInTheDocument();
    expect(within(setEditor).queryByLabelText(/Duration/)).not.toBeInTheDocument();
    expect(within(setEditor).queryByLabelText('Distance')).not.toBeInTheDocument();
    expect(within(setEditor).queryByLabelText('Distance unit')).not.toBeInTheDocument();
  });

  it('shows only distance and duration for a distance + duration exercise', async () => {
    renderSession({ kind: 'distanceDuration', distanceMiles: 12, durationMinutes: 45 });

    // Scoped to the detailed editor; see the sets+reps case above for why.
    const setEditor = (await screen.findAllByTestId('set-row'))[0]!;
    expect(within(setEditor).getByLabelText('Distance')).toBeInTheDocument();
    expect(within(setEditor).getByLabelText('Distance unit')).toBeInTheDocument();
    expect(within(setEditor).getByLabelText('Duration (min)')).toBeInTheDocument();
    expect(within(setEditor).queryByLabelText(/^Weight/)).not.toBeInTheDocument();
    expect(within(setEditor).queryByLabelText('Reps')).not.toBeInTheDocument();
    // A single continuous effort has no set type.
    expect(within(setEditor).queryByLabelText('Type')).not.toBeInTheDocument();
  });

  it('shows reps but not weight for bodyweight reps', async () => {
    renderSession({ kind: 'bodyweight_reps', sets: 4, repsMin: 8 });

    expect(await screen.findByLabelText('Reps')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Weight/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Duration/)).not.toBeInTheDocument();
  });

  it('shows duration in seconds for timed sets', async () => {
    renderSession({ kind: 'timed', sets: 3, durationSeconds: 45 });

    expect(await screen.findByLabelText('Duration (sec)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Weight/)).not.toBeInTheDocument();
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

    const weight = await screen.findByLabelText(/^Weight/);
    expect(weight).toHaveValue('45');
    expect(screen.getByLabelText('Reps')).toHaveValue('5');
  });

  it('converts a stored duration into minutes for continuous efforts', async () => {
    renderSession({ kind: 'duration', durationMinutes: 30 }, { durationSeconds: 1800 });

    await waitFor(() => expect(screen.getByLabelText('Duration (min)')).toHaveValue('30'));
  });

  it('falls back to a permissive field set when an exercise has no prescription', async () => {
    renderSession(null);

    expect(await screen.findByLabelText(/^Weight/)).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration (sec)')).toBeInTheDocument();
    expect(screen.getByLabelText('Distance')).toBeInTheDocument();
  });
});

/**
 * Story 23 — a completed session's logged sets are now correctable
 * (a typo like "55lb x 8" that should have been "155lb"), while
 * restructuring the session (duplicate/delete a set) stays blocked.
 */
describe('WorkoutSessionPage completed session set editing', () => {
  it('allows saving a corrected value on a completed session', async () => {
    const user = userEvent.setup();
    renderSession(
      { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 10 },
      { weightValue: 55, weightUnit: 'lb', reps: 8 },
      [],
      'completed',
    );

    const weight = await screen.findByLabelText(/^Weight/);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(weight);
    await user.type(weight, '155');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/workout-sets/set-1', expect.objectContaining({ weightValue: 155 })),
    );
  });

  it('still blocks restructuring a completed session', async () => {
    renderSession(
      { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 10 },
      { weightValue: 55, weightUnit: 'lb', reps: 8 },
      [],
      'completed',
    );

    await screen.findByLabelText(/^Weight/);
    expect(screen.getByRole('button', { name: 'Duplicate set 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete set 1' })).toBeDisabled();
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
    expect(screen.getByLabelText(/^Weight/)).toHaveValue('135');
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

  // Story 19: planned values are optional. Clearing a field used to be
  // treated as `Number('') === 0`, which every branch of
  // `prescriptionSchema` rejected as non-positive — that's exactly the
  // fake-zero-sentinel bug the story fixes. Clearing a field now means
  // "no target for this yet," not an invalid zero.
  it('allows adding with a prescription value cleared to no target', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, {}, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));
    await user.click(await screen.findByText('Barbell Back Squat'));
    await user.clear(await screen.findByLabelText('Sets'));

    expect(screen.getByRole('button', { name: /add to workout/i })).toBeEnabled();
    expect(screen.queryByText(/greater than zero/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to workout/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [, body] = mockPost.mock.calls.find(([path]) => typeof path === 'string' && path.includes('/exercises'))!;
    expect((body as { prescription: { sets?: number } }).prescription.sets).toBeUndefined();
  });

  // A value the user actually typed, not just cleared, must still be valid —
  // an explicit "0" is a real non-positive number, unlike an absent field.
  it('blocks the add when a prescription value is explicitly zero', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, {}, catalog);

    await user.click(await screen.findByRole('button', { name: /add exercise/i }));
    await user.click(await screen.findByText('Barbell Back Squat'));
    const setsInput = await screen.findByLabelText('Sets');
    await user.clear(setsInput);
    await user.type(setsInput, '0');

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

    await screen.findAllByLabelText(/^Weight/);
    expect(screen.queryByText('Weight PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Rep PR')).not.toBeInTheDocument();
  });
});

/**
 * Story 34 — removing an exercise from today's session flips the existing
 * `skipped` flag (a PATCH on the exercise log) rather than deleting
 * anything, so the underlying sets and the template are never touched.
 */
describe('WorkoutSessionPage session-only exercise removal', () => {
  function renderRemovable(sets: unknown[]) {
    let session = buildSession({ kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 }) as {
      exercises: { id: string; skipped: boolean; sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets;
    session.exercises[0]!.skipped = false;

    mockPatch.mockImplementation((path: string, body?: unknown) => {
      const match = /^\/workout-exercise-logs\/(.+)$/.exec(path);
      if (match && body && typeof body === 'object' && 'skipped' in body) {
        session = {
          ...session,
          exercises: session.exercises.map((exerciseLog) =>
            exerciseLog.id === match[1] ? { ...exerciseLog, skipped: (body as { skipped: boolean }).skipped } : exerciseLog,
          ),
        };
      }
      return Promise.resolve(body);
    });
    mockGet = (path: string) => {
      if (path.startsWith('/workout-sessions/')) return Promise.resolve(session);
      if (path === '/exercises') return Promise.resolve([]);
      return Promise.resolve(null);
    };
    return renderPage();
  }

  it('removes an exercise with no logged sets after a lightweight confirmation', async () => {
    const user = userEvent.setup();
    renderRemovable([]);

    await user.click(await screen.findByRole('button', { name: 'Outdoor Cycle actions' }));
    await user.click(await screen.findByText('Remove from today’s workout'));

    expect(screen.getByText("Remove Outdoor Cycle from today's workout?")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove exercise' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/workout-exercise-logs/log-1', { skipped: true }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Outdoor Cycle actions' })).not.toBeInTheDocument());
    expect(await screen.findByText("Outdoor Cycle removed from today's workout.")).toBeInTheDocument();
  });

  it('warns about logged sets before removing, naming the count', async () => {
    const user = userEvent.setup();
    renderRemovable([
      { id: 'set-1', exerciseLogId: 'log-1', clientId: 'c1', sortOrder: 0, setType: 'working', distanceValue: 5, distanceUnit: 'mi', durationSeconds: 1800, weightValue: null, weightUnit: null, reps: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: '2026-08-22T15:00:00.000Z', updatedAt: '2026-08-22T15:00:00.000Z' },
      { id: 'set-2', exerciseLogId: 'log-1', clientId: 'c2', sortOrder: 1, setType: 'working', distanceValue: 5, distanceUnit: 'mi', durationSeconds: 1800, weightValue: null, weightUnit: null, reps: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: '2026-08-22T15:00:00.000Z', updatedAt: '2026-08-22T15:00:00.000Z' },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Outdoor Cycle actions' }));
    await user.click(await screen.findByText('Remove from today’s workout'));

    expect(screen.getByText("Remove Outdoor Cycle and its 2 logged sets from today's workout?")).toBeInTheDocument();
    expect(screen.getByText(/sets you've already logged stay on record/)).toBeInTheDocument();
  });

  it('restores a removed exercise on undo, without re-adding it', async () => {
    const user = userEvent.setup();
    renderRemovable([]);

    await user.click(await screen.findByRole('button', { name: 'Outdoor Cycle actions' }));
    await user.click(await screen.findByText('Remove from today’s workout'));
    await user.click(screen.getByRole('button', { name: 'Remove exercise' }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/workout-exercise-logs/log-1', { skipped: true }));

    await user.click(await screen.findByText('Undo'));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/workout-exercise-logs/log-1', { skipped: false }));
    expect(mockPost).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Outdoor Cycle actions' })).toBeInTheDocument());
  });

  it('disables the remove action once the session is completed', async () => {
    const user = userEvent.setup();
    mockGet = (path: string) => {
      if (path.startsWith('/workout-sessions/')) return Promise.resolve(buildSession({ kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 }, {}, 'completed'));
      if (path === '/exercises') return Promise.resolve([]);
      return Promise.resolve(null);
    };
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Outdoor Cycle actions' }));
    expect(await screen.findByText('Remove from today’s workout')).toHaveAttribute('disabled');
  });
});

/**
 * Story 36 — Add exercise/Finish workout moved into a persistent action
 * surface, and Finish workout became persistently reachable, so a stray
 * tap must not end the session outright.
 */
describe('WorkoutSessionPage persistent session actions', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('does not complete the session immediately — it opens a confirmation first', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, { weightValue: 135, reps: 5 } as SetOverrides);

    await user.click(await screen.findByRole('button', { name: 'Finish workout' }));

    expect(await screen.findByText('Finish workout?')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalledWith('/workout-sessions/session-1/complete');
  });

  it('completes the session only once the confirmation is confirmed', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({});
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, { weightValue: 135, reps: 5 } as SetOverrides);

    await user.click(await screen.findByRole('button', { name: 'Finish workout' }));
    const dialog = await screen.findByRole('dialog');
    // The dialog names what was actually logged (one exercise, one set).
    expect(within(dialog).getByText(/You logged 1 exercise and 1 set\./)).toBeInTheDocument();
    // The sticky bar's own trigger is disabled while the dialog is open, so
    // this unambiguously targets the dialog's own "Finish workout" button —
    // both share that label per the story's own suggested copy.
    await user.click(within(dialog).getByRole('button', { name: 'Finish workout' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/workout-sessions/session-1/complete', undefined));
  });

  it('keeps training and does not complete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, { weightValue: 135, reps: 5 } as SetOverrides);

    await user.click(await screen.findByRole('button', { name: 'Finish workout' }));
    await user.click(await screen.findByRole('button', { name: 'Keep training' }));

    expect(screen.queryByText('Finish workout?')).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalledWith('/workout-sessions/session-1/complete', undefined);
  });

  it('hides the persistent session actions once the workout is completed', async () => {
    renderSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }, { weightValue: 135, reps: 5 } as SetOverrides, [], 'completed');

    await screen.findByText('Workout complete');
    expect(screen.queryByRole('button', { name: 'Finish workout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add exercise' })).not.toBeInTheDocument();
  });
});

/**
 * Stories 58 and 59 — Quick Log replaces the old "Apply to all sets" header.
 *
 * The previous action only *populated* the set inputs; the user still had to
 * expand the exercise and save each set, so the fast path cost more taps than
 * typing into the sets directly. Quick Log persists, in one request.
 */
describe('WorkoutSessionPage quick log', () => {
  // Own reset: `.find()` on a shared mock would otherwise match a call made
  // by an earlier test in this block and assert against the wrong payload.
  beforeEach(() => {
    mockPost.mockClear();
  });

  function renderMultiSet(
    sets: Array<{ weightValue: number | null; reps: number | null; setType?: string }>,
    prescription: unknown = { kind: 'sets_reps', sets: 3, repsMin: 8 },
  ) {
    const session = buildSession(prescription as never) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `3333333${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: set.setType ?? 'working',
      weightUnit: 'lb',
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      isPrWeight: false,
      isPrReps: false,
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

  const unlogged = { weightValue: null, reps: 8 };

  it('logs every unlogged set in one request', async () => {
    const user = userEvent.setup();
    renderMultiSet([unlogged, unlogged, unlogged]);

    const weight = await screen.findByLabelText(/^Quick log: Weight/);
    await user.type(weight, '135');
    await user.click(screen.getByRole('button', { name: 'Log all 3 sets' }));

    // One call, not three — the user is not serialised behind the network.
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/workout-exercise-logs/log-1/quick-log',
        expect.objectContaining({
          setIds: ['set-1', 'set-2', 'set-3'],
          values: expect.objectContaining({ weightValue: 135, reps: 8 }),
        }),
      ),
    );
  });

  it('names only the sets it will actually write once some are logged', async () => {
    const user = userEvent.setup();
    renderMultiSet([{ weightValue: 135, reps: 8 }, unlogged, unlogged]);

    const weight = await screen.findByLabelText(/^Quick log: Weight/);
    await user.type(weight, '135');
    // "Log all 3 sets" would misstate both the count and the effect.
    await user.click(screen.getByRole('button', { name: 'Log remaining 2 sets' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/workout-exercise-logs/log-1/quick-log',
        expect.objectContaining({ setIds: ['set-2', 'set-3'] }),
      ),
    );
  });

  it('never writes over a set the user already logged by hand', async () => {
    const user = userEvent.setup();
    // Set 2 was corrected to 6 reps; Quick Log must leave it alone.
    renderMultiSet([unlogged, { weightValue: 135, reps: 6 }, unlogged]);

    await user.type(await screen.findByLabelText(/^Quick log: Weight/), '135');
    await user.click(screen.getByRole('button', { name: 'Log remaining 2 sets' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const call = mockPost.mock.calls.filter(([path]) => String(path).endsWith('/quick-log')).at(-1)!;
    expect((call[1] as { setIds: string[] }).setIds).not.toContain('set-2');
  });

  it('never writes a warmup at the working weight', async () => {
    const user = userEvent.setup();
    renderMultiSet([{ ...unlogged, setType: 'warmup' }, unlogged, unlogged]);

    await user.type(await screen.findByLabelText(/^Quick log: Weight/), '135');
    // Two working sets, so the warmup is excluded from the count as well.
    await user.click(screen.getByRole('button', { name: 'Log all 2 sets' }));

    const call = mockPost.mock.calls.filter(([path]) => String(path).endsWith('/quick-log')).at(-1)!;
    expect((call[1] as { setIds: string[] }).setIds).toEqual(['set-2', 'set-3']);
  });

  it('does not offer RPE, which is optional and set-specific', async () => {
    renderMultiSet([unlogged, unlogged]);
    await screen.findByLabelText(/^Quick log: Weight/);
    expect(screen.queryByLabelText(/^Quick log: RPE/)).not.toBeInTheDocument();
  });

  it('will not log until every required value is present', async () => {
    renderMultiSet([{ weightValue: null, reps: null }, { weightValue: null, reps: null }]);
    await screen.findByLabelText(/^Quick log: Weight/);
    // Writing sets that still would not count as logged looks like a
    // silent failure.
    expect(screen.getByRole('button', { name: /^Log/ })).toBeDisabled();
  });

  it('disappears once there is nothing left to log', async () => {
    renderMultiSet([{ weightValue: 135, reps: 8 }, { weightValue: 135, reps: 8 }]);
    await screen.findByText('Outdoor Cycle');
    expect(screen.queryByLabelText(/^Quick log: Weight/)).not.toBeInTheDocument();
  });

  it('is withheld for top set + backoff, whose sets differ by design', async () => {
    /* Session start creates `top` and `backoff` sets with different planned
       reps on purpose. One weight across them would be wrong for at least one
       group, so the detailed editor is the honest answer. */
    renderMultiSet(
      [
        { ...unlogged, setType: 'top' },
        { ...unlogged, setType: 'backoff' },
      ],
      { kind: 'top_set_backoff', topSets: 1, backoffSets: 1 },
    );
    await screen.findByText('Outdoor Cycle');
    expect(screen.queryByLabelText(/^Quick log: Weight/)).not.toBeInTheDocument();
  });

  it('leaves a collapsed exercise collapsed when its Quick Log is focused', async () => {
    const user = userEvent.setup();
    renderMultiSet([unlogged, unlogged]);

    /* Collapse first — the active exercise is expanded by default, so
       focusing its Quick Log could not show anything either way. */
    await user.click(await screen.findByRole('button', { name: 'Collapse Outdoor Cycle' }));
    expect(screen.queryByTestId('set-row')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/^Quick log: Weight/));
    // Still collapsed: the quick path does not drag the editor open.
    expect(screen.queryByTestId('set-row')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Outdoor Cycle' })).toBeInTheDocument();
  });

  it('collapses and re-expands an exercise, hiding and restoring its set editor', async () => {
    const user = userEvent.setup();
    // A fully logged set, so Quick Log is absent and this is purely about the
    // detailed region opening and closing.
    renderMultiSet([{ weightValue: 135, reps: 8 }]);

    expect(await screen.findByLabelText('Reps')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse Outdoor Cycle' }));
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand Outdoor Cycle' }));
    expect(await screen.findByLabelText('Reps')).toBeInTheDocument();
  });
});

/**
 * Story 38 — exercise-level completion state, derived from every set's
 * own required-field completeness (packages/domain's isExerciseComplete),
 * never a UI flag toggled on accordion close.
 */
describe('WorkoutSessionPage exercise completion state', () => {
  function renderMultiSetWithCompletion(sets: { weightValue: number | null; reps: number | null }[]) {
    const session = buildSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `5555555${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightUnit: 'lb',
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      isPrWeight: false,
      isPrReps: false,
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

  it('shows Complete once every set has its required fields', async () => {
    renderMultiSetWithCompletion([
      { weightValue: 135, reps: 8 },
      { weightValue: 145, reps: 8 },
    ]);

    expect(await screen.findByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText(/sets complete/)).not.toBeInTheDocument();
  });

  it('shows a running count while any set is still missing a required field', async () => {
    renderMultiSetWithCompletion([
      { weightValue: 135, reps: 8 },
      { weightValue: null, reps: null },
    ]);

    expect(await screen.findByText('1 of 2 sets complete')).toBeInTheDocument();
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('is not vacuously complete with zero sets', async () => {
    renderMultiSetWithCompletion([]);

    await screen.findByText('Outdoor Cycle');
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
    expect(screen.queryByText(/sets complete/)).not.toBeInTheDocument();
  });
});

/**
 * Story 39 — single-active-exercise accordion: at most one exercise
 * expanded at a time, switching on an intentional interaction (tapping
 * another exercise's header, focusing a field inside it, or choosing an
 * action inside it) rather than on blur, which would be fragile given how
 * often focus moves between controls in the same exercise.
 */
describe('WorkoutSessionPage single-active-exercise accordion', () => {
  function renderTwoExercises() {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      localDate: '2026-08-22',
      status: 'in_progress' as const,
      startedAt: '2026-08-22T15:00:00.000Z',
      completedAt: null,
      dayTypeId: 'day-1',
      notes: null,
      createdAt: '2026-08-22T15:00:00.000Z',
      updatedAt: '2026-08-22T15:00:00.000Z',
      exercises: ['log-1', 'log-2'].map((id, index) => ({
        id,
        workoutSessionId: 'session-1',
        exerciseId: `exercise-${index + 1}`,
        sortOrder: index,
        skipped: false,
        notes: null,
        createdAt: '2026-08-22T15:00:00.000Z',
        updatedAt: '2026-08-22T15:00:00.000Z',
        exercise: {
          id: `exercise-${index + 1}`,
          name: index === 0 ? 'Bench Press' : 'Barbell Row',
          isCustom: false,
          ownerUserId: null,
          archivedAt: null,
          createdAt: '2026-08-22T15:00:00.000Z',
          updatedAt: '2026-08-22T15:00:00.000Z',
        },
        prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 },
        previousSession: null,
        sets: [
          {
            id: `set-${id}`,
            exerciseLogId: id,
            clientId: `${index}1111111-1111-4111-8111-111111111111`,
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
          },
        ],
      })),
    };

    mockGet = (path: string) => {
      if (path.startsWith('/workout-sessions/')) return Promise.resolve(session);
      if (path === '/exercises') return Promise.resolve([]);
      return Promise.resolve(null);
    };
    return renderPage();
  }

  it('starts with only the first exercise expanded', async () => {
    renderTwoExercises();

    await screen.findByRole('button', { name: 'Collapse Bench Press' });
    expect(screen.getByRole('button', { name: 'Expand Barbell Row' })).toBeInTheDocument();
  });

  it('tapping another exercise header switches which one is expanded', async () => {
    const user = userEvent.setup();
    renderTwoExercises();

    await screen.findByRole('button', { name: 'Collapse Bench Press' });
    await user.click(screen.getByRole('button', { name: 'Expand Barbell Row' }));

    expect(await screen.findByRole('button', { name: 'Collapse Barbell Row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Bench Press' })).toBeInTheDocument();
  });

  it('expands via keyboard activation (focus with no preceding mousedown, then a synthesized click)', async () => {
    renderTwoExercises();

    await screen.findByRole('button', { name: 'Collapse Bench Press' });
    const barbellRowChevron = screen.getByRole('button', { name: 'Expand Barbell Row' });
    // A real Tab-to-focus has no mousedown before it, unlike userEvent's
    // .click() (which always synthesizes one) — this is exactly the path
    // a keyboard/screen-reader user takes, and Enter/Space then dispatch
    // a click with nothing new before it either.
    fireEvent.focus(barbellRowChevron);
    fireEvent.click(barbellRowChevron);

    expect(await screen.findByRole('button', { name: 'Collapse Barbell Row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Bench Press' })).toBeInTheDocument();
  });

  it('focusing another exercise\'s Quick Log does not expand it', async () => {
    const user = userEvent.setup();
    renderTwoExercises();

    await screen.findByRole('button', { name: 'Collapse Bench Press' });
    /* Story 58 reverses what this used to assert. Focus landing inside a card
       still activates the exercise, but Quick Log is explicitly exempt: the
       old behaviour meant tabbing into a quick-entry box expanded the whole
       accordion and destroyed the lightweight path, which is the gym test's
       specific complaint. Detailed Sets open only through the explicit
       control now. */
    await user.click(screen.getAllByLabelText(/^Quick log: Reps/)[1]!);

    expect(screen.getByRole('button', { name: 'Expand Barbell Row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Bench Press' })).toBeInTheDocument();
  });

  it('focusing a set field inside a collapsed exercise still activates it', async () => {
    const user = userEvent.setup();
    renderTwoExercises();

    await screen.findByRole('button', { name: 'Collapse Bench Press' });
    // Only Quick Log is exempt; the detailed editor still claims focus.
    await user.click(screen.getByRole('button', { name: 'Expand Barbell Row' }));
    await user.click(screen.getAllByLabelText('Reps')[0]!);

    expect(await screen.findByRole('button', { name: 'Collapse Barbell Row' })).toBeInTheDocument();
  });

  it('manually collapsing the active exercise leaves none expanded', async () => {
    const user = userEvent.setup();
    renderTwoExercises();

    await user.click(await screen.findByRole('button', { name: 'Collapse Bench Press' }));

    expect(screen.getByRole('button', { name: 'Expand Bench Press' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Barbell Row' })).toBeInTheDocument();
  });
});

/**
 * Story 60 — saving one set must not block any other.
 *
 * A single `useMutation` exposes one `isPending` shared by every set that
 * uses it, so the previous Save button was disabled page-wide while any one
 * set was in flight. The user was serialised behind the network in the one
 * place that least tolerates it.
 */
describe('WorkoutSessionPage per-set save state', () => {
  function renderTwoSets() {
    const session = buildSession({ kind: 'sets_reps', sets: 2, repsMin: 8 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = [0, 1].map((index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `4444444${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightValue: 135,
      weightUnit: 'lb',
      reps: 8,
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      isPrWeight: false,
      isPrReps: false,
      createdAt: '2026-08-22T15:00:00.000Z',
      updatedAt: '2026-08-22T15:00:00.000Z',
    }));
    mockGet = (path: string) => {
      if (path.startsWith('/workout-sessions/')) return Promise.resolve(session);
      if (path === '/exercises') return Promise.resolve([]);
      return Promise.resolve(null);
    };
    return renderPage();
  }

  it('leaves another set saveable while one is in flight', async () => {
    const user = userEvent.setup();
    // A save that never resolves, so the first set stays in flight.
    mockPatch.mockImplementation(() => new Promise(() => {}));
    renderTwoSets();

    await screen.findAllByTestId('set-row');
    const reps = screen.getAllByLabelText('Reps');

    // Dirty both sets so both Save buttons are otherwise enabled.
    await user.clear(reps[0]!);
    await user.type(reps[0]!, '10');
    await user.clear(reps[1]!);
    await user.type(reps[1]!, '9');

    const saves = screen.getAllByRole('button', { name: /^Sav/ });
    await user.click(saves[0]!);

    // Set 1 shows its own progress; set 2 is untouched and still saveable.
    expect(screen.getAllByRole('button', { name: 'Saving…' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the entered values and offers a retry when a save fails', async () => {
    const user = userEvent.setup();
    mockPatch.mockImplementation(() => Promise.reject(new Error('offline')));
    renderTwoSets();

    await screen.findAllByTestId('set-row');
    const reps = screen.getAllByLabelText('Reps');
    await user.clear(reps[0]!);
    await user.type(reps[0]!, '10');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!);

    expect(await screen.findByTestId('sync-error-set-1')).toBeInTheDocument();
    // The value the user entered is still there to retry with.
    expect(screen.getAllByLabelText('Reps')[0]).toHaveValue('10');
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
  });
});

/**
 * Story 61 — completing an exercise should read as an accomplishment, not as
 * another form state. The previous treatment was a success badge inside an
 * otherwise unchanged header: informative, and emotionally flat.
 */
describe('WorkoutSessionPage exercise completion experience', () => {
  /* The per-set save suite above leaves `mockPatch` rejecting. `clearAllMocks`
     clears recorded calls but not implementations, so without this every save
     here fails and nothing ever completes. */
  beforeEach(() => {
    mockPatch.mockReset();
    mockPatch.mockImplementation((_path: string, body?: unknown) => Promise.resolve(body));
  });

  function renderWithSets(sets: Array<{ weightValue: number | null; reps: number | null }>) {
    const session = buildSession({ kind: 'sets_reps', sets: sets.length, repsMin: 8 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `5555555${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightUnit: 'lb',
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      isPrWeight: false,
      isPrReps: false,
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

  it('gives a completed exercise a distinct card, not just a badge', async () => {
    renderWithSets([{ weightValue: 135, reps: 8 }, { weightValue: 135, reps: 8 }]);
    expect(await screen.findByTestId('exercise-card-complete')).toBeInTheDocument();
  });

  it('leaves an unfinished exercise looking unfinished', async () => {
    renderWithSets([{ weightValue: 135, reps: 8 }, { weightValue: null, reps: null }]);
    await screen.findByTestId('exercise-card');
    expect(screen.queryByTestId('exercise-card-complete')).not.toBeInTheDocument();
  });

  it('summarises what was achieved in one line, not a set list', async () => {
    renderWithSets([
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
    ]);
    const summary = await screen.findByTestId('completed-summary-log-1');
    expect(summary).toHaveTextContent('3 sets · 135lb · 8 reps');
  });

  it('still says "Complete" in words, never colour alone', async () => {
    renderWithSets([{ weightValue: 135, reps: 8 }]);
    await screen.findByTestId('exercise-card-complete');
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('collapses the exercise once its last set is logged', async () => {
    const user = userEvent.setup();
    /* Driven through Quick Log rather than a per-set save: it is the primary
       flow, and it is the one that completes a whole exercise in a single
       action — which is exactly the transition this behaviour keys on. */
    renderWithSets([{ weightValue: null, reps: null }, { weightValue: null, reps: null }]);

    expect(await screen.findAllByTestId('set-row')).toHaveLength(2);

    // The refetch after logging returns a session where every set is logged.
    const completed = buildSession({ kind: 'sets_reps', sets: 2, repsMin: 8 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    completed.exercises[0]!.sets = [0, 1].map((index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `5555555${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightValue: 135,
      weightUnit: 'lb',
      reps: 8,
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      isPrWeight: false,
      isPrReps: false,
      createdAt: '2026-08-22T15:00:00.000Z',
      updatedAt: '2026-08-22T15:00:00.000Z',
    }));

    await user.type(screen.getByLabelText(/^Quick log: Weight/), '135');
    await user.type(screen.getByLabelText(/^Quick log: Reps/), '8');

    mockGet = (path: string) => {
      if (path.startsWith('/workout-sessions/')) return Promise.resolve(completed);
      if (path === '/exercises') return Promise.resolve([]);
      return Promise.resolve(null);
    };
    await user.click(screen.getByRole('button', { name: 'Log all 2 sets' }));

    // Collapsed automatically — detail on demand, attention moves on.
    await waitFor(() => expect(screen.queryAllByTestId('set-row')).toHaveLength(0));
    expect(screen.getByTestId('exercise-card-complete')).toBeInTheDocument();
  });

  it('lets a completed exercise be collapsed and reopened', async () => {
    const user = userEvent.setup();
    renderWithSets([{ weightValue: 135, reps: 8 }]);

    /* An exercise that was already complete when the page loaded is *not*
       auto-collapsed — that only fires on the transition, so reopening a
       finished exercise to correct it is never fought. */
    await screen.findByTestId('exercise-card-complete');
    await user.click(screen.getByRole('button', { name: /^Collapse/ }));
    expect(screen.queryAllByTestId('set-row')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /^Expand/ }));
    // Correcting a finished exercise stays possible.
    expect(await screen.findAllByTestId('set-row')).toHaveLength(1);
  });
});

/**
 * Story 62 — focus behaviour and override preservation.
 *
 * Most of this story's acceptance criteria are satisfied structurally by the
 * work in 39, 58, 59 and 61 rather than by new UI. These tests pin them, so
 * a future change cannot quietly undo one: Quick Log establishes a baseline,
 * it is not a prison.
 */
describe('WorkoutSessionPage focus and overrides', () => {
  function renderMixed(sets: Array<{ weightValue: number | null; reps: number | null }>) {
    const session = buildSession({ kind: 'sets_reps', sets: sets.length, repsMin: 8 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `6666666${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightUnit: 'lb',
      durationSeconds: null,
      distanceValue: null,
      distanceUnit: null,
      rpe: null,
      isPrWeight: false,
      isPrReps: false,
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

  it('an override after bulk logging touches only that set', async () => {
    const user = userEvent.setup();
    mockPatch.mockReset();
    mockPatch.mockImplementation((_path: string, body?: unknown) => Promise.resolve(body));
    renderMixed([
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
    ]);

    // Reopen the finished exercise and correct the last set.
    await screen.findByTestId('exercise-card-complete');
    await user.click(screen.getByRole('button', { name: /^Collapse/ }));
    await user.click(screen.getByRole('button', { name: /^Expand/ }));

    const thirdSet = within((await screen.findAllByTestId('set-row'))[2]!);
    await user.clear(thirdSet.getByLabelText('Reps'));
    await user.type(thirdSet.getByLabelText('Reps'), '6');
    await user.click(thirdSet.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // Exactly one write, to set 3. Siblings are untouched.
    const setWrites = mockPatch.mock.calls.filter(([path]) => String(path).startsWith('/workout-sets/'));
    expect(setWrites).toHaveLength(1);
    expect(setWrites[0]![0]).toBe('/workout-sets/set-3');
  });

  it('an exercise stays complete when actual differs from planned', async () => {
    /* A workout plan is guidance; actual performance is the truth of the
       session. Completion means the required data is present and valid, not
       that the user matched the prescription. */
    renderMixed([
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 6 },
    ]);
    expect(await screen.findByTestId('exercise-card-complete')).toBeInTheDocument();
  });

  it('never writes to the workout template from the session', async () => {
    const user = userEvent.setup();
    mockPatch.mockReset();
    mockPatch.mockImplementation((_path: string, body?: unknown) => Promise.resolve(body));
    renderMixed([{ weightValue: null, reps: null }, { weightValue: null, reps: null }]);

    await user.type(await screen.findByLabelText(/^Quick log: Weight/), '135');
    await user.type(screen.getByLabelText(/^Quick log: Reps/), '8');
    await user.click(screen.getByRole('button', { name: 'Log all 2 sets' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    // ADR 0005: the session is fact, the day type is intent. Nothing here
    // may reach `day-types` or `programs`.
    const touched = [...mockPost.mock.calls, ...mockPatch.mock.calls].map(([path]) => String(path));
    expect(touched.some((path) => path.includes('/day-types'))).toBe(false);
    expect(touched.some((path) => path.includes('/programs'))).toBe(false);
  });

  /* "Only one detailed region open at a time" is already pinned by the
     single-active-exercise accordion suite above; not duplicated here. */
});
