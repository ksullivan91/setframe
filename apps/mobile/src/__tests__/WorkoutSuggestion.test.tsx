import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TodayAdditionalActivitySection } from '../components/TodayAdditionalActivitySection';
import type { DiscoveredWorkout } from '../healthkit/workout-discovery';

/**
 * The Apple Health suggestion row, as it actually renders.
 *
 * All three defects reported from the device shipped past a green suite:
 * the Dismiss button was absent (Button defaults to `fullWidth`, so the
 * first one took the whole row), "Add to today" appeared to do nothing (the
 * API discarded the external id, so the suggestion never cleared), and the
 * block looked nothing like the design. None of the earlier tests rendered
 * this component at all — they tested the pure partition logic instead.
 */
const walk: DiscoveredWorkout = {
  externalId: 'hk-walk',
  appleType: 52,
  activityType: 'walk',
  title: 'Outdoor Walk',
  startedAt: '2026-08-31T12:42:00.000Z',
  endedAt: '2026-08-31T12:59:00.000Z',
  durationSeconds: 1020,
  distanceValue: 0.8,
  distanceUnit: 'mi',
  caloriesKcal: 64,
  avgHeartRateBpm: 118,
  peakHeartRateBpm: 141,
};

const mockDismiss = jest.fn();
let mockSuggestions: DiscoveredWorkout[] = [walk];

jest.mock('../healthkit/useWorkoutDiscovery', () => ({
  useWorkoutDiscovery: () => ({
    canRead: true,
    suggestions: mockSuggestions,
    suppressed: [],
    dismiss: mockDismiss,
    grant: jest.fn(),
    granting: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: () => {},
}));

const posted: { path: string; body: unknown }[] = [];
let mockItems: unknown[] = [];
jest.mock('../lib/api-client', () => ({
  ApiError: class extends Error {},
  useApiClient: () => ({
    get: () => Promise.resolve({ items: mockItems }),
    post: (path: string, body?: unknown) => {
      posted.push({ path, body });
      return Promise.resolve({});
    },
    patch: () => Promise.resolve({}),
    del: () => Promise.resolve(undefined),
  }),
}));

let tree: ReactTestRenderer | null = null;

async function render() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TodayAdditionalActivitySection localDate="2026-08-31" sessions={[]} isToday />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  return tree!;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function pressable(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  );
}

function hostByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (n) => n.props?.testID === testID && typeof n.type === 'string',
  );
}

