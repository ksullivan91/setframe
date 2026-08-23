import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import ProgramWizardScreen from '../../app/program-wizard';

const mockPush = jest.fn();
let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve([]);
let mockPost: (path: string, body?: unknown) => Promise<unknown> = () => Promise.resolve({});
let mockPatch: (path: string, body?: unknown) => Promise<unknown> = () => Promise.resolve({});
let mockDel: (path: string) => Promise<unknown> = () => Promise.resolve(undefined);
let dayTypeIdCounter = 0;
let dayTypeExercisesById: Record<string, unknown[]> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: (path: string, body?: unknown) => mockPatch(path, body),
    del: (path: string) => mockDel(path),
  }),
}));

function textNodesContaining(rendered: ReactTestRenderer, needle: string) {
  return rendered.root.findAll((node) => {
    if (typeof node.type !== 'string') return false;
    // JSX interpolation (`Remove {name}?`) splits into separate string/number
    // children rather than one joined string — join them before searching,
    // or a needle spanning an interpolation boundary never matches.
    const joined = ([] as unknown[])
      .concat(node.props?.children)
      .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
      .join('');
    return joined.includes(needle);
  });
}

function pressableByLabel(rendered: ReactTestRenderer, label: string) {
  return rendered.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  )[0];
}

let tree: ReactTestRenderer | null = null;

async function renderScreen(): Promise<ReactTestRenderer> {
  dayTypeIdCounter = 0;
  dayTypeExercisesById = {};
  mockGet = (path: string) => {
    if (path.startsWith('/day-types/')) {
      const id = path.split('/').pop()!;
      return Promise.resolve({ id, name: 'Workout', exercises: dayTypeExercisesById[id] ?? [] });
    }
    return Promise.resolve([]);
  };
  mockPost = (path: string, body?: unknown) => {
    if (path === '/programs') {
      return Promise.resolve({ id: 'program-1', name: (body as { name: string }).name, isActive: true, cycleLengthWeeks: null });
    }
    if (path === '/day-types') {
      dayTypeIdCounter += 1;
      return Promise.resolve({ id: `day-type-${dayTypeIdCounter}`, name: (body as { name: string }).name });
    }
    return Promise.resolve({});
  };
  mockPatch = (path: string, body?: unknown) => {
    if (path.startsWith('/day-types/')) return Promise.resolve({ id: path.split('/').pop(), name: (body as { name: string }).name });
    return Promise.resolve({});
  };
  mockDel = () => Promise.resolve(undefined);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ProgramWizardScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree!;
}

async function flush(rendered: ReactTestRenderer) {
  // Several ticks, not one — some flows here chain more than one await
  // (e.g. requestRemoveWorkout's api.get().catch() before its state update).
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return rendered;
}

function pressableContainingText(rendered: ReactTestRenderer, text: string) {
  // Take the LAST match, not the first: `findAll` visits outer nodes before
  // inner ones, and here an outer Pressable (Toast's own onDismiss) also
  // "contains" the inner Undo Pressable's text in its subtree — the inner,
  // most specific match is the one actually labeled by this text.
  const matches = rendered.root.findAll(
    (node) =>
      typeof node.props?.onPress === 'function' &&
      node.findAll(
        (child) =>
          typeof child.type === 'string' &&
          ([] as unknown[]).concat(child.props?.children).some((c) => c === text),
      ).length > 0,
  );
  return matches[matches.length - 1];
}

