import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import WorkoutSessionScreen from '../../app/workout/[sessionId]';
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

/* Mutable so a test can render the screen with no session id — the case
   that used to make this screen create a workout out of thin air. */
let mockRouteSessionId: string | undefined = 'session-1';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessionId: mockRouteSessionId }),
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

// `IconButton` renders a `Pressable` with the same accessibilityLabel/
// onPress it received, so a plain accessibilityLabel+onPress match finds
// both the IconButton and Pressable instances for the same control —
// harmless for `[0]!.props.onPress()` (same handler either way), but a
// real double-count for `toHaveLength`. Neither instance is a true RN
// host primitive (Pressable manages presses itself, it doesn't forward
// onPress to one), so dedupe by the handler's own reference identity —
// both layers carry the exact same function — rather than guessing which
// layer counts as "the" match.
/** `label` may be a regex — story 42's completed card builds its accessible
    name from the exercise name plus its state, so exact matching is brittle. */
function pressablesByLabel(rendered: ReactTestRenderer, label: string | RegExp) {
  const matches = rendered.root.findAll((node) => {
    const actual = node.props?.accessibilityLabel;
    if (typeof actual !== 'string' || typeof node.props?.onPress !== 'function') return false;
    return typeof label === 'string' ? actual === label : label.test(actual);
  });
  const seenHandlers = new Set<unknown>();
  return matches.filter((node) => {
    if (seenHandlers.has(node.props.onPress)) return false;
    seenHandlers.add(node.props.onPress);
    return true;
  });
}

function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

function textInputsByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.props?.accessibilityLabel === label &&
      typeof node.props?.onChangeText === 'function',
  );
}

// The Select component (unlike TextInput) has no accessibilityLabel prop —
// only its own composite instance carries `label`/`onChange`, so no
// host-vs-composite duplication concern here.
function selectsByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll((node) => node.props?.label === label && typeof node.props?.onChange === 'function');
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
          <WorkoutSessionScreen />
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
  mockRouteSessionId = 'session-1';
  jest.clearAllMocks();
});

/**
 * The screen is keyed to one session and cannot conjure another.
 *
 * As the Training *tab* it had to answer "what do I show when opened with
 * no active session?", and the implemented answer was to POST one from a
 * mount effect — creating duplicate empty sessions that shadowed finished
 * workouts, and destroying that date's `rest_day` as a side effect of
 * `POST /v1/workout-sessions`. Keying it to a route param deletes the
 * question; these tests pin that it stays deleted.
 */
describe('WorkoutSessionScreen never creates a session', () => {
  it('does not POST a workout session when it has one', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    await renderScreen();

    expect(mockPost).not.toHaveBeenCalledWith('/workout-sessions', expect.anything());
  });

  it('reports a missing session id instead of creating one', async () => {
    mockRouteSessionId = undefined;
    mockSessionPayload = baseSession({ sets: [] });
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'No workout session was specified').length).toBeGreaterThan(0);
    // The whole point: no id must mean an error, never an invitation.
    expect(mockPost).not.toHaveBeenCalledWith('/workout-sessions', expect.anything());
  });
});

