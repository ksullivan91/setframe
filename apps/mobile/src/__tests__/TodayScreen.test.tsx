import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import TodayScreen from '../../app/(tabs)/today';

const mockPush = jest.fn();
let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve([]);
const mockPost = jest.fn((_path: string, _body?: unknown) => Promise.resolve({} as unknown));
const mockDel = jest.fn((_path: string) => Promise.resolve(undefined as unknown));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// The screen imports the HealthKit adapter at module load; the full-screen
// render only needs a resolved no-op so no native module is touched.
jest.mock('../healthkit/HealthKitAdapter', () => ({
  healthKit: { getTodayMetrics: () => Promise.resolve(null) },
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
      get: (path: string) => mockGet(path),
      post: (path: string, body?: unknown) => mockPost(path, body),
      patch: () => Promise.resolve({}),
      del: (path: string) => mockDel(path),
      delete: (path: string) => mockDel(path),
    }),
  };
});

let tree: ReactTestRenderer | null = null;

function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

function hostsByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.type === 'string',
  );
}

// The Button and its inner Pressable are both composite instances carrying
// `onPress`; either invokes the same handler, so [0] drives the press.
function pressablesByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  );
}

function pressablesByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );
}

function textNodesContaining(rendered: ReactTestRenderer, needle: string) {
  return rendered.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      ([] as unknown[])
        .concat(node.props?.children)
        .some((child) => typeof child === 'string' && child.includes(needle)),
  );
}

function todayPayload(overrides: Record<string, unknown> = {}) {
  return {
    localDate: '2026-08-24',
    dayTypeId: null,
    dayLabel: null,
    weekLabel: null,
    estimatedDurationMinutes: null,
    sessions: [],
    manualEntry: null,
    activitySummary: null,
    nutritionSnapshot: null,
    syncState: null,
    restDay: null,
    ...overrides,
  };
}

function getFor(payload: Record<string, unknown>): (path: string) => Promise<unknown> {
  return (path: string) => {
    if (path.startsWith('/dashboard/today')) return Promise.resolve(payload);
    if (path === '/programs') return Promise.resolve([{ id: 'program-1', isActive: true }]);
    return Promise.resolve([]);
  };
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    // Macrotasks let react-query's fetch + state transitions settle
    // deterministically; microtask-only flushing is racy here.
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
          <TodayScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  return tree!;
}

// useLocalDate's interval leaks a Jest worker unless the tree is torn down.
afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  mockGet = () => Promise.resolve([]);
  jest.clearAllMocks();
});

