import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import SessionSummaryScreen from '../../app/session-summary';
import type { WorkoutSessionDetail } from '@setframe/schemas';

const mockReplace = jest.fn();
let mockSessionPayload: WorkoutSessionDetail;
const mockPatch = jest.fn((_path: string, body?: Record<string, unknown>) => Promise.resolve({ ...body }));

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
      get: () => Promise.resolve(mockSessionPayload),
      post: () => Promise.resolve({}),
      patch: (path: string, body?: Record<string, unknown>) => mockPatch(path, body),
      del: () => Promise.resolve(undefined),
      delete: () => Promise.resolve(undefined),
    }),
  };
});

function baseSession(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    id: 'session-1',
    userId: 'user-1',
    templateId: null,
    localDate: '2026-08-20',
    timezone: 'America/Chicago',
    status: 'completed',
    startedAt: '2026-08-20T12:00:00.000Z',
    completedAt: '2026-08-20T13:00:00.000Z',
    notes: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-20T13:00:00.000Z',
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
          name: 'Deadlift',
          isCustom: false,
          ownerUserId: null,
          archivedAt: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
        prescription: { kind: 'sets_reps', sets: 3, repsMin: 5, repsMax: 5 },
        sets: [
          {
            id: 'set-1',
            exerciseLogId: 'log-1',
            clientId: 'client-1',
            sortOrder: 0,
            setType: 'working',
            weightValue: 55,
            weightUnit: 'lb',
            reps: 8,
            durationSeconds: null,
            distanceValue: null,
            distanceUnit: null,
            rpe: null,
            isPrWeight: false,
            isPrReps: false,
            createdAt: '2026-08-20T12:10:00.000Z',
            updatedAt: '2026-08-20T12:10:00.000Z',
          },
        ],
        previousSession: null,
      },
    ],
    ...overrides,
  } as WorkoutSessionDetail;
}

let tree: ReactTestRenderer | null = null;

function hostsByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll((node) => node.props?.accessibilityLabel === label && typeof node.type === 'string');
}

function pressablesByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );
}

function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll((node) => node.props?.testID === testID && typeof node.type !== 'string');
}

function textNodesContaining(rendered: ReactTestRenderer, needle: string) {
  return rendered.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      ([] as unknown[]).concat(node.props?.children).some((child) => typeof child === 'string' && child.includes(needle)),
  );
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
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
          <SessionSummaryScreen />
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

/**
 * Story 23 — the completed workout review previously had no edit
 * affordance at all; this covers the new tap-to-correct flow.
 */
describe('SessionSummaryScreen set editing', () => {
  it('opens an edit sheet prefilled with the set values when a logged set is tapped', async () => {
    mockSessionPayload = baseSession();
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Edit set 1, Deadlift')[0]!.props.onPress();
    });
    await flush();

    const weightField = hostsByTestId(rendered, 'set-edit-field-weight')[0] as ReactTestInstance;
    expect(weightField.props.value).toBe('55');
    const repsField = hostsByTestId(rendered, 'set-edit-field-reps')[0] as ReactTestInstance;
    expect(repsField.props.value).toBe('8');
  });

  it('saves a corrected value via PATCH and refreshes the session', async () => {
    mockSessionPayload = baseSession();
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Edit set 1, Deadlift')[0]!.props.onPress();
    });
    await flush();

    const weightField = hostsByTestId(rendered, 'set-edit-field-weight')[0] as ReactTestInstance;
    await act(async () => {
      weightField.props.onChangeText('155');
    });

    await act(async () => {
      pressablesByLabel(rendered, 'Save')[0]!.props.onPress();
    });
    await flush();

    expect(mockPatch).toHaveBeenCalledWith('/workout-sets/set-1', expect.objectContaining({ weightValue: 155 }));
    // The sheet closes on a successful save.
    expect(hostsByTestId(rendered, 'set-edit-field-weight')).toHaveLength(0);
  });

  it('blocks a negative correction client-side without calling the API', async () => {
    mockSessionPayload = baseSession();
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'Edit set 1, Deadlift')[0]!.props.onPress();
    });
    await flush();

    const weightField = hostsByTestId(rendered, 'set-edit-field-weight')[0] as ReactTestInstance;
    await act(async () => {
      weightField.props.onChangeText('-10');
    });
    await act(async () => {
      pressablesByLabel(rendered, 'Save')[0]!.props.onPress();
    });
    await flush();

    expect(mockPatch).not.toHaveBeenCalled();
    expect(textNodesContaining(rendered, 'cannot be negative').length).toBeGreaterThan(0);
  });

  it('offers the edit affordance even though the session is completed', async () => {
    mockSessionPayload = baseSession({ status: 'completed' });
    const rendered = await renderScreen();

    expect(hostsByLabel(rendered, 'Edit set 1, Deadlift')).toHaveLength(1);
  });
});