/** Story 34 — session-only exercise removal. */
describe('WorkoutSessionScreen exercise removal', () => {
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
describe('WorkoutSessionScreen persistent session actions', () => {
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

/**
 * Story 37 — a quick-entry header above each exercise's full set editor,
 * for the common case where sets share a value. Explicit "Apply to all
 * sets" rather than automatic cascade, so a manually-edited set is never
 * silently overwritten (only ever by the user's own next click).
 */
/**
 * Stories 58 and 59 — Quick Log replaces the old "Apply to all sets" header.
 * Mirrors WorkoutSessionPage.test.tsx case for case, so parity is tested
 * rather than intended.
 *
 * The fixture is a `distanceDuration` exercise, so Quick Log offers distance
 * and duration — and never RPE, which is optional for every representation.
 */
describe('WorkoutSessionScreen quick log', () => {
  /** A set with none of its required values entered yet. */
  const unlogged = (overrides = {}) =>
    baseSet({ durationSeconds: null, distanceValue: null, ...overrides });

  it('logs every unlogged set in one request', async () => {
    mockSessionPayload = baseSession({
      sets: [unlogged(), unlogged({ id: 'set-2', sortOrder: 1 })],
    });
    const rendered = await renderScreen();

    await act(async () => {
      textInputsByLabel(rendered, 'Quick log: Distance')[0]!.props.onChangeText('5');
    });
    await act(async () => {
      textInputsByLabel(rendered, 'Quick log: Duration (min)')[0]!.props.onChangeText('30');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Log all 2 sets')[0]!.props.onPress();
    });

    // One call, not two — the user is not serialised behind the network.
    expect(mockPost).toHaveBeenCalledWith(
      '/workout-exercise-logs/log-1/quick-log',
      expect.objectContaining({ setIds: ['set-1', 'set-2'] }),
    );
  });

  it('names only the sets it will actually write once some are logged', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet(), unlogged({ id: 'set-2', sortOrder: 1 })],
    });
    const rendered = await renderScreen();

    // "Log all 2 sets" would misstate both the count and the effect.
    expect(pressablesByLabel(rendered, 'Log remaining set')).toHaveLength(1);
  });

  it('never writes over a set the user already logged by hand', async () => {
    mockSessionPayload = baseSession({
      sets: [unlogged(), baseSet({ id: 'set-2', sortOrder: 1, distanceValue: 8 })],
    });
    const rendered = await renderScreen();

    await act(async () => {
      textInputsByLabel(rendered, 'Quick log: Distance')[0]!.props.onChangeText('5');
    });
    await act(async () => {
      textInputsByLabel(rendered, 'Quick log: Duration (min)')[0]!.props.onChangeText('30');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Log remaining set')[0]!.props.onPress();
    });

    const call = mockPost.mock.calls.filter(([path]) => String(path).endsWith('/quick-log')).at(-1)!;
    expect((call[1] as { setIds: string[] }).setIds).toEqual(['set-1']);
  });

  it('never writes a warmup at the working values', async () => {
    mockSessionPayload = baseSession({
      sets: [unlogged({ setType: 'warmup' }), unlogged({ id: 'set-2', sortOrder: 1 })],
    });
    const rendered = await renderScreen();

    // One working set, so the warmup is excluded from the count as well.
    expect(pressablesByLabel(rendered, 'Log 1 set')).toHaveLength(1);
  });

  it('does not offer RPE, which is optional and set-specific', async () => {
    mockSessionPayload = baseSession({ sets: [unlogged()] });
    const rendered = await renderScreen();

    expect(textInputsByLabel(rendered, 'Quick log: Distance')).toHaveLength(1);
    expect(textInputsByLabel(rendered, 'Quick log: RPE')).toHaveLength(0);
  });

  it('will not log until every required value is present', async () => {
    mockSessionPayload = baseSession({ sets: [unlogged()] });
    const rendered = await renderScreen();

    // Writing sets that still would not count as logged looks like a
    // silent failure.
    expect(pressablesByLabel(rendered, 'Log 1 set')[0]!.props.accessibilityState?.disabled).toBe(true);
  });

  it('disappears once there is nothing left to log', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();

    expect(hostsByTestId(rendered, 'quick-log-panel-log-1')).toHaveLength(0);
  });

  it('collapses and re-expands an exercise, hiding and restoring its set editor', async () => {
    // A fully logged set, so Quick Log is absent and this is purely about the
    // detailed region opening and closing.
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();

    expect(textInputsByLabel(rendered, 'Duration (min)').length).toBeGreaterThan(0);

    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });
    expect(textInputsByLabel(rendered, 'Duration (min)')).toHaveLength(0);

    /* This exercise is fully logged, so collapsing it reveals story 42's
       completed card rather than a chevron — and the card is what reopens the
       editor. */
    await act(async () => {
      pressablesByLabel(rendered, /Outdoor Cycle, completed/)[0]!.props.onPress();
    });
    expect(textInputsByLabel(rendered, 'Duration (min)').length).toBeGreaterThan(0);
  });
});

