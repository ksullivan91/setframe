import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppleHealthCard } from '../components/AppleHealthCard';
import type { HealthConnection, HealthCardState } from '../healthkit/useHealthConnection';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function connection(overrides: Partial<HealthConnection> = {}): HealthConnection {
  return {
    state: 'not_connected' as HealthCardState,
    metrics: { steps: null, activeEnergyKcal: null, exerciseMinutes: null, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
    recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null, vo2Max: null, vo2MaxAt: null },
    body: { weightKg: null, heightCm: null, bodyFatPercent: null, biologicalSex: null, dateOfBirth: null, ageYears: null },
    nutritionSource: null,
    lastSyncedAt: null,
    hasMoreToGrant: false,
    unaskedGroups: [],
    connecting: false,
    connect: jest.fn(() => Promise.resolve()),
    refresh: jest.fn(() => Promise.resolve()),
    openHealthApp: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

let tree: ReactTestRenderer | null = null;

function render(conn: HealthConnection) {
  let rendered!: ReactTestRenderer;
  act(() => {
    rendered = create(
      <ThemeProvider>
        <AppleHealthCard connection={conn} />
      </ThemeProvider>,
    );
  });
  tree = rendered;
  return rendered;
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
  // JSX splits interpolated copy across several string children, so a
  // naive join leaves double spaces mid-sentence.
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function pressableByTestId(rendered: ReactTestRenderer, testID: string) {
  return rendered.root.findAll(
    (node) => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  );
}

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  mockPush.mockClear();
});

describe('AppleHealthCard', () => {
  it('offers a route into the flow when we have never asked', () => {
    const rendered = render(connection({ state: 'not_connected' }));
    const text = allText(rendered);

    expect(text).toContain('Not connected');
    expect(text).toContain('Connect Apple Health');
    // The promise that earns the tap has to actually be on screen.
    expect(text).toContain('Read only. Setframe never writes anything to Apple Health.');
    // Figma's second card: show what connecting would buy, don't describe it.
    expect(rendered.root.findAll((n) => n.props?.testID === 'health-preview').length).toBeGreaterThan(0);
  });

  it('pushes the priming screen rather than prompting straight away', () => {
    /* iOS grants one prompt per type, ever. Going straight to Apple's sheet
       from this button spends the single ask with no explanation first —
       the whole reason the priming screen exists. */
    const rendered = render(connection({ state: 'not_connected' }));

    act(() => {
      pressableByTestId(rendered, 'health-connect')[0]!.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith('/health-access');
  });

  it('shows real values with provenance once data arrives', () => {
    const rendered = render(
      connection({
        state: 'connected',
        metrics: { steps: 8432, activeEnergyKcal: 612, exerciseMinutes: 48, caloriesConsumedKcal: 2180, proteinG: null, carbsG: null, fatG: null },
        lastSyncedAt: new Date(),
      }),
    );
    const text = allText(rendered);

    expect(text).toContain('Synced');
    expect(text).toContain('8,432');
    expect(text).toContain('612 cal');
    expect(text).toContain('48 min');
    expect(text).toContain('2,180 cal');
    // Provenance, not decoration — HealthKit is authoritative for these.
    expect(text).toContain('From Apple Health');
    expect(rendered.root.findAll((n) => n.props?.testID === 'health-preview')).toHaveLength(0);
  });

  it('never claims access is off, because iOS will not tell us that', () => {
    /* The load-bearing assertion of this file. Apple deliberately makes a
       refused read indistinguishable from an empty store, so any copy that
       asserts "access is turned off" is a claim we cannot support. */
    const rendered = render(connection({ state: 'no_data' }));
    const text = allText(rendered);

    expect(text).toContain('No data yet');
    expect(text).toContain('iOS does not tell us');
    expect(text).toContain('Check access in Health');
    expect(text).not.toContain('turned off');
    expect(text).not.toContain('denied');
    expect(text).not.toContain('Declined');
  });

  it('routes to the Health app when there is nothing to show', () => {
    const openHealthApp = jest.fn(() => Promise.resolve());
    const rendered = render(connection({ state: 'no_data', openHealthApp }));

    act(() => {
      pressableByTestId(rendered, 'health-open-settings')[0]!.props.onPress();
    });

    expect(openHealthApp).toHaveBeenCalled();
  });

  it('reports partial data per metric without calling the gaps refusals', () => {
    const rendered = render(
      connection({
        state: 'connected',
        metrics: { steps: 8432, activeEnergyKcal: null, exerciseMinutes: 48, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
        lastSyncedAt: new Date(),
      }),
    );
    const text = allText(rendered);

    expect(text).toContain('8,432');
    // An absent value renders as an em dash, never as "Off" — we do not know
    // it was refused.
    expect(text).toContain('—');
    expect(text).not.toContain('Off');
    expect(text).toContain('2 metrics have no data for today.');
    expect(pressableByTestId(rendered, 'health-open-settings').length).toBeGreaterThan(0);
  });

  it('renders nothing at all where HealthKit does not exist', () => {
    const rendered = render(connection({ state: 'unavailable' }));
    expect(rendered.toJSON()).toBeNull();
  });

  it('shows a checking state rather than an empty claim while loading', () => {
    /* An empty state is a claim about the data. "Not connected" while we are
       still asking is the same defect that shipped on the Training screens. */
    const rendered = render(connection({ state: 'loading' }));
    const text = allText(rendered);

    expect(text).toContain('Checking Apple Health');
    expect(text).not.toContain('Not connected');
    expect(text).not.toContain('Connect Apple Health');
  });
});

describe('AppleHealthCard — server fallback', () => {
  const serverOnly = {
    proteinG: null,
    carbsG: null,
    fatG: null,
    steps: null,
    activeEnergyKcal: 480,
    exerciseMinutes: 30,
    caloriesConsumedKcal: 1900,
  };

  it('shows the reconciled snapshot when the device has nothing', () => {
    /* Before the rewrite the card read the server's activitySummary. If the
       new one only ever read HealthKit, a user whose data was synced from
       another device would watch numbers they had been seeing disappear. */
    let rendered!: ReactTestRenderer;
    act(() => {
      rendered = create(
        <ThemeProvider>
          <AppleHealthCard connection={connection({ state: 'no_data' })} fallback={serverOnly} />
        </ThemeProvider>,
      );
    });
    tree = rendered;
    const text = allText(rendered);

    expect(text).toContain('480 cal');
    expect(text).toContain('1,900 cal');
    // And it must stop reading as "nothing arrived", because something did.
    expect(text).not.toContain('No data yet');
    expect(text).toContain('Synced');
  });

  it('prefers a live device reading over the stored snapshot', () => {
    let rendered!: ReactTestRenderer;
    act(() => {
      rendered = create(
        <ThemeProvider>
          <AppleHealthCard
            connection={connection({
              state: 'connected',
              metrics: { steps: 9000, activeEnergyKcal: 700, exerciseMinutes: null, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
              lastSyncedAt: new Date(),
            })}
            fallback={serverOnly}
          />
        </ThemeProvider>,
      );
    });
    tree = rendered;
    const text = allText(rendered);

    expect(text).toContain('700 cal');
    expect(text).not.toContain('480 cal');
    // The gaps still fall back.
    expect(text).toContain('30 min');
  });
});

describe('AppleHealthCard — offering the rest', () => {
  it('names the one group that is actually missing', () => {
    /* A fixed label offered someone their own sleep data back the week
       workouts were added, which reads as the app losing track of what it
       already has. */
    const rendered = render(
      connection({ state: 'connected', metrics: { ...connection().metrics, steps: 100 }, hasMoreToGrant: true, unaskedGroups: ['workouts'] }),
    );
    const text = allText(rendered);
    expect(text).toContain('Share workouts');
    expect(text).not.toContain('sleep, heart and body');
  });

  it('falls back to a general offer when several groups are missing', () => {
    const rendered = render(
      connection({
        state: 'connected',
        metrics: { ...connection().metrics, steps: 100 },
        hasMoreToGrant: true,
        unaskedGroups: ['workouts', 'body measurements', 'macros'],
      }),
    );
    expect(allText(rendered)).toContain('Share more health data');
  });

  it('offers nothing when everything has been asked', () => {
    const rendered = render(
      connection({ state: 'connected', metrics: { ...connection().metrics, steps: 100 }, hasMoreToGrant: false, unaskedGroups: [] }),
    );
    expect(pressableByTestId(rendered, 'health-grant-more')).toHaveLength(0);
  });
});

describe('VO\u2082 max', () => {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  const withVo2 = (vo2Max: number | null, vo2MaxAt: string | null) =>
    connection({
      state: 'connected',
      metrics: { ...connection().metrics, steps: 4200 },
      recovery: { sleepMinutes: 438, hrvMs: 48, restingHeartRateBpm: 54, vo2Max, vo2MaxAt },
    });

  it('shows the reading', () => {
    expect(allText(render(withVo2(42.3, daysAgo(0))))).toContain('42.3');
  });

  it('says nothing about age when the reading is from today', () => {
    /* The absence of an age IS the statement that it is current — a
       "today" suffix on every other tile's neighbour is noise. */
    const text = allText(render(withVo2(42.3, daysAgo(0))));
    expect(text).toContain('VO\u2082 max');
    expect(text).not.toContain('ago');
    expect(text).not.toContain('yesterday');
  });

  it('says how old a stale reading is, at the right scale', () => {
    /* watchOS only estimates this during a qualifying outdoor workout, so
       months-old values are normal. A bare number would read as today's. */
    expect(allText(render(withVo2(42.3, daysAgo(1))))).toContain('yesterday');
    expect(allText(render(withVo2(42.3, daysAgo(3))))).toContain('3d ago');
    expect(allText(render(withVo2(42.3, daysAgo(21))))).toContain('3w ago');
    expect(allText(render(withVo2(42.3, daysAgo(120))))).toContain('4mo ago');
  });

  it('renders the tile with no date rather than inventing one', () => {
    const text = allText(render(withVo2(42.3, null)));
    expect(text).toContain('42.3');
    expect(text).not.toContain('ago');
  });

  it('keeps the recovery row when cardio fitness is the only reading', () => {
    // Otherwise the one number this person has is the one they cannot see.
    const text = allText(
      render(
        connection({
          state: 'connected',
          metrics: { ...connection().metrics, steps: 4200 },
          recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null, vo2Max: 38.7, vo2MaxAt: daysAgo(9) },
        }),
      ),
    );
    expect(text).toContain('38.7');
    expect(text).toContain('1w ago');
  });
});

describe('card title', () => {
  it('names Apple Health while connecting is the thing you do', () => {
    expect(allText(render(connection({ state: 'not_connected' })))).toContain('Apple Health');
  });

  it('names the content once data is flowing, not the source', () => {
    /* Where it came from is said in the provenance line underneath. A
       permanent "Apple Health" heading also makes the card read as
       Apple's, which it is not. */
    const text = allText(
      render(connection({ state: 'connected', metrics: { ...connection().metrics, steps: 4200 } })),
    );
    expect(text).toContain('Health metrics');
  });
});
