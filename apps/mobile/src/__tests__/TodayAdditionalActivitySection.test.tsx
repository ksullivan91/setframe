import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TodayAdditionalActivitySection } from '../components/TodayAdditionalActivitySection';
import type { AdditionalActivity } from '@setframe/schemas';

let mockItems: AdditionalActivity[] = [];
let mockGetError = false;
const mockPost = jest.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockPatch = jest.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockDel = jest.fn((_path: string) => Promise.resolve(undefined));

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
      get: () => (mockGetError ? Promise.reject(new Error('network error')) : Promise.resolve({ items: mockItems })),
      post: (path: string, body?: unknown) => mockPost(path, body),
      patch: (path: string, body?: unknown) => mockPatch(path, body),
      del: (path: string) => mockDel(path),
      delete: (path: string) => mockDel(path),
    }),
  };
});

function walkActivity(overrides: Partial<AdditionalActivity> = {}): AdditionalActivity {
  return {
    id: 'activity-1',
    localDate: '2026-08-24',
    timezone: 'America/Chicago',
    startedAt: '2026-08-24T18:45:00.000Z',
    durationSeconds: 1080,
    activityType: 'walk',
    source: 'manual',
    title: null,
    distanceValue: null,
    distanceUnit: null,
    caloriesKcal: null,
    notes: null,
    externalSourceId: null,
    createdAt: '2026-08-24T18:45:00.000Z',
    updatedAt: '2026-08-24T18:45:00.000Z',
    ...overrides,
  };
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

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderSection(): Promise<ReactTestRenderer> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TodayAdditionalActivitySection localDate="2026-08-24" />
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
  mockItems = [];
  mockGetError = false;
  jest.clearAllMocks();
});

/** Story 41 — Today's Additional Activity section, mobile counterpart. */
describe('TodayAdditionalActivitySection', () => {
  it('explains what the section is for when empty', async () => {
    const rendered = await renderSection();
    expect(textNodesContaining(rendered, "Add walks, mobility, yoga").length).toBeGreaterThan(0);
  });

  it('shows type and duration for a logged activity', async () => {
    mockItems = [walkActivity({ distanceValue: 0.8, distanceUnit: 'mi' })];
    const rendered = await renderSection();

    expect(textNodesContaining(rendered, 'Walk').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, '18 min').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, '0.8 mi').length).toBeGreaterThan(0);
  });

  it('degrades independently on a failed fetch', async () => {
    mockGetError = true;
    const rendered = await renderSection();
    expect(textNodesContaining(rendered, "Couldn't load additional activity.").length).toBeGreaterThan(0);
  });

  it('adds a manual activity and closes the sheet on save', async () => {
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Add activity')[0]!.props.onPress();
    });
    await flush();

    const durationField = rendered.root.findAll(
      (node) => node.props?.label === 'Duration' && typeof node.props?.onChangeText === 'function',
    )[0];
    await act(async () => {
      durationField!.props.onChangeText('15');
    });
    await act(async () => {
      rendered.root.findAll((node) => node.props?.label === 'Save' && typeof node.props?.onPress === 'function')[0]!.props.onPress();
    });
    await flush();

    expect(mockPost).toHaveBeenCalledWith(
      '/additional-activities',
      expect.objectContaining({ localDate: '2026-08-24', activityType: 'walk', durationSeconds: 900 }),
    );
  });

  it('sends a UTC-qualified startedAt, not a bare local-time string the API would reject', async () => {
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Add activity')[0]!.props.onPress();
    });
    await flush();

    const startTimeField = rendered.root.findAll(
      (node) => node.props?.label === 'Start time' && typeof node.props?.onChangeText === 'function',
    )[0];
    await act(async () => {
      startTimeField!.props.onChangeText('14:30');
    });
    await act(async () => {
      rendered.root.findAll((node) => node.props?.label === 'Save' && typeof node.props?.onPress === 'function')[0]!.props.onPress();
    });
    await flush();

    expect(mockPost).toHaveBeenCalled();
    const [, body] = mockPost.mock.calls[0]!;
    expect((body as { startedAt: string }).startedAt).toMatch(/Z$/);
  });

  it('shows an existing activity’s start time converted to local, not its raw UTC hour', async () => {
    const startedAt = '2026-08-24T18:45:00.000Z';
    mockItems = [walkActivity({ startedAt })];
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Edit Walk')[0]!.props.onPress();
    });
    await flush();

    const expectedLocal = new Date(startedAt);
    const expected = `${String(expectedLocal.getHours()).padStart(2, '0')}:${String(expectedLocal.getMinutes()).padStart(2, '0')}`;
    const startTimeField = rendered.root.findAll(
      (node) => node.props?.label === 'Start time' && typeof node.props?.onChangeText === 'function',
    )[0];
    expect(startTimeField!.props.value).toBe(expected);
  });

  it('deletes an activity after confirming', async () => {
    mockItems = [walkActivity()];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Remove')?.onPress?.();
    });
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Delete Walk')[0]!.props.onPress();
    });
    await flush();

    expect(mockDel).toHaveBeenCalledWith('/additional-activities/activity-1');
  });
});
