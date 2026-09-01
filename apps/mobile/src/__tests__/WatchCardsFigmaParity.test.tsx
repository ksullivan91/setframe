import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { effortChart, heartRateChart, heartRateZoneColors } from '@setframe/design-tokens';
import { zoneBands } from '@setframe/domain';
import { ThemeProvider } from '../theme/ThemeProvider';
import { WatchSummaryCard } from '../components/watch/WatchSummaryCard';
import { HeartRateCard } from '../components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../components/watch/EffortByExerciseCard';
import { WatchAttachCard } from '../components/watch/WatchAttachCard';

/**
 * Copy and geometry parity with Figma `265:2` — the assembled
 * completed-workout screen.
 *
 * The strings and numbers below were read out of the Figma nodes, not
 * retyped, so this fails if either side drifts. Copy and geometry are what
 * can be honestly checked here: nothing renders these on a device, and jest
 * does no layout.
 */
let tree: ReactTestRenderer | null = null;

function render(node: React.ReactElement) {
  act(() => {
    tree = create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return tree!;
}
function allText(rendered: ReactTestRenderer): string {
  const parts: string[] = [];
  rendered.root.findAll((n) => {
    if (typeof n.type !== 'string') return false;
    ([] as unknown[]).concat(n.props?.children).forEach((c) => {
      if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    });
    return false;
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
function byTestId(rendered: ReactTestRenderer, id: string) {
  return rendered.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
}

afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

const workout = {
  id: 'w1',
  sessionId: 's1',
  externalId: 'hk-1',
  activityType: 'other',
  appleActivityType: 50,
  title: 'Traditional Strength Training',
  startedAt: '2026-09-01T17:32:00.000Z',
  endedAt: '2026-09-01T18:36:00.000Z',
  durationSeconds: 3840,
  activeEnergyKcal: 612,
  totalEnergyKcal: 842,
  avgHeartRateBpm: 142,
  peakHeartRateBpm: 171,
  minHeartRateBpm: 96,
  distanceValue: null,
  distanceUnit: null,
  deviceName: 'Series 9',
  createdAt: '2026-09-01T18:40:00.000Z',
  updatedAt: '2026-09-01T18:40:00.000Z',
};

describe('WatchSummaryCard · Figma 265:2 › WatchSummary', () => {
  it('renders three tiles, in order', () => {
    const text = allText(render(<WatchSummaryCard workouts={[workout]} />));
    for (const s of ['From your Watch', 'Series 9', '612', 'Active kcal', '142', 'Avg HR', '171', 'Peak HR']) {
      expect(text).toContain(s);
    }
    const order = ['Active kcal', 'Avg HR', 'Peak HR'].map((l) => text.indexOf(l));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('carries no Total kcal tile — HealthKit has no such number', () => {
    /* `HKWorkout.totalEnergyBurned` IS the active energy, so the tile could
       only ever render a dash: nothing populated it, and on the device it
       always showed "—". A real total is active + basal, a second query and
       a second permission. Four tiles also wrapped every label onto two
       lines at 390pt, which is what made the row look broken. */
    const text = allText(render(<WatchSummaryCard workouts={[{ ...workout, totalEnergyKcal: 842 }]} />));
    expect(text).not.toContain('Total kcal');
    expect(text).not.toContain('842');
  });

  it('keeps every tile label on one line', () => {
    // A wrapped label makes its tile taller than its neighbours.
    const rendered = render(<WatchSummaryCard workouts={[workout]} />);
    const labels = rendered.root.findAll(
      (n) => typeof n.type === 'string' && typeof n.props?.children === 'string'
        && ['Active kcal', 'Avg HR', 'Peak HR'].includes(n.props.children),
    );
    expect(labels).toHaveLength(3);
    for (const l of labels) expect(l.props.numberOfLines).toBe(1);
  });

  it('names the workout and its duration underneath', () => {
    expect(allText(render(<WatchSummaryCard workouts={[workout]} />))).toContain(
      'Traditional Strength Training · 1h 04m, attached to this session.',
    );
  });

  it('weights the average heart rate by duration, not by workout', () => {
    /* A four-minute walk and a sixty-four-minute lift are not two equal
       opinions about the session's heart rate. */
    const walk = { ...workout, id: 'w2', externalId: 'hk-2', durationSeconds: 240, avgHeartRateBpm: 90 };
    const text = allText(render(<WatchSummaryCard workouts={[workout, walk]} />));
    // Weighted: (142×3840 + 90×240) / 4080 ≈ 139. A plain mean would say 116.
    expect(text).toContain('139');
    expect(text).not.toContain('116');
  });

  it('lists each attached workout with a Remove control, like a Today row', () => {
    const second = { ...workout, id: 'w2', externalId: 'hk-2', title: 'Outdoor Walk' };
    const rendered = render(
      <WatchSummaryCard workouts={[workout, second]} onRemove={jest.fn()} />,
    );
    expect(byTestId(rendered, 'watch-attached-w1')).toHaveLength(1);
    expect(byTestId(rendered, 'watch-attached-w2')).toHaveLength(1);
    const text = allText(rendered);
    expect(text).toContain('Outdoor Walk');
  });

  it('confirms before detaching — a tap never removes on its own', () => {
    /* Same shape as removing a logged activity on Today: Alert with Cancel
       and a destructive Remove, and the mutation only runs from the latter. */
    const onRemove = jest.fn();
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rendered = render(<WatchSummaryCard workouts={[workout]} onRemove={onRemove} />);

    act(() => {
      rendered.root
        .findAll((n) => n.props?.accessibilityLabel === `Remove ${workout.title}`
          && typeof n.props?.onPress === 'function')[0]!
        .props.onPress();
    });

    expect(onRemove).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    const buttons = spy.mock.calls[0]![2] as { text: string; style?: string; onPress?: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Remove']);
    expect(buttons[1]!.style).toBe('destructive');

    act(() => buttons[1]!.onPress!());
    expect(onRemove).toHaveBeenCalledWith('w1');
    spy.mockRestore();
  });

  it('shows no rows when removal is not offered — the summary line says it better', () => {
    const rendered = render(<WatchSummaryCard workouts={[workout]} />);
    expect(byTestId(rendered, 'watch-attached-w1')).toHaveLength(0);
  });

  it('renders nothing when no workout is attached', () => {
    expect(render(<WatchSummaryCard workouts={[]} />).toJSON()).toBeNull();
  });
});

describe('HeartRateCard · Figma 265:2 › HeartRateCard', () => {
  const series = {
    offsets: Array.from({ length: 240 }, (_, i) => i * 5),
    values: Array.from({ length: 240 }, (_, i) => 110 + Math.round(40 * Math.abs(Math.sin(i / 6)))),
  };
  const model = { restingBpm: 54, maxBpm: 186 };
  const props = {
    series,
    model,
    startedAt: '2026-09-01T17:32:00.000Z',
    endedAt: '2026-09-01T18:36:00.000Z',
  };

  it('carries the headings and footnote the design specifies', () => {
    const text = allText(render(<HeartRateCard {...props} />));
    expect(text).toContain('Heart rate');
    expect(text).toContain('TIME IN ZONE');
    expect(text).toContain('Zones from your heart-rate reserve');
    expect(text).toContain('resting 54');
    expect(text).toContain('max 186');
  });

  it("headlines the workout's own avg/peak, not the series' — Figma 265:2 shows the same 142/171 as the summary tiles above it", () => {
    /* HealthKit averages every sample the Watch took; `series` is the
       downsampled copy we store, so deriving the header from it puts a
       different "avg HR" a few hundred pixels under WatchSummaryCard's. */
    const derived = allText(render(<HeartRateCard {...props} />));
    expect(derived).not.toContain('142 avg');

    const text = allText(render(<HeartRateCard {...props} avgBpm={142} peakBpm={171} />));
    expect(text).toContain('142 avg · 171 peak');
  });

  it('falls back to the series when the workout carries no statistic', () => {
    const text = allText(render(<HeartRateCard {...props} avgBpm={null} peakBpm={null} />));
    expect(text).toMatch(/\d+ avg · \d+ peak/);
  });

  it('lists zones from 5 down to 1, as the design does', () => {
    const text = allText(render(<HeartRateCard {...props} />));
    const order = ['Zone 5', 'Zone 4', 'Zone 3', 'Zone 2', 'Zone 1'].map((z) => text.indexOf(z));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('labels the lowest zone as open-ended and the highest as unbounded', () => {
    // Figma: "< 124 bpm" and "171+ bpm" — neither is a two-ended range.
    const text = allText(render(<HeartRateCard {...props} />));
    expect(text).toMatch(/< \d+ bpm/);
    expect(text).toMatch(/\d+\+ bpm/);
  });

  it('colours bars from the sequential ramp, never a rainbow', () => {
    /* Five ordered hues cannot be told apart on a light surface — 192
       candidates were tested and none passed. The ramp is one hue, and the
       zone is also the bar's height, so colour is redundant by design. */
    const rendered = render(<HeartRateCard {...props} />);
    const bars = rendered.root.findAll(
      (n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('heart-rate-bar-') && typeof n.type === 'string',
    );
    expect(bars.length).toBeGreaterThan(0);
    const ramp = Object.values(heartRateZoneColors);
    for (const bar of bars) {
      const flat = JSON.stringify(bar.props.style);
      expect(ramp.some((hex) => flat.toLowerCase().includes(hex.toLowerCase()))).toBe(true);
    }
  });

  it('shows the summary at rest and the moment while scrubbing', () => {
    const resting = allText(render(<HeartRateCard {...props} />));
    expect(resting).toMatch(/\d+ avg · \d+ peak/);
    act(() => tree?.unmount());
    const scrubbed = allText(render(<HeartRateCard {...props} selectedIndex={4} />));
    // Stationary readout: it replaces the summary in place rather than
    // floating over the bars.
    expect(scrubbed).toMatch(/\d+:\d+ ?(AM|PM)? · \d+ bpm · Zone \d/);
  });

  it('dims every bar but the scrubbed one', () => {
    const rendered = render(<HeartRateCard {...props} selectedIndex={3} />);
    const opacity = (i: number) =>
      JSON.stringify(byTestId(rendered, `heart-rate-bar-${i}`)[0]!.props.style);
    expect(opacity(3)).toContain('"opacity":1');
    expect(opacity(4)).toContain('0.32');
  });

  it('uses the plot geometry from the design tokens', () => {
    const rendered = render(<HeartRateCard {...props} />);
    const plot = JSON.stringify(byTestId(rendered, 'heart-rate-plot')[0]!.props.style);
    expect(plot).toContain(`"height":${heartRateChart.plotHeight}`);
    expect(plot).toContain(`"padding":${heartRateChart.plotPadding}`);
    expect(plot).toContain(`"gap":${heartRateChart.barGap}`);
  });

  it('renders nothing without a series', () => {
    expect(render(<HeartRateCard {...props} series={{ offsets: [], values: [] }} />).toJSON()).toBeNull();
  });

  it('agrees with the domain about where the bands fall', () => {
    // The card must not compute its own zones alongside the domain's.
    const bands = zoneBands(model);
    const text = allText(render(<HeartRateCard {...props} />));
    expect(text).toContain(`${bands.find((b) => b.zone === 5)!.fromBpm}+ bpm`);
  });
});

describe('EffortByExerciseCard · Figma 265:2 › EffortByExerciseCard', () => {
  const efforts = [
    { exerciseName: 'Bench Press', avgBpm: 158, peakBpm: 174, setCount: 3 },
    { exerciseName: 'Incline DB Press', avgBpm: 149, peakBpm: 163, setCount: 3 },
    { exerciseName: 'Triceps Pushdown', avgBpm: 116, peakBpm: 127, setCount: 3 },
  ];

  it('carries the design heading and caption', () => {
    const text = allText(render(<EffortByExerciseCard efforts={efforts} />));
    expect(text).toContain('Effort by exercise');
    expect(text).toContain('Average heart rate while you were working each lift.');
    expect(text).toContain('Bar is average, tick is peak, both from 0 bpm so the lengths compare.');
  });

  it('states the spread between hardest and easiest', () => {
    // Figma: "Bench cost 42 bpm more than pushdowns".
    expect(allText(render(<EffortByExerciseCard efforts={efforts} />))).toContain('42 bpm more');
  });

  it('sizes each bar from its own number, on one zero-based scale', () => {
    /* The bars once used eyeballed fractions that did not match the numbers
       printed beside them — a chart contradicting its own labels. */
    const rendered = render(<EffortByExerciseCard efforts={efforts} />);
    /* Selected by testID rather than by shape: the bar's style is an array,
       so the first node with a plain `style.width` is the gap spacer. */
    const widths = efforts.map((e) => {
      const bar = byTestId(rendered, `effort-bar-${e.exerciseName}`)[0]!;
      const flat = ([] as Record<string, unknown>[]).concat(bar.props.style);
      return flat.reduce<number | undefined>(
        (found, layer) => (typeof layer?.width === 'number' ? (layer.width as number) : found),
        undefined,
      )!;
    });
    const scale = Math.max(...efforts.map((e) => e.peakBpm));
    efforts.forEach((e, i) => {
      expect(widths[i]).toBeCloseTo((e.avgBpm / scale) * effortChart.maxBarWidth, 1);
    });
  });

  it('renders nothing when no exercise could be aligned', () => {
    expect(render(<EffortByExerciseCard efforts={[]} />).toJSON()).toBeNull();
  });
});

describe('WatchAttachCard · Figma Watch-Live 2 · Found at finish', () => {
  const candidate = (over: Record<string, unknown> = {}) => ({
    relation: 'overlaps' as const,
    workout: {
      externalId: 'hk-lift',
      appleType: 50,
      activityType: 'other' as const,
      title: 'Traditional Strength Training',
      startedAt: '2026-09-01T17:32:00.000Z',
      endedAt: '2026-09-01T18:36:00.000Z',
      durationSeconds: 3840,
      distanceValue: null,
      distanceUnit: null,
      caloriesKcal: 612,
      avgHeartRateBpm: 142,
      peakHeartRateBpm: 171,
      ...over,
    },
  });

  it('offers rather than assumes', () => {
    const text = allText(
      render(
        <WatchAttachCard candidates={[candidate()]} onAttach={jest.fn()} onAttachAll={jest.fn()} />,
      ),
    );
    expect(text).toContain('Your Watch recorded a workout');
    expect(text).toContain('They overlap this session or follow it closely.');
    expect(text).toContain('Attach');
  });

  it('badges how each one relates to the session', () => {
    /* "After" is the difference between the lift and the walk home, and the
       user is the one who knows which counts. */
    const after = { ...candidate(), relation: 'after' as const };
    const text = allText(
      render(
        <WatchAttachCard
          candidates={[candidate(), { ...after, workout: { ...after.workout, externalId: 'hk-walk', title: 'Walk' } }]}
          onAttach={jest.fn()}
          onAttachAll={jest.fn()}
        />,
      ),
    );
    expect(text).toContain('Overlaps');
    expect(text).toContain('After');
  });

  it("puts each tile's numbers on it — Figma 229:21 shows '142 bpm avg  171 peak  612 kcal'", () => {
    /* The tiles are what you decide from; a title and a clock time are not
       enough to tell your lift from someone else's on a shared Watch. */
    const text = allText(
      render(
        <WatchAttachCard candidates={[candidate()]} onAttach={jest.fn()} onAttachAll={jest.fn()} />,
      ),
    );
    expect(text).toContain('142 bpm avg');
    expect(text).toContain('171 peak');
    expect(text).toContain('612 kcal');
  });

  it('omits the metrics a workout has none of, rather than printing a dash', () => {
    const bare = candidate({ avgHeartRateBpm: null, peakHeartRateBpm: null, caloriesKcal: null });
    const text = allText(
      render(<WatchAttachCard candidates={[bare]} onAttach={jest.fn()} onAttachAll={jest.fn()} />),
    );
    expect(text).not.toContain('bpm avg');
    expect(text).not.toContain('kcal');
    expect(text).toContain('Traditional Strength Training');
  });

  it('carries no per-tile Attach button — the design puts the actions in one row at the foot', () => {
    const rendered = render(
      <WatchAttachCard
        candidates={[candidate(), { ...candidate(), workout: { ...candidate().workout, externalId: 'hk-2' } }]}
        onAttach={jest.fn()}
        onAttachAll={jest.fn()}
      />,
    );
    expect(byTestId(rendered, 'attach-one-hk-lift')).toHaveLength(0);
    expect(byTestId(rendered, 'attach-all')).toHaveLength(1);
    expect(byTestId(rendered, 'attach-choose')).toHaveLength(1);
  });

  it('collapses to a single Attach when there is only one — choosing among one is not a choice', () => {
    const onAttach = jest.fn();
    const one = render(
      <WatchAttachCard candidates={[candidate()]} onAttach={onAttach} onAttachAll={jest.fn()} />,
    );
    expect(byTestId(one, 'attach-choose')).toHaveLength(0);
    const text = allText(one);
    expect(text).toContain('Attach');
    expect(text).not.toContain('Attach all');

    act(() => {
      one.root
        .findAll((n) => n.props?.testID === 'attach-all' && typeof n.props?.onPress === 'function')[0]!
        .props.onPress();
    });
    expect(onAttach).toHaveBeenCalledTimes(1);
  });

  it('Choose attaches only what was picked', () => {
    /* Figma 230:56: Choose exists because a Watch workout inside your
       session might be someone else's data on a shared device. */
    const onAttach = jest.fn();
    const onAttachAll = jest.fn();
    const two = [
      candidate(),
      { ...candidate(), workout: { ...candidate().workout, externalId: 'hk-2', title: 'Walk' } },
    ];
    const rendered = render(
      <WatchAttachCard candidates={two} onAttach={onAttach} onAttachAll={onAttachAll} />,
    );

    const press = (testID: string) =>
      act(() => {
        rendered.root
          .findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0]!
          .props.onPress();
      });

    press('attach-choose');
    /* Nothing picked yet, so the confirm is genuinely disabled — a
       Pressable in that state passes no onPress to its host view, so it
       cannot be tapped at all rather than tapping to no effect. */
    const confirm = byTestId(rendered, 'attach-chosen')[0]!;
    expect(confirm.props.accessibilityState).toMatchObject({ disabled: true });
    expect(typeof confirm.props.onPress).not.toBe('function');
    expect(onAttach).not.toHaveBeenCalled();

    press('attach-candidate-hk-2');
    press('attach-chosen');
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0]![0].workout.externalId).toBe('hk-2');
    expect(onAttachAll).not.toHaveBeenCalled();
  });

  it('Cancel leaves the choice without attaching anything', () => {
    const onAttach = jest.fn();
    const two = [
      candidate(),
      { ...candidate(), workout: { ...candidate().workout, externalId: 'hk-2' } },
    ];
    const rendered = render(
      <WatchAttachCard candidates={two} onAttach={onAttach} onAttachAll={jest.fn()} />,
    );
    const press = (testID: string) =>
      act(() => {
        rendered.root
          .findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === 'function')[0]!
          .props.onPress();
      });
    press('attach-choose');
    press('attach-candidate-hk-2');
    press('attach-cancel');
    expect(onAttach).not.toHaveBeenCalled();
    // Back to the offer, not stuck in selection.
    expect(byTestId(rendered, 'attach-all')).toHaveLength(1);
  });

  it('offers Dismiss on each candidate, the way Today does', () => {
    /* Today's suggestion pairs its action with a subtle Dismiss. Dismissing
       removes nothing — it only stops us asking again today — so it never
       wears a destructive treatment. */
    const onDismiss = jest.fn();
    const rendered = render(
      <WatchAttachCard
        candidates={[candidate()]}
        onAttach={jest.fn()}
        onAttachAll={jest.fn()}
        onDismiss={onDismiss}
      />,
    );
    expect(allText(rendered)).toContain('Dismiss');
    act(() => {
      rendered.root
        .findAll((n) => n.props?.testID === 'attach-dismiss-hk-lift' && typeof n.props?.onPress === 'function')[0]!
        .props.onPress();
    });
    expect(onDismiss).toHaveBeenCalledWith('hk-lift');
  });

  it('hides Dismiss while choosing, where a tap means pick', () => {
    const rendered = render(
      <WatchAttachCard
        candidates={[candidate(), { ...candidate(), workout: { ...candidate().workout, externalId: 'hk-2' } }]}
        onAttach={jest.fn()}
        onAttachAll={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expect(byTestId(rendered, 'attach-dismiss-hk-lift')).toHaveLength(1);
    act(() => {
      rendered.root
        .findAll((n) => n.props?.testID === 'attach-choose' && typeof n.props?.onPress === 'function')[0]!
        .props.onPress();
    });
    expect(byTestId(rendered, 'attach-dismiss-hk-lift')).toHaveLength(0);
  });

  it('renders nothing when there is nothing to offer', () => {
    // The no-Watch day shows no empty card, per frame 5.
    expect(
      render(<WatchAttachCard candidates={[]} onAttach={jest.fn()} onAttachAll={jest.fn()} />).toJSON(),
    ).toBeNull();
  });
});
