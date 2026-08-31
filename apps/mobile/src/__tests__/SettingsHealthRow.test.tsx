import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import SettingsScreen from '../../app/(tabs)/settings';

/**
 * The Apple Health rows on Settings.
 *
 * They used to render `integration_sync_state.status` from the server,
 * which stays `never_synced` because nothing posts a reconcile payload —
 * so a user looking at their own step count on Today was told here that
 * Apple Health was "Not connected" and last synced "Never". Both false
 * from where they were standing.
 */
let mockState = 'connected';
let mockLastSyncedAt: Date | null = new Date();

jest.mock('../healthkit/useHealthConnection', () => ({
  useHealthConnection: () => ({
    state: mockState,
    metrics: {},
    recovery: {},
    body: {},
    nutritionSource: null,
    lastSyncedAt: mockLastSyncedAt,
    hasMoreToGrant: false,
    unaskedGroups: [],
    connecting: false,
    connect: jest.fn(),
    refresh: jest.fn(),
    openHealthApp: jest.fn(),
  }),
}));

jest.mock('@clerk/clerk-expo', () => ({
  useClerk: () => ({}),
  useAuth: () => ({ signOut: jest.fn() }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'a@b.c' } } }),
}));

jest.mock('../lib/api-client', () => ({
  ApiError: class extends Error {},
  useApiClient: () => ({
    get: () => Promise.resolve({}),
    post: () => Promise.resolve({}),
    patch: () => Promise.resolve({}),
    del: () => Promise.resolve(undefined),
  }),
}));

let tree: ReactTestRenderer | null = null;

async function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SettingsScreen />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return tree!;
}

function allText(rendered: ReactTestRenderer): string {
  const parts: string[] = [];
  rendered.root.findAll((node) => {
    if (typeof node.type !== 'string') return false;
    ([] as unknown[]).concat(node.props?.children).forEach((child) => {
      if (typeof child === 'string') parts.push(child);
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
  mockState = 'connected';
  mockLastSyncedAt = new Date();
});

it('says connected when this phone can read Apple Health', async () => {
  const text = allText(await renderSettings());
  expect(text).toContain('Connected');
  expect(text).not.toContain('Not connected');
});

it('does not claim the last read was never when one just happened', async () => {
  const text = allText(await renderSettings());
  expect(text).not.toContain('Never');
});

it('still says not connected when we genuinely have not asked', async () => {
  mockState = 'not_connected';
  mockLastSyncedAt = null;
  const text = allText(await renderSettings());
  expect(text).toContain('Not connected');
});

it('distinguishes connected-but-empty from not connected', async () => {
  /* "No data today" is a different fact from "no access", and conflating
     them is what sent the user looking for a connection problem that did
     not exist. */
  mockState = 'no_data';
  const text = allText(await renderSettings());
  expect(text).toContain('Connected, no data today');
});