describe('TodayScreen rest days', () => {
  it('offers a rest day alongside choosing a workout when nothing is scheduled', async () => {
    mockGet = getFor(todayPayload());
    const rendered = await renderScreen();

    expect(hostsByTestId(rendered, 'choose-workout')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'mark-rest-day')).toHaveLength(1);
  });

  it('offers a rest day on a day that has a workout scheduled', async () => {
    mockGet = getFor(todayPayload({ dayTypeId: 'day-1', dayLabel: 'Push', weekLabel: 'Week 3' }));
    const rendered = await renderScreen();

    expect(hostsByLabel(rendered, 'Start workout')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'mark-rest-day')).toHaveLength(1);
  });

  /**
   * Story 27 — Rest Day previously sat as a third equal-weight button
   * beside Start/Preview with no explanation of what it does.
   */
  it('explains what taking a rest day does before the user commits', async () => {
    mockGet = getFor(todayPayload({ dayTypeId: 'day-1', dayLabel: 'Push', weekLabel: 'Week 3' }));
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'Need a day off?').length).toBeGreaterThan(0);
    expect(
      textNodesContaining(rendered, 'without changing your program or breaking your consistency').length,
    ).toBeGreaterThan(0);
  });

  it('shows a rest completion state with no workout to review and no stats', async () => {
    mockGet = getFor(
      todayPayload({
        dayTypeId: 'day-1',
        dayLabel: 'Push',
        restDay: {
          id: 'rest-1',
          localDate: '2026-08-24',
          timezone: 'America/Chicago',
          note: null,
          createdAt: '2026-08-24T12:00:00.000Z',
        },
      }),
    );
    const rendered = await renderScreen();

    expect(hostsByTestId(rendered, 'workout-card-rested')).toHaveLength(1);
    expect(hostsByTestId(rendered, 'undo-rest-day')).toHaveLength(1);
    // No dead-end review link, and none of the celebratory workout stats.
    expect(hostsByLabel(rendered, 'Review workout')).toHaveLength(0);
    expect(hostsByTestId(rendered, 'workout-card-completed')).toHaveLength(0);
    expect(textNodesContaining(rendered, 'Sets logged')).toHaveLength(0);
    expect(hostsByLabel(rendered, 'Start workout')).toHaveLength(0);
  });

  it('tells the user a rest day will not count against their training', async () => {
    mockGet = getFor(
      todayPayload({
        restDay: {
          id: 'rest-1',
          localDate: '2026-08-24',
          timezone: 'America/Chicago',
          note: null,
          createdAt: '2026-08-24T12:00:00.000Z',
        },
      }),
    );
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'will not count against your training').length).toBeGreaterThan(0);
  });

  it("counts the rest day toward the day's training step", async () => {
    mockGet = getFor(
      todayPayload({
        restDay: {
          id: 'rest-1',
          localDate: '2026-08-24',
          timezone: 'America/Chicago',
          note: null,
          createdAt: '2026-08-24T12:00:00.000Z',
        },
      }),
    );
    const rendered = await renderScreen();

    // The done badge stands in for web's completed-step tally: a rested day
    // reads as a closed training step, not an open workout.
    expect(hostsByTestId(rendered, 'workout-done-badge')).toHaveLength(1);
  });

  it('does not read as a closed training step when nothing is scheduled', async () => {
    mockGet = getFor(todayPayload());
    const rendered = await renderScreen();

    expect(hostsByTestId(rendered, 'workout-done-badge')).toHaveLength(0);
  });

  it('exposes the rest actions as 44pt accessible buttons', async () => {
    mockGet = getFor(todayPayload());
    const rendered = await renderScreen();

    const mark = hostsByTestId(rendered, 'mark-rest-day')[0] as ReactTestInstance;
    expect(mark.props.accessible).toBe(true);
    expect(mark.props.accessibilityRole).toBe('button');
    expect(mark.props.accessibilityLabel).toBe('Take a rest day');
    const style = Object.assign({}, ...[mark.props.style].flat(2).filter(Boolean));
    expect(style.minHeight).toBe(44);
  });

  it('surfaces a clear message when the day already has a workout (409)', async () => {
    mockGet = getFor(todayPayload({ dayTypeId: 'day-1', dayLabel: 'Push' }));
    const { ApiError } = jest.requireMock('../lib/api-client') as {
      ApiError: new (message: string, status: number) => Error;
    };
    mockPost.mockRejectedValueOnce(new ApiError('conflict', 409));
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByTestId(rendered, 'mark-rest-day')[0]!.props.onPress();
    });
    await flush();

    expect(textNodesContaining(rendered, "can't be a rest day").length).toBeGreaterThan(0);
  });
});

/**
 * The logger is a route keyed by session id, and Today is the only screen
 * that creates a session.
 *
 * Both halves matter. Pushing without the id is what stranded the logger
 * on an empty state once it stopped inventing sessions; not refreshing
 * Today's cache is what let a second press miss the session just created
 * and POST another — duplicating the workout and, because
 * POST /v1/workout-sessions clears that date's rest_day, destroying a
 * logged rest day.
 */
describe('TodayScreen starting a workout', () => {
  it('navigates to the session route carrying its id', async () => {
    mockGet = getFor(todayPayload({ dayTypeId: 'day-1', dayLabel: 'Push' }));
    mockPost.mockResolvedValueOnce({ id: 'session-99' });
    const rendered = await renderScreen();

    await act(async () => {
      hostsByLabel(rendered, 'Start workout')[0]!.props.onPress?.();
      pressablesByLabel(rendered, 'Start workout')[0]?.props.onPress();
    });
    await flush();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/workout/[sessionId]',
      params: { sessionId: 'session-99' },
    });
  });
});
