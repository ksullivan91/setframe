import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UpcomingDaysSchedule } from '../components/UpcomingDaysSchedule';

const mockPost = jest.fn(() => Promise.resolve({}));
const mockDel = jest.fn(() => Promise.resolve({}));
let mockDays: Record<string, unknown> = {};

jest.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => {
      const date = path.split('localDate=')[1] ?? '';
      return Promise.resolve(
        mockDays[date] ?? { localDate: date, dayLabel: null, sessions: [], restDay: null },
      );
    },
    post: mockPost,
    del: mockDel,
    patch: jest.fn(),
  }),
}));

const TODAY = '2026-08-26';

let tree: ReactTestRenderer | null = null;
let client: QueryClient | null = null;

/**
 * Waits for every in-flight query to settle and for React to flush.
 *
 * A single `await act(async () => ...)` only drains one microtask round,
 * which is not enough for fourteen parallel queries — asserting there finds a
 * component still in its loading state and reports it as a missing control.
 */
async function settle(active: QueryClient) {
  for (let attempt = 0; attempt < 20 && active.isFetching() > 0; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderSchedule() {
  const active = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client = active;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={active}>
        <ThemeProvider>
          <UpcomingDaysSchedule localDate={TODAY} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await settle(active);
  return tree!;
}

function byTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.type === 'string',
  );
}

function pressablesByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  );
}

/**
 * Flattens every string in the rendered output. Stringifying raw props throws
 * on a circular structure the moment a node holds React elements rather than
 * plain strings.
 */
function allText(rendered: ReactTestRenderer): string {
  const collect = (node: unknown): string => {
    if (node == null || node === false) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(collect).join(' ');
    const children = (node as { children?: unknown }).children;
    return children === undefined ? '' : collect(children);
  };
  return collect(rendered.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDays = {};
});

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  client?.clear();
  client = null;
});

/**
 * Story 55's last gap. Story 21 built rest-day scheduling for web only,
 * because mobile's program editor was read-only at the time; Training is the
 * editor now, so that rationale is gone. Mirrors the web component's
 * behaviour exactly — same endpoints, same eligibility rule.
 */
describe('UpcomingDaysSchedule', () => {
  it('shows a window of past and future days, with today marked', async () => {
    const rendered = await renderSchedule();
    // 3 back + today + 10 forward.
    expect(byTestId(rendered, 'upcoming-day-row')).toHaveLength(14);
    expect(allText(rendered)).toContain('Today');
  });

  it('marks a day as rest', async () => {
    const rendered = await renderSchedule();
    await act(async () => {
      pressablesByTestId(rendered, 'upcoming-day-toggle')[0]!.props.onPress();
    });
    expect(mockPost).toHaveBeenCalledWith('/rest-days', expect.objectContaining({
      localDate: '2026-08-23',
    }));
  });

  it('clears rest on a day already marked', async () => {
    mockDays['2026-08-23'] = {
      localDate: '2026-08-23',
      dayLabel: null,
      sessions: [],
      restDay: { id: 'r1', localDate: '2026-08-23' },
    };
    const rendered = await renderSchedule();
    const toggle = pressablesByTestId(rendered, 'upcoming-day-toggle')[0]!;
    expect(toggle.props.accessibilityLabel).toContain('Clear rest');
    await act(async () => {
      toggle.props.onPress();
    });
    expect(mockDel).toHaveBeenCalledWith('/rest-days/2026-08-23');
  });

  it('offers no rest toggle on a day already trained', async () => {
    // Training and rest are contradictory; the server rejects it too.
    mockDays['2026-08-23'] = {
      localDate: '2026-08-23',
      dayLabel: 'Lower A',
      sessions: [{ status: 'completed' }],
      restDay: null,
    };
    const rendered = await renderSchedule();
    expect(allText(rendered)).toContain('Trained');
    expect(pressablesByTestId(rendered, 'upcoming-day-toggle')).toHaveLength(13);
  });

  it('still allows rest on a day whose only session was abandoned', async () => {
    /* An abandoned session is not training, and `POST /v1/rest-days` makes
       the same distinction server-side — so the client must not be stricter
       than the API it calls. */
    mockDays['2026-08-23'] = {
      localDate: '2026-08-23',
      dayLabel: null,
      sessions: [{ status: 'abandoned' }],
      restDay: null,
    };
    const rendered = await renderSchedule();
    expect(pressablesByTestId(rendered, 'upcoming-day-toggle')).toHaveLength(14);
  });
});
