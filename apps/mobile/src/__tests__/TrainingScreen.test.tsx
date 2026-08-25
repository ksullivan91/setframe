import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import TrainingScreen from '../../app/(tabs)/training';
import type { WorkoutSessionDetail } from '@setframe/schemas';

const mockReplace = jest.fn();
const mockPost = jest.fn((_path: string, body?: Record<string, unknown>) => Promise.resolve({ ...body }));
let mockSessionPayload: WorkoutSessionDetail;
const mockPatch = jest.fn((path: string, body?: Record<string, unknown>) => {
  // Mirrors the real PATCH handler closely enough for these tests: applying
  // `skipped` to the matching exercise log via a fresh object, the same way
  // a real JSON-over-HTTP refetch would never hand back the prior reference
  // — an in-place mutation here would leave query data referentially
  // unchanged and any useMemo keyed on it stale.
  const match = /^\/workout-exercise-logs\/(.+)$/.exec(path);
  if (match && body && 'skipped' in body) {
    mockSessionPayload = {
      ...mockSessionPayload,
      exercises: mockSessionPayload.exercises.map((exerciseLog) =>
        exerciseLog.id === match[1] ? { ...exerciseLog, skipped: body.skipped as boolean } : exerciseLog,
      ),
    };
  }
  return Promise.resolve({ ...body });
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessionId: 'session-1' }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../lib/api-client', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    ApiError,
    useApiClient: () => ({
      get: (path: string) => {
        if (path.startsWith('/workout-sessions/')) return Promise.resolve(mockSessionPayload);
        if (path === '/exercises') return Promise.resolve([]);
        return Promise.resolve([]);
      },
      post: (path: string, body?: Record<string, unknown>) => mockPost(path, body),
      patch: (path: string, body?: Record<string, unknown>) => mockPatch(path, body),
      del: () => Promise.resolve(undefined),
      delete: () => Promise.resolve(undefined),
    }),
  };
});

// The session's one exercise below is prescribed as `distanceDuration`
// (mirrors the story's own "Outdoor Cycle, 5 mi / 30 min" example), so a
// set only counts as logged once it carries distance/duration values —
// weight/reps alone (a strength-set shape) wouldn't satisfy that
// prescription's required fields.
function baseSet(overrides: Partial<WorkoutSessionDetail['exercises'][number]['sets'][number]> = {}) {
  return {
    id: 'set-1',
    exerciseLogId: 'log-1',
    clientId: 'client-1',
    sortOrder: 0,
    setType: 'working' as const,
    weightValue: null,
    weightUnit: null,
    reps: null,
    durationSeconds: 1800,
    distanceValue: 5,
    distanceUnit: 'mi' as const,
    rpe: null,
    isPrWeight: false,
    isPrReps: false,
    createdAt: '2026-08-20T12:10:00.000Z',
    updatedAt: '2026-08-20T12:10:00.000Z',
    ...overrides,
  };
}

function baseSession(overrides: {
  sets?: WorkoutSessionDetail['exercises'][number]['sets'];
  status?: WorkoutSessionDetail['status'];
} = {}): WorkoutSessionDetail {
  return {
    id: 'session-1',
    userId: 'user-1',
    templateId: null,
    localDate: '2026-08-20',
    timezone: 'America/Chicago',
    status: overrides.status ?? 'in_progress',
    startedAt: '2026-08-20T12:00:00.000Z',
    completedAt: null,
    notes: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-20T12:00:00.000Z',
    exercises: [
      {
        id: 'log-1',
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        templateExerciseId: null,
        sortOrder: 0,
        skipped: false,
        notes: null,
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
        exercise: {
          id: 'exercise-1',
          name: 'Outdoor Cycle',
          isCustom: false,
          ownerUserId: null,
          archivedAt: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
        prescription: { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 },
        sets: overrides.sets ?? [],
        previousSession: null,
      },
    ],
  } as WorkoutSessionDetail;
}

let tree: ReactTestRenderer | null = null;

function textNodesContaining(rendered: ReactTestRenderer, needle: string) {
  return rendered.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      ([] as unknown[]).concat(node.props?.children).some((child) => typeof child === 'string' && child.includes(needle)),
  );
}

function pressablesByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );
}

// Toast's action button (e.g. "Undo") carries no accessibility label, so
// find it by walking up from its text to the nearest pressable ancestor.
function pressableForText(rendered: ReactTestRenderer, text: string) {
  let current = textNodesContaining(rendered, text)[0] ?? null;
  while (current) {
    if (typeof current.props?.onPress === 'function') return current;
    current = current.parent;
  }
  return null;
}

async function flush(iterations = 10) {
  for (let i = 0; i < iterations; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderScreen(): Promise<ReactTestRenderer> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TrainingScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  return tree!;
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  jest.clearAllMocks();
});

/** Story 34 — session-only exercise removal. */
describe('TrainingScreen exercise removal', () => {
  it('confirms with lightweight copy and removes an exercise with no logged sets', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'Outdoor Cycle').length).toBeGreaterThan(0);

    await act(async () => {
      pressablesByLabel(rendered, 'Outdoor Cycle actions')[0]!.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Remove Outdoor Cycle from today's workout?",
      expect.stringContaining('stay in the workout template'),
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0]![2]!;
    const removeButton = buttons.find((b) => b.text === 'Remove')!;

    await act(async () => {
      removeButton.onPress!();
    });
    await flush(40);

    expect(mockPatch).toHaveBeenCalledWith('/workout-exercise-logs/log-1', { skipped: true });
    // The success toast itself says "Outdoor Cycle removed…", so a bare
    // substring check for the exercise name would still find a match —
    // check the exercise card's own action button is gone instead.
    expect(pressablesByLabel(rendered, 'Outdoor Cycle actions')).toHaveLength(0);
    expect(textNodesContaining(rendered, "removed from today's workout").length).toBeGreaterThan(0);
  });

  it('warns about logged sets before removing an exercise that has them', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1 })] });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Outdoor Cycle actions')[0]!.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Remove Outdoor Cycle and its 2 logged sets from today's workout?",
      expect.stringContaining("sets you've already logged stay on record"),
      expect.any(Array),
    );
  });

  it('restores a removed exercise on undo', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Remove')?.onPress?.();
    });
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Outdoor Cycle actions')[0]!.props.onPress();
    });
    await flush(40);

    expect(mockPatch).toHaveBeenCalledWith('/workout-exercise-logs/log-1', { skipped: true });

    await act(async () => {
      pressableForText(rendered, 'Undo')!.props.onPress();
    });
    await flush(40);

    expect(mockPatch).toHaveBeenCalledWith('/workout-exercise-logs/log-1', { skipped: false });
  });
});

/** Story 36 — persistent Add exercise / Finish workout actions. */
describe('TrainingScreen persistent session actions', () => {
  it('shows Add exercise and Finish workout while the session is active', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, 'Add exercise')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Finish workout')).toHaveLength(1);
  });

  it('does not complete the session immediately — it confirms first', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Finish workout')[0]!.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Finish workout?',
      expect.stringContaining('You logged 1 exercise and 0 sets.'),
      expect.any(Array),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('completes and navigates to the summary once confirmed', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Finish workout')?.onPress?.();
    });
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Finish workout')[0]!.props.onPress();
    });
    await flush(40);

    expect(mockPost).toHaveBeenCalledWith('/workout-sessions/session-1/complete', undefined);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/session-summary', params: { sessionId: 'session-1' } });
  });

  it('keeps training and does not complete when the confirmation is cancelled', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Keep training')?.onPress?.();
    });
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Finish workout')[0]!.props.onPress();
    });
    await flush(40);

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('hides the persistent session actions once the workout is completed', async () => {
    mockSessionPayload = baseSession({ sets: [], status: 'completed' });
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, 'Add exercise')).toHaveLength(0);
    expect(pressablesByLabel(rendered, 'Finish workout')).toHaveLength(0);
  });
});
