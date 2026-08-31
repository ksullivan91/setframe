import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { PlansScreen } from '../screens/PlansScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useFocusEffect: () => {},
}));

let mockPost: (path: string) => Promise<unknown> = () => Promise.resolve({});
const programs = [
  { id: 'p-active', name: 'Lower/Upper', isActive: true, cycleLengthWeeks: null, startDate: null },
  { id: 'p-other', name: 'Push/Pull', isActive: false, cycleLengthWeeks: 4, startDate: '2026-08-01' },
];

jest.mock('../lib/api-client', () => ({
  ApiError: class extends Error {},
  useApiClient: () => ({
    get: () => Promise.resolve(programs),
    post: (path: string) => mockPost(path),
    patch: () => Promise.resolve({}),
    del: () => Promise.resolve(undefined),
  }),
}));

let tree: ReactTestRenderer | null = null;

async function render() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <PlansScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  return tree!;
}

/**
 * react-query settles across both microtasks and a macrotask turn.
 * Counting microtasks alone was flaky — it settled for two tests and not
 * the third, which is the kind of ordering dependence that makes a suite
 * untrustworthy rather than merely red.
 */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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

function pressable(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  );
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  mockBack.mockClear();
  mockPost = () => Promise.resolve({});
});

it('badges the active plan in words a person can decode', async () => {
  /* "Driving Today" was an attempt to say what the plan does rather than
     use the word Active. The first person to see it asked what it meant. */
  const text = allText(await render());
  expect(text).toContain('Active');
  expect(text).not.toContain('Driving Today');
});

it('switches plans and returns to Training', async () => {
  const calls: string[] = [];
  mockPost = (path) => {
    calls.push(path);
    return Promise.resolve({});
  };
  const rendered = await render();

  await act(async () => {
    pressable(rendered, 'use-plan-p-other')[0]!.props.onPress();
  });
  await flush();

  expect(calls).toEqual(['/programs/p-other/activate']);
  expect(mockBack).toHaveBeenCalled();
});

it('says so when switching fails instead of looking like a dead button', async () => {
  /* The mutation had no onError. A failed request produced no spinner, no
     message and no navigation — indistinguishable from a control that was
     never wired up, which is exactly how it was reported. */
  mockPost = () => Promise.reject(new Error('400'));
  const rendered = await render();

  await act(async () => {
    pressable(rendered, 'use-plan-p-other')[0]!.props.onPress();
  });
  await flush();

  expect(allText(rendered)).toContain('Could not switch plans');
  expect(mockBack).not.toHaveBeenCalled();
});

it('offers no switch button on the plan already in use', async () => {
  const rendered = await render();
  expect(pressable(rendered, 'use-plan-p-active')).toHaveLength(0);
});