describe('WorkoutSessionScreen exercise completion state', () => {
  it('reads as complete once every set has its required fields', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1 })],
    });
    const rendered = await renderScreen();

    /* Story 42 replaced story 38's `Complete` badge with a distinct collapsed
       card. The derived completion state it keys on is unchanged — only how
       that state presents itself. */
    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });
    expect(hostsByTestId(rendered, 'completed-exercise-log-1').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'of 2 sets complete')).toHaveLength(0);
  });

  it('shows a running count while any set is still missing a required field', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1, distanceValue: null, durationSeconds: null })],
    });
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, '1 of 2 sets complete').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'Complete').length).toBe(0);
  });

  it('is not vacuously complete with zero sets', async () => {
    mockSessionPayload = baseSession({ sets: [] });
    const rendered = await renderScreen();

    await flush();
    expect(textNodesContaining(rendered, 'Complete')).toHaveLength(0);
    expect(textNodesContaining(rendered, 'sets complete')).toHaveLength(0);
  });
});

/**
 * Story 39 — single-active-exercise accordion: at most one exercise
 * expanded at a time, switching on an intentional interaction (tapping
 * another exercise's header, focusing a field inside it, or choosing an
 * action inside it) rather than on blur, which would be fragile given how
 * often focus moves between controls in the same exercise.
 */
describe('WorkoutSessionScreen single-active-exercise accordion', () => {
  /**
   * @param logged Whether both exercises' sets already have their required
   *   values. Unlogged sets are what make Quick Log render at all, so a test
   *   about Quick Log has to ask for them explicitly.
   */
  function twoExerciseSession(logged = true): WorkoutSessionDetail {
    const set = logged ? baseSet() : baseSet({ durationSeconds: null, distanceValue: null });
    const base = baseSession({ sets: [set] });
    return {
      ...base,
      exercises: [
        base.exercises[0]!,
        {
          ...base.exercises[0]!,
          id: 'log-2',
          exerciseId: 'exercise-2',
          sortOrder: 1,
          exercise: { ...base.exercises[0]!.exercise, id: 'exercise-2', name: 'Indoor Cycle' },
          sets: [{ ...base.exercises[0]!.sets[0]!, id: 'set-2', exerciseLogId: 'log-2' }],
        },
      ],
    };
  }

  /* Story 42 note: these use the *unlogged* fixture. A complete exercise no
     longer renders a chevron while collapsed — it renders a summary card, and
     the card itself is the reopen control — so a chevron-based assertion about
     accordion mechanics needs exercises that are still in progress. The
     completed-card behaviour is covered in its own describe below. */
  it('starts with only the first exercise expanded', async () => {
    mockSessionPayload = twoExerciseSession(false);
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, 'Collapse Outdoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Expand Indoor Cycle')).toHaveLength(1);
  });

  it('tapping another exercise header switches which one is expanded', async () => {
    mockSessionPayload = twoExerciseSession(false);
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Expand Indoor Cycle')[0]!.props.onPress();
    });

    expect(pressablesByLabel(rendered, 'Collapse Indoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Expand Outdoor Cycle')).toHaveLength(1);
  });

  it('focusing another exercise\'s Quick Log does not expand it', async () => {
    mockSessionPayload = twoExerciseSession(false);
    const rendered = await renderScreen();

    /* Story 58 reverses what this used to assert. Focus landing inside a
       card still activates the exercise, but Quick Log is explicitly exempt:
       the old behaviour meant touching a quick-entry box expanded the whole
       accordion and destroyed the lightweight path, which is the gym test's
       specific complaint. Detailed Sets open only through the explicit
       control now.

       Asserted on behaviour rather than on the absence of an `onFocus` prop:
       the `Input` component supplies its own for focus styling, so the prop
       is always present and its absence would test the wrong thing. */
    const secondQuickLog = textInputsByLabel(rendered, 'Quick log: Duration (min)')[1]!;
    await act(async () => {
      secondQuickLog.props.onFocus?.({ nativeEvent: {} });
    });

    expect(pressablesByLabel(rendered, 'Expand Indoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Collapse Outdoor Cycle')).toHaveLength(1);
  });

  it('manually collapsing the active exercise leaves none expanded', async () => {
    mockSessionPayload = twoExerciseSession(false);
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });

    expect(pressablesByLabel(rendered, 'Expand Outdoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Expand Indoor Cycle')).toHaveLength(1);
  });
});

