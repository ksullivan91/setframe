import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TodayAdditionalActivitySection } from '../components/TodayAdditionalActivitySection';
import type { AdditionalActivity, AdditionalActivityPreset } from '@setframe/schemas';

let mockItems: AdditionalActivity[] = [];
let mockRecentItems: AdditionalActivity[] = [];
let mockPresets: AdditionalActivityPreset[] = [];
let mockGetError = false;
let mockPreferredUnits: 'imperial' | 'metric' = 'imperial';
const mockPost = jest.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockPatch = jest.fn((_path: string, body?: unknown) => Promise.resolve(body));
const mockDel = jest.fn((_path: string) => Promise.resolve(undefined));

/* The card now discovers Apple Health workouts, which means it reads the
   adapter and subscribes to screen focus. Both need standing in for: the
   real app always renders this inside a navigator, but a unit test does
   not, and useFocusEffect throws without one. */
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const React = jest.requireActual('react') as typeof import('react');
    React.useEffect(() => cb(), []);
  },
}));

jest.mock('../healthkit/HealthKitAdapter', () =>
  require('../test-support/healthkit-mock').healthKitModuleMock(),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: () => Promise.resolve(null),
  setItemAsync: () => Promise.resolve(),
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
        if (mockGetError) return Promise.reject(new Error('network error'));
        if (path === '/me') return Promise.resolve({ preferredUnits: mockPreferredUnits });
        if (path === '/additional-activity-presets') return Promise.resolve({ items: mockPresets });
        if (path.includes('from=')) return Promise.resolve({ items: mockRecentItems });
        return Promise.resolve({ items: mockItems });
      },
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

// Chip labels are bare Pressables around Text with no accessibilityLabel —
// find the nearest pressable ancestor of the matching text instead.
function pressableForText(rendered: ReactTestRenderer, text: string) {
  let current = textNodesContaining(rendered, text)[0] ?? null;
  while (current) {
    if (typeof current.props?.onPress === 'function') return current;
    current = current.parent;
  }
  return null;
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
          <TodayAdditionalActivitySection localDate="2026-08-24" isToday />
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
  mockRecentItems = [];
  mockPresets = [];
  mockGetError = false;
  mockPreferredUnits = 'imperial';
  jest.clearAllMocks();
});

