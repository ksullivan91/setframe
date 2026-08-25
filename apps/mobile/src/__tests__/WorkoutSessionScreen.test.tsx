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
function pressablesByLabel(rendered: ReactTestRenderer, label: string) {
  const matches = rendered.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );
  const seenHandlers = new Set<unknown>();
  return matches.filter((node) => {
    if (seenHandlers.has(node.props.onPress)) return false;
    seenHandlers.add(node.props.onPress);
    return true;
  });
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
describe('WorkoutSessionScreen collapsible quick-entry', () => {
  it('pre-fills the quick-entry header from the first set, matching what session-start already templated', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1 })] });
    const rendered = await renderScreen();

    const header = textInputsByLabel(rendered, 'All sets: Duration (min)')[0]!;
    expect(header.props.value).toBe('30');
  });

  it('applies the header value to every set only when Apply to all sets is explicitly clicked', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1 })] });
    const rendered = await renderScreen();

    const header = textInputsByLabel(rendered, 'All sets: Duration (min)')[0]!;
    await act(async () => {
      header.props.onChangeText('45');
    });

    // Not applied yet — each set's own field is untouched.
    let perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[0]!.props.value).toBe('30');
    expect(perSetDuration[1]!.props.value).toBe('30');

    await act(async () => {
      pressablesByLabel(rendered, 'Apply to all sets')[0]!.props.onPress();
    });

    perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[0]!.props.value).toBe('45');
    expect(perSetDuration[1]!.props.value).toBe('45');
  });

  it('leaves a manual per-set override alone unless Apply to all sets is clicked again', async () => {
    // Set 2 differs from set 1 on every quick-entry field, not just
    // duration — otherwise a bug that applied the *whole* header (instead
    // of only the field the user actually touched) couldn't be caught:
    // distance/rpe would already coincidentally match and look unchanged.
    mockSessionPayload = baseSession({
      sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1, distanceValue: 8, rpe: 6 })],
    });
    const rendered = await renderScreen();

    let perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    await act(async () => {
      perSetDuration[1]!.props.onChangeText('20');
    });
    perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[1]!.props.value).toBe('20');

    // Editing the header itself, without clicking Apply, never touches any
    // set — the cascade is only ever triggered by the explicit button.
    const header = textInputsByLabel(rendered, 'All sets: Duration (min)')[0]!;
    await act(async () => {
      header.props.onChangeText('45');
    });
    perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[1]!.props.value).toBe('20');

    // Clicking Apply is the one action that does overwrite it — an
    // explicit, deliberate re-application, not a silent one. Only the
    // field actually edited in the header (duration) should move; set 2's
    // own distance/rpe — never touched in the header — must survive.
    await act(async () => {
      pressablesByLabel(rendered, 'Apply to all sets')[0]!.props.onPress();
    });
    expect(textInputsByLabel(rendered, 'Distance')[1]!.props.value).toBe('8');
    expect(textInputsByLabel(rendered, 'RPE')[1]!.props.value).toBe('6');
    perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[1]!.props.value).toBe('45');
  });

  it('changing only the distance unit does not drag the distance value along when applied', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet({ distanceValue: 5 }), baseSet({ id: 'set-2', sortOrder: 1, distanceValue: 8 })],
    });
    const rendered = await renderScreen();

    // Only the unit dropdown is touched — the distance value input itself
    // is never edited.
    await act(async () => {
      selectsByLabel(rendered, 'All sets: Distance unit')[0]!.props.onChange('km');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Apply to all sets')[0]!.props.onPress();
    });

    // The unit applies to both sets...
    const perSetUnit = selectsByLabel(rendered, 'Unit');
    expect(perSetUnit[0]!.props.value).toBe('km');
    expect(perSetUnit[1]!.props.value).toBe('km');
    // ...but each set's own distance value — never touched in the header
    // — must survive untouched.
    const perSetDistance = textInputsByLabel(rendered, 'Distance');
    expect(perSetDistance[0]!.props.value).toBe('5');
    expect(perSetDistance[1]!.props.value).toBe('8');
  });

  it('clears the touched header fields after a successful Apply, so a later click cannot silently reapply a stale edit', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet({ durationSeconds: 1800 }), baseSet({ id: 'set-2', sortOrder: 1, durationSeconds: 1200 })],
    });
    const rendered = await renderScreen();

    const headerDuration = textInputsByLabel(rendered, 'All sets: Duration (min)')[0]!;
    await act(async () => {
      headerDuration.props.onChangeText('60');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Apply to all sets')[0]!.props.onPress();
    });
    expect(textInputsByLabel(rendered, 'Duration (min)')[1]!.props.value).toBe('60');

    // Set 2's duration is hand-edited back to something else after the
    // apply...
    let perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    await act(async () => {
      perSetDuration[1]!.props.onChangeText('15');
    });
    perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[1]!.props.value).toBe('15');

    // ...and now the user edits the header's *distance* only, then
    // applies. The stale "duration" touch from earlier must not still be
    // armed — set 2's hand-edited duration must survive this unrelated
    // apply.
    const headerDistance = textInputsByLabel(rendered, 'All sets: Distance')[0]!;
    await act(async () => {
      headerDistance.props.onChangeText('12');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Apply to all sets')[0]!.props.onPress();
    });

    perSetDuration = textInputsByLabel(rendered, 'Duration (min)');
    expect(perSetDuration[1]!.props.value).toBe('15');
    expect(textInputsByLabel(rendered, 'Distance')[1]!.props.value).toBe('12');
  });

  it('collapses and re-expands an exercise, hiding and restoring its set editor', async () => {
    mockSessionPayload = baseSession({ sets: [baseSet()] });
    const rendered = await renderScreen();

    expect(textInputsByLabel(rendered, 'Duration (min)')).toHaveLength(1);
    // The quick-entry header stays visible either way.
    expect(textInputsByLabel(rendered, 'All sets: Duration (min)')).toHaveLength(1);

    await act(async () => {
      pressablesByLabel(rendered, 'Collapse Outdoor Cycle')[0]!.props.onPress();
    });
    expect(textInputsByLabel(rendered, 'Duration (min)')).toHaveLength(0);
    expect(textInputsByLabel(rendered, 'All sets: Duration (min)')).toHaveLength(1);

    await act(async () => {
      pressablesByLabel(rendered, 'Expand Outdoor Cycle')[0]!.props.onPress();
    });
    expect(textInputsByLabel(rendered, 'Duration (min)')).toHaveLength(1);
  });
});