/**
 * Six of this screen's mutations had no `onError` at all, so a request
 * that failed — the ordinary case on gym wifi — was pixel-identical to
 * one that succeeded. Saving a set is the costly one: the inputs still
 * show what the user typed afterwards, so the set looks logged when it
 * is not.
 */
describe('WorkoutSessionScreen write failures', () => {
  it('tells the user when a set fails to save', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    mockPatch.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const rendered = await renderScreen();

    await act(async () => {
      pressableForText(rendered, 'Save')?.props.onPress();
    });
    await flush(40);

    expect(textNodesContaining(rendered, 'did not save').length).toBeGreaterThan(0);
  });

  it('tells the user when finishing the workout fails', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    mockPost.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    // Story 36 put Finish behind a confirmation, so the mutation fires from
    // the Alert's own button rather than the sticky one.
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Finish workout')?.onPress?.();
    });
    const rendered = await renderScreen();

    await act(async () => {
      pressableForText(rendered, 'Finish')?.props.onPress();
    });
    await flush(40);

    expect(textNodesContaining(rendered, 'Could not finish your workout').length).toBeGreaterThan(0);
  });
});

/**
 * Story 61 — the mobile half of the completion experience. Mirrors
 * WorkoutSessionPage.test.tsx so parity is tested rather than intended.
 */
/**
 * Story 42A/42B — a completed *workout* is a review surface.
 *
 * The boundary is the parent session being marked complete, never an exercise
 * finishing inside an active one. In review mode the overflow control holds
 * nothing, so it is gone; the chevron takes one fixed slot and stays there
 * whether the sets are showing or not; and controls that would only render
 * disabled are removed rather than greyed out.
 */
describe('WorkoutSessionScreen completed-workout review', () => {
  it('drops the overflow control once the workout is complete', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()], status: 'completed' });
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, /Outdoor Cycle actions/)).toHaveLength(0);
  });

  it('keeps the overflow control during an active workout', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, /Outdoor Cycle actions/).length).toBeGreaterThan(0);
  });

  it('keeps the summary card and its chevron in place while expanded', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()], status: 'completed' });
    const rendered = await renderScreen();

    /* A finished session opens on its first exercise, so this starts
       expanded: summary card, sets below, chevron offering to collapse. */
    expect(hostsByTestId(rendered, 'completed-exercise-log-1').length).toBeGreaterThan(0);
    expect(pressablesByLabel(rendered, 'Collapse Outdoor Cycle').length).toBeGreaterThan(0);

    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });

    /* The card never hands over to the editing header, and the chevron is in
       the same slot — now offering to expand. */
    expect(hostsByTestId(rendered, 'completed-exercise-log-1').length).toBeGreaterThan(0);
    expect(pressablesByLabel(rendered, 'Expand Outdoor Cycle').length).toBeGreaterThan(0);
  });

  it('removes set mutation controls once the workout is complete', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()], status: 'completed' });
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, 'Duplicate set')).toHaveLength(0);
    expect(pressablesByLabel(rendered, 'Remove set')).toHaveLength(0);
    const labels = rendered.root
      .findAll((node) => typeof node.type === 'string')
      .flatMap((node) => ([] as unknown[]).concat(node.props?.children))
      .filter((child): child is string => typeof child === 'string');
    expect(labels).not.toContain('Add set');
    expect(labels).not.toContain('Save');
  });

  it('keeps every set control during an active workout', async () => {
    /* The guard rail for this pack: the removals key on the *workout* being
       complete. This exercise is fully logged — so it is complete — inside an
       active workout, and every control must still be there. */
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, 'Duplicate set').length).toBeGreaterThan(0);
    expect(pressablesByLabel(rendered, 'Remove set').length).toBeGreaterThan(0);
    const labels = rendered.root
      .findAll((node) => typeof node.type === 'string')
      .flatMap((node) => ([] as unknown[]).concat(node.props?.children))
      .filter((child): child is string => typeof child === 'string');
    expect(labels).toContain('Add set');
  });
});

