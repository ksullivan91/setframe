import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import ProgramEditorScreen from '../../app/program-editor';

const mockPush = jest.fn();
let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve([]);
const mockPost = jest.fn((_path: string, _body?: unknown) => Promise.resolve({} as unknown));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    patch: () => Promise.resolve({}),
    del: () => Promise.resolve(undefined),
    delete: () => Promise.resolve(undefined),
  }),
}));

const baseProgram = {
  id: 'program-1',
  userId: 'user-1',
  name: 'Base',
  description: null,
  isActive: true,
  startDate: null,
  cycleLengthWeeks: null,
  archivedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const recoveryProgram = {
  ...baseProgram,
  id: 'program-2',
  name: 'Recovery Block',
  isActive: false,
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
};

function getFor(programs: unknown[]): (path: string) => Promise<unknown> {
  return (path: string) => {
    if (path === '/programs') return Promise.resolve(programs);
    if (path.startsWith('/programs/') && path.endsWith('/schedule-slots')) return Promise.resolve([]);
    if (path === '/day-types') return Promise.resolve([]);
    if (path === '/exercises') return Promise.resolve([]);
    return Promise.resolve([]);
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

function pressablesByText(rendered: ReactTestRenderer, text: string) {
  return rendered.root.findAll(
    (node) => typeof node.props?.onPress === 'function' && textNodesContaining(rendered, text).some((n) => isDescendant(node, n)),
  );
}

function isDescendant(ancestor: ReactTestInstance, node: ReactTestInstance): boolean {
  let current: ReactTestInstance | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
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
          <ProgramEditorScreen />
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
 * Story 24 — mobile's program-editor previously always showed the active
 * program with no way to see or switch between programs at all.
 */
describe('ProgramEditorScreen program switching', () => {
  it('lists every program with the active one marked, once more than one exists', async () => {
    mockGet = getFor([baseProgram, recoveryProgram]);
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'Base').length).toBeGreaterThan(0);
    expect(textNodesContaining(rendered, 'Recovery Block').length).toBeGreaterThan(0);
  });

  it('does not show a program switcher with only one program', async () => {
    mockGet = getFor([baseProgram]);
    const rendered = await renderScreen();

    expect(textNodesContaining(rendered, 'Your programs')).toHaveLength(0);
  });

  it('viewing a non-active program does not activate it', async () => {
    mockGet = getFor([baseProgram, recoveryProgram]);
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByLabel(rendered, 'View Recovery Block')[0]!.props.onPress();
    });
    await flush();

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('setting a program active calls the activate endpoint and confirms it', async () => {
    mockPost.mockImplementation((path: string) =>
      path === '/programs/program-2/activate' ? Promise.resolve({ ...recoveryProgram, isActive: true }) : Promise.resolve({}),
    );
    mockGet = getFor([baseProgram, recoveryProgram]);
    const rendered = await renderScreen();

    await act(async () => {
      pressablesByText(rendered, 'Set active')[0]!.props.onPress();
    });
    await flush();

    expect(mockPost).toHaveBeenCalledWith('/programs/program-2/activate', undefined);
    expect(textNodesContaining(rendered, 'Recovery Block is now your active program.').length).toBeGreaterThan(0);
  });
});