/**
 * Story 38 — exercise-level completion state, derived from every set's
 * own required-field completeness (packages/domain's isExerciseComplete),
 * never a UI flag toggled on accordion close.
 */
describe('WorkoutSessionScreen exercise completion state', () => {
  it('shows Complete once every set has its required fields', async () => {
    mockSessionPayload = baseSession({
      sets: [baseSet(), baseSet({ id: 'set-2', sortOrder: 1 })],
    });
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'Complete').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'sets complete')).toHaveLength(0);
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
  function twoExerciseSession(): WorkoutSessionDetail {
    const base = baseSession({ sets: [baseSet()] });
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

  it('starts with only the first exercise expanded', async () => {
    mockSessionPayload = twoExerciseSession();
    const rendered = await renderScreen();

    expect(pressablesByLabel(rendered, 'Collapse Outdoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Expand Indoor Cycle')).toHaveLength(1);
  });

  it('tapping another exercise header switches which one is expanded', async () => {
    mockSessionPayload = twoExerciseSession();
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Expand Indoor Cycle')[0]!.props.onPress();
    });

    expect(pressablesByLabel(rendered, 'Collapse Indoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Expand Outdoor Cycle')).toHaveLength(1);
  });

  it('focusing a quick-entry field inside a collapsed exercise activates it too', async () => {
    mockSessionPayload = twoExerciseSession();
    const rendered = await renderScreen();

    // The quick-entry header stays visible even while collapsed (Story 37)
    // — focusing it is exactly the "focus lands inside this exercise"
    // trigger.
    const secondHeaderDuration = textInputsByLabel(rendered, 'All sets: Duration (min)')[1]!;
    await act(async () => {
      secondHeaderDuration.props.onFocus();
    });

    expect(pressablesByLabel(rendered, 'Collapse Indoor Cycle')).toHaveLength(1);
    expect(pressablesByLabel(rendered, 'Expand Outdoor Cycle')).toHaveLength(1);
  });

  it('manually collapsing the active exercise leaves none expanded', async () => {
    mockSessionPayload = twoExerciseSession();
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