describe('WorkoutSessionScreen exercise completion experience', () => {
  it('gives a completed exercise a distinct card, not just a badge', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();
    expect(hostsByTestId(rendered, 'exercise-card-complete').length).toBeGreaterThan(0);
  });

  it('leaves an unfinished exercise looking unfinished', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1, durationSeconds: null, distanceValue: null })],
    });
    const rendered = await renderScreen();
    expect(hostsByTestId(rendered, 'exercise-card-complete')).toHaveLength(0);
    expect(hostsByTestId(rendered, 'exercise-card').length).toBeGreaterThan(0);
  });

  it('reports achievement as labelled figures, not a summary string', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1 })] });
    const rendered = await renderScreen();
    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });
    /* The base fixture is a distance+duration ride, so this also pins that the
       card is representation-aware: distance and pace, never weight × reps. */
    /* The rendered node holds React internals, so it cannot be stringified —
       collect the visible strings instead. */
    const tile = hostsByTestId(rendered, 'completed-exercise-log-1-metrics')[0]!;
    const text = tile
      .findAll((node) => typeof node.type === 'string')
      .flatMap((node) => ([] as unknown[]).concat(node.props?.children))
      .filter((child): child is string => typeof child === 'string')
      .join(' ');
    expect(text).toContain('Distance');
    expect(text).toContain('Pace');
    expect(text).not.toContain('Volume');
    expect(text).not.toContain('lb');
  });

  it('announces completion rather than relying on colour', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();
    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });
    /* Completion is carried by an icon and a tint, so the accessible name has
       to say it in words — and say that the card reopens. */
    expect(pressablesByLabel(rendered, /Outdoor Cycle, completed, 1 set completed/).length).toBeGreaterThan(0);
  });

  it('does not label the card "Complete" beside the exercise name', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();
    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });
    /* `Complete` may legitimately appear inside "1 set completed"; what must
       not exist is a standalone label competing with the exercise name. */
    const exactLabels = textNodesContaining(rendered, 'Complete').filter((node) =>
      ([] as unknown[]).concat(node.props?.children).some((child) => child === 'Complete'),
    );
    expect(exactLabels).toHaveLength(0);
  });
});

/**
 * Story 62 — the mobile half. Most of this story's criteria are satisfied
 * structurally by the work in 39, 58, 59 and 61 rather than by new UI; these
 * pin them so a future change cannot quietly undo one.
 */
describe('WorkoutSessionScreen focus and overrides', () => {
  it('stays complete when actual differs from planned', async () => {
    /* A plan is guidance; actual performance is the truth of the session.
       Completion means the required data is present, not that the user
       matched the prescription. */
    mockSessionPayload = baseSession({
      sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1, durationSeconds: 1200, distanceValue: 2 })],
    });
    const rendered = await renderScreen();
    expect(hostsByTestId(rendered, 'exercise-card-complete').length).toBeGreaterThan(0);
  });

  it('never writes to the workout template from the session', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet({ durationSeconds: null, distanceValue: null })],
    });
    const rendered = await renderScreen();

    await act(async () => {
      textInputsByLabel(rendered, 'Quick log: Distance')[0]!.props.onChangeText('5');
    });
    await act(async () => {
      textInputsByLabel(rendered, 'Quick log: Duration (min)')[0]!.props.onChangeText('30');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Log 1 set')[0]!.props.onPress();
    });

    // ADR 0005: the session is fact, the day type is intent.
    const touched = mockPost.mock.calls.map(([path]) => String(path));
    expect(touched.some((path) => path.includes('/day-types'))).toBe(false);
    expect(touched.some((path) => path.includes('/programs'))).toBe(false);
  });
});