async function reachWorkoutsStep(): Promise<ReactTestRenderer> {
  const rendered = await renderScreen();
  await act(async () => {
    pressableByLabel(rendered, 'Next')!.props.onPress();
  });
  await flush(rendered);
  return rendered;
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

/**
 * Story 17 (mobile parity) — the same containment example and step
 * descriptions added to the web wizard, plus the parity gap the explore
 * pass found: mobile's step indicator previously dropped `description`
 * entirely.
 */
describe('ProgramWizardScreen hierarchy copy', () => {
  it('shows the persistent Program → Workout → Exercise hierarchy example', async () => {
    const rendered = await renderScreen();
    expect(textNodesContaining(rendered, '4-Day Strength Plan').length).toBeGreaterThan(0);
  });

  it('shows the current step description under the step indicator (parity gap fix)', async () => {
    const rendered = await renderScreen();
    // Previously the mobile step indicator rendered only "Step 1 of 4 ·
    // Program" with no description at all, unlike web's Stepper.
    expect(textNodesContaining(rendered, 'Your overall training plan over time').length).toBeGreaterThan(0);
  });
});

/** Story 18 (mobile parity) — same create/rename/remove/undo flow as web. */
describe('ProgramWizardScreen workout create/rename/remove/undo', () => {
  function workoutNameInput(rendered: ReactTestRenderer) {
    return rendered.root.findAll(
      (node) => node.props?.placeholder === 'Upper A' && typeof node.props?.onChangeText === 'function',
    )[0];
  }

  async function addWorkout(rendered: ReactTestRenderer, name: string) {
    await act(async () => {
      workoutNameInput(rendered)!.props.onChangeText(name);
    });
    await act(async () => {
      pressableByLabel(rendered, 'Add workout')!.props.onPress();
    });
    await flush(rendered);
  }

  it('keeps Add Workout usable for a second workout and rejects a duplicate name', async () => {
    const rendered = await reachWorkoutsStep();

    await addWorkout(rendered, 'Push');
    expect(textNodesContaining(rendered, 'Push').length).toBeGreaterThan(0);

    await addWorkout(rendered, 'Pull');
    expect(textNodesContaining(rendered, 'Pull').length).toBeGreaterThan(0);

    await addWorkout(rendered, 'push');
    expect(textNodesContaining(rendered, 'already exists').length).toBeGreaterThan(0);
  });

  it('renames a workout via its actions sheet', async () => {
    const rendered = await reachWorkoutsStep();
    await addWorkout(rendered, 'Push');

    await act(async () => {
      pressableByLabel(rendered, 'Actions for Push')!.props.onPress();
    });
    await flush(rendered);
    await act(async () => {
      pressableByLabel(rendered, 'Rename')!.props.onPress();
    });
    await flush(rendered);

    const renameInput = rendered.root.findAll(
      (node) => node.props?.value === 'Push' && typeof node.props?.onChangeText === 'function',
    )[0]!;
    await act(async () => {
      // Deliberately not "Upper Push" — it contains "Push" as a substring,
      // which would make the disappearance assertion below meaningless.
      renameInput.props.onChangeText('Legs');
    });
    await act(async () => {
      pressableByLabel(rendered, 'Save')!.props.onPress();
    });
    await flush(rendered);

    expect(textNodesContaining(rendered, 'Legs').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'Push').length).toBe(0);
  });

  it('removes an empty workout immediately and restores it on undo', async () => {
    const rendered = await reachWorkoutsStep();
    await addWorkout(rendered, 'Push');

    await act(async () => {
      pressableByLabel(rendered, 'Actions for Push')!.props.onPress();
    });
    await flush(rendered);
    await act(async () => {
      pressableByLabel(rendered, 'Remove')!.props.onPress();
    });
    await flush(rendered);

    expect(textNodesContaining(rendered, 'Push').length).toBe(0);
    expect(textNodesContaining(rendered, 'Workout removed.').length).toBeGreaterThan(0);

    await act(async () => {
      pressableContainingText(rendered, 'Undo')!.props.onPress();
    });
    await flush(rendered);
    expect(textNodesContaining(rendered, 'Push').length).toBeGreaterThan(0);
  });

  it('warns about exercise loss before removing a workout that has exercises', async () => {
    const rendered = await reachWorkoutsStep();
    await addWorkout(rendered, 'Push');
    dayTypeExercisesById['day-type-1'] = [{ id: 'ex-1' }, { id: 'ex-2' }];

    await act(async () => {
      pressableByLabel(rendered, 'Actions for Push')!.props.onPress();
    });
    await flush(rendered);
    await act(async () => {
      pressableByLabel(rendered, 'Remove')!.props.onPress();
    });
    await flush(rendered);

    expect(textNodesContaining(rendered, 'Remove Push?').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'has 2 exercise').length).toBeGreaterThan(0);
    // Still there — not removed until the confirm sheet's own button is pressed.
    expect(textNodesContaining(rendered, 'Push').length).toBeGreaterThan(0);

    await act(async () => {
      pressableByLabel(rendered, 'Remove workout')!.props.onPress();
    });
    await flush(rendered);
    expect(textNodesContaining(rendered, 'Remove Push?').length).toBe(0);
  });
});
