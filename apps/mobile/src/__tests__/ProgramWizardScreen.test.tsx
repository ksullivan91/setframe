import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import ProgramWizardScreen from '../../app/program-wizard';

const mockPush = jest.fn();
let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve([]);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: jest.fn(async () => ({})),
    patch: jest.fn(async () => ({})),
    del: jest.fn(async () => undefined),
  }),
}));

function textNodesContaining(rendered: ReactTestRenderer, needle: string) {
  return rendered.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      ([] as unknown[])
        .concat(node.props?.children)
        .some((child) => typeof child === 'string' && child.includes(needle)),
  );
}

let tree: ReactTestRenderer | null = null;

async function renderScreen(): Promise<ReactTestRenderer> {
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