/** Story 41 — Today's Additional Activity section, mobile counterpart. */
describe('TodayAdditionalActivitySection', () => {
  it('says the day holds nothing, on the row that adds one', async () => {
    /* The empty state used to be a sentence plus its own button. The row is
       both now — two affordances for one action was the bug. */
    const rendered = await renderSection();
    expect(textNodesContaining(rendered, 'Nothing added').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'Add walks, mobility, yoga')).toHaveLength(0);
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
      pressablesByLabel(rendered, 'Activity. Add an activity')[0]!.props.onPress();
    });
    await flush();

    const durationField = byTestId(rendered, 'activity-minutes');
    await act(async () => {
      durationField!.props.onChangeText('15');
    });
    await act(async () => {
      rendered.root.findAll((node) => node.props?.testID === 'save-activity' && typeof node.props?.onPress === 'function')[0]!.props.onPress();
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
      pressablesByLabel(rendered, 'Activity. Add an activity')[0]!.props.onPress();
    });
    await flush();

    const startTimeField = byTestId(rendered, 'activity-start-time');
    await act(async () => {
      startTimeField!.props.onChangeText('14:30');
    });
    await act(async () => {
      rendered.root.findAll((node) => node.props?.testID === 'save-activity' && typeof node.props?.onPress === 'function')[0]!.props.onPress();
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
    const startTimeField = byTestId(rendered, 'activity-start-time');
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

function selectActivityType(rendered: ReactTestRenderer, value: string) {
  /* A chip grid, not a select: nine types, each its own target. */
  const chip = rendered.root.findAll(
    (node) => node.props?.testID === `activity-type-${value}` && typeof node.props?.onPress === 'function',
  )[0];
  chip!.props.onPress();
}

function byTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onChangeText === 'function',
  )[0];
}

function fieldLabels(rendered: ReactTestRenderer) {
  /* The sheet renders its own labels as text rather than passing them to a
     labelled Input, so the visible copy is what to look for. */
  const has = (copy: string) => textNodesContaining(rendered, copy).length > 0;
  return [
    has('HOW FAR') ? 'Distance' : null,
    has('WHAT TO CALL IT') ? 'Activity name' : null,
    has('HOW LONG') ? 'Duration' : null,
    has('WHEN') ? 'Start time' : null,
  ].filter(Boolean) as string[];
}

function legacyFieldLabels(rendered: ReactTestRenderer) {
  return rendered.root
    .findAll((node) => typeof node.props?.label === 'string' && (node.props?.onChangeText || node.props?.onChange))
    .map((node) => node.props.label as string);
}

/**
 * Story 42 — the add/edit sheet shows only the fields relevant to the
 * selected activity type, instead of Story 41's generic every-field form.
 */
describe('TodayAdditionalActivitySection activity-type-driven fields', () => {
  it('hides distance for a stationary activity like Yoga', async () => {
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Activity. Add an activity')[0]!.props.onPress();
    });
    await flush();
    expect(fieldLabels(rendered)).toContain('Distance');

    await act(async () => {
      selectActivityType(rendered, 'yoga');
    });
    await flush();

    expect(fieldLabels(rendered)).not.toContain('Distance');
    expect(fieldLabels(rendered)).toContain('Start time');
  });

  it('shows an Activity name field only for "Other", and requires it to save', async () => {
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Activity. Add an activity')[0]!.props.onPress();
    });
    await flush();
    expect(fieldLabels(rendered)).not.toContain('Activity name');

    await act(async () => {
      selectActivityType(rendered, 'other');
    });
    await flush();
    expect(fieldLabels(rendered)).toContain('Activity name');

    const durationField = byTestId(rendered, 'activity-minutes');
    await act(async () => {
      durationField!.props.onChangeText('10');
    });
    await flush();
    const saveButton = rendered.root.findAll(
      (node) => node.props?.testID === 'save-activity' && node.props?.onPress,
    )[0];
    expect(saveButton!.props.disabled).toBe(true);

    const titleField = byTestId(rendered, 'activity-title');
    await act(async () => {
      titleField!.props.onChangeText('Jump rope');
    });
    await flush();
    const saveButtonAfter = rendered.root.findAll((node) => node.props?.testID === 'save-activity' && node.props?.onPress)[0];
    expect(saveButtonAfter!.props.disabled).toBe(false);
  });

  it("defaults the distance unit to the user's metric preference", async () => {
    /* Asserted through the saved body rather than through which chip looks
       selected. The preference matters because it reaches the API; a
       selector over rendered state also matched the activity-type chips,
       which is a fact about the markup rather than about the behaviour. */
    mockPreferredUnits = 'metric';
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Activity. Add an activity')[0]!.props.onPress();
    });
    await flush();

    await act(async () => {
      byTestId(rendered, 'activity-minutes')!.props.onChangeText('20');
    });
    await act(async () => {
      byTestId(rendered, 'activity-distance')!.props.onChangeText('5');
    });
    await act(async () => {
      rendered.root
        .findAll((node) => node.props?.testID === 'save-activity' && node.props?.onPress)[0]!
        .props.onPress();
    });
    await flush();

    expect(mockPost).toHaveBeenCalledWith(
      '/additional-activities',
      expect.objectContaining({ distanceValue: 5, distanceUnit: 'km' }),
    );
  });

  // Regression: buildBody() used to force `null` for any field the current
  // type's field list excludes — for an edit, that silently wiped a value
  // the record already had in a field the sheet never even showed, rather
  // than leaving it untouched.
  it('does not wipe a title the record already has when editing a type that has no name field', async () => {
    mockItems = [walkActivity({ title: 'Morning stroll' })];
    const rendered = await renderSection();

    await act(async () => {
      pressablesByLabel(rendered, 'Edit Walk')[0]!.props.onPress();
    });
    await flush();
    expect(rendered.root.findAll((node) => node.props?.label === 'Activity name')).toHaveLength(0);

    await act(async () => {
      rendered.root.findAll((node) => node.props?.testID === 'save-activity' && node.props?.onPress)[0]!.props.onPress();
    });
    await flush();

    expect(mockPatch).toHaveBeenCalled();
    const [, body] = mockPatch.mock.calls[0]!;
    expect(body as object).not.toHaveProperty('title', null);
  });
});

function preset(overrides: Partial<AdditionalActivityPreset> = {}): AdditionalActivityPreset {
  return {
    id: 'preset-1',
    title: 'Post-meal walk',
    activityType: 'walk',
    defaultDurationSeconds: 900,
    defaultDistanceValue: null,
    defaultDistanceUnit: null,
    defaultNotes: null,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

/* Quick-activity presets were removed with the sheet rewrite: they existed
   to speed up a form that is no longer slow. Their tests go with them, and
   the invariants worth keeping — which fields a type shows, and that a
   PATCH never wipes a column the user did not touch — are asserted above
   against the new sheet. */
