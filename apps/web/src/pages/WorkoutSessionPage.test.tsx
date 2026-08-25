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

    expect(await screen.findByLabelText(/^Weight/)).toBeInTheDocument();
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
    expect(screen.queryByLabelText(/^Weight/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();
    // A single continuous effort has no set type.
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument();
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
 * Story 37 — a quick-entry header above each exercise's full set editor,
 * for the common case where sets share a value. Explicit "Apply to all
 * sets" rather than automatic cascade, so a manually-edited set is never
 * silently overwritten (only ever by the user's own next click).
 */
describe('WorkoutSessionPage collapsible quick-entry', () => {
  function renderMultiSet(sets: { weightValue: number; reps: number }[]) {
    const session = buildSession({ kind: 'sets_reps', sets: 3, repsMin: 8 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `3333333${index}-1111-4111-8111-111111111111`,
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

  it('pre-fills the quick-entry header from the first set, matching what session-start already templated', async () => {
    renderMultiSet([
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
    ]);

    expect(await screen.findByLabelText('All sets: Reps')).toHaveValue('8');
  });

  it('applies the header value to every set only when Apply to all sets is explicitly clicked', async () => {
    const user = userEvent.setup();
    renderMultiSet([
      { weightValue: 135, reps: 8 },
      { weightValue: 135, reps: 8 },
    ]);

    const headerReps = await screen.findByLabelText('All sets: Reps');
    await user.clear(headerReps);
    await user.type(headerReps, '10');

    // Not applied yet — each set's own field is untouched.
    const perSetReps = screen.getAllByLabelText('Reps');
    expect(perSetReps[0]).toHaveValue('8');
    expect(perSetReps[1]).toHaveValue('8');

    await user.click(screen.getByRole('button', { name: 'Apply to all sets' }));

    expect(perSetReps[0]).toHaveValue('10');
    expect(perSetReps[1]).toHaveValue('10');
  });

  it('leaves a manual per-set override alone unless Apply to all sets is clicked again', async () => {
    const user = userEvent.setup();
    // Set 2 differs from set 1 on weight too, not just reps — otherwise a
    // bug that applied the *whole* header (instead of only the field the
    // user actually touched) couldn't be caught: weight would already
    // coincidentally match and look unchanged.
    renderMultiSet([
      { weightValue: 135, reps: 8 },
      { weightValue: 95, reps: 8 },
    ]);

    await screen.findByLabelText('All sets: Reps');
    const perSetReps = screen.getAllByLabelText('Reps');
    await user.clear(perSetReps[1]!);
    await user.type(perSetReps[1]!, '6');
    expect(perSetReps[0]).toHaveValue('8');
    expect(perSetReps[1]).toHaveValue('6');

    // Editing the header itself, without clicking Apply, never touches any
    // set — the cascade is only ever triggered by the explicit button.
    const headerReps = screen.getByLabelText('All sets: Reps');
    await user.clear(headerReps);
    await user.type(headerReps, '10');
    expect(perSetReps[1]).toHaveValue('6');

    // Clicking Apply is the one action that does overwrite it — an
    // explicit, deliberate re-application, not a silent one. Only the
    // field actually edited in the header (reps) should move; set 2's own
    // weight — never touched in the header — must survive.
    await user.click(screen.getByRole('button', { name: 'Apply to all sets' }));
    expect(perSetReps[1]).toHaveValue('10');
    expect(screen.getAllByLabelText(/^Weight/)[1]).toHaveValue('95');
  });

  function renderMultiSetDistance(sets: { distanceValue: number; distanceUnit: 'm' | 'km' | 'mi'; durationSeconds: number }[]) {
    const session = buildSession({ kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 }) as unknown as {
      exercises: { sets: unknown[] }[];
    };
    session.exercises[0]!.sets = sets.map((set, index) => ({
      id: `set-${index + 1}`,
      exerciseLogId: 'log-1',
      clientId: `4444444${index}-1111-4111-8111-111111111111`,
      sortOrder: index,
      setType: 'working',
      weightValue: null,
      weightUnit: null,
      reps: null,
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

  it('changing only the distance unit does not drag the distance value along when applied', async () => {
    const user = userEvent.setup();
    renderMultiSetDistance([
      { distanceValue: 5, distanceUnit: 'mi', durationSeconds: 1800 },
      { distanceValue: 8, distanceUnit: 'mi', durationSeconds: 1800 },
    ]);

    // Only the unit dropdown is touched — the distance value input itself
    // is never edited.
    await user.selectOptions(await screen.findByLabelText('All sets: Distance unit'), 'km');
    await user.click(screen.getByRole('button', { name: 'Apply to all sets' }));

    // The unit applies to both sets...
    expect(screen.getAllByLabelText('All sets: Distance unit')[0]).toHaveValue('km');
    const perSetUnit = screen.getAllByLabelText('Distance unit');
    expect(perSetUnit[0]).toHaveValue('km');
    expect(perSetUnit[1]).toHaveValue('km');
    // ...but each set's own distance value — never touched in the header
    // — must survive untouched.
    const perSetDistance = screen.getAllByLabelText('Distance');
    expect(perSetDistance[0]).toHaveValue('5');
    expect(perSetDistance[1]).toHaveValue('8');
  });

  it('clears the touched header fields after a successful Apply, so a later click cannot silently reapply a stale edit', async () => {
    const user = userEvent.setup();
    renderMultiSet([
      { weightValue: 135, reps: 8 },
      { weightValue: 95, reps: 6 },
    ]);

    const headerReps = await screen.findByLabelText('All sets: Reps');
    await user.clear(headerReps);
    await user.type(headerReps, '10');
    await user.click(screen.getByRole('button', { name: 'Apply to all sets' }));
    expect(screen.getAllByLabelText('Reps')[1]).toHaveValue('10');

    // Set 2's reps are hand-edited back to something else after the apply...
    const perSetReps = screen.getAllByLabelText('Reps');
    await user.clear(perSetReps[1]!);
    await user.type(perSetReps[1]!, '7');
    expect(perSetReps[1]).toHaveValue('7');

    // ...and now the user edits the header's *weight* only, then applies.
    // The stale "reps" touch from earlier must not still be armed — set 2's
    // hand-edited reps must survive this unrelated apply.
    const headerWeight = screen.getByLabelText(/^All sets: Weight/);
    await user.clear(headerWeight);
    await user.type(headerWeight, '150');
    await user.click(screen.getByRole('button', { name: 'Apply to all sets' }));

    expect(screen.getAllByLabelText('Reps')[1]).toHaveValue('7');
    expect(screen.getAllByLabelText(/^Weight/)[1]).toHaveValue('150');
  });

  it('collapses and re-expands an exercise, hiding and restoring its set editor', async () => {
    const user = userEvent.setup();
    renderMultiSet([{ weightValue: 135, reps: 8 }]);

    expect(await screen.findByLabelText('Reps')).toBeInTheDocument();
    // The quick-entry header stays visible either way.
    expect(screen.getByLabelText('All sets: Reps')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse Outdoor Cycle' }));
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();
    expect(screen.getByLabelText('All sets: Reps')).toBeInTheDocument();

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

  it('focusing a field inside a collapsed exercise activates it too', async () => {
    const user = userEvent.setup();
    renderTwoExercises();

    await screen.findByRole('button', { name: 'Collapse Bench Press' });
    // The quick-entry header stays visible even while collapsed (Story 37) —
    // focusing it is exactly the "focus lands inside this exercise" trigger.
    await user.click(screen.getAllByLabelText('All sets: Reps')[1]!);

    expect(await screen.findByRole('button', { name: 'Collapse Barbell Row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Bench Press' })).toBeInTheDocument();
  });

  it('manually collapsing the active exercise leaves none expanded', async () => {
    const user = userEvent.setup();
    renderTwoExercises();

    await user.click(await screen.findByRole('button', { name: 'Collapse Bench Press' }));

    expect(screen.getByRole('button', { name: 'Expand Bench Press' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Barbell Row' })).toBeInTheDocument();
  });
});