function allText(rendered: ReactTestRenderer): string {
  const parts: string[] = [];
  rendered.root.findAll((n) => {
    if (typeof n.type !== 'string') return false;
    ([] as unknown[]).concat(n.props?.children).forEach((c) => {
      if (typeof c === 'string') parts.push(c);
    });
    return false;
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  mockDismiss.mockClear();
  posted.length = 0;
  mockSuggestions = [walk];
  mockItems = [];
});

it('renders both actions, and neither one takes the whole row', async () => {
  /* The reported defect. `Button` defaults to fullWidth, so two side by
     side each asked for 100% and the second was pushed off screen. Asserting
     presence alone would not have caught it — the width is the bug. */
  const rendered = await render();

  expect(pressable(rendered, 'workout-add-hk-walk')).toHaveLength(1);
  expect(pressable(rendered, 'workout-dismiss-hk-walk')).toHaveLength(1);

  for (const id of ['workout-add-hk-walk', 'workout-dismiss-hk-walk']) {
    const styles = hostByTestId(rendered, id)[0]!.props.style;
    const flat = JSON.stringify(styles);
    expect(flat).not.toContain('"width":"100%"');
    expect(flat).toContain('flexGrow');
  }
});

it('shows the workout the way the design describes it', async () => {
  const text = allText(await render());
  expect(text).toContain('FOUND IN APPLE HEALTH');
  expect(text).toContain('Outdoor Walk');
  expect(text).toContain('17 min');
  expect(text).toContain('0.8 mi');
  expect(text).toContain('Add to today');
  expect(text).toContain('Dismiss');
});

it('sends provenance and the dedupe key when adding', async () => {
  /* Without externalSourceId the server records the row as manual, dedupe
     never matches, the suggestion never clears, and the button reads as
     dead — which is exactly how it was reported. */
  const rendered = await render();

  await act(async () => {
    pressable(rendered, 'workout-add-hk-walk')[0]!.props.onPress();
  });
  await flush();

  expect(posted).toHaveLength(1);
  expect(posted[0]!.path).toBe('/additional-activities');
  expect(posted[0]!.body).toMatchObject({
    source: 'apple_health',
    externalSourceId: 'hk-walk',
    activityType: 'walk',
    title: 'Outdoor Walk',
  });
});

it('dismisses without touching the server', async () => {
  const rendered = await render();

  await act(async () => {
    pressable(rendered, 'workout-dismiss-hk-walk')[0]!.props.onPress();
  });

  expect(mockDismiss).toHaveBeenCalledWith('hk-walk');
  expect(posted).toHaveLength(0);
});

it('shows nothing when there is nothing to suggest', async () => {
  mockSuggestions = [];
  const rendered = await render();
  expect(allText(rendered)).not.toContain('FOUND IN APPLE HEALTH');
});

describe('parity with Figma 211:857 / 211:867 / 211:865', () => {
  const logged = {
    id: 'act-1',
    localDate: '2026-08-31',
    timezone: 'UTC',
    startedAt: '2026-08-31T08:10:00.000Z',
    durationSeconds: 1320,
    activityType: 'walk',
    source: 'apple_health',
    title: 'Morning Walk',
    distanceValue: null,
    distanceUnit: null,
    caloriesKcal: null,
    notes: null,
    externalSourceId: 'hk-morning',
    createdAt: '2026-08-31T08:10:00.000Z',
    updatedAt: '2026-08-31T08:10:00.000Z',
  };

  it('puts what is already logged above what was found', async () => {
    /* Figma 211:857 orders the card head → logged row → suggestions → hint.
       Ours rendered suggestions first, so an offer sat above the record of
       what the user actually did. */
    mockItems = [logged];
    const text = allText(await render());

    expect(text.indexOf('Morning Walk')).toBeGreaterThan(-1);
    expect(text.indexOf('FOUND IN APPLE HEALTH')).toBeGreaterThan(-1);
    expect(text.indexOf('Morning Walk')).toBeLessThan(text.indexOf('FOUND IN APPLE HEALTH'));
  });

  it('badges an imported activity instead of listing the source as text', async () => {
    /* 211:867 draws "Apple Health" as a tinted pill beside the detail line.
       Ours joined it into the detail string with a middle dot. */
    mockItems = [logged];
    const rendered = await render();

    expect(hostByTestId(rendered, 'activity-source-act-1').length).toBeGreaterThan(0);
    expect(allText(rendered)).not.toContain('22 min · Apple Health');
  });

  it('reads the detail in the order the design does', async () => {
    // 211:867: time, then duration. Ours had duration first.
    // Asserted structurally, not against a literal clock time: the fixture
    // is UTC and the runner is not, so "8:10 AM" only held in one timezone.
    mockItems = [logged];
    const text = allText(await render());
    expect(text).toMatch(/\d{1,2}:\d{2}\s?(AM|PM) · 22 min/);
  });

  it('counts the suggestions when there is more than one', async () => {
    // 211:857 says "Two more found today"; 211:836 reassures instead.
    mockSuggestions = [walk, { ...walk, externalId: 'hk-yoga', title: 'Yoga' }];
    expect(allText(await render())).toContain('Two more found today');
  });

  it('reassures rather than counting when there is only one', async () => {
    expect(allText(await render())).toContain('Setframe never adds these on its own.');
  });
});
