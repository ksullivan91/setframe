import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Exercise } from '@setframe/schemas';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MovementPatternField } from '../screens/ExerciseHistoryScreen';

const mockPatch = jest.fn(() => Promise.resolve({}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ exerciseId: '11111111-1111-4111-8111-111111111111' }),
}));

jest.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: jest.fn(() => Promise.resolve([])),
    post: jest.fn(),
    patch: mockPatch,
    del: jest.fn(),
  }),
}));

/* The field is exercised directly rather than through a full screen mount.
   That matches how every other mobile screen is tested here (see
   ProgressScreen.test.tsx), and avoids racing react-query's own scheduling
   for a component whose behaviour has nothing to do with fetching. */
const custom = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Backyard Sled Push',
  movementPattern: null,
  isCustom: true,
} as unknown as Exercise;

let tree: ReactTestRenderer | null = null;
let client: QueryClient | null = null;

function renderField(exercise: Exercise) {
  const active = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client = active;
  act(() => {
    tree = create(
      <QueryClientProvider client={active}>
        <ThemeProvider>
          <MovementPatternField exercise={exercise} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return tree!;
}

function hostsByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

/**
 * Drives the `Select`'s `onChange` directly rather than tapping through its
 * option sheet. Reaching into the sheet made the assertion conditional —
 * "if the option is reachable check the call, otherwise check something
 * weaker" — which passes whether or not the wiring works.
 */
async function choose(rendered: ReactTestRenderer, value: string) {
  const select = rendered.root.findAll(
    (node) =>
      node.props?.testID === 'movement-pattern-select' &&
      typeof node.props?.onChange === 'function',
  )[0]!;
  await act(async () => {
    select.props.onChange(value);
  });
}

beforeEach(() => jest.clearAllMocks());

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  /* A QueryClient keeps its cache's garbage-collection timers alive after the
     tree unmounts. Left running they hold the Jest worker open, which turns
     into a hung run rather than a reported failure — the same class of
     silent-config problem that made eight suites unrunnable earlier. */
  client?.clear();
  client?.unmount();
  client = null;
});

/**
 * Story 57 — the mobile half. Mirrors ExerciseHistoryPage.test.tsx so parity
 * is tested rather than intended.
 */
describe('MovementPatternField', () => {
  it('offers a movement pattern for the user’s own custom exercise', () => {
    const rendered = renderField(custom);
    expect(hostsByTestId(rendered, 'movement-pattern-field').length).toBeGreaterThan(0);
  });

  it('hides the control for a system exercise the API would refuse to edit', () => {
    // Showing a control that always fails is worse than showing none.
    const rendered = renderField({ ...custom, isCustom: false } as Exercise);
    expect(rendered.toJSON()).toBeNull();
  });

  it('saves the chosen pattern', async () => {
    const rendered = renderField(custom);
    await choose(rendered, 'hinge');
    expect(mockPatch).toHaveBeenCalledWith(`/exercises/${custom.id}`, {
      movementPattern: 'hinge',
    });
  });

  it('sends null when cleared, rather than an empty string', async () => {
    /* `''` is not "unset" — storing it would create a nameless pattern key
       that groups as its own band on the composition chart. */
    const rendered = renderField({ ...custom, movementPattern: 'hinge' } as Exercise);
    await choose(rendered, '');
    expect(mockPatch).toHaveBeenCalledWith(`/exercises/${custom.id}`, { movementPattern: null });
  });

  it('tells the user that leaving it unset is legitimate', () => {
    const rendered = renderField(custom);
    const help = hostsByTestId(rendered, 'movement-pattern-help')[0]!;
    expect(JSON.stringify(help.props.children)).toContain('Leave it unset rather than guessing');
  });
});
